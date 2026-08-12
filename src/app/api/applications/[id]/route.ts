import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { UpdateApplicationStatusSchema } from "@/lib/validations";
import type {
  ApiResponse,
  InternshipApplication,
  UserRole,
} from "@/types";

// Roles that can view application details
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

// Roles that can update application status
const REVIEW_ROLES: UserRole[] = ["company_hr", "university_admin", "super_admin"];

/**
 * GET /api/applications/[id]
 * Get application details by ID
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
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !VIEW_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch application with full details
    const { data: application, error } = await supabase
      .from("internship_applications")
      .select(`
        *,
        internships:internship_id(
          *,
          companies:company_id(*),
          universities:university_id(name)
        ),
        students:student_id(
          *,
          profiles:user_id(*),
          departments:department_id(name),
          programs:program_id(name)
        )
      `)
      .eq("id", id)
      .single();

    if (error || !application) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // Check access permissions based on role
    const app = application as unknown as InternshipApplication & {
      internships: { company_id: string; universities: { name: string } };
      students: { user_id: string; university_id: string };
    };

    let hasAccess = profile.role === "super_admin";

    if (!hasAccess && profile.role === "student") {
      // Students can only view their own applications
      hasAccess = app.students?.user_id === user.id;
    }

    if (!hasAccess && profile.role === "company_hr") {
      // Company HR can view applications for their company's internships
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", app.internships?.company_id)
        .in("role", ["admin", "hr"])
        .single();
      hasAccess = !!companyUser;
    }

    if (
      !hasAccess &&
      ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
        profile.role!
      )
    ) {
      // University staff can view applications for their university
      hasAccess =
        app.students?.university_id === profile.university_id ||
        app.internships?.universities?.name !== undefined;
    }

    if (!hasAccess) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Cannot access this application" },
        { status: 403 }
      );
    }

    return NextResponse.json<ApiResponse<InternshipApplication>>({
      success: true,
      data: application as unknown as InternshipApplication,
    });
  } catch (error) {
    console.error("Error in GET /api/applications/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/applications/[id]
 * Update application status - Company HR or University Admin
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

    if (!profile || !REVIEW_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions to review applications" },
        { status: 403 }
      );
    }

    // Check if application exists
    const { data: existingApp } = await supabase
      .from("internship_applications")
      .select(`
        *,
        internships:internship_id(company_id, universities:university_id(id))
      `)
      .eq("id", id)
      .single();

    if (!existingApp) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateApplicationStatusSchema.safeParse(body);

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

    // Validate status transitions
    const currentStatus = existingApp.status;
    const newStatus = updateData.status;

    const validTransitions: Record<string, string[]> = {
      pending: ["under_review", "approved", "rejected", "withdrawn"],
      under_review: ["approved", "rejected", "withdrawn"],
      approved: [],
      rejected: ["pending"], // Allow re-submission
      withdrawn: ["pending"], // Allow re-application
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // Check reviewer permissions for this application
    const appInternship = existingApp as unknown as {
      internships: { company_id: string; universities: { id: string } };
    };

    if (profile.role === "company_hr") {
      // Company HR can only approve/reject (not withdraw)
      if (newStatus === "withdrawn") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Company HR cannot withdraw applications" },
          { status: 403 }
        );
      }

      // Verify they belong to the internship's company
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", appInternship.internships.company_id)
        .in("role", ["admin", "hr"])
        .single();

      if (!companyUser) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You don't have permission to review this application" },
          { status: 403 }
        );
      }

      // Set company response
      updateData.company_response = updateData.company_response || "";
    }

    if (profile.role === "university_admin") {
      // University admin sets university response
      updateData.university_response = updateData.university_response || "";
    }

    // Build update object
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    };

    if (updateData.company_response !== undefined) {
      updatePayload.company_response = updateData.company_response;
    }
    if (updateData.university_response !== undefined) {
      updatePayload.university_response = updateData.university_response;
    }

    // Update application
    const { data: updatedApp, error } = await supabase
      .from("internship_applications")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating application:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update application" },
        { status: 500 }
      );
    }

    // If approved, optionally create student_internship record
    if (newStatus === "approved") {
      // Check if student_internship already exists
      const { data: existingSI } = await supabase
        .from("student_internships")
        .select("id")
        .eq("application_id", id)
        .single();

      if (!existingSI) {
        // Get internship details for creating student_internship
        const { data: internship } = await supabase
          .from("internships")
          .select("*")
          .eq("id", existingApp.internship_id)
          .single();

        if (internship) {
          await supabase.from("student_internships").insert({
            student_id: existingApp.student_id,
            internship_id: existingApp.internship_id,
            application_id: id,
            start_date: internship.start_date || new Date().toISOString(),
            end_date:
              internship.end_date ||
              new Date(
                Date.now() + internship.duration_weeks * 7 * 24 * 60 * 60 * 1000
              ).toISOString(),
            status: "active",
            progress_percentage: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json<ApiResponse<InternshipApplication>>({
      success: true,
      data: updatedApp as InternshipApplication,
      message: `Application ${newStatus} successfully`,
    });
  } catch (error) {
    console.error("Error in PUT /api/applications/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
