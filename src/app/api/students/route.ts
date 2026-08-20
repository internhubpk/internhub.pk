import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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
  "program_coordinator",
  "faculty_supervisor",
];

// Roles that can create students.
// IMPORTANT: department_coordinator is INTENTIONALLY EXCLUDED per InternHub
// spec section 14 — only program_coordinator (and higher) can create students.
// This is enforced server-side AND via RLS, not just by hiding UI buttons.
const CREATE_STUDENT_ROLES: UserRole[] = ["super_admin", "university_admin", "program_coordinator"];

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
    const departmentIdFilter = searchParams.get("department_id");
    
    // Validate sort parameters
    const { sortBy, ascending } = validateSortParam(
      searchParams.get("sort_by"),
      searchParams.get("sort_order")
    );

    // Build base query with joins for related data.
    // `faculty_supervisor_id` is included so the Students page can show the
    // currently-assigned supervisor inline (set via the assignment endpoint
    // — migration 0041 backstops this for students without an internship row).
    let query = supabase
      .from("students")
      .select(`
        *,
        profiles:user_id(first_name, last_name, email, is_active),
        departments:department_id(name, code),
        programs:program_id(name, code),
        faculty_supervisor:faculty_supervisor_id(first_name, last_name, email)
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

    // Department filter: for university_admin / super_admin / faculty_supervisor
    // (who can see students across the whole university), this narrows the
    // result to a single department. Department coordinators are already
    // restricted to their own department above, so this is a no-op for them.
    if (departmentIdFilter) {
      query = query.eq("department_id", departmentIdFilter);
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
 * Register new student - Uni Admin / Coordinator / Super Admin only.
 *
 * WHY SERVICE ROLE:
 *   The previous version used the cookie-bound (publishable key) client for
 *   the INSERT. This worked in most cases, but failed silently when RLS
 *   blocked the SELECT of the target user's profile (e.g., new auth user
 *   with NULL department_id in profile). The route would return a generic
 *   "Failed to create student" 500 error with no diagnostic info.
 *
 *   Now: we authenticate the caller with the cookie-bound client (read-only
 *   session check), but use the SERVICE ROLE client for the INSERT and all
 *   validation lookups. Service role bypasses RLS, so we can always read
 *   the target user's profile, verify department/program existence, and
 *   insert the student row reliably.
 *
 *   Authorization is enforced EXPLICITLY via requireRole + manual tenant
 *   scoping (university_id and department_id forced from caller's profile
 *   for coordinator/university_admin roles).
 *
 * SECURITY: Validates university ownership, logs audit trail
 */
export async function POST(request: NextRequest) {
  const requestId = `stu-post-${Date.now()}`;
  try {
    // Require authentication and appropriate role (uses cookie-bound client).
    const authContext = await requireRole(CREATE_STUDENT_ROLES);

    const userRole = authContext.profile?.role;
    const userUniversityId = authContext.profile?.university_id;
    const userDepartmentId = authContext.profile?.department_id;

    // Build service role client for all DB operations.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(`[${requestId}] SUPABASE_SERVICE_ROLE_KEY is not set`);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfiguration: service role key is not set" },
        { status: 500 }
      );
    }
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Parse and validate request body.
    const body = await request.json().catch(() => ({}));
    const validation = CreateStudentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.issues[0]?.message,
          details: validation.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const studentData = validation.data;

    // SECURITY: Validate + force tenant IDs based on caller role.
    if (userRole === "university_admin") {
      if (!userUniversityId) {
        return authorizationError("No university assigned to your account. Ask a super admin to assign you to a university.");
      }
      if (studentData.university_id !== userUniversityId) {
        await audit.studentCreate("unknown", studentData.university_id);
        return authorizationError("Cannot create student in another university");
      }
      studentData.university_id = userUniversityId;
    }

    if (userRole === "department_coordinator") {
      // REJECTED per InternHub spec section 14:
      //   "Department Coordinators must NOT be able to: create students,
      //    create supervisors."
      //   "Do not only hide buttons. Enforce the restriction in:
      //    server-side actions/API routes, authorization checks, RLS where applicable."
      // This branch is reached only if CREATE_STUDENT_ROLES is misconfigured
      // — defensive denial. The requireRole() call above should already have
      // rejected department_coordinator callers before this code runs.
      return authorizationError(
        "Department Coordinators cannot create students. This responsibility belongs to the Program Coordinator of the relevant program. Contact your University Admin if a Program Coordinator has not yet been assigned."
      );
    }

    if (userRole === "program_coordinator") {
      // Program coordinators can create students ONLY within their own program.
      if (!userUniversityId) {
        return authorizationError("No university assigned to your account");
      }
      const userProgramId = (authContext.profile as any)?.program_id;
      if (!userProgramId) {
        return authorizationError(
          "No program assigned to your account. Ask a Department Coordinator to assign you to a program first."
        );
      }
      // Force university_id from caller's profile (cannot spoof).
      studentData.university_id = userUniversityId;
      // Force program_id from caller's profile (cannot spoof).
      studentData.program_id = userProgramId;
    }

    // For super admins, verify the university exists.
    if (userRole === "super_admin") {
      const { data: university } = await admin
        .from("universities")
        .select("id")
        .eq("id", studentData.university_id)
        .maybeSingle();

      if (!university) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Referenced university does not exist" },
          { status: 400 }
        );
      }
    }

    // Ensure the target user's profile exists (idempotent — fixes the
    // "auth user created but profile missing" issue from the broken trigger).
    await admin.rpc("ensure_profile_exists", { p_user_id: studentData.user_id });

    // Check if student_id_number is unique within the university.
    const { data: existingEnrollment } = await admin
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

    // Verify department + program belong to the same university (only if set).
    if (studentData.department_id) {
      const { data: dept } = await admin
        .from("departments")
        .select("id, university_id, name")
        .eq("id", studentData.department_id)
        .maybeSingle();

      if (!dept) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Referenced department does not exist" },
          { status: 400 }
        );
      }
      if (dept.university_id !== studentData.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Department does not belong to the specified university" },
          { status: 400 }
        );
      }
    }

    if (studentData.program_id) {
      const { data: prog } = await admin
        .from("programs")
        .select("id, university_id, name")
        .eq("id", studentData.program_id)
        .maybeSingle();

      if (!prog) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Referenced program does not exist" },
          { status: 400 }
        );
      }
      if (prog.university_id !== studentData.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Program does not belong to the specified university" },
          { status: 400 }
        );
      }
    }

    // Get client info for audit log.
    const clientInfo = extractClientInfo(request);

    // Create student row.
    const { data: student, error } = await admin
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
      console.error(`[${requestId}] student INSERT error`, error);

      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Student with this student ID number already exists" },
          { status: 409 }
        );
      }

      // Surface the actual PostgREST error.
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Failed to create student: ${error.message} (code ${error.code})`,
        },
        { status: 500 }
      );
    }

    // AUDIT LOG: Log student creation for compliance.
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

    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Internal server error: ${detail}` },
      { status: 500 }
    );
  }
}
