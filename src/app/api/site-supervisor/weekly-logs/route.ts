import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";
import { getSupervisorColumn, isSupervisorRole } from "@/lib/supervisor-role";

// GET: Get weekly logs from assigned students
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user — student_internships.site_supervisor_id and
    // weekly_logs.supervisor_id both reference profiles.user_id, so we use
    // the auth user's id directly (RLS uses auth.uid() the same way).
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const supervisorUserId = user.id;

    // Determine supervisor column from caller's role.
    const { data: getProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!getProfile || !isSupervisorRole(getProfile.role as any)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Supervisor access required" } },
        { status: 403 }
      );
    }
    const supervisorColumn = getSupervisorColumn(getProfile.role as any);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status"); // submitted, approved, rejected
    const studentId = searchParams.get("studentId");
    const lateOnly = searchParams.get("lateOnly") === "true";

    // First get all assigned student user_ids (real column: student_user_id).
    const { data: assignments, error: assignError } = await supabase
      .from("student_internships")
      .select("student_user_id")
      .eq(supervisorColumn, supervisorUserId);

    if (assignError) {
      console.error("Error fetching assignments:", assignError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: assignError.message } },
        { status: 500 }
      );
    }

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

    // Build query for weekly logs using REAL schema columns:
    //   tasks_completed text[], challenges, learnings, next_week_goals,
    //   hours_worked, week_number (migration 0042 made it nullable w/ default).
    let query = supabase
      .from("weekly_logs")
      .select(`
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
        student_profile:student_user_id(full_name, first_name, last_name, email, avatar_url)
      `, { count: "exact" })
      .eq(supervisorColumn, supervisorUserId)
      .in("student_user_id", studentIds);

    if (status) {
      query = query.eq("status", status);
    }
    if (studentId) {
      query = query.eq("student_user_id", studentId);
    }

    // Filter for late logs if requested
    if (lateOnly) {
      // A log is considered late if it was submitted after the week end date + 3 days grace period
      query = query.filter('submitted_at', 'not.is', null);
      // Additional filtering will be done client-side or via more complex SQL
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("week_start_date", { ascending: false });

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("Error fetching weekly logs:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    // Process logs to determine which are late
    const processedLogs = (logs || []).map((log: any) => {
      const weekEnd = new Date(log.week_end_date);
      const submittedAt = log.submitted_at ? new Date(log.submitted_at) : null;
      const gracePeriodEnd = new Date(weekEnd.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days grace

      return {
        ...log,
        isLate: submittedAt ? submittedAt > gracePeriodEnd : false,
        daysLate: submittedAt && submittedAt > gracePeriodEnd
          ? Math.floor((submittedAt.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      };
    });

    // Apply late filter after processing
    const filteredLogs = lateOnly ? processedLogs.filter((log: any) => log.isLate) : processedLogs;

    const response: PaginatedResponse<any> = {
      items: filteredLogs,
      total: count || filteredLogs.length,
      page,
      pageSize,
      totalPages: Math.ceil((count || filteredLogs.length) / pageSize),
      hasNextPage: (page * pageSize) < (count || 0),
      hasPrevPage: page > 1,
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<any>>>({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Unexpected error in site-supervisor/weekly-logs:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PUT: Approve/reject log with feedback
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user — student_internships.site_supervisor_id and
    // weekly_logs.supervisor_id both reference profiles.user_id, so we use
    // the auth user's id directly.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const supervisorUserId = user.id;

    // Determine supervisor column from caller's role.
    const { data: putProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!putProfile || !isSupervisorRole(putProfile.role as any)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Supervisor access required" } },
        { status: 403 }
      );
    }
    const supervisorColumn = getSupervisorColumn(putProfile.role as any);

    const body = await request.json();
    const { logId, action, feedback } = body;

    if (!logId || !action || !['approve', 'reject', 'request_revision'].includes(action)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Valid log ID and action (approve/reject/request_revision) are required" } },
        { status: 400 }
      );
    }

    // Verify the log belongs to an assigned student. weekly_logs has no
    // `student_id` column — the student FK is `student_user_id`.
    const { data: log, error: logError } = await supabase
      .from("weekly_logs")
      .select("id, student_user_id, supervisor_id, week_start_date, week_end_date, status")
      .eq("id", logId)
      .single();

    if (logError || !log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found" } },
        { status: 404 }
      );
    }

    // Check if student is assigned to this supervisor. Filter by the
    // supervisor's user_id (profiles.user_id) — NOT the supervisors table
    // PK — and use `student_user_id`, not `student_id`.
    const { data: assignment } = await supabase
      .from("student_internships")
      .select("id")
      .eq(supervisorColumn, supervisorUserId)
      .eq("student_user_id", log.student_user_id)
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "This student is not assigned to you" } },
        { status: 403 }
      );
    }

    // Determine new status based on action
    const statusMap = {
      approve: "approved",
      reject: "rejected",
      request_revision: "revision_required",
    };

    const newStatus = statusMap[action as keyof typeof statusMap];

    // Update the log — all columns below exist on weekly_logs.
    // `site_supervisor_id` / `external_evaluator_id` (migration 0058/0071)
    // references profiles.user_id, so write the supervisor's user_id.
    // (Legacy `supervisor_id` column is left untouched.)
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      supervisor_feedback: feedback || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Write to the role-specific supervisor_id column.
    updatePayload[supervisorColumn] = supervisorUserId;

    const { data: updatedLog, error: updateError } = await supabase
      .from("weekly_logs")
      .update(updatePayload)
      .eq("id", logId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating weekly log:", updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    // Create notification for student about log review. weekly_logs has no
    // `student_id` column — use `student_user_id`. week_number IS a real
    // column (migration 0042 made it nullable w/ default 1), but we use
    // week_start_date for the human-readable label.
    const weekLabel = log.week_start_date
      ? new Date(log.week_start_date).toLocaleDateString()
      : "the week";
    await supabase.from("notifications").insert({
      user_id: log.student_user_id,
      sender_id: supervisorUserId,
      title: `Weekly Log ${newStatus === 'approved' ? 'Approved' : 'Reviewed'}`,
      message: `Your weekly log for the week of ${weekLabel} has been ${newStatus.replace('_', ' ')}.${feedback ? ` Feedback: ${feedback}` : ''}`,
      category: "evaluation",
      priority: newStatus === "rejected" ? "high" : "medium",
      metadata: {
        log_id: logId,
        action,
        supervisor_id: supervisorUserId,
        sent_by: "site_supervisor",
      },
    });

    // Create audit log. `audit_logs` has a single `details` jsonb column
    // (migration 0042 also adds compat `old_values`/`new_values` columns).
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

  } catch (error) {
    console.error("Unexpected error updating weekly log:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
