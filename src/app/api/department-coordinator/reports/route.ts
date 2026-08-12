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
  let studentQuery = supabase
    .from("students")
    .select("user_id", { count: "exact" });

  let programQuery = supabase
    .from("programs")
    .select("id, is_active", { count: "exact" });

  let supervisorQuery = supabase
    .from("supervisors")
    .select("id", { count: "exact" })
    .eq("type", "faculty");

  let internshipQuery = supabase
    .from("student_internships")
    .select("id, status", { count: "exact" });

  // Apply department/university filters
  if (filters.department_id) {
    studentQuery = studentQuery.eq("department_id", filters.department_id);
    programQuery = programQuery.eq("department_id", filters.department_id);
    supervisorQuery = supervisorQuery.eq("department_id", filters.department_id);
    internshipQuery = internshipQuery.eq("department_id", filters.department_id);

    // For internships, also restrict to students in this department (defense-in-depth
    // in case the denormalized `department_id` on `student_internships` is NULL).
    const { data: deptStudents } = await supabase
      .from("students")
      .select("user_id")
      .eq("department_id", filters.department_id!);
    
    const studentIds = deptStudents?.map(s => s.user_id) || [];
    if (studentIds.length > 0) {
      internshipQuery = internshipQuery.in("student_user_id", studentIds);
    }
  }

  if (filters.university_id && !filters.department_id) {
    studentQuery = studentQuery.eq("university_id", filters.university_id);
    programQuery = programQuery.eq("university_id", filters.university_id);
    supervisorQuery = supervisorQuery.eq("university_id", filters.university_id);
  }

  // Execute all queries in parallel.
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
  ] = await Promise.all([
    studentQuery,
    programQuery,
    programQuery.eq("is_active", true),
    supervisorQuery,
    internshipQuery.eq("status", "active"),
    internshipQuery.eq("status", "completed"),
  ]);

  // Count students without supervisors (pending assignments)
  let pendingAssignmentsCount = 0;
  if (filters.department_id) {
    const { data: studentsWithoutSupervisor } = await supabase
      .from("students")
      .select("user_id")
      .eq("department_id", filters.department_id!)
      .not("program_id", "is", null);

    if (studentsWithoutSupervisor && studentsWithoutSupervisor.length > 0) {
      const studentIds = studentsWithoutSupervisor.map(s => s.user_id);
      
      const { count: assignedCount } = await supabase
        .from("student_internships")
        .select("id", { count: "exact" })
        .in("student_user_id", studentIds)
        .not("faculty_supervisor_id", "is", null);

      pendingAssignmentsCount = (studentsWithoutSupervisor.length) - (assignedCount || 0);
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
    if (programStudentIds.length > 0) {
      const [activeInternshipsResult, completedInternshipsResult] = await Promise.all([
        supabase
          .from("student_internships")
          .select("id", { count: "exact" })
          .eq("status", "active")
          .in("student_user_id", programStudentIds),
        supabase
          .from("student_internships")
          .select("id", { count: "exact" })
          .eq("status", "completed")
          .in("student_user_id", programStudentIds),
      ]);
      activeCount = activeInternshipsResult.count || 0;
      completedCount = completedInternshipsResult.count || 0;
    }

    const completionRate = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

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

  // Get assignment counts for each supervisor.
  // NOTE: student_internships.faculty_supervisor_id references
  // profiles.user_id, NOT the supervisors.id surrogate key.
  const workloadData: SupervisorWorkload[] = [];

  for (const supervisor of supervisors || []) {
    const [assignedResult, activeResult, completedResult] = await Promise.all([
      supabase.from("student_internships").select("id", { count: "exact" }).eq("faculty_supervisor_id", supervisor.user_id),
      supabase.from("student_internships").select("id", { count: "exact" }).eq("faculty_supervisor_id", supervisor.user_id).eq("status", "active"),
      supabase.from("student_internships").select("id", { count: "exact" }).eq("faculty_supervisor_id", supervisor.user_id).eq("status", "completed"),
    ]);

    const profile = supervisor.profiles as any;
    workloadData.push({
      supervisor_id: supervisor.id,
      supervisor_name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown",
      supervisor_email: profile?.email || "",
      assigned_students: assignedResult.count || 0,
      active_supervisions: activeResult.count || 0,
      completed_supervisions: completedResult.count || 0,
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
 * Get detailed student report (for CSV export)
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

  // Enrich with supervisor info if needed
  let enrichedStudents = students || [];

  if (hasSupervisor === "true" || hasSupervisor === "false") {
    const studentIds = enrichedStudents.map(s => s.user_id);
    
    if (studentIds.length > 0) {
      const { data: assignments } = await supabase
        .from("student_internships")
        .select("student_user_id, faculty_supervisor_id")
        .in("student_user_id", studentIds)
        .not("faculty_supervisor_id", "is", null);

      const studentsWithSupervisor = new Set(assignments?.map(a => a.student_user_id) || []);

      if (hasSupervisor === "true") {
        enrichedStudents = enrichedStudents.filter(s => studentsWithSupervisor.has(s.user_id));
      } else {
        enrichedStudents = enrichedStudents.filter(s => !studentsWithSupervisor.has(s.user_id));
      }
    }
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
