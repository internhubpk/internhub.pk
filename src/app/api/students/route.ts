import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateStudentSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Student,
  UserRole,
} from "@/types";

// Roles that can view students
const VIEW_STUDENT_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
];

// Roles that can create students
const CREATE_STUDENT_ROLES: UserRole[] = ["super_admin", "university_admin"];

/**
 * GET /api/students
 * List students - filtered by university/department based on role
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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

    // Get user profile with role and university info
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !VIEW_STUDENT_ROLES.includes(profile.role as UserRole)) {
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
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build base query with joins for related data
    let query = supabase
      .from("students")
      .select(`
        *,
        profiles:user_id(first_name, last_name, email),
        departments:department_id(name, code),
        programs:program_id(name, code)
      `, { count: "exact" });

    // Apply role-based filtering
    if (profile.role === "university_admin" && profile.university_id) {
      query = query.eq("university_id", profile.university_id);
    } else if (profile.role === "department_coordinator" && profile.department_id) {
      query = query.eq("department_id", profile.department_id);
    } else if (
      profile.role === "faculty_supervisor" &&
      profile.university_id
    ) {
      query = query.eq("university_id", profile.university_id);
    }

    // Apply additional filters
    if (filters.university_id) {
      query = query.eq("university_id", filters.university_id);
    }
    if (filters.department_id) {
      query = query.eq("department_id", filters.department_id);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Apply search filter
    if (search) {
      query = query.or(`enrollment_number.ilike.%${search}%`);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: students, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching students:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch students" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Student> = {
      data: students as unknown as Student[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Student>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/students:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students
 * Register new student - Uni Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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

    if (!profile || !CREATE_STUDENT_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin access required" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateStudentSchema.safeParse(body);

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

    const studentData = validation.data;

    // Uni admins can only create students in their own university
    if (profile.role === "university_admin") {
      if (studentData.university_id !== profile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot create student in another university" },
          { status: 403 }
        );
      }
    }

    // Check if enrollment number is unique within the university
    const { data: existingEnrollment } = await supabase
      .from("students")
      .select("id")
      .eq("enrollment_number", studentData.enrollment_number)
      .eq("university_id", studentData.university_id)
      .single();

    if (existingEnrollment) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A student with this enrollment number already exists" },
        { status: 409 }
      );
    }

    // Verify that the referenced entities exist
    const [universityCheck, departmentCheck, programCheck] = await Promise.all([
      supabase.from("universities").select("id").eq("id", studentData.university_id).single(),
      supabase.from("departments").select("id").eq("id", studentData.department_id).single(),
      supabase.from("programs").select("id").eq("id", studentData.program_id).single(),
    ]);

    if (!universityCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced university does not exist" },
        { status: 400 }
      );
    }
    if (!departmentCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced department does not exist" },
        { status: 400 }
      );
    }
    if (!programCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced program does not exist" },
        { status: 400 }
      );
    }

    // Create student
    const { data: student, error } = await supabase
      .from("students")
      .insert({
        ...studentData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating student:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Student with this enrollment number already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create student" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Student>>({
      success: true,
      data: student as Student,
      message: "Student registered successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/students:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
