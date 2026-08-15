import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { ApiResponse, UserRole } from "@/types";
import {
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";

// Roles that can access department reports
const VIEW_REPORT_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
];

interface DepartmentStats {
  totalStudents: number;
  activeStudents: number;
  completedInternships: number;
  activeInternships: number;
  /** Internships that are in the active pipeline (assigned + active + paused)
   *  — i.e. neither completed nor terminated. Coordinators see this as
   *  "currently in progress" on the dashboard. */
  inProgressInternships: number;
  pendingAssignments: number;
  totalSupervisors: number;
  totalPrograms: number;
  activePrograms: number;
}

interface ProgramPerformance {
  program_id: string;
  program_name: string;
  program_code: string;
  total_students: number;
  active_internships: number;
  completed_internships: number;
  completion_rate: number;
}

interface SupervisorWorkload {
  supervisor_id: string;
  supervisor_name: string;
  supervisor_email: string;
  assigned_students: number;
  active_supervisions: number;
  completed_supervisions: number;
}

interface MonthlyTrend {
  month: string;
  internships_started: number;
  internships_completed: number;
  students_enrolled: number;
}

/**
 * GET /api/department-coordinator/reports
 * Generate department-scoped reports and analytics
 * SECURITY: Department coordinators can ONLY see their department's data
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.profile || !VIEW_REPORT_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to view reports");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") || "overview";
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    // CRITICAL SCOPING - Get user's department context
    const userRole = authContext.profile.role;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    // For department coordinators, enforce department scope
    if (userRole === "department_coordinator" && !userDepartmentId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "No department assigned to your account" },
        { status: 403 }
      );
    }

    // Build filters based on role
    const deptFilter: Record<string, string | null> = userRole === "department_coordinator" 
      ? { department_id: userDepartmentId, university_id: userUniversityId }
      : userRole === "university_admin"
      ? { university_id: userUniversityId }
      : {};

    switch (reportType) {
      case "overview":
        return await getOverviewStats(supabase, deptFilter);
      case "programs":
        return await getProgramPerformance(supabase, deptFilter);
      case "supervisors":
        return await getSupervisorWorkload(supabase, deptFilter);
      case "trends":
        return await getMonthlyTrends(supabase, deptFilter, year);
      case "students":
        return await getStudentReport(supabase, deptFilter, searchParams);
      case "internships":
        return await getInternshipDetail(supabase, deptFilter);
      default:
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Invalid report type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in GET /api/department-coordinator/reports:", error);
    
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
 * Get overview statistics for the department
 */
