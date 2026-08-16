import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";
import { getSupervisorColumn, getEvaluatorRoleValue, isSupervisorRole } from "@/lib/supervisor-role";

// GET: List ONLY assigned students (scoped by site_supervisor_id).
//
// `student_internships.site_supervisor_id` references profiles.user_id, so
// we filter by the auth user's id (the supervisor's user_id) — NOT the
// supervisors table PK. RLS uses auth.uid() the same way.
//
// This route is not currently called by the students page (which queries
// Supabase directly), but it's kept correct for future callers.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Look up the caller's profile so we can determine which supervisor
    // column to filter on. site_supervisor filters on site_supervisor_id;
    // external_evaluator filters on external_evaluator_id. Both roles share
    // this same API route and the same UI pages.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!profile || !isSupervisorRole(profile.role as any)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Supervisor access required" } },
        { status: 403 }
      );
    }
    const supervisorColumn = getSupervisorColumn(profile.role as any);
    const evaluatorRoleValue = getEvaluatorRoleValue(profile.role as any);

    const supervisorUserId = user.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status"); // active, completed, etc.
    const evaluationDue = searchParams.get("evaluationDue"); // yes/no

    // Query assigned students via student_internships table. Use real
    // columns only — `student_id`, `progress`, `last_evaluation_at` don't
    // exist. Join `profiles` (not `students`) via `student_user_id`.
    let query = supabase
      .from("student_internships")
      .select(
        `
        id,
        student_user_id,
        internship_id,
        status,
        start_date,
        end_date,
        created_at,
        updated_at,
        student_profile:student_user_id(
          full_name,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          student_id_number
        ),
        internship:internships(
          id,
          title,
          company_id,
          status,
          start_date,
          end_date
        )
        `,
        { count: "exact" }
      )
      .eq(supervisorColumn, supervisorUserId);

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("updated_at", { ascending: false });

    const { data: assignments, error, count } = await query;

    if (error) {
      console.error("Error fetching assigned students:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    // Pull all student_user_ids so we can look up most-recent evaluation per
    // student in a single query (evaluations.evaluator_id is the supervisor's
    // user_id, NOT supervisors.id).
    const internRows = (assignments || []) as any[];
    const studentUserIds = internRows
      .map((r) => r.student_user_id)
      .filter((id: any): id is string => Boolean(id));

    let lastEvalByStudent = new Map<string, { date: string; rating: number | null }>();
    if (studentUserIds.length) {
      const { data: evals } = await supabase
        .from("evaluations")
        .select("id, student_user_id, created_at, rating")
        .eq("evaluator_id", supervisorUserId)
        .eq("evaluator_role", evaluatorRoleValue)
        .in("student_user_id", studentUserIds)
        .order("created_at", { ascending: false });
      (evals || []).forEach((ev: any) => {
        if (ev.student_user_id && !lastEvalByStudent.has(ev.student_user_id)) {
          lastEvalByStudent.set(ev.student_user_id, {
            date: ev.created_at,
            rating: typeof ev.rating === "number" ? ev.rating : null,
          });
        }
      });
    }

    // Transform data for frontend
    const students = internRows.map((assignment: any) => {
      const profile = assignment.student_profile || {};
      const internship = assignment.internship || {};
      const studentUser = assignment.student_user_id as string | undefined;
      const lastEvalInfo = studentUser ? lastEvalByStudent.get(studentUser) ?? null : null;
      const lastEvalDate = lastEvalInfo ? new Date(lastEvalInfo.date) : null;
      const daysSinceLastEval = lastEvalDate
        ? Math.floor((Date.now() - lastEvalDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const fullName =
        profile.full_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "Unknown Student";

      return {
        id: assignment.id,
        studentId: studentUser,
        studentName: fullName,
        studentEmail: profile.email || "",
        studentPhone: profile.phone ?? null,
        avatarUrl: profile.avatar_url ?? null,
        enrollmentNumber: profile.student_id_number ?? null,
        internshipId: internship.id,
        internshipTitle: internship.title,
        companyId: internship.company_id,
        status: assignment.status,
        startDate: assignment.start_date,
        endDate: assignment.end_date,
        // student_internships has no `progress` column — leave 0.
        progress: 0,
        lastEvaluationAt: lastEvalInfo?.date ?? null,
        daysSinceLastEvaluation: daysSinceLastEval,
        latestRating: lastEvalInfo?.rating ?? null,
        totalEvaluations: studentUser ? 0 : 0, // not fetched in this lightweight route
      };
    });

    // Filter by evaluation due status if requested
    let filteredStudents = students;
    if (evaluationDue === "yes") {
      filteredStudents = students.filter(
        (s: any) => !s.daysSinceLastEvaluation || s.daysSinceLastEvaluation > 21
      );
    } else if (evaluationDue === "no") {
      filteredStudents = students.filter(
        (s: any) => s.daysSinceLastEvaluation !== null && s.daysSinceLastEvaluation <= 21
      );
    }

    const response: PaginatedResponse<typeof filteredStudents[number]> = {
      items: filteredStudents,
      total: count || filteredStudents.length,
      page,
      pageSize,
      totalPages: Math.ceil((count || filteredStudents.length) / pageSize),
      hasNextPage: (page * pageSize) < (count || 0),
      hasPrevPage: page > 1,
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<typeof filteredStudents[number]>>>({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Unexpected error in site-supervisor/students:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
