import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { UpdateUniversitySchema } from "@/lib/validations";
import type { ApiResponse, University, UserRole } from "@/types";

// Roles that can view university details
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
];

/**
 * GET /api/universities/[id]
 * Get university details by ID
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

    // Check user role
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

    // Fetch university
    const { data: university, error } = await supabase
      .from("universities")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !university) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "University not found" },
        { status: 404 }
      );
    }

    // Non-super-admins can only view their own university
    if (profile.role !== "super_admin" && profile.university_id !== id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Cannot access this university" },
        { status: 403 }
      );
    }

    return NextResponse.json<ApiResponse<University>>({
      success: true,
      data: university as University,
    });
  } catch (error) {
    console.error("Error in GET /api/universities/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/universities/[id]
 * Update university - Super Admin only (or own university for Uni Admin)
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

    // Check user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Super admin can update any university, uni admin can only update their own
    if (
      profile.role !== "super_admin" &&
      !(profile.role === "university_admin" && profile.university_id === id)
    ) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      );
    }

    // Check if university exists
    const { data: existing } = await supabase
      .from("universities")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "University not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateUniversitySchema.safeParse(body);

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

    // If slug is being updated, check uniqueness
    if (validation.data.slug) {
      const { data: existingSlug } = await supabase
        .from("universities")
        .select("id")
        .eq("slug", validation.data.slug)
        .neq("id", id)
        .single();

      if (existingSlug) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A university with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // Update university
    const { data: university, error } = await supabase
      .from("universities")
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating university:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "University with this name or slug already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update university" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<University>>({
      success: true,
      data: university as University,
      message: "University updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/universities/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/universities/[id]
 * Soft delete university - Super Admin only
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

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Super Admin access required" },
        { status: 403 }
      );
    }

    // Check if university exists
    const { data: existing } = await supabase
      .from("universities")
      .select("id, is_active")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "University not found" },
        { status: 404 }
      );
    }

    // Soft delete by setting is_active to false and updating slug
    const deletedSlug = `deleted_${id}_${Date.now()}`;
    const { error } = await supabase
      .from("universities")
      .update({
        is_active: false,
        slug: deletedSlug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error deleting university:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to delete university" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: true,
        message: "University deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/universities/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
