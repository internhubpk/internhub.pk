import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isSuperAdminError, superAdminErrorBody } from "@/lib/super-admin";
import type { ApiResponse } from "@/types";

/**
 * DELETE /api/super-admin/universities/[id]
 *
 * PERMANENTLY deletes a university and everything under it:
 *   - all user accounts (university admin, coordinators, supervisors,
 *     students) — both their profiles rows and their auth.users entries
 *   - departments, programs, student records, tasks, weekly logs,
 *     evaluations, certificates, reports, MOUs, holidays, licenses…
 *   - internships posted to the university
 *   - companies registered under the university (with their own accounts,
 *     internships, applications…)
 *
 * Delegated to the SECURITY DEFINER SQL function
 * internhub.hard_delete_university(uuid) (migration 0098), which deletes in
 * FK-dependency order and returns a summary count.
 *
 * Super Admin only. NOT a soft delete — the UI must confirm explicitly.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing university id" },
        { status: 400 }
      );
    }

    const ctx = await requireSuperAdmin();
    if (isSuperAdminError(ctx)) {
      const err = superAdminErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, admin } = ctx;

    // Existence check for a clean 404 (and to capture the name for the audit
    // log before the row disappears).
    const { data: university } = await admin
      .from("universities")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (!university) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "University not found" },
        { status: 404 }
      );
    }

    // Run the cascade delete.
    const { data: result, error: rpcError } = await admin.rpc(
      "hard_delete_university",
      { p_university_id: id }
    );

    if (rpcError) {
      console.error("[super-admin/universities DELETE] RPC failed:", rpcError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete university: ${rpcError.message}` },
        { status: 500 }
      );
    }

    const summary = (result || {}) as Record<string, unknown>;
    if (summary.error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: String(summary.error) },
        { status: 404 }
      );
    }

    // Audit trail (best-effort — the audit_logs insert runs AFTER the
    // cascade, which deletes this university's old audit rows; this new row
    // survives because it references the SUPER ADMIN as actor).
    await admin.from("audit_logs").insert({
      user_id: callerUserId,
      action: "super_admin.hard_delete_university",
      entity_type: "university",
      entity_id: id,
      old_values: { name: university.name },
      new_values: summary,
    });

    return NextResponse.json<
      ApiResponse<{
        deleted_profiles: number;
        deleted_auth_users: number;
        deleted_companies: number;
      }>
    >({
      success: true,
      data: {
        deleted_profiles: Number(summary.deleted_profiles || 0),
        deleted_auth_users: Number(summary.deleted_auth_users || 0),
        deleted_companies: Number(summary.deleted_companies || 0),
      },
      message: `University "${university.name}" deleted along with ${
        Number(summary.deleted_auth_users || 0)
      } user account(s)`,
    });
  } catch (error) {
    console.error("[super-admin/universities DELETE] error:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
