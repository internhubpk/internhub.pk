import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

// POST: Send notification to assigned students only
export async function POST(request: NextRequest) {
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
    const { recipientType, studentIds, title, content, priority = "medium" } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Title and content are required" } },
        { status: 400 }
      );
    }

    if (!recipientType || !["individual", "broadcast"].includes(recipientType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Recipient type must be 'individual' or 'broadcast'" } },
        { status: 400 }
      );
    }

    // Get all assigned student IDs
    const { data: assignments, error: assignError } = await supabase
      .from("student_internships")
      .select("student_id, student:students(user_id)")
      .eq("site_supervisor_id", supervisor.id);

    if (assignError) {
      console.error("Error fetching assignments:", assignError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: assignError.message } },
        { status: 500 }
      );
    }

    // Determine recipients
    let targetStudentIds: string[] = [];
    
    if (recipientType === "broadcast") {
      // Send to ALL assigned students
      targetStudentIds = assignments?.map(a => a.student_id) || [];
    } else {
      // Send to specific students - verify they are assigned to this supervisor
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Student IDs array is required for individual notifications" } },
          { status: 400 }
        );
      }

      const assignedStudentIds = assignments?.map(a => a.student_id) || [];
      const invalidIds = studentIds.filter((id: string) => !assignedStudentIds.includes(id));
      
      if (invalidIds.length > 0) {
        return NextResponse.json<ApiResponse<null>>(
          { 
            success: false, 
            error: { 
              code: "FORBIDDEN", 
              message: `The following students are not assigned to you: ${invalidIds.join(", ")}` 
            } 
          },
          { status: 403 }
        );
      }

      targetStudentIds = studentIds;
    }

    if (targetStudentIds.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NO_RECIPIENTS", message: "No valid recipients found" } },
        { status: 400 }
      );
    }

    // Get user IDs for the target students
    const targetAssignments = assignments?.filter(a => targetStudentIds.includes(a.student_id)) || [];
    const userIds = targetAssignments.map(a => (a as any).student?.user_id).filter(Boolean);

    // Create notifications for each student
    const notifications = userIds.map((userId: string) => ({
      user_id: userId,
      title,
      message: content,
      category: "announcement" as const,
      priority,
      sender_id: user.id,
      metadata: {
        sent_by: "site_supervisor",
        supervisor_id: supervisor.id,
        recipient_type: recipientType,
      },
    }));

    const { data: createdNotifications, error: insertError } = await supabase
      .from("notifications")
      .insert(notifications)
      .select();

    if (insertError) {
      console.error("Error creating notifications:", insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "send_notification",
      entity_type: "notification",
      new_values: {
        recipient_type: recipientType,
        recipient_count: targetStudentIds.length,
        title,
      },
    });

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        sentCount: createdNotifications?.length || 0,
        recipientCount: targetStudentIds.length,
        recipients: targetStudentIds,
      },
    });

  } catch (error) {
    console.error("Unexpected error sending notification:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// GET: Get sent notifications history
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

    // Query notifications sent by this supervisor
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: notifications, error, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("metadata->>sent_by", "site_supervisor")
      .eq("metadata->>supervisor_id", supervisor.id)
      .range(from, to)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<any> = {
      items: notifications || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
      hasNextPage: (page * pageSize) < (count || 0),
      hasPrevPage: page > 1,
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<any>>>({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Unexpected error fetching notifications:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