async function getOverviewStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: Record<string, string | null>
): Promise<NextResponse<ApiResponse<DepartmentStats>>> {
  // Build base queries with department filter.
  // NOTE: `students` table has no `status` column — the previous code filtered
  // on a non-existent column, which caused PostgREST to 400 every call.
  // `students.user_id` (not `id`) is the PK.
  //
  // CRITICAL: supabase-js's `.eq()` MUTATES the underlying URL builder
  // (`this.url.searchParams.append(...)` then `return this`). Re-using
  // the same `programQuery` / `internshipQuery` variable for both the
  // total and the filtered variant caused the previous code to ACCUMULATE
  // filters across the Promise.all entries:
  //   - `programQuery.eq("is_active", true)` mutated the same builder
  //     used by `programQuery`, so the "total programs" count was also
  //     filtered to active only.
  //   - `internshipQuery.eq("status", "active")` + `.eq("status", "completed")`
  //     were applied to the SAME builder, producing a query like
  //     `?status=eq.active&status=eq.completed` — PostgREST AND-s these,
  //     so active_internships and completed_internships BOTH returned 0.
  // The fix is to build SEPARATE query builders for each metric. Each
  // helper below constructs its own filters from `filters` so there's
  // no shared mutable state.

  const buildStudentQuery = () => {
    let q = supabase
      .from("students")
      .select("user_id", { count: "exact" });
    if (filters.department_id) {
      q = q.eq("department_id", filters.department_id);
    } else if (filters.university_id) {
      q = q.eq("university_id", filters.university_id);
    }
    return q;
  };

  const buildProgramQuery = (activeOnly: boolean) => {
    let q = supabase
      .from("programs")
      .select("id, is_active", { count: "exact" });
    if (filters.department_id) {
      q = q.eq("department_id", filters.department_id);
    } else if (filters.university_id) {
      q = q.eq("university_id", filters.university_id);
    }
    if (activeOnly) {
      q = q.eq("is_active", true);
    }
    return q;
  };

  const buildSupervisorQuery = () => {
    // Count faculty supervisors via the profiles table (role='faculty_supervisor').
    // This catches BOTH supervisors with a `supervisors` table row AND legacy /
    // program-default-only assignments where the user has only a profile row.
    let q = supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "faculty_supervisor");
    if (filters.department_id) {
      q = q.eq("department_id", filters.department_id);
    } else if (filters.university_id) {
      q = q.eq("university_id", filters.university_id);
    }
    return q;
  };

  // For internships, we need to fetch the department's student ids first
  // (so we can filter by `student_user_id IN (...)` as defense-in-depth
  // against NULL `department_id` on `student_internships` rows).
  let deptStudentIds: string[] = [];
  if (filters.department_id) {
    const { data: deptStudents } = await supabase
      .from("students")
      .select("user_id")
      .eq("department_id", filters.department_id!);
    deptStudentIds = (deptStudents || []).map((s) => s.user_id);
  }

  const buildInternshipQuery = (status: string) => {
    let q = supabase
      .from("student_internships")
      .select("id, status", { count: "exact" })
      .eq("status", status);
    if (filters.department_id) {
      q = q.eq("department_id", filters.department_id);
      if (deptStudentIds.length > 0) {
        q = q.in("student_user_id", deptStudentIds);
      }
    } else if (filters.university_id) {
      q = q.eq("university_id", filters.university_id);
    }
    return q;
  };

  // "In-progress" internships = assigned + active + paused (anything
  // not completed/terminated). We build this with `.in("status", [...])`
  // on its own builder — separate from the per-status builders below.
  const buildInProgressInternshipQuery = () => {
    let q = supabase
      .from("student_internships")
      .select("id, status", { count: "exact" })
      .in("status", ["assigned", "active", "paused"]);
    if (filters.department_id) {
      q = q.eq("department_id", filters.department_id);
      if (deptStudentIds.length > 0) {
        q = q.in("student_user_id", deptStudentIds);
      }
    } else if (filters.university_id) {
      q = q.eq("university_id", filters.university_id);
    }
    return q;
  };

  // Execute all queries in parallel — each one is its own builder
  // instance, so no shared-mutable-state accumulation.
  // `students` has no `status` column — `activeStudents` previously came from
  // a `.eq("status", "active")` filter that 400'd. We now report it equal to
  // `totalStudents` until a real status column is added.
  const [
    studentsResult,
    programsResult,
    activeProgramsResult,
    supervisorsResult,
    activeInternshipsResult,
    completedInternshipsResult,
    inProgressResult,
  ] = await Promise.all([
    buildStudentQuery(),
    buildProgramQuery(false),
    buildProgramQuery(true),
    buildSupervisorQuery(),
    buildInternshipQuery("active"),
    buildInternshipQuery("completed"),
    buildInProgressInternshipQuery(),
  ]);

  // Count students without supervisors (pending assignments).
  //
  // A student is considered "assigned" if they have a supervisor via EITHER:
  //   1. `students.faculty_supervisor_id` (pre-internship assignment —
  //      migration 0041, set by coordinator via the Students page when the
  //      student hasn't been placed into an internship yet), OR
  //   2. `student_internships.faculty_supervisor_id` (internship-time
  //      assignment, set when the student is placed into an internship).
  //
  // Previously this ONLY checked student_internships, which meant any
  // student assigned via the new students.faculty_supervisor_id column was
  // still counted as "pending" — and the dashboard showed the amber
  // "Action Required: N students may need supervisor assignments" alert
  // forever, even when every student had a supervisor. This fix makes the
  // alert disappear as soon as every student has a supervisor via either
  // path.
  let pendingAssignmentsCount = 0;
  if (filters.department_id) {
    // Fetch all students in the department that have a program_id
    // (students without a program are counted in a different "incomplete
    // profile" bucket on the dashboard, not here).
    const { data: studentsWithProgram } = await supabase
      .from("students")
      .select("user_id, faculty_supervisor_id")
      .eq("department_id", filters.department_id!)
      .not("program_id", "is", null);

    if (studentsWithProgram && studentsWithProgram.length > 0) {
      // Students already assigned via the new students.faculty_supervisor_id
      // column (migration 0041) — these are NOT pending.
      const assignedViaStudentsTable = new Set(
        studentsWithProgram
          .filter((s) => s.faculty_supervisor_id)
          .map((s) => s.user_id)
      );

      // Students who DON'T have a students.faculty_supervisor_id — check
      // whether they have a student_internships row with a faculty_supervisor_id.
      const studentsNeedingInternshipCheck = studentsWithProgram
        .filter((s) => !s.faculty_supervisor_id)
        .map((s) => s.user_id);

      let assignedViaInternshipCount = 0;
      if (studentsNeedingInternshipCheck.length > 0) {
        const { count: assignedCount } = await supabase
          .from("student_internships")
          .select("id", { count: "exact" })
          .in("student_user_id", studentsNeedingInternshipCheck)
          .not("faculty_supervisor_id", "is", null);
        assignedViaInternshipCount = assignedCount || 0;
      }

      const totalAssigned =
        assignedViaStudentsTable.size + assignedViaInternshipCount;
      pendingAssignmentsCount = studentsWithProgram.length - totalAssigned;
      // Defensive: never report a negative count.
      if (pendingAssignmentsCount < 0) pendingAssignmentsCount = 0;
    }
  }

  const stats: DepartmentStats = {
    totalStudents: studentsResult.count || 0,
    activeStudents: studentsResult.count || 0,
    totalPrograms: programsResult.count || 0,
    activePrograms: activeProgramsResult.count || 0,
    totalSupervisors: supervisorsResult.count || 0,
    activeInternships: activeInternshipsResult.count || 0,
    completedInternships: completedInternshipsResult.count || 0,
    inProgressInternships: inProgressResult.count || 0,
    pendingAssignments: pendingAssignmentsCount,
  };

  return NextResponse.json<ApiResponse<DepartmentStats>>({
    success: true,
    data: stats,
  });
}

