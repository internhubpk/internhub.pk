import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { ApiResponse, UserRole } from "@/types";
import {
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";

// Roles that can manage assignments
const MANAGE_ASSIGNMENT_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
];

/**
 * GET /api/department-coordinator/assignments
 * Get all student-supervisor assignments in coordinator's department
 * SECURITY: Department-scoped queries
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.profile || !MANAGE_ASSIGNMENT_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to view assignments");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const supervisorId = searchParams.get("supervisor_id");
    const programId = searchParams.get("program_id");
    const status = searchParams.get("status");

    // CRITICAL SCOPING - Get user's department context
    const userRole = authContext.profile.role;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    // Build query - get student internships with supervisor info
    // NOTE: `student_internships.student_user_id` references `profiles.user_id`
    // (NOT `students.id`), and `faculty_supervisor_id` also references `profiles.user_id`.
    let query = supabase
      .from("student_internships")
      .select(`
        *,
        student_profile:student_user_id(first_name, last_name, email, avatar_url, phone),
        faculty_supervisor_profile:faculty_supervisor_id(first_name, last_name, email, avatar_url, phone),
        internships:internship_id(
          id,
          title,
          company_id,
          companies:company_id(name)
        )
      `, { count: "exact" });

    // Apply department-scoped filtering
    if (userRole === "department_coordinator") {
      // For department coordinators, we need to filter by their department.
      // `student_internships` has its own `department_id` column (denormalized for RLS)
      // but the audit spec asks us to filter via the `students` table lookup so the
      // filter is authoritative regardless of how the row was inserted.
      if (userDepartmentId && userUniversityId) {
        // Get students (their user_ids) in this department
        const { data: deptStudents } = await supabase
          .from("students")
          .select("user_id")
          .eq("department_id", userDepartmentId)
          .eq("university_id", userUniversityId);

        const deptStudentIds = deptStudents?.map(s => s.user_id) || [];
        
        if (deptStudentIds.length > 0) {
          query = query.in("student_user_id", deptStudentIds);
        } else {
          // No students in department
          return NextResponse.json<ApiResponse<any>>({
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
      } else {
        // No department assigned → empty result
        return NextResponse.json<ApiResponse<any>>({
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
    }

    // Apply additional filters
    if (supervisorId) {
      query = query.eq("faculty_supervisor_id", supervisorId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: assignments, error } = await query
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) {
      console.error("Error fetching assignments:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch assignments" },
        { status: 500 }
      );
    }

    const response = {
      data: assignments || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<typeof response>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/department-coordinator/assignments:", error);
    
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
 * POST /api/department-coordinator/assignments
 * Assign student to supervisor
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.profile || !MANAGE_ASSIGNMENT_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to manage assignments");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const body = await request.json();
    const { student_id, faculty_supervisor_id, internship_id } = body;

    if (!student_id || !faculty_supervisor_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "student_id and faculty_supervisor_id are required" },
        { status: 400 }
      );
    }

    // CRITICAL SCOPING - Verify both student and supervisor belong to coordinator's department
    const userRole = authContext.profile.role;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    // Fetch student and verify department access.
    // NOTE: `student_id` in the request body is the student's `user_id`
    // (since `students.user_id` is the PK and `student_internships.student_user_id`
    // references `profiles.user_id`).
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", student_id)
      .maybeSingle();

    if (!student) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    if (userRole === "department_coordinator") {
      if (student.department_id !== userDepartmentId || student.university_id !== userUniversityId) {
        return authorizationError("Cannot assign students from another department");
      }
    }

    // Fetch supervisor and verify department access.
    // NOTE: faculty_supervisor_id here (and on student_internships) refers to
    // the supervisor's profiles.user_id, NOT the supervisors.id surrogate key.
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("*")
      .eq("user_id", faculty_supervisor_id)
      .maybeSingle();

    if (!supervisor) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Supervisor not found" },
        { status: 404 }
      );
    }

    if (userRole === "department_coordinator") {
      if (supervisor.department_id !== userDepartmentId || supervisor.university_id !== userUniversityId) {
        return authorizationError("Cannot assign supervisors from another department");
      }
    }

    // Check if assignment already exists for this student-internship combo.
    // `student_internships.student_user_id` (not `student_id`) is the FK to profiles.
    let existingAssignmentQuery = supabase
      .from("student_internships")
      .select("id")
      .eq("student_user_id", student_id)
      .eq("faculty_supervisor_id", faculty_supervisor_id);

    if (internship_id) {
      existingAssignmentQuery = existingAssignmentQuery.eq("internship_id", internship_id);
    }

    const { data: existingAssignment } = await existingAssignmentQuery.maybeSingle();

    if (existingAssignment) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This assignment already exists" },
        { status: 409 }
      );
    }

    // Check if there's an existing student_internships row to update.
    // The department-coordinator flow is “assign a faculty supervisor to a student
    // who already has an internship” — so we expect a row to already exist.
    // INSERTing a fresh `student_internships` row would require `internship_id`,
    // `company_id`, and `start_date` (all NOT NULL) which this endpoint does not
    // (and should not) provide.
    const { data: existingSI } = await supabase
      .from("student_internships")
      .select("id, status")
      .eq("student_user_id", student_id)
      .maybeSingle();

    let result;

    if (existingSI) {
      // Update existing record — only set faculty_supervisor_id (and updated_at).
      // Do NOT re-set student_user_id / internship_id on an UPDATE.
      const { data, error } = await supabase
        .from("student_internships")
        .update({
          faculty_supervisor_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSI.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating assignment:", error);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Failed to update assignment" },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // No existing student_internships row — the student has not been placed
      // into an internship yet, so a faculty-supervisor assignment is meaningless.
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student has no active internship — cannot assign supervisor" },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<typeof result>>({
      success: true,
      data: result!,
      message: "Student assigned to supervisor successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/department-coordinator/assignments:", error);
    
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
 * DELETE /api/department-coordinator/assignments
 * Remove student-supervisor assignment
 */
export async function DELETE(request: NextRequest) {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.profile || !MANAGE_ASSIGNMENT_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to manage assignments");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id");
    const supervisorId = searchParams.get("supervisor_id");

    if (!studentId || !supervisorId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Both student_id and supervisor_id are required" },
        { status: 400 }
      );
    }

    // CRITICAL SCOPING - Verify student belongs to coordinator's department
    const userRole = authContext.profile.role;
    const userDepartmentId = authContext.profile.department_id;

    if (userRole === "department_coordinator") {
      const { data: student } = await supabase
        .from("students")
        .select("department_id")
        .eq("user_id", studentId)
        .maybeSingle();

      if (!student || student.department_id !== userDepartmentId) {
        return authorizationError("Cannot modify assignments for students outside your department");
      }
    }

    // Remove assignment (set supervisor to null).
    // NOTE: `student_internships.student_user_id` (not `student_id`) is the FK to profiles.
    const { error } = await supabase
      .from("student_internships")
      .update({ 
        faculty_supervisor_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("student_user_id", studentId)
      .eq("faculty_supervisor_id", supervisorId);

    if (error) {
      console.error("Error removing assignment:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to remove assignment" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
      message: "Assignment removed successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/department-coordinator/assignments:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
