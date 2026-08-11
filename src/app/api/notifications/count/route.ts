import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: Get unread notification count for current user
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ count: 0 }, { status: 200 }); // Return 0 for unauthenticated
    }

    // Query unread notifications count using service role to bypass RLS if needed
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.debug("Notification count query failed:", error.message);
      
      // Return 0 on any error - don't break the UI for a badge count
      return NextResponse.json({ 
        count: 0, 
        available: false,
        note: "Notifications unavailable"
      });
    }

    return NextResponse.json({ 
      count: count || 0,
      available: true
    });
    
  } catch (error) {
    console.error("Notification count API error:", error);
    // Always return a valid response, never throw for a badge count
    return NextResponse.json({ count: 0, available: false });
  }
}
