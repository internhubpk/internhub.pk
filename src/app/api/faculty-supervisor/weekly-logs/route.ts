import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

// ============================================================================
// GET /api/faculty-supervisor/weekly-logs
//   Returns weekly logs for students assigned to the authenticated faculty
//   supervisor. Supports filtering by status and student.
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const studentId = searchParams.get("studentId");

    // Find students assigned to this faculty supervisor.
    const { data: assignments } = await supabase
      .from("student_internships")
      .select("student_user_id")
      .eq("faculty_supervisor_id", user.id);

    const studentIds = (assignments || [])
      .map((a: any) => a.student_user_id)
      .filter((id: any): id is string => Boolean(id));

    if (studentIds.length === 0) {
      return NextResponse.json<ApiResponse<PaginatedResponse<null>>>({
        success: true,
        data: {
          items: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    let query = supabase
      .from("weekly_logs")
      .select(
        `
        id,
        student_user_id,
        supervisor_id,
        week_number,
        week_start_date,
        week_end_date,
        tasks_completed,
        challenges,
        learnings,
        next_week_goals,
        hours_worked,
        status,
        supervisor_feedback,
        reviewed_at,
        submitted_at,
        created_at,
        updated_at,
        program_name,
        department_name,
        university_logo_url,
        weekly_activities,
        learning_outcomes,
        challenges_solutions,
        supporting_evidence,
        student_signature_url,
        student_signed_at,
        site_supervisor_id,
        site_supervisor_signature_url,
        site_supervisor_remarks,
        site_supervisor_signed_at,
        faculty_supervisor_id,
        faculty_supervisor_signature_url,
        faculty_supervisor_remarks,
        faculty_supervisor_signed_at,
        student_profile:student_user_id(full_name, first_name, last_name, email, avatar_url, student_id_number)
        `,
        { count: "exact" }
      )
      .in("student_user_id", studentIds);

    if (status) query = query.eq("status", status);
    if (studentId) query = query.eq("student_user_id", studentId);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("week_start_date", { ascending: false });

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("[faculty/weekly-logs GET] db error:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<PaginatedResponse<any>>>({
      success: true,
      data: {
        items: logs || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
        hasNextPage: page * pageSize < (count || 0),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error("[faculty/weekly-logs GET] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/faculty-supervisor/weekly-logs
//   Review a weekly log: approve / reject / request_revision (no signature).
//   This is the legacy review endpoint — kept for parity with the site-
//   supervisor route. For the new sign-off flow, use POST /[id]/sign.
// ============================================================================
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { logId, action, feedback } = body;

    if (!logId || !action || !["approve", "reject", "request_revision"].includes(action)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "logId and action (approve/reject/request_revision) required" } },
        { status: 400 }
      );
    }

    const { data: log } = await supabase
      .from("weekly_logs")
      .select("id, student_user_id, status, week_start_date, week_end_date")
      .eq("id", logId)
      .single();

    if (!log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found" } },
        { status: 404 }
      );
    }

    // Verify assignment.
    const { data: assignment } = await supabase
      .from("student_internships")
      .select("id")
      .eq("faculty_supervisor_id", user.id)
      .eq("student_user_id", log.student_user_id)
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "This student is not assigned to you" } },
        { status: 403 }
      );
    }

    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      request_revision: "revision_required",
    };
    const newStatus = statusMap[action];

    const { data: updatedLog, error: updateError } = await supabase
      .from("weekly_logs")
      .update({
        status: newStatus,
        supervisor_feedback: feedback || null,
        supervisor_id: user.id,
        faculty_supervisor_id: user.id,
        faculty_supervisor_remarks: feedback || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId)
      .select()
      .single();

    if (updateError) {
      console.error("[faculty/weekly-logs PUT] db error:", updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    // Notify the student — uses the shared sendNotification helper so the
    // notification is also delivered via web push to subscribed devices.
    const weekLabel = log.week_start_date ? new Date(log.week_start_date).toLocaleDateString() : "the week";
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(supabase, {
      userId: log.student_user_id,
      senderId: user.id,
      title: `Weekly Log ${newStatus === "approved" ? "Approved" : "Reviewed"}`,
      message: `Your weekly log for the week of ${weekLabel} has been ${newStatus.replace("_", " ")} by your faculty supervisor.${feedback ? ` Feedback: ${feedback}` : ""}`,
      category: "evaluation",
      priority: newStatus === "rejected" ? "high" : "medium",
      actionUrl: "/student/weekly-logs",
      metadata: { type: "weekly_log_reviewed", log_id: logId, action, sent_by: "faculty_supervisor" },
    });

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `weekly_log_${action}`,
      entity_type: "weekly_log",
      entity_id: logId,
      details: { old: { status: log.status }, new: { status: newStatus, feedback } },
    });

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: updatedLog,
    });
  } catch (error: any) {
    console.error("[faculty/weekly-logs PUT] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
