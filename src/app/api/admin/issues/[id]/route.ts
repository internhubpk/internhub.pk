import { createClient } from "@/utils/supabase/server";
import { requireSuperAdmin, isSuperAdminError, superAdminErrorBody } from "@/lib/super-admin";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

const VALID_STATUSES = ["open", "working", "solved", "rejected"] as const;
type IssueStatus = (typeof VALID_STATUSES)[number];

// PATCH /api/admin/issues/[id] — update status (and optional admin_note).
// super_admin only. resolved_by/resolved_at are stamped automatically by
// the issue_reports_stamp_resolution trigger (migration 0105), not set here.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing issue id" }, { status: 400 });
    }

    const ctx = await requireSuperAdmin();
    if (isSuperAdminError(ctx)) {
      const err = superAdminErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const status = body.status as IssueStatus | undefined;
    const adminNote = typeof body.admin_note === "string" ? body.admin_note.trim() : undefined;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Use the caller's own RLS-respecting client, not the service-role
    // client — issue_reports_update policy already restricts UPDATE to
    // super_admin, so this both works correctly and stays defense-in-depth
    // consistent with GET /api/admin/issues.
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = { status };
    if (adminNote !== undefined) {
      updatePayload.admin_note = adminNote || null;
    }

    const { data, error } = await supabase
      .from("issue_reports")
      .update(updatePayload)
      .eq("id", id)
      .select("id, name, email, issue, status, admin_note, resolved_by, resolved_at, updated_at")
      .single();

    if (error) {
      console.error("PATCH /api/admin/issues/[id] error:", error);
      return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    return NextResponse.json({ issue: data });
  } catch (err) {
    console.error("PATCH /api/admin/issues/[id] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
