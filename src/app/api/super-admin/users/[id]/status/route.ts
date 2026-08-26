import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isSuperAdminError, superAdminErrorBody } from "@/lib/super-admin";
import type { ApiResponse } from "@/types";

/**
 * POST /api/super-admin/users/[id]/status
 * Body: { "status": "suspended" | "active" }
 *
 * Suspend / activate a user WITH ORGANIZATION-WIDE CASCADE (user request
 * 2026-08-27: "if he suspend any university or company admin account it
 * should suspend all the below users below him"):
 *
 *   - Target is a UNIVERSITY ADMIN  → every account under that university
 *     (coordinators, supervisors, students, …) is suspended/activated too.
 *   - Target is a COMPANY HR admin  → every account of that company
 *     (site supervisors, external evaluators, …) is suspended/activated too.
 *   - Any other account            → only that one account is affected.
 *
 * Suspending:
 *   - profiles.status = 'suspended', profiles.is_active = false
 *   - auth.users.banned_until = infinity  → cannot sign in or refresh tokens
 *   - auth.sessions deleted                → existing sessions die instantly
 *
 * Activating reverses all three.
 *
 * Implemented via the SECURITY DEFINER SQL function
 * internhub.cascade_set_users_suspended(uuid[], boolean) (migration 0098).
 * Super Admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing user id" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const newStatus = (body as { status?: string }).status;
    if (newStatus !== "suspended" && newStatus !== "active") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "status must be 'suspended' or 'active'" },
        { status: 400 }
      );
    }

    const ctx = await requireSuperAdmin();
    if (isSuperAdminError(ctx)) {
      const err = superAdminErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, admin } = ctx;

    // Never let the super admin suspend themselves out of the platform.
    if (targetUserId === callerUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You cannot change your own account status" },
        { status: 400 }
      );
    }

    // Fetch the target profile.
    const { data: target } = await admin
      .from("profiles")
      .select("user_id, email, full_name, role, university_id, company_id, status")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // ------------------------------------------------------------------
    // Determine the CASCADE SCOPE.
    // ------------------------------------------------------------------
    let scope: "university" | "company" | "single" = "single";
    let scopeLabel = "this account only";

    if (target.role === "university_admin" && target.university_id) {
      scope = "university";
      const { data: uni } = await admin
        .from("universities")
        .select("name")
        .eq("id", target.university_id)
        .maybeSingle();
      scopeLabel = `all accounts under ${uni?.name || "the university"}`;
    } else if (target.role === "company_hr" && target.company_id) {
      scope = "company";
      const { data: company } = await admin
        .from("companies")
        .select("name")
        .eq("id", target.company_id)
        .maybeSingle();
      scopeLabel = `all accounts of ${company?.name || "the company"}`;
    }

    // Collect the affected user ids.
    let userIds: string[] = [targetUserId];
    if (scope === "university" && target.university_id) {
      const { data: rows } = await admin
        .from("profiles")
        .select("user_id")
        .eq("university_id", target.university_id);
      userIds = (rows || []).map((r: { user_id: string }) => r.user_id);
    } else if (scope === "company" && target.company_id) {
      const { data: rows } = await admin
        .from("profiles")
        .select("user_id")
        .eq("company_id", target.company_id);
      userIds = (rows || []).map((r: { user_id: string }) => r.user_id);
    }

    if (userIds.length === 0) {
      userIds = [targetUserId];
    }

    const suspending = newStatus === "suspended";
    const { data: affected, error: rpcError } = await admin.rpc(
      "cascade_set_users_suspended",
      { p_user_ids: userIds, p_suspended: suspending }
    );

    if (rpcError) {
      console.error("[super-admin/users/status] RPC failed:", rpcError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to update status: ${rpcError.message}` },
        { status: 500 }
      );
    }

    // Audit trail (super admin as actor — never caught by the cascade).
    await admin.from("audit_logs").insert({
      user_id: callerUserId,
      action: suspending ? "super_admin.suspend_user_cascade" : "super_admin.activate_user_cascade",
      entity_type: "profile",
      entity_id: targetUserId,
      old_values: { status: target.status, scope },
      new_values: { status: newStatus, affected: affected ?? 0, scope },
    });

    return NextResponse.json<
      ApiResponse<{ affected: number; scope: typeof scope }>
    >({
      success: true,
      data: { affected: Number(affected || 0), scope },
      message: suspending
        ? `Suspended ${Number(affected || 0)} account(s) — ${scopeLabel}`
        : `Activated ${Number(affected || 0)} account(s) — ${scopeLabel}`,
    });
  } catch (error) {
    console.error("[super-admin/users/status] error:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
