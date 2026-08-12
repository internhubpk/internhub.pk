import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateStudentSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import {
  requireAuth,
  requireUniversityAccess,
  requireRole,
  hasPermission,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import { validateTenantOwnership } from "@/lib/tenant-server";
import { audit } from "@/lib/audit";
import { sanitizeInput, extractClientInfo, validatePaginationParams } from "@/lib/api-security";
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

// Allowed sort fields to prevent SQL injection
const ALLOWED_SORT_FIELDS = [
  "created_at",
  "updated_at",
  "cgpa",
  "student_id_number",
] as const;

/**
 * Validate and sanitize sort parameters
 */
function validateSortParam(sortBy: string | null, sortOrder: string | null): {
  sortBy: typeof ALLOWED_SORT_FIELDS[number];
  ascending: boolean;
} {
  const validSort = ALLOWED_SORT_FIELDS.includes(sortBy as any)
    ? (sortBy as typeof ALLOWED_SORT_FIELDS[number])
    : "created_at";
  
  return {
    sortBy: validSort,
    ascending: sortOrder === "asc",
  };
}

/**
 * GET /api/students
 * List students - filtered by university/department based on role
 * SECURITY: University-scoped queries, department coordinator restrictions
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get context with university access verification
    const authContext = await requireAuth();
    
    if (!authContext.profile || !VIEW_STUDENT_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to view students");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    const filterResult = FilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    // Validate pagination bounds
    const validatedPagination = validatePaginationParams(searchParams);
    const page = paginationResult.success ? paginationResult.data.page : validatedPagination.page;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : validatedPagination.pageSize;
    const filters = filterResult.success ? filterResult.data : FilterSchema.parse({});
    
    // Sanitize search input to prevent XSS/injection
    const search = searchParams.get("search") ? sanitizeInput(searchParams.get("search")!) : null;
    // NOTE: a `status` query param is accepted for backwards-compat but ignored —
    // the `students` table has no `status` column.
    const programIdFilter = searchParams.get("program_id");
    
    // Validate sort parameters
    const { sortBy, ascending } = validateSortParam(
      searchParams.get("sort_by"),
      searchParams.get("sort_order")
    );

    // Build base query with joins for related data
    let query = supabase
      .from("students")
      .select(`
        *,
        profiles:user_id(first_name, last_name, email),
        departments:department_id(name, code),
        programs:program_id(name, code)
      `, { count: "exact" });

    // Apply role-based filtering with university access enforcement
    const userRole = authContext.profile.role;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    if (userRole === "super_admin") {
      // Super admins can see all students, but respect explicit university filter
      if (filters.university_id) {
        query = query.eq("university_id", filters.university_id);
      }
    } else if (userRole === "university_admin" && userUniversityId) {
      // University admins can only see their university's students
      query = query.eq("university_id", userUniversityId);
      
      // Security: Prevent accessing other universities even if filter is provided
      if (filters.university_id && filters.university_id !== userUniversityId) {
        // Silently ignore the filter - don't expose error that could leak info
        console.warn(`User ${authContext.user?.id} attempted to access different university`);
      }
    } else if (userRole === "department_coordinator") {
      // Department coordinators can ONLY see their department's students
      if (userDepartmentId) {
        query = query.eq("department_id", userDepartmentId);
        
        // Also enforce university scope
        if (userUniversityId) {
          query = query.eq("university_id", userUniversityId);
        }
      } else {
        // Department coordinator without department assignment gets empty results
        return NextResponse.json<ApiResponse<PaginatedResponse<Student>>>({
          success: true,
          data: {
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          },
        });
      }
    } else if (userRole === "faculty_supervisor" && userUniversityId) {
      // Faculty supervisors see their university's students
      query = query.eq("university_id", userUniversityId);
    } else {
      // Other roles get empty results or denied
      return authorizationError("Insufficient permissions");
    }

    // Apply additional filters (only if not already restricted by role)
    if (programIdFilter) {
      query = query.eq("program_id", programIdFilter);
    }

    // Apply sanitized search filter
    if (search) {
      // Use parameterized-like approach with ilike
      query = query.or(`student_id_number.ilike.%${search}%`);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: students, error } = await query
      .order(sortBy, { ascending })
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
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    if (error instanceof Error && error.message.includes("Access denied")) {
      return authorizationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students
 * Register new student - Uni Admin only
 * SECURITY: Validates university ownership, logs audit trail
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication and appropriate role
    const authContext = await requireRole(CREATE_STUDENT_ROLES);
    
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateStudentSchema.safeParse(body);

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

    const studentData = validation.data;

    // SECURITY: Validate that university_id matches authenticated user's university
    const userRole = authContext.profile?.role;
    const userUniversityId = authContext.profile?.university_id;

    if (userRole === "university_admin") {
      // Uni admins can ONLY create students in their own university
      if (!userUniversityId) {
        return authorizationError("No university assigned to your account");
      }
      
      if (studentData.university_id !== userUniversityId) {
        // Audit log this security violation attempt
        await audit.studentCreate(
          "unknown",
          studentData.university_id
        );
        
        return authorizationError("Cannot create student in another university");
      }
      
      // Override with user's university ID for extra security
      studentData.university_id = userUniversityId;
    }

    // For super admins, verify the university exists
    if (userRole === "super_admin") {
      const { data: university } = await supabase
        .from("universities")
        .select("id")
        .eq("id", studentData.university_id)
        .single();

      if (!university) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Referenced university does not exist" },
          { status: 400 }
        );
      }
    }

    // Check if student_id_number is unique within the university
    const { data: existingEnrollment } = await supabase
      .from("students")
      .select("user_id")
      .eq("student_id_number", studentData.student_id_number)
      .eq("university_id", studentData.university_id)
      .maybeSingle();

    if (existingEnrollment) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A student with this student ID number already exists" },
        { status: 409 }
      );
    }

    // Verify that the referenced entities exist and belong to same university
    const [departmentCheck, programCheck] = await Promise.all([
      supabase
        .from("departments")
        .select("id, university_id")
        .eq("id", studentData.department_id)
        .single(),
      supabase
        .from("programs")
        .select("id, university_id")
        .eq("id", studentData.program_id)
        .single(),
    ]);

    // SECURITY: Verify department belongs to the same university
    if (!departmentCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced department does not exist" },
        { status: 400 }
      );
    }
    
    if (departmentCheck.data.university_id !== studentData.university_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Department does not belong to the specified university" },
        { status: 400 }
      );
    }

    if (!programCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced program does not exist" },
        { status: 400 }
      );
    }

    // Get client info for audit log
    const clientInfo = extractClientInfo(request);

    // Create student
    const { data: student, error } = await supabase
      .from("students")
      .insert({
        user_id: studentData.user_id,
        university_id: studentData.university_id,
        department_id: studentData.department_id,
        program_id: studentData.program_id,
        student_id_number: studentData.student_id_number,
        enrollment_year: studentData.enrollment_year,
        expected_graduation: studentData.expected_graduation,
        cgpa: studentData.cgpa,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating student:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Student with this student ID number already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create student" },
        { status: 500 }
      );
    }

    // AUDIT LOG: Log student creation for compliance
    await audit.studentCreate(student!.user_id, studentData.university_id);

    return NextResponse.json<ApiResponse<Student>>({
      success: true,
      data: student as Student,
      message: "Student registered successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/students:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    if (error instanceof Error && (error.message.includes("role") || error.message.includes("Access"))) {
      return authorizationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
