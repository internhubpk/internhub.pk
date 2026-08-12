import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateSupervisorSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Supervisor,
  UserRole,
} from "@/types";

// Roles that can view supervisors
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
];

// Roles that can create supervisors
const CREATE_ROLES: UserRole[] = ["super_admin", "university_admin"];

/**
 * GET /api/supervisors
 * List supervisors - filtered by user role
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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

    // Get user profile with university info
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    const filterResult = FilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;
    const filters = filterResult.success ? filterResult.data : FilterSchema.parse({});
    const search = searchParams.get("search");
    const supervisorType = searchParams.get("type");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data
    let query = supabase
      .from("supervisors")
      .select(`
        *,
        universities:university_id(name, slug),
        departments:department_id(name, code),
        profiles:user_id(first_name, last_name, email, avatar_url)
      `, { count: "exact" });

    // Apply university scope based on role
    if (
      ["university_admin", "department_coordinator"].includes(profile.role) &&
      profile.university_id
    ) {
      query = query.eq("university_id", profile.university_id);
    }

    if (profile.role === "faculty_supervisor" && profile.university_id) {
      // Faculty supervisors can see other supervisors in their university
      query = query.eq("university_id", profile.university_id);
    }

    // Department coordinators further filter by their department
    if (
      profile.role === "department_coordinator" &&
      profile.department_id
    ) {
      query = query.eq("department_id", profile.department_id);
    }

    // Apply additional filters
    if (filters.university_id) {
      if (profile.role !== "super_admin") {
        if (filters.university_id !== profile.university_id) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Cannot access supervisors from another university" },
            { status: 403 }
          );
        }
      }
      query = query.eq("university_id", filters.university_id);
    }

    if (filters.department_id) {
      query = query.eq("department_id", filters.department_id);
    }

    // Filter by supervisor type
    if (supervisorType && ["faculty", "site", "external"].includes(supervisorType)) {
      query = query.eq("type", supervisorType);
    }

    // Apply search filter on name fields and specialization
    if (search) {
      // Search in related profiles table for names
      // This is a simplified approach - in production you might want a more sophisticated search
      query = query.or(
        `specialization.ilike.%${search}%,title.ilike.%${search}%`
      );
    }

    // Filter by active status
    const isActive = searchParams.get("is_active");
    if (isActive === "true") {
      query = query.eq("is_active", true);
    } else if (isActive === "false") {
      query = query.eq("is_active", false);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: supervisors, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching supervisors:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch supervisors" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Supervisor> = {
      data: supervisors as unknown as Supervisor[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Supervisor>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/supervisors:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/supervisors
 * Add supervisor - University Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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

    if (!profile || !CREATE_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin access required to add supervisors" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateSupervisorSchema.safeParse(body);

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

    const supervisorData = validation.data;

    // University admins can only add supervisors to their own university
    if (profile.role === "university_admin") {
      if (supervisorData.university_id !== profile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot add supervisor to another university" },
          { status: 403 }
        );
      }
    }

    // Verify university exists
    const { data: university } = await supabase
      .from("universities")
      .select("id")
      .eq("id", supervisorData.university_id)
      .eq("is_active", true)
      .single();

    if (!university) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced university does not exist or is not active" },
        { status: 400 }
      );
    }

    // Verify user exists and belongs to this university.
    // `profiles` uses `user_id` (no `id` column) — filter by user_id, not id.
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("user_id, university_id, role")
      .eq("user_id", supervisorData.user_id)
      .single();

    if (!userProfile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced user not found" },
        { status: 400 }
      );
    }

    if (
      userProfile.university_id &&
      userProfile.university_id !== supervisorData.university_id
    ) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "User must belong to the same university" },
        { status: 400 }
      );
    }

    // If department_id is provided, verify it's valid and in the same university
    if (supervisorData.department_id) {
      const { data: department } = await supabase
        .from("departments")
        .select("id, university_id")
        .eq("id", supervisorData.department_id)
        .single();

      if (!department) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Referenced department not found" },
          { status: 400 }
        );
      }

      if (department.university_id !== supervisorData.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Department must belong to the same university" },
          { status: 400 }
        );
      }
    }

    // Check if user is already a supervisor of the same type
    const { data: existingSupervisor } = await supabase
      .from("supervisors")
      .select("id")
      .eq("user_id", supervisorData.user_id)
      .eq("type", supervisorData.type)
      .eq("university_id", supervisorData.university_id)
      .single();

    if (existingSupervisor) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This user is already registered as a supervisor of this type" },
        { status: 409 }
      );
    }

    // Create supervisor
    const { data: supervisor, error } = await supabase
      .from("supervisors")
      .insert({
        ...supervisorData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating supervisor:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "This user is already a supervisor" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create supervisor" },
        { status: 500 }
      );
    }

    // Update user's role if they don't have an appropriate role yet
    const validRolesForType: Record<string, UserRole> = {
      faculty: "faculty_supervisor",
      site: "site_supervisor",
      external: "external_evaluator",
    };

    const expectedRole = validRolesForType[supervisorData.type];
    
    if (expectedRole && userProfile.role === "student") {
      // Don't automatically change student roles - they might be dual-role
      // Just log this case
      console.log(`User ${user.id} is a student but also being added as ${expectedRole}`);
    }

    return NextResponse.json<ApiResponse<Supervisor>>({
      success: true,
      data: supervisor as Supervisor,
      message: "Supervisor added successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/supervisors:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
