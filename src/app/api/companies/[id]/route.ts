import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { ApiResponse, UserRole } from "@/types";

/**
 * PATCH /api/companies/[id]
 * Update a company record.
 *
 * Permissions:
 *   - super_admin    → any company, any field (incl. is_verified)
 *   - university_admin → only companies registered under THEIR university
 *                        (companies.university_id); cannot change
 *                        university_id or is_verified.
 *
 * DELETE /api/companies/[id]
 * Permanently remove a company.
 *
 *   - super_admin    → full cascade via public.hard_delete_company(uuid)
 *                      (migration 0098): every account, internship,
 *                      application, MOU, document … under the company.
 *   - university_admin → allowed ONLY for companies registered under their
 *                      university that have NO internships, applications,
 *                      student internship records or MOUs yet. The
 *                      company's HR / supervisor accounts are hard-deleted
 *                      first (hard_delete_user), then the company row.
 *                      If the company has live data the route returns 409
 *                      with an explanation (deactivate instead, or ask a
 *                      super admin to hard-delete).
 */

const COMPANY_FIELDS = [
  "name",
  "slug",
  "logo_url",
  "industry",
  "website",
  "size",
  "description",
  "address",
  "city",
  "country",
  "contact_person",
  "contact_email",
  "contact_phone",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    if (!companyId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing company id" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfigured (service role key missing)" },
        { status: 500 }
      );
    }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("user_id, role, university_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = callerProfile?.role as UserRole | undefined;
    const isSuperAdmin = role === "super_admin";
    const isUniAdmin = role === "university_admin";

    if (!isSuperAdmin && !isUniAdmin) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Super Admin or University Admin access required" },
        { status: 403 }
      );
    }

    const { data: company } = await admin
      .from("companies")
      .select("id, name, university_id")
      .eq("id", companyId)
      .maybeSingle();

    if (!company) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    if (isUniAdmin) {
      if (!callerProfile?.university_id || company.university_id !== callerProfile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Forbidden: you can only edit companies registered under your university" },
          { status: 403 }
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const field of COMPANY_FIELDS) {
      if (body[field] !== undefined) {
        const value = body[field];
        updates[field] = typeof value === "string" ? value.trim() || null : value;
      }
    }
    // Status flags: super admin can flip both; university admin only is_active.
    if (body.is_active !== undefined && typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }
    if (isSuperAdmin && typeof body.is_verified === "boolean") {
      updates.is_verified = body.is_verified;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Nothing to update" },
        { status: 400 }
      );
    }

    // Basic validations
    if (typeof updates.name === "string" && updates.name.length < 2) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Company name must be at least 2 characters" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateErr } = await admin
      .from("companies")
      .update(updates)
      .eq("id", companyId)
      .select()
      .single();

    if (updateErr) {
      console.error("[PATCH /api/companies/[id]] error:", updateErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to update company: ${updateErr.message}` },
        { status: 500 }
      );
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: `${isSuperAdmin ? "super_admin" : "university_admin"}.update_company`,
      entity_type: "company",
      entity_id: companyId,
      new_values: updates,
    });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      success: true,
      data: updated,
      message: "Company updated",
    });
  } catch (error) {
    console.error("Error in PATCH /api/companies/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    if (!companyId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing company id" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfigured (service role key missing)" },
        { status: 500 }
      );
    }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("user_id, role, university_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = callerProfile?.role as UserRole | undefined;
    const isSuperAdmin = role === "super_admin";
    const isUniAdmin = role === "university_admin";

    if (!isSuperAdmin && !isUniAdmin) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Super Admin or University Admin access required" },
        { status: 403 }
      );
    }

    const { data: company } = await admin
      .from("companies")
      .select("id, name, university_id")
      .eq("id", companyId)
      .maybeSingle();

    if (!company) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    if (isSuperAdmin) {
      // Full cascade (accounts, internships, applications, MOUs, …).
      const { data: rpcResult, error: rpcError } = await admin.rpc("hard_delete_company", {
        p_company_id: companyId,
      });
      if (rpcError) {
        console.error("[DELETE /api/companies/[id]] RPC failed:", rpcError);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to delete company: ${rpcError.message}` },
          { status: 500 }
        );
      }
      const result = (rpcResult ?? {}) as Record<string, unknown>;
      if (result.error) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: String(result.error) },
          { status: 400 }
        );
      }
      await admin.from("audit_logs").insert({
        user_id: user.id,
        action: "super_admin.delete_company",
        entity_type: "company",
        entity_id: companyId,
        old_values: { name: company.name },
        new_values: null,
      });
      return NextResponse.json<ApiResponse<Record<string, unknown>>>({
        success: true,
        data: result,
        message: `${company.name} and everything under it were permanently deleted`,
      });
    }

    // ------------------------------------------------------------------
    // university_admin: scoped delete — only companies under their
    // university with NO live data.
    // ------------------------------------------------------------------
    if (!callerProfile?.university_id || company.university_id !== callerProfile.university_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: you can only delete companies registered under your university" },
        { status: 403 }
      );
    }

    // Block when the company already has ecosystem data.
    const [{ count: internshipCount }, { count: mouCount }, { count: applicationCount }] =
      await Promise.all([
        admin.from("internships").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        admin.from("mous").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        admin
          .from("internship_applications")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
      ]);

    if ((internshipCount || 0) > 0 || (mouCount || 0) > 0 || (applicationCount || 0) > 0) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            `This company already has ${internshipCount || 0} internship(s), ${mouCount || 0} MOU(s) and ` +
            `${applicationCount || 0} application(s). Deactivate it instead, or ask a Super Admin to ` +
            "permanently delete it with all of its data.",
        },
        { status: 409 }
      );
    }

    // Hard-delete every account that belongs to this company (HR +
    // supervisors), then the company row itself.
    const { data: members } = await admin
      .from("profiles")
      .select("user_id")
      .eq("company_id", companyId);

    for (const member of members || []) {
      const { data: r, error: e } = await admin.rpc("hard_delete_user", {
        p_user_id: member.user_id,
      });
      if (e || (r as Record<string, unknown>)?.error) {
        console.error("[DELETE /api/companies/[id]] member delete failed:", e, r);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to delete a company account: ${e?.message || (r as Record<string, unknown>)?.error}` },
          { status: 500 }
        );
      }
    }

    const { error: deleteErr } = await admin.from("companies").delete().eq("id", companyId);
    if (deleteErr) {
      console.error("[DELETE /api/companies/[id]] company delete failed:", deleteErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete company: ${deleteErr.message}` },
        { status: 500 }
      );
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "university_admin.delete_company",
      entity_type: "company",
      entity_id: companyId,
      old_values: { name: company.name, accounts_removed: (members || []).length },
      new_values: null,
    });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      success: true,
      data: { accounts_removed: (members || []).length },
      message: `${company.name} and its ${(members || []).length} account(s) were permanently deleted`,
    });
  } catch (error) {
    console.error("Error in DELETE /api/companies/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
