import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/auth/change-password
 *
 * Universal password-change endpoint for ALL dashboard roles
 * (super_admin, university_admin, department_coordinator,
 *  faculty_supervisor, site_supervisor, company_hr, external_evaluator,
 *  student).
 *
 * Body: { current_password, new_password }
 *
 * Security model:
 *   - Caller must be authenticated (auth.getUser()).
 *   - We re-authenticate with current_password via signInWithPassword to
 *     prove the user actually knows their current password. This is more
 *     secure than calling updateUser({ password }) directly, which would
 *     allow changing the password from a hijacked session.
 *   - On success, we call supabase.auth.updateUser({ password }) — Supabase
 *     Auth handles the hashing; we never store passwords in DB tables.
 *   - RLS is NOT involved in password changes — auth.users lives in the
 *     `auth` schema, not `public`, and only the service-role / Auth Admin
 *     API can mutate it. The user's own access token is sufficient via
 *     updateUser().
 *   - We audit-log the change (no plaintext password stored).
 *
 * Responses:
 *   200 — success
 *   400 — validation error (weak password, missing fields)
 *   401 — wrong current password
 *   500 — unexpected error (no internals leaked to client)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { current_password, new_password } = body as {
      current_password?: string;
      new_password?: string;
    };

    if (!current_password || !new_password) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Both current_password and new_password are required." },
        },
        { status: 400 }
      );
    }

    if (typeof new_password !== "string" || new_password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "New password must be at least 8 characters long." },
        },
        { status: 400 }
      );
    }

    if (new_password.length > 128) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "New password is too long (max 128 characters)." },
        },
        { status: 400 }
      );
    }

    if (current_password === new_password) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "New password must be different from the current password." },
        },
        { status: 400 }
      );
    }

    // Re-authenticate by signing in with the current password. This proves
    // the user knows their password. We do NOT keep the new session —
    // signInWithPassword rotates the access token, but we discard it.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || "",
      password: current_password,
    });

    if (signInError) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PASSWORD", message: "Current password is incorrect." } },
        { status: 401 }
      );
    }

    // Update the password via Supabase Auth (handles hashing, salting,
    // token rotation). The user's existing session token is sufficient
    // because they just proved ownership via signInWithPassword.
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password,
    });

    if (updateError) {
      // Common cause: password too weak per Supabase Auth's strength policy.
      // We return the message verbatim because Supabase's messages are
      // already user-friendly ("Password should be at least 8 characters.")
      // and don't leak internals.
      return NextResponse.json(
        {
          success: false,
          error: { code: "AUTH_ERROR", message: updateError.message || "Failed to update password." },
        },
        { status: 400 }
      );
    }

    // Best-effort audit log. audit_logs has RLS but service-role writes
    // are allowed via the existing policy. We don't fail the request if
    // this fails — the password change already succeeded.
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "change_password",
        entity_type: "profile",
        entity_id: user.id,
        details: { at: new Date().toISOString() },
      });
    } catch {
      // Non-fatal.
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. Please use your new password the next time you sign in.",
    });
  } catch (error) {
    console.error("[/api/auth/change-password] unhandled:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
