import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: Fetch notifications for the current user (their inbox)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const onlyUnread = searchParams.get("unread") === "true";

    // Build query - fetch notifications for this user
    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Filter by read status if requested
    if (onlyUnread) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, count, error } = await query;

    if (error) {
      console.error("Error fetching inbox notifications:", error);
      
      // If table doesn't exist or RLS issue, return empty rather than error
      if (error.code === "42P01" || error.code === "42501" || error.message?.includes("permission")) {
        return NextResponse.json({
          success: true,
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            note: "Notifications table not available"
          }
        });
      }
      
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Enrich with sender info from metadata
    const enrichedNotifications = (notifications || []).map(notification => ({
      ...notification,
      sender_name: notification.metadata?.sender_name || "System",
      sender_role: notification.metadata?.sender_role || "system",
    }));

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
    console.error("Inbox GET API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Mark notification(s) as read
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, mark_all_read } = body;

    let query;

    if (mark_all_read) {
      // Mark all notifications as read for this user
      query = supabase
        .from("notifications")
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq("user_id", user.id)
        .eq("is_read", false);
    } else if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      query = supabase
        .from("notifications")
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .in("id", notification_ids)
        .eq("user_id", user.id); // Security: ensure users can only mark their own
    } else {
      return NextResponse.json(
        { error: "Either notification_ids or mark_all_read is required" },
        { status: 400 }
      );
    }

    const { error } = await query;

    if (error) {
      console.error("Error marking notifications as read:", error);
      
      // Handle table/permission issues gracefully
      if (error.code === "42P01" || error.code === "42501") {
        return NextResponse.json({
          success: true,
          message: "Notifications not available",
          updated: 0
        });
      }
      
      return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: mark_all_read ? "All notifications marked as read" : "Notifications marked as read",
    });
  } catch (error) {
    console.error("Inbox PATCH API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
