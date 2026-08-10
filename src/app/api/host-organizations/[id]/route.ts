import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  getServerAuthContext,
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import { audit } from "@/lib/audit";
import type { ApiResponse, UserRole } from "@/types";
import { z } from "zod";

// ============ ZOD VALIDATION SCHEMAS ============

const UpdateHostOrganizationSchema = z.object({
  name: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(200)
    .optional(),
  logo_url: z.string().url("Invalid URL format").optional(),
  industry: z.string().max(100).optional(),
  website: z.string().url("Invalid website URL").optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email("Invalid email format").optional(),
  description: z.string().max(2000).optional(),
  contact_person: z.string().max(100).optional(),
  contact_person_role: z.string().max(100).optional(),
  max_interns: z.number()
    .int("Max interns must be an integer")
    .min(1, "Must allow at least 1 intern")
    .max(500)
    .optional(),
  is_verified: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// Roles that can manage host organizations
const MANAGE_ROLES: UserRole[] = ["super_admin", "university_admin"];

/**
 * GET /api/host-organizations/[id]
 * Get a single host organization by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user (optional for public view of verified orgs)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { id } = await params;

    // Fetch host organization
    const { data: organization, error } = await supabase
      .from("host_organizations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !organization) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Host organization not found" },
        { status: 404 }
      );
    }

    // If not authenticated, only show verified and active organizations
    if (!user) {
      if (!organization.is_verified || !organization.is_active) {
        return authenticationError();
      }
      // Return limited data for unauthenticated users
      return NextResponse.json<ApiResponse<typeof organization>>({
        success: true,
        data: organization,
      });
    }

    // For authenticated users, check university access
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      // Non-super-admin users can only see their own university's organizations
      if (organization.university_id && organization.university_id !== profile?.university_id) {
        return authorizationError("Access denied to this organization");
      }
    }

    // Get related internship count
    const { count: activeInternshipCount } = await supabase
      .from("internships")
      .select("*", { count: "exact", head: true })
      .eq("company_id", id)
      .in("status", ["active"]);

    return NextResponse.json<ApiResponse<typeof organization & { 
      active_internships?: number 
    }>>({
      success: true,
      data: {
        ...organization,
        active_internships: activeInternshipCount || 0,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/host-organizations/[id]:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/host-organizations/[id]
 * Update a host organization
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate and authorize user
    const authContext = await requireAuth();

    // Check user role - only super admin and university admin can update
    if (!MANAGE_ROLES.includes(authContext.profile?.role as UserRole)) {
      return authorizationError("Insufficient permissions to update host organizations");
    }

    const { id } = await params;

    // Fetch existing organization
    const { data: existingOrg, error: fetchError } = await supabase
      .from("host_organizations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingOrg) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Host organization not found" },
        { status: 404 }
      );
    }

    // Check university access for non-super-admin users
    if (authContext.profile?.role !== "super_admin") {
      if (existingOrg.university_id !== authContext.profile?.university_id) {
        return authorizationError("Cannot update organization from another university");
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateHostOrganizationSchema.safeParse(body);

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

    // If changing name, check for duplicates
    if (updateData.name && updateData.name !== existingOrg.name) {
      const duplicateQuery = supabase
        .from("host_organizations")
        .select("id")
        .eq("name", updateData.name)
        .neq("id", id);

      if (existingOrg.university_id) {
        duplicateQuery.eq("university_id", existingOrg.university_id);
      }

      const { data: duplicate } = await duplicateQuery.single();

      if (duplicate) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "An organization with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Perform update
    const { data: updatedOrg, error: updateError } = await supabase
      .from("host_organizations")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating host organization:", updateError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update host organization" },
        { status: 500 }
      );
    }

    // Log audit entry for verification changes
    if (updateData.is_verified === true && !existingOrg.is_verified) {
      await audit.companyVerify(id, authContext.user!.id);
    }

    return NextResponse.json<ApiResponse<typeof updatedOrg>>({
      success: true,
      data: updatedOrg,
      message: "Host organization updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/host-organizations/[id]:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/host-organizations/[id]
 * Remove a host organization (soft delete or hard delete based on state)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate and authorize user
    const authContext = await requireAuth();

    // Only super admin can delete organizations
    if (authContext.profile?.role !== "super_admin") {
      return authorizationError("Only super administrators can delete host organizations");
    }

    const { id } = await params;

    // Fetch existing organization
    const { data: existingOrg, error: fetchError } = await supabase
      .from("host_organizations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingOrg) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Host organization not found" },
        { status: 404 }
      );
    }

    // Check if there are active internships with this organization
    const { count: activeInternships } = await supabase
      .from("internships")
      .select("*", { count: "exact", head: true })
      .eq("company_id", id)
      .in("status", ["active"]);

    if ((activeInternships || 0) > 0) {
      return NextResponse.json<ApiResponse<never>>(
        { 
          success: false, 
          error: "Cannot delete organization with active internships. Please complete or reassign internships first." 
        },
        { status: 400 }
      );
    }

    // Perform deletion
    const { error: deleteError } = await supabase
      .from("host_organizations")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting host organization:", deleteError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to delete host organization" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted: true },
      message: "Host organization deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/host-organizations/[id]:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
