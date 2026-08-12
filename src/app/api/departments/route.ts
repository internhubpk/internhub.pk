import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateDepartmentSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Department,
  UserRole,
} from "@/types";

// Roles that can view departments
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
];

// Roles that can create departments
const CREATE_ROLES: UserRole[] = ["super_admin", "university_admin"];

/**
 * GET /api/departments
 * List departments - university-scoped
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Authenticate user (departments are role-restricted)
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
    const filters = filterResult.success ? filterResult.data : {};
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sort_by") || "name";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data
    let query = supabase
      .from("departments")
      .select(`
        *,
        universities:university_id(name, slug),
        heads:head_id(first_name, last_name),
        programs:programs(id, name, code)
      `, { count: "exact" });

    // Apply university scope based on role
    if (
      ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
        profile.role
      ) &&
      profile.university_id
    ) {
      query = query.eq("university_id", profile.university_id);
    }

    // Students see their department and other departments in their university
    if (profile.role === "student" && profile.university_id) {
      query = query.eq("university_id", profile.university_id);
    }

    // Apply additional filters
    if (filters.university_id) {
      if (profile.role !== "super_admin") {
        // Non-super-admins can only access their own university
        if (filters.university_id !== profile.university_id) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Cannot access departments from another university" },
            { status: 403 }
          );
        }
      }
      query = query.eq("university_id", filters.university_id);
    }

    if (filters.department_id) {
      query = query.eq("id", filters.department_id);
    }

    // Apply search filter on name and code
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
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

    const { data: departments, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching departments:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch departments" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Department> = {
      data: departments as unknown as Department[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Department>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/departments:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/departments
 * Create department - University Admin only
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
        { success: false, error: "Forbidden: University Admin access required to create departments" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateDepartmentSchema.safeParse(body);

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

    const departmentData = validation.data;

    // University admins can only create departments in their own university
    if (profile.role === "university_admin") {
      if (departmentData.university_id !== profile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot create department in another university" },
          { status: 403 }
        );
      }
    }

    // Verify university exists
    const { data: university } = await supabase
      .from("universities")
      .select("id")
      .eq("id", departmentData.university_id)
      .eq("is_active", true)
      .single();

    if (!university) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced university does not exist or is not active" },
        { status: 400 }
      );
    }

    // Check if department code already exists in this university
    const { data: existingDept } = await supabase
      .from("departments")
      .select("id")
      .eq("code", departmentData.code)
      .eq("university_id", departmentData.university_id)
      .single();

    if (existingDept) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A department with this code already exists in this university" },
        { status: 409 }
      );
    }

    // If head_id is provided, verify it's a valid user in this university
    if (departmentData.head_id) {
      const { data: headProfile } = await supabase
        .from("profiles")
        .select("id, university_id, role")
        .eq("id", departmentData.head_id)
        .single();

      if (!headProfile) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Referenced department head not found" },
          { status: 400 }
        );
      }

      if (headProfile.university_id !== departmentData.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Department head must be from the same university" },
          { status: 400 }
        );
      }
    }

    // Create department
    const { data: department, error } = await supabase
      .from("departments")
      .insert({
        ...departmentData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating department:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A department with this code already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create department" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Department>>({
      success: true,
      data: department as Department,
      message: "Department created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/departments:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
