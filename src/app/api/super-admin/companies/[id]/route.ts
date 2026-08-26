import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isSuperAdminError, superAdminErrorBody } from "@/lib/super-admin";
import type { ApiResponse } from "@/types";

/**
 * DELETE /api/super-admin/companies/[id]
 *
 * PERMANENTLY deletes a company and everything under it:
 *   - all of its accounts (company HR, site supervisors, external
 *     evaluators) — both their profiles rows and auth.users entries
 *   - its internships, internship target-department rows, applications,
 *     student internship records, weekly logs written at those internships,
 *     evaluations, attendance, certificates, supervisor remarks…
 *   - MOUs and MoU invitations involving the company, documents,
 *     supervisors rows
 *
 * Delegated to the SECURITY DEFINER SQL function
 * internhub.hard_delete_company(uuid) (migration 0098), which deletes in
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
        { success: false, error: "Missing company id" },
        { status: 400 }
      );
    }

    const ctx = await requireSuperAdmin();
    if (isSuperAdminError(ctx)) {
      const err = superAdminErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, admin } = ctx;

    const { data: company } = await admin
      .from("companies")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (!company) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    const { data: result, error: rpcError } = await admin.rpc(
      "hard_delete_company",
      { p_company_id: id }
    );

    if (rpcError) {
      console.error("[super-admin/companies DELETE] RPC failed:", rpcError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete company: ${rpcError.message}` },
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

    await admin.from("audit_logs").insert({
      user_id: callerUserId,
      action: "super_admin.hard_delete_company",
      entity_type: "company",
      entity_id: id,
      old_values: { name: company.name },
      new_values: summary,
    });

    return NextResponse.json<
      ApiResponse<{ deleted_profiles: number; deleted_auth_users: number }>
    >({
      success: true,
      data: {
        deleted_profiles: Number(summary.deleted_profiles || 0),
        deleted_auth_users: Number(summary.deleted_auth_users || 0),
      },
      message: `Company "${company.name}" deleted along with ${
        Number(summary.deleted_auth_users || 0)
      } user account(s)`,
    });
  } catch (error) {
    console.error("[super-admin/companies DELETE] error:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
