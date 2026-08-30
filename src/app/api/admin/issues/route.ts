import { createClient } from "@/utils/supabase/server";
import { requireSuperAdmin, isSuperAdminError, superAdminErrorBody } from "@/lib/super-admin";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

// GET /api/admin/issues — platform-wide issue report list, super_admin only.
//
// Uses the caller's own cookie-bound client (NOT the service-role client)
// so the query is still filtered by RLS's issue_reports_select policy —
// belt-and-braces: requireSuperAdmin() already verified the role from the
// DB, and RLS independently verifies it again at the query level via
// internhub.is_super_admin(). Either check alone would be sufficient; both
// together mean a bug in one doesn't expose the data.
export async function GET(request: Request) {
  try {
    const ctx = await requireSuperAdmin();
    if (isSuperAdminError(ctx)) {
      const err = superAdminErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let query = supabase
      .from("issue_reports")
      .select("id, reporter_user_id, name, email, issue, status, admin_note, resolved_by, resolved_at, created_at, updated_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("GET /api/admin/issues error:", error);
      return NextResponse.json({ error: "Failed to load issues" }, { status: 500 });
    }

    return NextResponse.json({ issues: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    console.error("GET /api/admin/issues unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
