import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      ),
    };
  }
  if (profile.role !== "company_hr") {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      ),
    };
  }
  return { profile, errorResponse: null };
}

// GET /api/company-hr/notifications — list notifications for the HR user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq("is_read", false);
    if (category && category !== "all") query = query.eq("category", category);

    const { data: notifications, count, error } = await query;
    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch notifications" } },
        { status: 500 }
      );
    }

    const unreadCount = (notifications || []).filter((n: any) => !n.is_read).length;

    return NextResponse.json({
      success: true,
      data: notifications || [],
      meta: { total: count || 0, unread: unreadCount },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PATCH /api/company-hr/notifications — mark as read / unread (bulk or single)
// body: { ids?: string[], id?: string, is_read?: boolean }
// body: { mark_all_read: true }
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { id, ids, is_read = true, mark_all_read } = body;

    const isReadValue = Boolean(is_read);
    let updateFilter: any = supabase.from("notifications").update({ is_read: isReadValue }).eq("user_id", user.id);

    if (mark_all_read) {
      // No id filter — affects all unread for this user
      updateFilter = updateFilter.eq("is_read", false);
    } else {
      const targetIds = Array.isArray(ids) && ids.length > 0 ? ids : id ? [id] : [];
      if (targetIds.length === 0) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "id, ids[], or mark_all_read is required" } },
          { status: 400 }
        );
      }
      updateFilter = updateFilter.in("id", targetIds);
    }

    const { data: updated, error: updateError } = await updateFilter.select();
    if (updateError) {
      console.error("Error updating notifications:", updateError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update notifications" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Updated ${updated?.length || 0} notification(s)`,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