/**
 * Get performance metrics by program
 */
async function getProgramPerformance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: Record<string, string | null>
): Promise<NextResponse<ApiResponse<ProgramPerformance[]>>> {
  let programQuery = supabase
    .from("programs")
    .select(`
      id,
      name,
      code
    `);

  if (filters.department_id) {
    programQuery = programQuery.eq("department_id", filters.department_id);
  }
  if (filters.university_id) {
    programQuery = programQuery.eq("university_id", filters.university_id);
  }

  const { data: programs, error: programsError } = await programQuery;

  if (programsError) {
    throw programsError;
  }

  // Get stats for each program
  const performanceData: ProgramPerformance[] = [];

  for (const program of programs || []) {
    const { data: programStudents } = await supabase
      .from("students")
      .select("user_id")
      .eq("program_id", program.id);

    const programStudentIds = programStudents?.map((s) => s.user_id) || [];
    const totalStudents = programStudentIds.length;

    let activeCount = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    if (programStudentIds.length > 0) {
      // "In-progress" matches the dashboard's definition: any internship
      // that's been assigned but hasn't yet completed or been terminated —
      // i.e. status IN ('assigned', 'active', 'paused').
      //
      // We fetch in-progress and completed as separate counts. `activeCount`
      // (the column shown as "Active" in the UI) used to be the only metric
      // and only counted status='active', which made every program look
      // empty because most internships sit in 'assigned' (the default
      // status when a student is placed into an internship) until the
      // start date flips them to 'active'.
      const [inProgressResult, completedInternshipsResult] = await Promise.all([
        supabase
          .from("student_internships")
          .select("id", { count: "exact" })
          .in("status", ["assigned", "active", "paused"])
          .in("student_user_id", programStudentIds),
        supabase
          .from("student_internships")
          .select("id", { count: "exact" })
          .eq("status", "completed")
          .in("student_user_id", programStudentIds),
      ]);
      inProgressCount = inProgressResult.count || 0;
      activeCount = inProgressCount; // UI "Active" column = in-progress pipeline
      completedCount = completedInternshipsResult.count || 0;
    }

    // Completion rate = completed / (in-progress + completed).
    // Denominator matches the dashboard's `totalInternships` so the rate
    // shown here matches the rate shown in the header StatsCard.
    const denominator = inProgressCount + completedCount;
    const completionRate = denominator > 0 ? Math.round((completedCount / denominator) * 100) : 0;

    performanceData.push({
      program_id: program.id,
      program_name: program.name,
      program_code: program.code,
      total_students: totalStudents,
      active_internships: activeCount,
      completed_internships: completedCount,
      completion_rate: completionRate,
    });
  }

  return NextResponse.json<ApiResponse<ProgramPerformance[]>>({
    success: true,
    data: performanceData,
  });
}

/**
 * Get supervisor workload distribution
 *
 * `assigned_students` counts each student who is "under" this supervisor
 * via EITHER of two paths (union — a student enrolled in the supervisor's
 * program AND directly assigned to them via the Students page is counted
 * only once):
 *
 *   1. INDIRECT (program-level): the student is enrolled in a program
 *      where this supervisor is the `default_faculty_supervisor_id`.
 *      This is the automatic assignment that happens when a coordinator
 *      creates a program (the supervisor is created with the program and
 *      every student subsequently enrolled in that program is "theirs").
 *
 *   2. DIRECT (internship-level): the student has a `student_internships`
 *      row with `faculty_supervisor_id = supervisor.user_id`. This is the
 *      manual assignment a coordinator makes from the Students page.
 *
 * Without the indirect path, newly-created supervisors (who have not yet
 * had any students manually assigned to them) would always show 0 — which
 * is misleading because every student enrolled in their program IS under
 * their supervision.
 *
 * `active_supervisions` and `completed_supervisions` count
 * `student_internships` rows by status (no program-level component — a
 * student enrolled in a program but without an active internship row is
 * not "actively interning" yet).
 */
