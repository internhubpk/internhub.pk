import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { ApiResponse, UserRole } from "@/types";
import {
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import { notifyStudentAssigned } from "@/lib/notifications";

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
        // Get students (their user_ids) in this department, INCLUDING their
        // direct faculty_supervisor_id (migration 0041 — pre-internship
        // assignment). We synthesize "assignment" rows from this column so
        // the students-page UI sees the same shape as student_internships.
        const { data: deptStudents } = await supabase
          .from("students")
          .select("user_id, faculty_supervisor_id")
          .eq("department_id", userDepartmentId)
          .eq("university_id", userUniversityId);

        const deptStudentIds = deptStudents?.map(s => s.user_id) || [];

        if (deptStudentIds.length > 0) {
          query = query.in("student_user_id", deptStudentIds);
        } else {
          // No students in department — but we still need to fall through
          // to the synthesized-rows step below, which may produce results
          // from the direct students.faculty_supervisor_id column.
          // Return early only if there are also no pre-internship
          // assignments to synthesize.
          const synthesized = (deptStudents || [])
            .filter(s => s.faculty_supervisor_id)
            .map(s => ({
              student_user_id: s.user_id,
              faculty_supervisor_id: s.faculty_supervisor_id,
              // The students-page UI only reads these two fields from this
              // endpoint to build the assignedSupervisorByStudent map.
              _source: "students_table",
            }));

          return NextResponse.json<ApiResponse<any>>({
            success: true,
            data: {
              data: synthesized,
              total: synthesized.length,
              page,
              pageSize,
              totalPages: Math.ceil(synthesized.length / pageSize) || 0,
            },
          });
        }

        // Stash deptStudents so we can synthesize rows for pre-internship
        // assignments after the main query runs.
        (request as any)._deptStudents = deptStudents;
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

    // Merge in pre-internship assignments from `students.faculty_supervisor_id`
    // (migration 0041). These are students who have a faculty supervisor
    // assigned directly on the students row but no student_internships row
    // yet. We synthesize a minimal row shape that the students-page UI
    // reads (student_user_id + faculty_supervisor_id).
    let merged: any[] = assignments || [];
    const deptStudents: any[] | undefined = (request as any)._deptStudents;
    if (deptStudents && deptStudents.length > 0) {
      const seenStudentIds = new Set(
        merged
          .map((a: any) => a.student_user_id || a.student_id)
          .filter(Boolean)
      );
      const synthesized = deptStudents
        .filter(s => s.faculty_supervisor_id && !seenStudentIds.has(s.user_id))
        .map(s => ({
          student_user_id: s.user_id,
          faculty_supervisor_id: s.faculty_supervisor_id,
          _source: "students_table",
        }));
      merged = [...merged, ...synthesized];
    }

    const response = {
      data: merged,
      total: merged.length,
      page,
      pageSize,
      totalPages: Math.ceil(merged.length / pageSize),
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
    const { student_id, faculty_supervisor_id, external_evaluator_id, internship_id } = body;

    // At least one supervisor/evaluator ID and a student_id are required.
    if (!student_id || (!faculty_supervisor_id && !external_evaluator_id)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "student_id and at least one of faculty_supervisor_id or external_evaluator_id are required" },
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

    // Fetch supervisor(s) and verify department access.
    // Both `faculty_supervisor_id` and `external_evaluator_id` refer to
    // `profiles.user_id`. We look each one up in the `supervisors` table.
    // External evaluators (type='external') don't necessarily have a
    // `department_id` set (they may be cross-department / industry experts),
    // so the department check is skipped for them.
    const supervisorLookups: Promise<any>[] = [];
    if (faculty_supervisor_id) {
      supervisorLookups.push(
        Promise.resolve(
          supabase
            .from("supervisors")
            .select("*")
            .eq("user_id", faculty_supervisor_id)
            .maybeSingle()
        ).then((r) => ({ ...r, _kind: "faculty" as const }))
      );
    }
    if (external_evaluator_id) {
      supervisorLookups.push(
        Promise.resolve(
          supabase
            .from("supervisors")
            .select("*")
            .eq("user_id", external_evaluator_id)
            .maybeSingle()
        ).then((r) => ({ ...r, _kind: "external" as const }))
      );
    }
    const supervisorResults = await Promise.all(supervisorLookups);

    for (const r of supervisorResults) {
      if (!r.data) {
        const label = r._kind === "external" ? "External evaluator" : "Supervisor";
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `${label} not found` },
          { status: 404 }
        );
      }
      // Department check is enforced only for faculty supervisors. External
      // evaluators may be cross-department industry experts.
      if (r._kind === "faculty" && userRole === "department_coordinator") {
        if (r.data.department_id !== userDepartmentId || r.data.university_id !== userUniversityId) {
          return authorizationError("Cannot assign supervisors from another department");
        }
      }
    }

    // Build the column→value map we'll apply to student_internships (and to
    // students, for the pre-internship fallback).
    const assignmentColumns: Record<string, string> = {};
    if (faculty_supervisor_id) assignmentColumns.faculty_supervisor_id = faculty_supervisor_id;
    if (external_evaluator_id) assignmentColumns.external_evaluator_id = external_evaluator_id;

    // Check if assignment already exists for this student-internship combo.
    // We check each provided column separately to avoid duplicate inserts.
    let existingAssignmentQuery = supabase
      .from("student_internships")
      .select("id")
      .eq("student_user_id", student_id);

    // Narrow the query: if internship_id is provided, scope to that internship.
    // Otherwise, fall back to checking ALL of this student's internships.
    if (internship_id) {
      existingAssignmentQuery = (existingAssignmentQuery as any).eq("internship_id", internship_id);
    }
    // OR-style check across columns: supabase-js does not expose OR easily here,
    // so we filter with a manual `.or()` string.
    const orParts: string[] = [];
    if (faculty_supervisor_id) {
      orParts.push(`faculty_supervisor_id.eq.${faculty_supervisor_id}`);
    }
    if (external_evaluator_id) {
      orParts.push(`external_evaluator_id.eq.${external_evaluator_id}`);
    }
    existingAssignmentQuery = (existingAssignmentQuery as any).or(orParts.join(","));

    const { data: existingAssignment } = await existingAssignmentQuery.maybeSingle();

    if (existingAssignment) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This assignment already exists" },
        { status: 409 }
      );
    }

    // Check if there's an existing student_internships row to update.
    // The department-coordinator flow is “assign a supervisor to a student”.
    // If a student_internships row exists (student already placed in an internship),
    // we update that row's supervisor/evaluator column(s).
    // Otherwise, we fall back to setting `students.faculty_supervisor_id` directly
    // (migration 0041) so coordinators can pre-assign supervisors before the
    // student is placed in an internship. NOTE: `students` table does NOT have
    // an `external_evaluator_id` column — for external evaluators without an
    // existing SI row we create a placeholder student_internships row instead.
    const { data: existingSI } = await supabase
      .from("student_internships")
      .select("id, status")
      .eq("student_user_id", student_id)
      .maybeSingle();

    let result;

    if (existingSI) {
      // Update existing record — only set the column(s) that were provided.
      const { data, error } = await supabase
        .from("student_internships")
        .update({
          ...assignmentColumns,
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
    } else if (faculty_supervisor_id && !external_evaluator_id) {
      // No existing student_internships row — the student has not been placed
      // into an internship yet. Fall back to setting `students.faculty_supervisor_id`
      // directly (migration 0041) so the coordinator can pre-assign a supervisor.
      const { data: updatedStudent, error: updateErr } = await supabase
        .from("students")
        .update({
          faculty_supervisor_id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", student_id)
        .select()
        .single();

      if (updateErr) {
        console.error("Error updating student faculty_supervisor_id:", updateErr);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Failed to assign supervisor to student" },
          { status: 500 }
        );
      }
      result = updatedStudent;
    } else {
      // External evaluator (with or without faculty) but no student_internships
      // row exists yet. The `students` table has no `external_evaluator_id`
      // column, so we create a placeholder student_internships row carrying
      // whichever supervisor columns were provided.
      const insertPayload: Record<string, any> = {
        student_user_id: student_id,
        ...assignmentColumns,
        status: "assigned",
        start_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (internship_id) insertPayload.internship_id = internship_id;
      // Denormalize department/university for RLS if available on the student.
      if (student.department_id) insertPayload.department_id = student.department_id;
      if (student.university_id) insertPayload.university_id = student.university_id;
      if (student.company_id) insertPayload.company_id = student.company_id;

      const { data: inserted, error: insertErr } = await supabase
        .from("student_internships")
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) {
        console.error("Error creating placeholder student_internships row:", insertErr);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Failed to assign evaluator to student" },
          { status: 500 }
        );
      }
      result = inserted;
    }

    // Notify the student that a supervisor/evaluator has been assigned. Best-effort.
    try {
      // Resolve human-readable names + internship title.
      const profileIds = [faculty_supervisor_id, external_evaluator_id].filter(Boolean) as string[];
      const [{ data: supervisorProfiles }, internship] = await Promise.all([
        profileIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", profileIds)
          : Promise.resolve({ data: [], error: null }),
        (internship_id || (result as any)?.internship_id)
          ? supabase
              .from("internships")
              .select("title")
              .eq("id", (internship_id || (result as any)?.internship_id) as string)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const profileMap = new Map((supervisorProfiles || []).map((p: any) => [p.user_id, p.full_name]));
      const names: string[] = [];
      if (faculty_supervisor_id && profileMap.get(faculty_supervisor_id)) {
        names.push(`${profileMap.get(faculty_supervisor_id)} (Faculty Supervisor)`);
      }
      if (external_evaluator_id && profileMap.get(external_evaluator_id)) {
        names.push(`${profileMap.get(external_evaluator_id)} (External Evaluator)`);
      }
      const supervisorName = names.length ? names.join(", ") : "your supervisor";
      const internshipTitle = (internship as any)?.data?.title || "your internship";

      await notifyStudentAssigned(
        supabase,
        student_id,
        supervisorName,
        internshipTitle,
        authContext.user!.id
      ).catch(() => {});
    } catch (notifErr) {
      console.warn(
        "[/api/department-coordinator/assignments] student notification failed (non-fatal):",
        notifErr
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

    // Remove assignment (set supervisor/evaluator to null) on BOTH tables:
    //   1. student_internships.{faculty_supervisor_id, external_evaluator_id}
    //   2. students.faculty_supervisor_id (pre-internship assignment, migration 0041)
    // The DELETE endpoint is called with `supervisor_id` referring to whichever
    // user_id was assigned (faculty or external). We clear BOTH columns where
    // they match — this is safe because if `supervisor_id` only ever sat in
    // one column, the other column's update is a no-op.
    // NOTE: `student_internships.student_user_id` (not `student_id`) is the FK to profiles.
    const { error: siErr } = await supabase
      .from("student_internships")
      .update({
        faculty_supervisor_id: null,
        external_evaluator_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("student_user_id", studentId)
      .or(`faculty_supervisor_id.eq.${supervisorId},external_evaluator_id.eq.${supervisorId}`);

    if (siErr) {
      console.error("Error removing student_internships assignment:", siErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to remove assignment" },
        { status: 500 }
      );
    }

    // Also clear the pre-internship assignment on students.faculty_supervisor_id
    // (only set if the supervisor being removed is a faculty supervisor —
    // external evaluators are never stored on the `students` table).
    const { error: stuErr } = await supabase
      .from("students")
      .update({
        faculty_supervisor_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", studentId)
      .eq("faculty_supervisor_id", supervisorId);

    if (stuErr) {
      console.error("Error removing students.faculty_supervisor_id assignment:", stuErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to remove student-level assignment" },
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
