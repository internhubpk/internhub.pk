import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

// GET: Get weekly logs from assigned students
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
    const status = searchParams.get("status"); // submitted, approved, rejected
    const studentId = searchParams.get("studentId");
    const lateOnly = searchParams.get("lateOnly") === "true";

    // First get all assigned student IDs
    const { data: assignments, error: assignError } = await supabase
      .from("student_internships")
      .select("student_id")
      .eq("site_supervisor_id", supervisor.id);

    if (assignError) {
      console.error("Error fetching assignments:", assignError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: assignError.message } },
        { status: 500 }
      );
    }

    const studentIds = assignments?.map(a => a.student_id) || [];
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

    // Build query for weekly logs
    let query = supabase
      .from("weekly_logs")
      .select(`
        *,
        student:students(id, full_name, email, avatar_url),
        internship:internships(id, title)
      `, { count: "exact" })
      .in("student_id", studentIds);

    if (status) {
      query = query.eq("status", status);
    }
    if (studentId) {
      query = query.eq("student_id", studentId);
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

    const body = await request.json();
    const { logId, action, feedback } = body;

    if (!logId || !action || !['approve', 'reject', 'request_revision'].includes(action)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Valid log ID and action (approve/reject/request_revision) are required" } },
        { status: 400 }
      );
    }

    // Verify the log belongs to an assigned student
    const { data: log, error: logError } = await supabase
      .from("weekly_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError || !log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found" } },
        { status: 404 }
      );
    }

    // Check if student is assigned to this supervisor
    const { data: assignment } = await supabase
      .from("student_internships")
      .select("id")
      .eq("site_supervisor_id", supervisor.id)
      .eq("student_id", log.student_id)
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

    // Update the log
    const { data: updatedLog, error: updateError } = await supabase
      .from("weekly_logs")
      .update({
        status: newStatus,
        supervisor_feedback: feedback || null,
        supervisor_id: supervisor.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
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

    // Create notification for student about log review
    await supabase.from("notifications").insert({
      user_id: log.student_id,
      title: `Weekly Log ${newStatus === 'approved' ? 'Approved' : 'Reviewed'}`,
      message: `Your weekly log for Week ${log.week_number} has been ${newStatus.replace('_', ' ')}.${feedback ? ` Feedback: ${feedback}` : ''}`,
      category: "evaluation",
      priority: newStatus === "rejected" ? "high" : "medium",
      metadata: {
        log_id: logId,
        action,
      },
    });

    // Create audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `weekly_log_${action}`,
      entity_type: "weekly_log",
      entity_id: logId,
      old_values: { status: log.status },
      new_values: { status: newStatus, feedback },
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
