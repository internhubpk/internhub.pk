import { NextRequest, NextResponse } from "next/server";
import { getCaller, isCallerError, callerErrorBody, canManageTarget } from "@/lib/user-admin";
import type { ApiResponse } from "@/types";

/**
 * PUT /api/supervisors/[id]
 *
 * Edit a FACULTY supervisor account (the accounts managed from the
 * Program Coordinator → Supervisors and Department Coordinator →
 * Supervisors pages — profiles with role='faculty_supervisor').
 *
 *   { full_name?, email?, phone?, specialization?, is_active?, department_id? }
 *
 * DELETE /api/supervisors/[id]
 *
 * Permanently delete a faculty supervisor account via
 * public.hard_delete_user(uuid). Their supervisors row, evaluations and
 * assignments cascade; evaluations they wrote survive with evaluator NULL.
 *
 * Permissions (both methods):
 *   - super_admin          → any faculty supervisor
 *   - university_admin     → faculty supervisors of their university
 *   - program_coordinator  → faculty supervisors of their university
 *   - department_coordinator → faculty supervisors of their university
 *
 * Company-side supervisors (site supervisors) are managed through
 * /api/company-hr/supervisors/[id] and are NOT addressable here.
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supervisorId } = await params;
    if (!supervisorId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing supervisor id" },
        { status: 400 }
      );
    }

    const ctx = await getCaller();
    if (isCallerError(ctx)) {
      const err = callerErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, caller, admin } = ctx;

    if (!admin) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfigured (missing service role key)" },
        { status: 500 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      full_name?: string;
      email?: string;
      phone?: string;
      specialization?: string;
      is_active?: boolean;
      department_id?: string | null;
    };

    // ------------------------------------------------------------------
    // Fetch + scope-check the target.
    // ------------------------------------------------------------------
    const { data: target } = await admin
      .from("profiles")
      .select("user_id, role, university_id, email, full_name")
      .eq("user_id", supervisorId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Supervisor not found" },
        { status: 404 }
      );
    }

    if (target.role !== "faculty_supervisor") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "This route manages faculty supervisors only. Company site supervisors are managed from the Company HR dashboard.",
        },
        { status: 400 }
      );
    }

    if (!canManageTarget(caller, { university_id: target.university_id })) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: you can only manage supervisors of your own university" },
        { status: 403 }
      );
    }

    // ------------------------------------------------------------------
    // Validate + build updates.
    // ------------------------------------------------------------------
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.full_name === "string") {
      const name = body.full_name.trim();
      if (name.length < 2) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Full name must be at least 2 characters" },
          { status: 400 }
        );
      }
      updates.full_name = name;
      updates.first_name = name.split(" ")[0];
      updates.last_name = name.split(" ").slice(1).join(" ") || null;
    }
    if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
    if (typeof body.specialization === "string") {
      updates.specialization = body.specialization.trim() || null;
    }
    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
      updates.status = body.is_active ? "active" : "inactive";
    }
    if (body.department_id !== undefined) {
      updates.department_id = body.department_id || null;
    }

    const newEmail =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    if (newEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // Auth updates (email) via GoTrue admin API.
    // ------------------------------------------------------------------
    if (newEmail && newEmail !== target.email) {
      const { error: authError } = await admin.auth.admin.updateUserById(supervisorId, {
        email: newEmail,
        email_confirm: true,
      });
      if (authError) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to update auth account: ${authError.message}` },
          { status: 500 }
        );
      }
      updates.email = newEmail;
    }

    if (Object.keys(updates).length > 1) {
      const { error: updateErr } = await admin
        .from("profiles")
        .update(updates)
        .eq("user_id", supervisorId);
      if (updateErr) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to update supervisor: ${updateErr.message}` },
          { status: 500 }
        );
      }
    }

    // Keep the supervisors row in sync (specialization lives there too).
    if (typeof body.specialization === "string") {
      await admin
        .from("supervisors")
        .update({ specialization: body.specialization.trim() || null })
        .eq("user_id", supervisorId);
    }

    await admin.from("audit_logs").insert({
      user_id: callerUserId,
      action: `${caller.role}.update_faculty_supervisor`,
      entity_type: "profile",
      entity_id: supervisorId,
      new_values: updates,
    });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      success: true,
      data: updates,
      message: "Supervisor updated",
    });
  } catch (error) {
    console.error("Error in PUT /api/supervisors/[id]:", error);
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
    const { id: supervisorId } = await params;
    if (!supervisorId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing supervisor id" },
        { status: 400 }
      );
    }

    const ctx = await getCaller();
    if (isCallerError(ctx)) {
      const err = callerErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, caller, admin } = ctx;

    if (!admin) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfigured (missing service role key)" },
        { status: 500 }
      );
    }

    if (supervisorId === callerUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const { data: target } = await admin
      .from("profiles")
      .select("user_id, role, university_id, email, full_name")
      .eq("user_id", supervisorId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Supervisor not found" },
        { status: 404 }
      );
    }

    if (target.role !== "faculty_supervisor") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "This route manages faculty supervisors only. Company site supervisors are managed from the Company HR dashboard.",
        },
        { status: 400 }
      );
    }

    if (!canManageTarget(caller, { university_id: target.university_id })) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: you can only delete supervisors of your own university" },
        { status: 403 }
      );
    }

    const { data: rpcResult, error: rpcError } = await admin.rpc("hard_delete_user", {
      p_user_id: supervisorId,
    });

    if (rpcError) {
      console.error("[DELETE /api/supervisors/[id]] RPC failed:", rpcError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete supervisor: ${rpcError.message}` },
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
      user_id: callerUserId,
      action: `${caller.role}.delete_faculty_supervisor`,
      entity_type: "profile",
      entity_id: supervisorId,
      old_values: { email: target.email },
      new_values: null,
    });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      success: true,
      data: result,
      message: `${target.full_name || target.email} permanently deleted`,
    });
  } catch (error) {
    console.error("Error in DELETE /api/supervisors/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
