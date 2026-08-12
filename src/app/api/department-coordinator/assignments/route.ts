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
    let query = supabase
      .from("student_internships")
      .select(`
        *,
        students:student_id(
          id,
          enrollment_number,
          profiles:user_id(first_name, last_name, email),
          programs:program_id(name, code),
          departments:department_id(name)
        ),
        faculty_supervisors:faculty_supervisor_id(
          id,
          title,
          specialization,
          profiles:user_id(first_name, last_name, email)
        ),
        internships:internship_id(
          id,
          title,
          company_id,
          companies:company_id(name)
        )
      `, { count: "exact" });

    // Apply department-scoped filtering
    if (userRole === "department_coordinator") {
      // For department coordinators, we need to filter by their department
      // This requires joining through students table
      if (userDepartmentId && userUniversityId) {
        // We'll need to get students in this department first
        const { data: deptStudents } = await supabase
          .from("students")
          .select("id")
          .eq("department_id", userDepartmentId)
          .eq("university_id", userUniversityId);

        const deptStudentIds = deptStudents?.map(s => s.id) || [];
        
        if (deptStudentIds.length > 0) {
          query = query.in("student_id", deptStudentIds);
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

    // Fetch student and verify department access
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("id", student_id)
      .single();

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
      .single();

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

    // Check if assignment already exists for this student-internship combo
    let existingAssignmentQuery = supabase
      .from("student_internships")
      .select("id")
      .eq("student_id", student_id)
      .eq("faculty_supervisor_id", faculty_supervisor_id);

    if (internship_id) {
      existingAssignmentQuery = existingAssignmentQuery.eq("internship_id", internship_id);
    }

    const { data: existingAssignment } = await existingAssignmentQuery.single();

    if (existingAssignment) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This assignment already exists" },
        { status: 409 }
      );
    }

    // Create or update assignment
    const assignmentData: Record<string, any> = {
      student_id,
      faculty_supervisor_id,
      updated_at: new Date().toISOString(),
    };

    if (internship_id) {
      assignmentData.internship_id = internship_id;
    }

    // Check if there's an existing student internship record to update
    const { data: existingSI } = await supabase
      .from("student_internships")
      .select("id, status")
      .eq("student_id", student_id)
      .maybeSingle();

    let result;

    if (existingSI) {
      // Update existing record
      const { data, error } = await supabase
        .from("student_internships")
        .update(assignmentData)
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
      // Create new record
      const { data, error } = await supabase
        .from("student_internships")
        .insert({
          ...assignmentData,
          status: internship_id ? "active" : "assigned",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating assignment:", error);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Failed to create assignment" },
          { status: 500 }
        );
      }
      result = data;
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
        .eq("id", studentId)
        .single();

      if (!student || student.department_id !== userDepartmentId) {
        return authorizationError("Cannot modify assignments for students outside your department");
      }
    }

    // Remove assignment (set supervisor to null)
    const { error } = await supabase
      .from("student_internships")
      .update({ 
        faculty_supervisor_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("student_id", studentId)
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
