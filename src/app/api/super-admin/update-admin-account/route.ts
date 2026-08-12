import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ApiResponse } from "@/types";

/**
 * POST /api/super-admin/update-admin-account
 *
 * Updates an existing admin account's display name, email, and/or
 * password — Super Admin only. Used by the Universities page's "edit"
 * dialog, which lets a Super Admin view/update the university_admin
 * account tied to a university.
 *
 * Uses the service role key so email/password changes on auth.users
 * take effect (the publishable/anon key cannot call auth.admin.*).
 * The caller's own session is untouched — we never call signIn/signUp.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // No-op — we don't need to mutate cookies here.
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const callerRole =
      (user.app_metadata?.role as string | undefined) ??
      (user.user_metadata?.role as string | undefined);

    if (callerRole !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Super Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_id, full_name, email, password } = body as {
      user_id?: string;
      full_name?: string;
      email?: string;
      password?: string;
    };

    if (!user_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }
    if (password && password.length < 8) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (email && !email.includes("@")) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A valid email is required" },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(
        "[/api/super-admin/update-admin-account] SUPABASE_SERVICE_ROLE_KEY is not set."
      );
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Server misconfiguration: service role key is not set. Contact the platform administrator.",
        },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Update auth.users email/password if provided.
    if (email || password) {
      const authUpdate: { email?: string; password?: string } = {};
      if (email) authUpdate.email = email.trim();
      if (password) authUpdate.password = password;

      const { error: updateAuthError } =
        await adminClient.auth.admin.updateUserById(user_id, authUpdate);

      if (updateAuthError) {
        console.error(
          "[/api/super-admin/update-admin-account] updateUserById error:",
          updateAuthError
        );
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error: updateAuthError.message || "Failed to update admin account",
          },
          { status: 500 }
        );
      }
    }

    // Update the profiles row so it stays in sync with auth.users.
    const profileUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (full_name !== undefined) {
      profileUpdate.full_name = full_name.trim() || null;
      profileUpdate.first_name = full_name.trim().split(" ")[0] || null;
      profileUpdate.last_name =
        full_name.trim().split(" ").slice(1).join(" ") || null;
    }
    if (email) {
      profileUpdate.email = email.trim();
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user_id);

    if (profileError) {
      console.error(
        "[/api/super-admin/update-admin-account] profile update error:",
        profileError
      );
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Admin account was updated but the profile record failed to sync.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ user_id: string }>>({
      success: true,
      data: { user_id },
      message: "Admin account updated successfully",
    });
  } catch (error) {
    console.error(
      "[/api/super-admin/update-admin-account] unhandled error:",
      error
    );
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