async function getSupervisorWorkload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: Record<string, string | null>
): Promise<NextResponse<ApiResponse<SupervisorWorkload[]>>> {
  let supervisorQuery = supabase
    .from("supervisors")
    .select(`
      id,
      user_id,
      specialization,
      profiles:user_id(first_name, last_name, email)
    `)
    .eq("type", "faculty");

  if (filters.department_id) {
    supervisorQuery = supervisorQuery.eq("department_id", filters.department_id);
  }
  if (filters.university_id) {
    supervisorQuery = supervisorQuery.eq("university_id", filters.university_id);
  }

  const { data: supervisors, error: supervisorsError } = await supervisorQuery;

  if (supervisorsError) {
    throw supervisorsError;
  }

  if (!supervisors || supervisors.length === 0) {
    return NextResponse.json<ApiResponse<SupervisorWorkload[]>>({
      success: true,
      data: [],
    });
  }

  // ---------- Batch fetch the data we need to compute per-supervisor
  // workload without an N+1 query storm. ----------
  const supervisorUserIds = supervisors.map((s) => s.user_id);

  // (a) Programs where any of these supervisors is the default.
  //     `default_faculty_supervisor_id` references profiles.user_id.
  let programsQuery = supabase
    .from("programs")
    .select("id, default_faculty_supervisor_id")
    .in("default_faculty_supervisor_id", supervisorUserIds)
    .not("default_faculty_supervisor_id", "is", null);

  if (filters.department_id) {
    programsQuery = programsQuery.eq("department_id", filters.department_id);
  }
  if (filters.university_id) {
    programsQuery = programsQuery.eq("university_id", filters.university_id);
  }
  const { data: supervisorPrograms, error: programsError } = await programsQuery;
  if (programsError) throw programsError;

  // Group program ids by their default supervisor's user_id.
  const programIdsBySupervisor = new Map<string, Set<string>>();
  for (const p of supervisorPrograms || []) {
    const supUid = p.default_faculty_supervisor_id as string;
    if (!programIdsBySupervisor.has(supUid)) {
      programIdsBySupervisor.set(supUid, new Set());
    }
    programIdsBySupervisor.get(supUid)!.add(p.id);
  }

  // (b) Students enrolled in any of those programs (indirect assignments).
  const allProgramIds = Array.from(
    new Set((supervisorPrograms || []).map((p) => p.id))
  );
  let programStudents: { user_id: string; program_id: string }[] = [];
  if (allProgramIds.length > 0) {
    let studentsQuery = supabase
      .from("students")
      .select("user_id, program_id")
      .in("program_id", allProgramIds);
    if (filters.department_id) {
      studentsQuery = studentsQuery.eq("department_id", filters.department_id);
    }
    if (filters.university_id) {
      studentsQuery = studentsQuery.eq("university_id", filters.university_id);
    }
    const { data: psData, error: psError } = await studentsQuery;
    if (psError) throw psError;
    programStudents = psData || [];
  }

  // (c) Direct assignments: student_internships rows where
  //     faculty_supervisor_id matches any of our supervisors.
  //
  //     NOTE: this ONLY catches internships where the assignment was made
  //     AFTER the student_internships row was created (the assignments
  //     route updates the row's faculty_supervisor_id in place). It MISSES
  //     internships where the supervisor was pre-assigned via
  //     students.faculty_supervisor_id BEFORE the student was placed into
  //     an internship — in that case student_internships.faculty_supervisor_id
  //     stays NULL even though the student is effectively under this
  //     supervisor's supervision. We patch that gap in step (c'') below.
  let internshipsQuery = supabase
    .from("student_internships")
    .select("id, student_user_id, faculty_supervisor_id, status")
    .in("faculty_supervisor_id", supervisorUserIds);
  if (filters.department_id) {
    internshipsQuery = internshipsQuery.eq("department_id", filters.department_id);
  }
  if (filters.university_id) {
    internshipsQuery = internshipsQuery.eq("university_id", filters.university_id);
  }
  const { data: supervisorInternships, error: internshipsError } = await internshipsQuery;
  if (internshipsError) throw internshipsError;

  // (c') Pre-internship direct assignments: students.faculty_supervisor_id
  //      (migration 0041) — students who have a faculty supervisor assigned
  //      directly on the students row but no student_internships row yet.
  let preInternshipStudentsQuery = supabase
    .from("students")
    .select("user_id, faculty_supervisor_id")
    .in("faculty_supervisor_id", supervisorUserIds);
  if (filters.department_id) {
    preInternshipStudentsQuery = preInternshipStudentsQuery.eq("department_id", filters.department_id);
  }
  if (filters.university_id) {
    preInternshipStudentsQuery = preInternshipStudentsQuery.eq("university_id", filters.university_id);
  }
  const { data: preInternshipStudents, error: preErr } = await preInternshipStudentsQuery;
  if (preErr) throw preErr;

  // (c'') Internship rows for pre-assigned students.
  //      When a coordinator pre-assigns a supervisor to a student via the
  //      Students page (which writes students.faculty_supervisor_id) and
  //      LATER places the student into an internship (which creates a
  //      student_internships row), the new internship row is created with
  //      faculty_supervisor_id = NULL. The assignment is implicit via the
  //      students table, but the internship row doesn't carry it.
  //
  //      Without this lookup, the workload table showed those supervisors
  //      with Assigned=1, Active=0, Completed=0 even when their student
  //      had multiple in-progress internship rows — because step (c) only
  //      matches by student_internships.faculty_supervisor_id.
  //
  //      We fetch all internship rows for the pre-assigned students and
  //      attach them to the supervisor via students.faculty_supervisor_id.
  //      Deduplicated against (c) by student_user_id+id so a row that has
  //      BOTH the SI.faculty_supervisor_id set AND a students-table
  //      assignment isn't double-counted.
  const preAssignedStudentIds = (preInternshipStudents || []).map((s) => s.user_id);
  const preAssignedStudentToSupervisor = new Map<string, string>();
  for (const s of preInternshipStudents || []) {
    preAssignedStudentToSupervisor.set(s.user_id, s.faculty_supervisor_id);
  }
  let implicitInternships: { student_user_id: string; status: string; id?: string }[] = [];
  if (preAssignedStudentIds.length > 0) {
    let implicitQuery = supabase
      .from("student_internships")
      .select("id, student_user_id, status")
      .in("student_user_id", preAssignedStudentIds);
    if (filters.department_id) {
      implicitQuery = implicitQuery.eq("department_id", filters.department_id);
    }
    if (filters.university_id) {
      implicitQuery = implicitQuery.eq("university_id", filters.university_id);
    }
    const { data: implicitData, error: implicitErr } = await implicitQuery;
    if (implicitErr) throw implicitErr;
    implicitInternships = implicitData || [];
  }

  // ---------- Aggregate per supervisor ----------
  const workloadData: SupervisorWorkload[] = [];

  for (const supervisor of supervisors) {
    const profile = supervisor.profiles as any;

    // Indirect: students in this supervisor's programs.
    const programIdsForSup = programIdsBySupervisor.get(supervisor.user_id);
    const indirectStudentIds = new Set<string>();
    if (programIdsForSup) {
      for (const ps of programStudents) {
        if (programIdsForSup.has(ps.program_id)) {
          indirectStudentIds.add(ps.user_id);
        }
      }
    }

    // Direct: student_internships where faculty_supervisor_id = this supervisor.
    //
    // "Active" supervisions = internships in the in-progress pipeline
    // (assigned + active + paused), matching the dashboard's
    // `inProgressInternships` definition. Previously this only counted
    // status='active', which made every supervisor look idle when most
    // of their students were still in 'assigned' (pre-start) status.
    //
    // Track which (student_user_id, internship_id) pairs we've already
    // counted via the explicit SI.faculty_supervisor_id path so we don't
    // double-count them again in the implicit-pre-assignment path below.
    const directStudentIds = new Set<string>();
    const countedInternshipIds = new Set<string>();
    let activeCount = 0;
    let completedCount = 0;
    for (const si of supervisorInternships || []) {
      if (si.faculty_supervisor_id !== supervisor.user_id) continue;
      directStudentIds.add(si.student_user_id);
      if (si.id) countedInternshipIds.add(si.id);
      if (["assigned", "active", "paused"].includes(si.status)) activeCount++;
      else if (si.status === "completed") completedCount++;
    }

    // Direct (pre-internship): students.faculty_supervisor_id = this supervisor.
    // These are students who were assigned a supervisor via the Students page
    // but haven't been placed in an internship yet.
    for (const s of preInternshipStudents || []) {
      if (s.faculty_supervisor_id !== supervisor.user_id) continue;
      directStudentIds.add(s.user_id);
    }

    // Implicit: internship rows belonging to students who were pre-assigned
    // to this supervisor via students.faculty_supervisor_id. The internship
    // row itself has faculty_supervisor_id = NULL (because it was created
    // AFTER the pre-assignment and the create-internship flow doesn't
    // backfill faculty_supervisor_id from the students table). We count
    // these rows toward this supervisor's active/completed totals so the
    // workload table reflects reality — the supervisor IS supervising
    // this student's internship, the linkage just lives one hop away.
    //
    // Dedupe by internship id against the explicit-SI set so a row that
    // has BOTH the SI.faculty_supervisor_id set AND a students-table
    // assignment isn't counted twice.
    for (const si of implicitInternships) {
      if (si.id && countedInternshipIds.has(si.id)) continue;
      const supUid = preAssignedStudentToSupervisor.get(si.student_user_id);
      if (supUid !== supervisor.user_id) continue;
      if (["assigned", "active", "paused"].includes(si.status)) activeCount++;
      else if (si.status === "completed") completedCount++;
    }

    // Union of indirect + direct student ids.
    const assignedSet = new Set<string>([...indirectStudentIds, ...directStudentIds]);

    workloadData.push({
      supervisor_id: supervisor.id,
      supervisor_name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown",
      supervisor_email: profile?.email || "",
      assigned_students: assignedSet.size,
      active_supervisions: activeCount,
      completed_supervisions: completedCount,
    });
  }

  // Sort by assigned students descending
  workloadData.sort((a, b) => b.assigned_students - a.assigned_students);

  return NextResponse.json<ApiResponse<SupervisorWorkload[]>>({
    success: true,
    data: workloadData,
  });
}

