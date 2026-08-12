import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ApiResponse, UserRole } from "@/types";

/**
 * POST /api/admin/create-user
 *
 * Creates a new auth.users row + profiles row WITHOUT affecting the
 * caller's session. This is the correct way for Super Admin to create
 * university_admin / company_hr / etc. accounts from the dashboard.
 *
 * WHY THIS EXISTS
 *   The previous flow called `supabase.auth.signUp()` from the browser
 *   using the publishable (anon) key. signUp() establishes a session for
 *   the NEW user by default, which means the Super Admin would get
 *   logged in as the newly created account — losing their super_admin
 *   session. Not good.
 *
 *   This route:
 *     1. Authenticates the caller with the cookie-bound SSR client
 *        (publishable key — same as everywhere else).
 *     2. Verifies the caller's role is 'super_admin' (from app_metadata,
 *        kept in sync with profiles.role by the profiles_sync_role_to_auth
 *        trigger — migration 0011).
 *     3. Uses a SECOND Supabase client constructed with the
 *        SERVICE_ROLE_KEY (server-only, never exposed to the browser) to
 *        call auth.admin.createUser(). This creates the user without
 *        establishing a session for them — the caller's session is
 *        untouched.
 *     4. The on_auth_user_created trigger inserts the profiles row
 *        automatically with role from raw_user_meta_data. We then upsert
 *        that row with the extra fields the caller passed (company_id,
 *        university_id, phone, job_title, etc.).
 *
 * AUTHORIZATION
 *   - Caller must be authenticated.
 *   - Caller's role (from app_metadata, kept in sync with profiles.role
 *     by the profiles_sync_role_to_auth trigger — migration 0011) must
 *     be 'super_admin'.
 *   - Request body role must be one of the non-super_admin roles
 *     (super_admin accounts can only be bootstrapped via 0004_bootstrap_admin).
 */

const ALLOWED_TARGET_ROLES: UserRole[] = [
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "company_hr",
  "site_supervisor",
  "external_evaluator",
];

export async function POST(request: NextRequest) {
  try {
    // ==========================================================
    // 1. Authenticate the caller via the cookie-bound SSR client.
    //    This is the publishable-key client — same as every other
    //    server route. We only use it to read the caller's session.
    // ==========================================================
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

    // Check role from app_metadata FIRST (kept in sync with profiles.role
    // by the profiles_sync_role_to_auth trigger — migration 0011).
    // Fall back to user_metadata for legacy accounts.
    const callerRole =
      (user.app_metadata?.role as UserRole | undefined) ??
      (user.user_metadata?.role as UserRole | undefined);

    if (callerRole !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Forbidden: Super Admin access required",
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // 2. Parse + validate the request body.
    // ==========================================================
    const body = await request.json();
    const {
      email,
      password,
      full_name,
      role,
      university_id,
      company_id,
      job_title,
      phone,
    } = body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: UserRole;
      university_id?: string;
      company_id?: string;
      job_title?: string;
      phone?: string;
    };

    if (!email || !email.includes("@")) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A valid email is required" },
        { status: 400 }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!role || !ALLOWED_TARGET_ROLES.includes(role)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Invalid role. Must be one of: ${ALLOWED_TARGET_ROLES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // 3. Build the admin client using the SERVICE_ROLE key.
    //    This is the only place in the codebase that uses the
    //    service role key — it NEVER leaves the server.
    // ==========================================================
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(
        "[/api/admin/create-user] SUPABASE_SERVICE_ROLE_KEY is not set. " +
          "Set it in your environment variables (Vercel project settings → Environment Variables → add SUPABASE_SERVICE_ROLE_KEY)."
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

    // ==========================================================
    // 4. Create the auth.users row. email_confirm: true so the new
    //    user can sign in immediately without clicking an email link.
    //    raw_user_meta_data carries the role + full_name — the
    //    on_auth_user_created trigger reads these and inserts the
    //    profiles row with role = company_hr / university_admin / etc.
    // ==========================================================
    const firstName = full_name?.trim().split(" ")[0] || null;
    const lastName = full_name?.trim().split(" ").slice(1).join(" ") || null;

    const { data: authData, error: authError2 } =
      await adminClient.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name?.trim() || null,
          first_name: firstName,
          last_name: lastName,
          role, // picked up by the on_auth_user_created trigger
          ...(university_id ? { university_id } : {}),
          ...(company_id ? { company_id } : {}),
          ...(job_title ? { job_title } : {}),
          ...(phone ? { phone } : {}),
        },
      });

    if (authError2) {
      console.error("[/api/admin/create-user] createUser error:", authError2);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: authError2.message || "Failed to create auth account",
        },
        { status: 500 }
      );
    }

    if (!authData?.user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // ==========================================================
    // 5. The on_auth_user_created trigger should have inserted a
    //    profiles row. Upsert it with the extra fields the caller
    //    passed (company_id, university_id, job_title, phone, etc.).
    //    Upsert handles both cases (trigger fired / didn't fire).
    // ==========================================================
    const profileUpdate: Record<string, unknown> = {
      user_id: authData.user.id,
      email: email.trim(),
      full_name: full_name?.trim() || null,
      first_name: firstName,
      last_name: lastName,
      role,
      status: "active",
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (university_id) profileUpdate.university_id = university_id;
    if (company_id) profileUpdate.company_id = company_id;
    if (job_title) profileUpdate.job_title = job_title?.trim() || null;
    if (phone) profileUpdate.phone = phone?.trim() || null;

    const { error: profileUpsertError } = await adminClient
      .from("profiles")
      .upsert(profileUpdate, { onConflict: "user_id" });

    if (profileUpsertError) {
      console.error(
        "[/api/admin/create-user] profile upsert error:",
        profileUpsertError
      );
      // Don't fail the whole request — the auth user was created
      // successfully, and the trigger likely already inserted a
      // minimal profile row. The super admin can edit it from the UI.
    }

    // ==========================================================
    // 6. Return the new user's id. The caller's session is NOT
    //    affected — they remain signed in as super_admin.
    // ==========================================================
    return NextResponse.json<ApiResponse<{ id: string; email: string; role: string }>>(
      {
        success: true,
        data: {
          id: authData.user.id,
          email: email.trim(),
          role,
        },
        message: "Account created. The new user can sign in with their email and password.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[/api/admin/create-user] unhandled error:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
