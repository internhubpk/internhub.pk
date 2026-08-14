import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: Fetch notifications for the current user (their inbox)
//
// Auth handling: Returns 200 with an empty payload when the request is
// unauthenticated, mirroring the behaviour of `/api/notifications/count`.
// This is intentional — the inbox endpoint is polled every 60 s by the
// dashboard Header's bell-icon widget. Returning 401 for unauthenticated
// polling requests floods the browser console with red errors whenever
// the user's session has expired client-side but the AuthProvider still
// holds a stale `user.id`. The dashboard layout's RouteGuard already
// handles true session expiry by redirecting to /login, so the inbox
// endpoint does not need to surface 401s to the client.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Parse query parameters (needed for the empty-payload response below)
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const onlyUnread = searchParams.get("unread") === "true";

    if (authError || !user) {
      // Return 200 with empty data so the bell icon polling doesn't
      // spam the console with 401s. The dashboard layout's RouteGuard
      // will handle the actual session-expiry redirect separately.
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

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
//
// Same auth-handling rationale as GET: return 200 with `updated: 0`
// instead of 401 when unauthenticated, so the bell icon's mark-all-read
// fire-and-forget call doesn't surface errors in the console.
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: true,
        message: "Not authenticated — no notifications to update",
        updated: 0,
      });
    }

    const body = await request.json();
    const { notification_ids, mark_all_read } = body;

    let query;

    if (mark_all_read) {
      // Mark all notifications as read for this user
      query = supabase
        .from("notifications")
        .update({ 
          is_read: true
        })
        .eq("user_id", user.id)
        .eq("is_read", false);
    } else if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      query = supabase
        .from("notifications")
        .update({ 
          is_read: true
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
