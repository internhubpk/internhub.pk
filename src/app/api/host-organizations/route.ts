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
import type { ApiResponse, PaginatedResponse, UserRole } from "@/types";
import { z } from "zod";

// ============ ZOD VALIDATION SCHEMAS ============

const CreateHostOrganizationSchema = z.object({
  name: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(200),
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
    .default(10),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

const UpdateHostOrganizationSchema = CreateHostOrganizationSchema.partial();

const HostOrgFilterSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  is_verified: z.enum(["true", "false"]).optional(),
  is_active: z.enum(["true", "false"]).optional(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Roles that can view host organizations
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
];

// Roles that can create host organizations
const CREATE_ROLES: UserRole[] = ["super_admin", "university_admin"];

// Roles that can manage (update/delete) host organizations
const MANAGE_ROLES: UserRole[] = ["super_admin", "university_admin"];

/**
 * GET /api/host-organizations
 * List host organizations - university-scoped
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // For public listings, allow unauthenticated access with limited data
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    const filterResult = HostOrgFilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const filters = filterResult.success ? filterResult.data : HostOrgFilterSchema.parse({});
    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;
    const sortBy = searchParams.get("sort_by") || "name";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build base query
    let query = supabase
      .from("host_organizations")
      .select("*", { count: "exact" });

    // Authenticated users get role-based filtering
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, university_id")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        // University staff see host organizations associated with their university
        if (
          ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
            profile.role
          ) &&
          profile.university_id
        ) {
          query = query.eq("university_id", profile.university_id);
        }

        // Students see verified, active host organizations for their university
        if (profile.role === "student" && profile.university_id) {
          query = query
            .eq("university_id", profile.university_id)
            .eq("is_verified", true)
            .eq("is_active", true);
        }
      }
    } else {
      // Unauthenticated users see only verified, active orgs
      query = query.eq("is_verified", true).eq("is_active", true);
    }

    // Apply additional filters
    if (filters.industry) {
      query = query.ilike("industry", `%${filters.industry}%`);
    }

    if (filters.is_verified === "true") {
      query = query.eq("is_verified", true);
    } else if (filters.is_verified === "false") {
      query = query.eq("is_verified", false);
    }

    if (filters.is_active === "true") {
      query = query.eq("is_active", true);
    } else if (filters.is_active === "false") {
      query = query.eq("is_active", false);
    }

    // Apply search filter on name and description
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: organizations, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching host organizations:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch host organizations" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<typeof organizations[0]> = {
      data: organizations || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<typeof organizations[0]>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/host-organizations:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/host-organizations
 * Add a new host organization (University Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Authenticate user
    const authContext = await requireAuth();

    // Check user role - only super admin and university admin can create
    if (!CREATE_ROLES.includes(authContext.profile?.role as UserRole)) {
      return authorizationError("Insufficient permissions to create host organizations");
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateHostOrganizationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    const orgData = validation.data;

    // Determine university ID based on role
    let universityId: string;

    if (authContext.profile?.role === "super_admin") {
      // Super admin must provide university_id or it's platform-level
      universityId = ""; // Will be handled differently for super admin
    } else {
      // University admin uses their own university
      universityId = authContext.profile!.university_id!;
      
      if (!universityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "No university assigned to your account" },
          { status: 400 }
        );
      }
    }

    // Check if organization name already exists in this university
    const existingQuery = supabase
      .from("host_organizations")
      .select("id")
      .eq("name", orgData.name);

    if (universityId) {
      existingQuery.eq("university_id", universityId);
    }

    const { data: existingOrg } = await existingQuery.single();

    if (existingOrg) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "An organization with this name already exists" },
        { status: 409 }
      );
    }

    // Create the host organization
    const insertData: Record<string, any> = {
      ...orgData,
      university_id: universityId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: organization, error } = await supabase
      .from("host_organizations")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating host organization:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "An organization with this name already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create host organization" },
        { status: 500 }
      );
    }

    // Log the audit entry
    await audit.companyCreate(organization!.id, universityId);

    return NextResponse.json<ApiResponse<typeof organization>>({
      success: true,
      data: organization,
      message: "Host organization created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/host-organizations:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
