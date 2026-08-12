import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: List sent notifications with read receipts
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sender's profile.
    // NOTE: `profiles` uses `user_id` (uuid PK mirroring auth.users.id) —
    // there is no `id` column. Selecting `id` would make PostgREST return
    // HTTP 400. Use `user_id` instead.
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status"); // sent, delivered, read, failed
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    // Build query for notifications sent by this user (or system notifications for supervisors)
    let query = supabase
      .from("notifications")
      .select(`
        *,
        notification_recipients (
          id,
          user_id,
          is_read,
          read_at,
          delivered_at,
          profiles:user_id (
            full_name,
            email
          )
        )
      `, { count: "exact" })
      .or(`sender_id.eq.${user.id},and(sender_id.is.null,type.eq.system)`)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status && status !== "all") {
      // For status filtering, we need to check recipient status
      // This is a simplified version - in production you'd use a more complex query
    }
    
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
    }

    const { data: notifications, count, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Calculate statistics for each notification
    const enrichedNotifications = (notifications || []).map(notification => {
      const recipients = notification.notification_recipients || [];
      return {
        ...notification,
        recipient_count: recipients.length,
        read_count: recipients.filter(r => r.is_read).length,
        delivered_count: recipients.filter(r => r.delivered_at).length,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedNotifications,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Notifications GET API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Send notification to students
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sender's profile (user_id, not id — profiles has no `id` column)
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only faculty supervisors and above can send notifications
    if (!["faculty_supervisor", "department_coordinator", "university_admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to send notifications" },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const {
      title,
      message,
      priority = "medium",
      target_type, // 'individual', 'program', 'department', 'all'
      target_id, // Student ID or Program ID or Department ID
      action_url,
      metadata = {},
    } = body;

    // Validate required fields
    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      );
    }

    if (!target_type) {
      return NextResponse.json(
        { error: "Target type is required" },
        { status: 400 }
      );
    }

    const validTargetTypes = ["individual", "program", "department", "all"];
    if (!validTargetTypes.includes(target_type)) {
      return NextResponse.json(
        { error: `Invalid target_type. Must be one of: ${validTargetTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }

    // Determine recipients based on target type
    let recipientUserIds: string[] = [];

    if (target_type === "all") {
      // For faculty supervisors, get all students in their supervised programs
      if (profile.role === "faculty_supervisor") {
        const { data: supervisor } = await supabase
          .from("supervisors")
          .select("program_ids")
          .eq("user_id", user.id)
          .eq("type", "faculty")
          .single();

        const programIds = supervisor?.program_ids || [];
        
        if (programIds.length > 0) {
          const { data: students } = await supabase
            .from("students")
            .select("user_id")
            .in("program_id", programIds);
          
          recipientUserIds = students?.map(s => s.user_id) || [];
        }
      } else {
        // For admins/coordinators, get all students in their scope
        const { data: students } = await supabase
          .from("students")
          .select("user_id");
        
        recipientUserIds = students?.map(s => s.user_id) || [];
      }
    } else if (target_type === "individual") {
      if (!target_id) {
        return NextResponse.json(
          { error: "Target ID (student ID) is required for individual targeting" },
          { status: 400 }
        );
      }

      // Verify student exists and is accessible
      const { data: student } = await supabase
        .from("students")
        .select("user_id, program_id")
        .eq("id", target_id)
        .single();

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      // If faculty supervisor, verify student is in supervised programs
      if (profile.role === "faculty_supervisor") {
        const { data: supervisor } = await supabase
          .from("supervisors")
          .select("program_ids")
          .eq("user_id", user.id)
          .eq("type", "faculty")
          .single();

        const programIds = supervisor?.program_ids || [];
        
        if (!programIds.includes(student.program_id)) {
          return NextResponse.json(
            { error: "Student is not in your supervised programs" },
            { status: 403 }
          );
        }
      }

      recipientUserIds = [student.user_id];
    } else if (target_type === "program") {
      if (!target_id) {
        return NextResponse.json(
          { error: "Program ID is required for program targeting" },
          { status: 400 }
        );
      }

      // Get all students in this program
      const { data: students } = await supabase
        .from("students")
        .select("user_id")
        .eq("program_id", target_id);

      recipientUserIds = students?.map(s => s.user_id) || [];
    } else if (target_type === "department") {
      if (!target_id) {
        return NextResponse.json(
          { error: "Department ID is required for department targeting" },
          { status: 400 }
        );
      }

      // Get all programs in this department, then all students in those programs
      const { data: programs } = await supabase
        .from("programs")
        .select("id")
        .eq("department_id", target_id);

      const programIds = programs?.map(p => p.id) || [];
      
      if (programIds.length > 0) {
        const { data: students } = await supabase
          .from("students")
          .select("user_id")
          .in("program_id", programIds);
        
        recipientUserIds = students?.map(s => s.user_id) || [];
      }
    }

    if (recipientUserIds.length === 0) {
      return NextResponse.json(
        { error: "No recipients found for the specified target" },
        { status: 400 }
      );
    }

    // Create the notification record
    const { data: notification, error: notifError } = await supabase
      .from("notifications_sent")
      .insert({
        sender_id: user.id,
        title,
        message,
        category: "announcement",
        priority,
        target_type,
        target_id: target_id || null,
        recipient_count: recipientUserIds.length,
        action_url: action_url || null,
        metadata,
      })
      .select()
      .single();

    if (notifError) {
      console.error("Error creating notification:", notifError);
      return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
    }

    // Create notification records for each recipient
    const recipientRecords = recipientUserIds.map(userId => ({
      notification_id: notification.id,
      user_id: userId,
      is_read: false,
    }));

    const { error: recipError } = await supabase
      .from("notification_recipients")
      .insert(recipientRecords);

    if (recipError) {
      console.error("Error creating recipient records:", recipError);
      // Non-fatal - notification was created but some recipients may not receive it
    }

    // Also insert into main notifications table for real-time delivery
    const notificationRecords = recipientUserIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type: "announcement",
      category: "notification",
      priority,
      is_read: false,
      action_url: action_url || null,
      metadata: {
        ...metadata,
        notification_id: notification.id,
        sender_name: profile.full_name,
        sender_role: profile.role,
      },
    }));

    // Insert in batches to avoid payload limits
    const batchSize = 100;
    for (let i = 0; i < notificationRecords.length; i += batchSize) {
      const batch = notificationRecords.slice(i, i + batchSize);
      await supabase.from("notifications").insert(batch);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...notification,
        actual_recipient_count: recipientUserIds.length,
      },
      message: `Notification sent to ${recipientUserIds.length} recipient(s)`,
    });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