/**
 * Get monthly trends for charts
 */
async function getMonthlyTrends(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: Record<string, string | null>,
  year: number
): Promise<NextResponse<ApiResponse<MonthlyTrend[]>>> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Get monthly data
  const trends: MonthlyTrend[] = [];
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = month.toString().padStart(2, "0");
    const monthStart = `${year}-${monthStr}-01`;
    const monthEnd = new Date(year, month, 0).toISOString().split("T")[0];

    // Get student enrollments this month.
    // `students.user_id` (not `id`) is the PK.
    let enrollmentQuery = supabase
      .from("students")
      .select("user_id", { count: "exact" })
      .gte("created_at", monthStart)
      .lte("created_at", `${monthEnd}T23:59:59`);

    // Get internships started this month.
    // SECURITY FIX: previously these queries had NO department filter — they
    // returned global platform counts. `student_internships` has a denormalized
    // `department_id` column (mirrored from `students.department_id`) so we can
    // filter on it directly without a subquery.
    let startedQuery = supabase
      .from("student_internships")
      .select("id", { count: "exact" })
      .gte("created_at", monthStart)
      .lte("created_at", `${monthEnd}T23:59:59`);

    // Get internships completed this month
    let completedQuery = supabase
      .from("student_internships")
      .select("id", { count: "exact" })
      .gte("updated_at", monthStart)
      .lte("updated_at", `${monthEnd}T23:59:59`)
      .eq("status", "completed");

    if (filters.department_id) {
      enrollmentQuery = enrollmentQuery.eq("department_id", filters.department_id);
      startedQuery = startedQuery.eq("department_id", filters.department_id);
      completedQuery = completedQuery.eq("department_id", filters.department_id);
    }
    if (filters.university_id) {
      enrollmentQuery = enrollmentQuery.eq("university_id", filters.university_id);
      startedQuery = startedQuery.eq("university_id", filters.university_id);
      completedQuery = completedQuery.eq("university_id", filters.university_id);
    }

    const [enrollments, started, completed] = await Promise.all([
      enrollmentQuery,
      startedQuery,
      completedQuery,
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    trends.push({
      month: `${monthNames[month - 1]} ${year}`,
      internships_started: started.count || 0,
      internships_completed: completed.count || 0,
      students_enrolled: enrollments.count || 0,
    });
  }

  return NextResponse.json<ApiResponse<MonthlyTrend[]>>({
    success: true,
    data: trends,
  });
}

