import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isSuperAdminError, superAdminErrorBody } from "@/lib/super-admin";
import type { ApiResponse } from "@/types";

/**
 * PUT /api/super-admin/users/[id]
 * Body: { full_name?, email?, phone?, password?, is_active? }
 *
 * Edit any user account (super admin):
 *   - profile fields (full_name / phone / is_active) via service role
 *   - auth email change + email confirmation reset via GoTrue admin API
 *   - optional password reset
 *
 * DELETE /api/super-admin/users/[id]
 *
 * Permanently delete a single user account (profile + auth.users + all data
 * where the user is the subject). Runs the SECURITY DEFINER SQL function
 * public.hard_delete_user(uuid) (migration 0100), which:
 *   - deletes the user's applications, weekly logs, evaluations, submissions,
 *     attendance, certificates, notifications, … (ON DELETE CASCADE FKs)
 *   - preserves records that merely reference the user as an actor
 *     (internships they created, evaluations they wrote → reference set NULL)
 *   - guards: self-deletion + last-active-super-admin deletion are blocked
 *
 * For deleting a whole university/company (with every account under it) use
 * DELETE /api/super-admin/universities/[id] or /companies/[id] instead.
 */

interface EditUserBody {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  is_active?: boolean;
}

export async function PUT(
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

    const ctx = await requireSuperAdmin();
    if (isSuperAdminError(ctx)) {
      const err = superAdminErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, admin } = ctx;

    const body = (await request.json().catch(() => ({}))) as EditUserBody;

    // ------------------------------------------------------------------
    // Validate inputs
    // ------------------------------------------------------------------
    const updates: Record<string, unknown> = {};
    if (typeof body.full_name === "string") {
      const name = body.full_name.trim();
      if (name.length < 2) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Full name must be at least 2 characters" },
          { status: 400 }
        );
      }
      updates.full_name = name;
    }
    if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
      updates.status = body.is_active ? "active" : "inactive";
    }

    const newEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    if (newEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }
    if (body.password !== undefined && body.password !== "" && body.password.length < 8) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // Fetch the target
    // ------------------------------------------------------------------
    const { data: target } = await admin
      .from("profiles")
      .select("user_id, email, full_name, role, status")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // ------------------------------------------------------------------
    // Update auth user (email / password) via GoTrue admin API
    // ------------------------------------------------------------------
    const authUpdates: Record<string, unknown> = {};
    if (newEmail && newEmail !== target.email) authUpdates.email = newEmail;
    if (body.password) authUpdates.password = body.password;
    if (newEmail && newEmail !== target.email) {
      // Force the user to re-confirm the new email on next sign-in flow.
      authUpdates.email_confirm = true;
      authUpdates.confirmation_sent_at = new Date().toISOString();
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await admin.auth.admin.updateUserById(
        targetUserId,
        authUpdates
      );
      if (authError) {
        console.error("[super-admin/users/PUT] auth update failed:", authError);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to update auth account: ${authError.message}` },
          { status: 500 }
        );
      }
    }

    // ------------------------------------------------------------------
    // Update profile row (name / phone / status + email mirror)
    // ------------------------------------------------------------------
    if (newEmail) updates.email = newEmail;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: profileError } = await admin
        .from("profiles")
        .update(updates)
        .eq("user_id", targetUserId);
      if (profileError) {
        console.error("[super-admin/users/PUT] profile update failed:", profileError);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to update profile: ${profileError.message}` },
          { status: 500 }
        );
      }
    }

    // Audit trail
    await admin.from("audit_logs").insert({
      user_id: callerUserId,
      action: "super_admin.update_user",
      entity_type: "profile",
      entity_id: targetUserId,
      old_values: { full_name: target.full_name, email: target.email },
      new_values: { ...updates, password_changed: Boolean(body.password) },
    });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      success: true,
      data: updates,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("[super-admin/users/PUT] error:", error);
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
    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing user id" },
        { status: 400 }
      );
    }

    const ctx = await requireSuperAdmin();
    if (isSuperAdminError(ctx)) {
      const err = superAdminErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, admin } = ctx;

    if (targetUserId === callerUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Fetch the target for the response message + audit context.
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

    // If the target is a university admin, warn the caller in the response
    // that the UNIVERSITY itself (and its other accounts) remain — deleting
    // the whole tree is a separate, explicit action from the Universities page.
    const { data: rpcResult, error: rpcError } = await admin.rpc("hard_delete_user", {
      p_user_id: targetUserId,
    });

    if (rpcError) {
      console.error("[super-admin/users/DELETE] RPC failed:", rpcError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete user: ${rpcError.message}` },
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

    // Audit trail
    await admin.from("audit_logs").insert({
      user_id: callerUserId,
      action: "super_admin.delete_user",
      entity_type: "profile",
      entity_id: targetUserId,
      old_values: { email: target.email, role: target.role, status: target.status },
      new_values: null,
    });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      success: true,
      data: result,
      message: `Permanently deleted ${target.full_name || target.email} and all of their personal data`,
    });
  } catch (error) {
    console.error("[super-admin/users/DELETE] error:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
