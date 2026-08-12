import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { UpdateInternshipSchema } from "@/lib/validations";
import type { ApiResponse, Internship, UserRole } from "@/types";

// Roles that can view internship details
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

/**
 * GET /api/internships/[id]
 * Get internship details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    const { id } = await params;

    // For public internships (published/active), allow unauthenticated access
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch internship with full details
    const { data: internship, error } = await supabase
      .from("internships")
      .select(`
        *,
        companies:company_id(*),
        universities:university_id(name, slug),
        creators:created_by(first_name, last_name)
      `)
      .eq("id", id)
      .single();

    if (error || !internship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Internship not found" },
        { status: 404 }
      );
    }

    // If not published/active and user is not authenticated, deny access
    if (!["published", "active"].includes(internship.status) && !user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This internship is not publicly available" },
        { status: 403 }
      );
    }

    // If user is authenticated, check role-based access for non-public internships
    if (user && !["published", "active"].includes(internship.status)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, university_id, department_id")
        .eq("user_id", user.id)
        .single();

      if (!profile || !VIEW_ROLES.includes(profile.role as UserRole)) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Forbidden: Insufficient permissions" },
          { status: 403 }
        );
      }

      // Check access based on role
      const hasAccess =
        profile.role === "super_admin" ||
        (profile.role === "company_hr" &&
          (await checkCompanyAccess(supabase, user.id, internship.company_id))) ||
        (profile.university_id === internship.university_id &&
          ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
            profile.role
          ));

      if (!hasAccess) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Forbidden: Cannot access this internship" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json<ApiResponse<Internship>>({
      success: true,
      data: internship as unknown as Internship,
    });
  } catch (error) {
    console.error("Error in GET /api/internships/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/internships/[id]
 * Update internship
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if internship exists
    const { data: existingInternship } = await supabase
      .from("internships")
      .select("*")
      .eq("id", id)
      .single();

    if (!existingInternship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Internship not found" },
        { status: 404 }
      );
    }

    // Check update permissions
    const canUpdate =
      profile.role === "super_admin" ||
      (profile.role === "company_hr" &&
        (await checkCompanyAccess(supabase, user.id, existingInternship.company_id))) ||
      (profile.role === "university_admin");

    if (!canUpdate) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Cannot update this internship" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateInternshipSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.errors[0]?.message,
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Validate date range if both dates are being updated
    if (
      (updateData.start_date || existingInternship.start_date) &&
      (updateData.end_date || existingInternship.end_date)
    ) {
      const start = new Date(updateData.start_date || existingInternship.start_date!);
      const end = new Date(updateData.end_date || existingInternship.end_date!);
      if (end <= start) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "End date must be after start date" },
          { status: 400 }
        );
      }
    }

    // Don't allow changing company or university once created
    if (updateData.company_id && updateData.company_id !== existingInternship.company_id) {
      delete updateData.company_id;
    }
    if (updateData.university_id && updateData.university_id !== existingInternship.university_id) {
      delete updateData.university_id;
    }

    // Update internship
    const { data: internship, error } = await supabase
      .from("internships")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating internship:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update internship" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Internship>>({
      success: true,
      data: internship as Internship,
      message: "Internship updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/internships/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/internships/[id]
 * Close/delete internship - Company HR or Super Admin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if internship exists
    const { data: existingInternship } = await supabase
      .from("internships")
      .select("*")
      .eq("id", id)
      .single();

    if (!existingInternship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Internship not found" },
        { status: 404 }
      );
    }

    // Check delete permissions
    const canDelete =
      profile.role === "super_admin" ||
      (profile.role === "company_hr" &&
        (await checkCompanyAccess(supabase, user.id, existingInternship.company_id)));

    if (!canDelete) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Cannot delete this internship" },
        { status: 403 }
      );
    }

    // Check if there are active applications or student internships
    const [{ count: applicationCount }, { count: activeInternshipCount }] = await Promise.all([
      supabase
        .from("internship_applications")
        .select("*", { count: "exact", head: true })
        .eq("internship_id", id)
        .in("status", ["pending", "under_review", "approved"]),
      supabase
        .from("student_internships")
        .select("*", { count: "exact", head: true })
        .eq("internship_id", id)
        .in("status", ["active"]),
    ]);

    // If there are active records, soft close instead of hard delete
    if ((applicationCount ?? 0) > 0 || (activeInternshipCount ?? 0) > 0) {
      const { error } = await supabase
        .from("internships")
        .update({
          status: "closed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("Error closing internship:", error);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Failed to close internship" },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse<never>>(
        {
          success: true,
          message: "Internship closed due to active applications or ongoing internships",
        },
        { status: 200 }
      );
    }

    // Hard delete if no active records
    const { error } = await supabase.from("internships").delete().eq("id", id);

    if (error) {
      console.error("Error deleting internship:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to delete internship" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: true,
        message: "Internship deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/internships/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Helper function to check if a user has access to a company's data
 */
async function checkCompanyAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  companyId: string
): Promise<boolean> {
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .in("role", ["admin", "hr"])
    .single();

  return !!companyUser;
}