/**
 * Get detailed student report (for CSV export + on-page roster table)
 *
 * Each student row is enriched with:
 *   - profile (name, email, phone)
 *   - program (name, code)
 *   - department (name, code)
 *   - internship status (latest internship row, if any) — joined as a
 *     lateral SELECT to avoid N+1 queries
 *   - assigned faculty supervisor (name, email) — resolved via either
 *     `students.faculty_supervisor_id` (pre-internship assignment,
 *     migration 0041) OR `student_internships.faculty_supervisor_id`
 *     (internship-time assignment)
 *
 * This is the data source for BOTH the on-page Student Roster table and
 * the per-student section of the comprehensive CSV export. The previous
 * implementation only returned basic profile info and never included
 * internship/supervisor data — coordinators had no way to see, in one
 * view, "student X has internship Y with supervisor Z".
 */
async function getStudentReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: Record<string, string | null>,
  searchParams: URLSearchParams
): Promise<NextResponse<ApiResponse<any>>> {
  // NOTE: `students` table has no `id`, `enrollment_number`, `status`, or
  // `semester` columns (PK is `user_id`; identifier is `student_id_number`).
  // The `status` query param is silently ignored for backwards-compat.
  const programId = searchParams.get("program_id");
  const hasSupervisor = searchParams.get("has_supervisor");

  let query = supabase
    .from("students")
    .select(`
      user_id,
      student_id_number,
      enrollment_year,
      expected_graduation,
      cgpa,
      created_at,
      faculty_supervisor_id,
      profiles:user_id(first_name, last_name, email, phone),
      programs:program_id(name, code),
      departments:department_id(name, code)
    `);

  if (filters.department_id) {
    query = query.eq("department_id", filters.department_id);
  }
  if (filters.university_id) {
    query = query.eq("university_id", filters.university_id);
  }
  if (programId) {
    query = query.eq("program_id", programId);
  }

  const { data: students, error } = await query.order("student_id_number", { ascending: true });

  if (error) {
    throw error;
  }

  // Cast to any[] so we can replace the nested-join shape returned by
  // Supabase (with `profiles`, `programs`, `departments` as arrays)
  // with the flattened shape we build below. Without this cast TS
  // infers the original shape and refuses to let us reassign.
  let enrichedStudents: any[] = (students || []) as any[];

  // ----------------------------------------------------------------
  // Batch-fetch internship + supervisor info for ALL students in one
  // round-trip per table, then merge locally. This avoids the N+1 query
  // storm where each student triggered 2 separate queries.
  // ----------------------------------------------------------------
  const studentUserIds = enrichedStudents.map((s: any) => s.user_id);

  // (a) Latest internship per student (so we can show "Active",
  //     "Completed", "Not Started" in the roster). We fetch ALL rows
  //     and pick the latest locally because PostgREST doesn't support
  //     DISTINCT ON in the select() builder.
  let internshipByStudent = new Map<string, any>();
  let supervisorIdsFromInternships = new Set<string>();
  if (studentUserIds.length > 0) {
    const { data: internships, error: internshipsErr } = await supabase
      .from("student_internships")
      .select(`
        id,
        student_user_id,
        status,
        start_date,
        end_date,
        company_id,
        faculty_supervisor_id,
        created_at,
        companies:company_id(name)
      `)
      .in("student_user_id", studentUserIds)
      .order("created_at", { ascending: false });

    if (!internshipsErr && internships) {
      for (const si of internships) {
        if (!internshipByStudent.has(si.student_user_id)) {
          internshipByStudent.set(si.student_user_id, si);
          if (si.faculty_supervisor_id) {
            supervisorIdsFromInternships.add(si.faculty_supervisor_id);
          }
        }
      }
    }
  }

  // (b) Faculty supervisor profiles. Collect from BOTH:
  //     - `students.faculty_supervisor_id` (pre-internship assignment)
  //     - `student_internships.faculty_supervisor_id` (internship-time)
  //     Then fetch their profiles in one query.
  const allSupervisorIds = new Set<string>();
  for (const s of enrichedStudents) {
    if (s.faculty_supervisor_id) allSupervisorIds.add(s.faculty_supervisor_id);
  }
  for (const sid of supervisorIdsFromInternships) allSupervisorIds.add(sid);

  let supervisorProfileById = new Map<string, any>();
  if (allSupervisorIds.size > 0) {
    // CRITICAL: `faculty_supervisor_id` (on both `students` and
    // `student_internships`) REFERENCES `profiles.user_id`, NOT
    // `profiles.id`. The `profiles` table has NO `id` column at all —
    // its PRIMARY KEY is `user_id` (it's a 1:1 extension of
    // `auth.users`). The previous query used `.in("id", ...)` which
    // hit a non-existent column, returned an empty result set every
    // time, and silently made every student show "Unassigned" in the
    // roster — even when the assignment existed in the DB.
    const { data: supervisorProfiles, error: supErr } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", Array.from(allSupervisorIds));
    if (!supErr && supervisorProfiles) {
      for (const p of supervisorProfiles) {
        supervisorProfileById.set(p.user_id, p);
      }
    }
  }

  // ----------------------------------------------------------------
  // Merge everything into the final student roster rows.
  // ----------------------------------------------------------------
  enrichedStudents = enrichedStudents.map((s) => {
    const internship = internshipByStudent.get(s.user_id);
    // Prefer internship-time supervisor if set, else fall back to the
    // pre-internship assignment on `students.faculty_supervisor_id`.
    const supervisorId =
      internship?.faculty_supervisor_id || s.faculty_supervisor_id;
    const supervisorProfile = supervisorId
      ? supervisorProfileById.get(supervisorId)
      : null;

    return {
      user_id: s.user_id,
      student_id_number: s.student_id_number,
      enrollment_year: s.enrollment_year,
      expected_graduation: s.expected_graduation,
      cgpa: s.cgpa,
      created_at: s.created_at,
      first_name: s.profiles?.first_name ?? "",
      last_name: s.profiles?.last_name ?? "",
      email: s.profiles?.email ?? "",
      phone: s.profiles?.phone ?? "",
      program_name: s.programs?.name ?? "",
      program_code: s.programs?.code ?? "",
      department_name: s.departments?.name ?? "",
      department_code: s.departments?.code ?? "",
      // Internship info (null if the student hasn't started one yet)
      internship_status: internship?.status ?? null,
      internship_start_date: internship?.start_date ?? null,
      internship_end_date: internship?.end_date ?? null,
      internship_company: internship?.companies?.name ?? null,
      // Supervisor info (null if none assigned via either path)
      supervisor_name: supervisorProfile
        ? `${supervisorProfile.first_name || ""} ${supervisorProfile.last_name || ""}`.trim()
        : null,
      supervisor_email: supervisorProfile?.email ?? null,
    };
  });

  // Apply the optional `has_supervisor` filter (true/false) on the
  // enriched data — this is more accurate than the previous impl which
  // only checked `student_internships.faculty_supervisor_id` and
  // missed students assigned via `students.faculty_supervisor_id`.
  if (hasSupervisor === "true" || hasSupervisor === "false") {
    enrichedStudents = enrichedStudents.filter((s: any) =>
      hasSupervisor === "true" ? !!s.supervisor_name : !s.supervisor_name
    );
  }

  return NextResponse.json<ApiResponse<any>>({
    success: true,
    data: {
      students: enrichedStudents,
      total: enrichedStudents.length,
      generated_at: new Date().toISOString(),
    },
  });
}

