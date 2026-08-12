import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

// GET: List ONLY assigned students (scoped by site_supervisor_id)
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

    // Get site supervisor record
    const { data: supervisor, error: supervisorError } = await supabase
      .from("supervisors")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "site")
      .single();

    if (supervisorError || !supervisor) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "No site supervisor record found" } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status"); // active, completed, etc.
    const programId = searchParams.get("programId");
    const evaluationDue = searchParams.get("evaluationDue"); // yes/no

    // Query assigned students via student_internships table
    let query = supabase
      .from("student_internships")
      .select(`
        id,
        student_id,
        internship_id,
        status,
        start_date,
        end_date,
        progress,
        last_evaluation_at,
        student:students(
          id,
          user_id,
          full_name,
          email,
          phone,
          avatar_url,
          university_id,
          department_id,
          program_id,
          enrollment_number
        ),
        internship:internships(
          id,
          title,
          company_id,
          status,
          start_date,
          end_date,
          duration_weeks
        ),
        evaluations:evaluations(
          id,
          overall_rating,
          decision,
          created_at
        )
      `, { count: "exact" })
      .eq("site_supervisor_id", supervisor.id);

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (programId) {
      query = query.eq("student.program_id", programId);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: assignments, error, count } = await query;

    if (error) {
      console.error("Error fetching assigned students:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    // Transform data for frontend
    const students = (assignments || []).map((assignment: any) => {
      const student = assignment.student || {};
      const internship = assignment.internship || {};
      const evaluations = assignment.evaluations || [];
      
      // Calculate days since last evaluation
      const lastEvalDate = assignment.last_evaluation_at 
        ? new Date(assignment.last_evaluation_at)
        : null;
      const daysSinceLastEval = lastEvalDate 
        ? Math.floor((Date.now() - lastEvalDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Get latest evaluation rating
      const latestEvaluation = evaluations.length > 0
        ? evaluations.reduce((latest: any, eval_: any) => 
            !latest || new Date(eval_.created_at) > new Date(latest.created_at) ? eval_ : latest
          , null)
        : null;

      return {
        id: assignment.id,
        studentId: student.id,
        studentName: student.full_name || "Unknown Student",
        studentEmail: student.email,
        studentPhone: student.phone,
        avatarUrl: student.avatar_url,
        enrollmentNumber: student.enrollment_number,
        universityId: student.university_id,
        departmentId: student.department_id,
        programId: student.program_id,
        internshipId: internship.id,
        internshipTitle: internship.title,
        companyId: internship.company_id,
        status: assignment.status,
        startDate: assignment.start_date,
        endDate: assignment.end_date,
        progress: assignment.progress || 0,
        lastEvaluationAt: assignment.last_evaluation_at,
        daysSinceLastEvaluation: daysSinceLastEval,
        latestRating: latestEvaluation?.overall_rating || null,
        latestDecision: latestEvaluation?.decision || null,
        totalEvaluations: evaluations.length,
      };
    });

    // Filter by evaluation due status if requested
    let filteredStudents = students;
    if (evaluationDue === "yes") {
      filteredStudents = students.filter((s: any) => 
        !s.daysSinceLastEvaluation || s.daysSinceLastEvaluation > 21
      );
    } else if (evaluationDue === "no") {
      filteredStudents = students.filter((s: any) => 
        s.daysSinceLastEvaluation !== null && s.daysSinceLastEvaluation <= 21
      );
    }

    const response: PaginatedResponse<typeof filteredStudents[0]> = {
      items: filteredStudents,
      total: count || filteredStudents.length,
      page,
      pageSize,
      totalPages: Math.ceil((count || filteredStudents.length) / pageSize),
      hasNextPage: (page * pageSize) < (count || 0),
      hasPrevPage: page > 1,
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<typeof filteredStudents[0]>>>({
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