/**
 * Get detailed internship report (for CSV export + on-page internship table)
 *
 * Each row is one `student_internships` row, enriched with:
 *   - student profile (name, email, student_id_number)
 *   - student program (name, code)
 *   - company (name, industry)
 *   - faculty supervisor (name, email)
 *
 * This gives coordinators a per-internship view that the previous
 * reports page lacked entirely — they could see counts ("2 in-progress
 * internships") but never the actual list of which student is at which
 * company with which supervisor.
 */
async function getInternshipDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: Record<string, string | null>
): Promise<NextResponse<ApiResponse<any>>> {
  // NOTE on the embeds:
  //   - `companies:company_id(name, industry)` — valid: `student_internships.company_id` REFERENCES `companies(id)`.
  //   - `students:student_user_id(profiles:user_id(...), programs:program_id(...))` — valid: `student_user_id` REFERENCES `students.user_id` (PK), then nested embeds resolve via `students.user_id -> profiles.user_id` and `students.program_id -> programs.id`.
  //   - `supervisor_profile:faculty_supervisor_id(first_name, last_name, email)` — valid: `student_internships.faculty_supervisor_id` REFERENCES `profiles.user_id` (PK). We use the alias `supervisor_profile` to avoid colliding with `students.profiles`.
  //
  // Previous code used `supervisors:faculty_supervisor_id(profiles:user_id(...))`, which
  // PostgREST REJECTED with a 400 (surfaced as 500 here) because there is NO
  // foreign key from `student_internships.faculty_supervisor_id` to the
  // `supervisors` table — the FK target is `profiles.user_id`. The route
  // then crashed with 500 on every call, which is why the Internships tab
  // showed nothing and the browser console logged the fetch failure.
  let query = supabase
    .from("student_internships")
    .select(`
      id,
      student_user_id,
      status,
      start_date,
      end_date,
      created_at,
      updated_at,
      company_id,
      faculty_supervisor_id,
      companies:company_id(name, industry),
      students:student_user_id(
        student_id_number,
        profiles:user_id(first_name, last_name, email),
        programs:program_id(name, code)
      ),
      supervisor_profile:faculty_supervisor_id(first_name, last_name, email)
    `);

  if (filters.department_id) {
    query = query.eq("department_id", filters.department_id);
  } else if (filters.university_id) {
    query = query.eq("university_id", filters.university_id);
  }

  query = query.order("created_at", { ascending: false });

  const { data: internships, error } = await query;

  if (error) {
    throw error;
  }

  // Flatten the nested joins so the CSV exporter and the page UI can
  // read fields directly without digging through `students.profiles[0].first_name`.
  const flattened = (internships || []).map((si: any) => {
    const student = si.students;
    const profile = student?.profiles;
    const program = student?.programs;
    const company = si.companies;
    // The supervisor profile is embedded directly as `supervisor_profile`
    // (a to-one object, not an array). It's null when the internship row
    // has no `faculty_supervisor_id` set.
    const supervisor = si.supervisor_profile;

    return {
      internship_id: si.id,
      status: si.status,
      start_date: si.start_date,
      end_date: si.end_date,
      created_at: si.created_at,
      updated_at: si.updated_at,
      // Student
      student_user_id: si.student_user_id,
      student_name:
        profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
          : "",
      student_email: profile?.email ?? "",
      student_id_number: student?.student_id_number ?? "",
      program_name: program?.name ?? "",
      program_code: program?.code ?? "",
      // Company
      company_name: company?.name ?? "",
      company_industry: company?.industry ?? "",
      // Faculty supervisor
      supervisor_name: supervisor
        ? `${supervisor.first_name || ""} ${supervisor.last_name || ""}`.trim()
        : "",
      supervisor_email: supervisor?.email ?? "",
    };
  });

  return NextResponse.json<ApiResponse<any>>({
    success: true,
    data: {
      internships: flattened,
      total: flattened.length,
      generated_at: new Date().toISOString(),
    },
  });
}
