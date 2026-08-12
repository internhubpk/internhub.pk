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
 * university_admin / company_hr / etc. accounts, and for University Admin
 * to create department_coordinator / faculty_supervisor / student accounts
 * within their own university, from the dashboard.
 *
 * WHY THIS EXISTS
 *   The previous flow called `supabase.auth.signUp()` from the browser
 *   using the publishable (anon) key. signUp() establishes a session for
 *   the NEW user by default, which means the calling admin would get
 *   logged in as the newly created account — losing their own session.
 *   Not good.
 *
 *   This route:
 *     1. Authenticates the caller with the cookie-bound SSR client
 *        (publishable key — same as everywhere else).
 *     2. Verifies the caller's role is `super_admin` OR `university_admin`
 *        (from app_metadata, kept in sync with profiles.role by the
 *        profiles_sync_role_to_auth trigger — migration 0011).
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
 * AUTHORIZATION MATRIX
 *   ┌─────────────────────┬───────────────────────────────────────────────────┐
 *   │ Caller role         │ Allowed target roles                              │
 *   ├─────────────────────┼───────────────────────────────────────────────────┤
 *   │ super_admin         │ university_admin, department_coordinator,         │
 *   │                     │ faculty_supervisor, company_hr, site_supervisor,  │
 *   │                     │ external_evaluator, student                       │
 *   │ university_admin    │ department_coordinator, faculty_supervisor,       │
 *   │                     │ student (within their own university only)        │
 *   └─────────────────────┴───────────────────────────────────────────────────┘
 *
 *   For university_admin callers, the `university_id` field is FORCED to
 *   the caller's own university_id — any value passed in the request body
 *   is ignored. This prevents a university_admin from creating accounts in
 *   another university.
 */

// Roles a Super Admin can create.
const SUPER_ADMIN_TARGET_ROLES: UserRole[] = [
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "company_hr",
  "site_supervisor",
  "external_evaluator",
  "student",
];

// Roles a University Admin can create — limited to roles that live inside
// their own university. company_hr / site_supervisor / external_evaluator
// are not in this list because those roles are tied to a company, not a
// university.
const UNI_ADMIN_TARGET_ROLES: UserRole[] = [
  "department_coordinator",
  "faculty_supervisor",
  "student",
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

    if (callerRole !== "super_admin" && callerRole !== "university_admin") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Forbidden: Super Admin or University Admin access required",
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
      department_id,
      job_title,
      phone,
    } = body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: UserRole;
      university_id?: string;
      company_id?: string;
      department_id?: string;
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

    // Determine which target roles this caller is allowed to create.
    const allowedTargetRoles =
      callerRole === "super_admin"
        ? SUPER_ADMIN_TARGET_ROLES
        : UNI_ADMIN_TARGET_ROLES;

    if (!role || !allowedTargetRoles.includes(role)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Invalid role. As ${callerRole}, you may create: ${allowedTargetRoles.join(", ")}`,
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // 3. Resolve the effective university_id.
    //    - super_admin: use the value passed in the body (must be set).
    //    - university_admin: FORCE it to be the caller's own
    //      university_id (read from the profiles table) — ignore the
    //      body value entirely. This prevents privilege escalation.
    // ==========================================================
    let effectiveUniversityId: string | undefined;
    let effectiveDepartmentId: string | undefined = department_id;

    if (callerRole === "super_admin") {
      effectiveUniversityId = university_id;
      // super_admin creating a company_hr — university_id may be unset,
      // company_id may be set instead. That's fine.
    } else {
      // university_admin: fetch their profile to get university_id.
      const { data: callerProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("university_id, department_id")
        .eq("user_id", user.id)
        .single();

      if (profileErr || !callerProfile?.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "Your admin account is not linked to a university. Ask a Super Admin to assign you to a university first.",
          },
          { status: 403 }
        );
      }
      effectiveUniversityId = callerProfile.university_id;
      // If department_id was passed, validate it belongs to the same
      // university. (We rely on RLS to also enforce this — departments
      // outside the caller's university would not be SELECT-able, so the
      // INSERT below with that department_id would fail the composite FK
      // constraint.)
    }

    // ==========================================================
    // 4. Build the admin client using the SERVICE_ROLE key.
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
    // 5. Create the auth.users row. email_confirm: true so the new
    //    user can sign in immediately without clicking an email link.
    //
    //    We populate BOTH raw_user_meta_data (via user_metadata) AND
    //    raw_app_meta_data (via app_metadata) with the tenant ids.
    //    - user_metadata is read by the on_auth_user_created trigger
    //      to populate the profiles row.
    //    - app_metadata is system-managed and tamper-proof. The
    //      internhub.current_university_id/department_id/company_id
    //      helpers (migration 0013) read app_metadata FIRST, so the
    //      new user's RLS policies resolve to the correct tenant
    //      immediately — even before the profiles row is upserted
    //      in step 6 below.
    // ==========================================================
    const firstName = full_name?.trim().split(" ")[0] || null;
    const lastName = full_name?.trim().split(" ").slice(1).join(" ") || null;

    const userMetadata: Record<string, unknown> = {
      full_name: full_name?.trim() || null,
      first_name: firstName,
      last_name: lastName,
      role, // picked up by the on_auth_user_created trigger
    };
    if (effectiveUniversityId) userMetadata.university_id = effectiveUniversityId;
    if (company_id) userMetadata.company_id = company_id;
    if (effectiveDepartmentId) userMetadata.department_id = effectiveDepartmentId;
    if (job_title) userMetadata.job_title = job_title?.trim() || null;
    if (phone) userMetadata.phone = phone?.trim() || null;

    // app_metadata: system-managed, tamper-proof. Only the role + tenant
    // ids go here (no display fields like full_name — those belong in
    // user_metadata only).
    const appMetadata: Record<string, unknown> = { role };
    if (effectiveUniversityId) appMetadata.university_id = effectiveUniversityId;
    if (company_id) appMetadata.company_id = company_id;
    if (effectiveDepartmentId) appMetadata.department_id = effectiveDepartmentId;

    const { data: authData, error: authError2 } =
      await adminClient.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
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
    // 6. The on_auth_user_created trigger should have inserted a
    //    profiles row. Upsert it with the extra fields the caller
    //    passed (company_id, university_id, department_id, job_title,
    //    phone, etc.). Upsert handles both cases (trigger fired /
    //    didn't fire).
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
    if (effectiveUniversityId) profileUpdate.university_id = effectiveUniversityId;
    if (company_id) profileUpdate.company_id = company_id;
    if (effectiveDepartmentId) profileUpdate.department_id = effectiveDepartmentId;
    if (job_title) profileUpdate.job_title = job_title?.trim() || null;
    if (phone) profileUpdate.phone = phone?.trim() || null;

    let profileUpsertError: unknown = null;
    let profileAfterUpsert: Record<string, unknown> | null = null;

    try {
      const upsertRes = await adminClient
        .from("profiles")
        .upsert(profileUpdate, { onConflict: "user_id" })
        .select()
        .single();
      profileUpsertError = upsertRes.error;
      profileAfterUpsert = upsertRes.data;
    } catch (e) {
      profileUpsertError = e;
    }

    if (profileUpsertError) {
      console.error(
        "[/api/admin/create-user] profile upsert error:",
        profileUpsertError
      );
      // Don't fail the whole request — the auth user was created
      // successfully, and the trigger likely already inserted a
      // minimal profile row. But DO surface the error to the caller
      // so the UI can warn the admin that the profile may be
      // incomplete (e.g. university_id missing → won't show in lists).
    }

    // ==========================================================
    // 7. Return the new user's id. The caller's session is NOT
    //    affected — they remain signed in as super_admin /
    //    university_admin.
    //
    //    If the profile upsert failed, we include a `warning` field
    //    with the error message. The caller can display this so the
    //    admin knows the profile may be incomplete.
    // ==========================================================
    const upsertErrMsg =
      profileUpsertError instanceof Error
        ? profileUpsertError.message
        : profileUpsertError && typeof profileUpsertError === "object" && "message" in profileUpsertError
          ? String((profileUpsertError as { message: unknown }).message)
          : null;

    return NextResponse.json<
      ApiResponse<{ id: string; email: string; role: string; profile?: Record<string, unknown> | null }> & {
        warning?: string;
      }
    >(
      {
        success: true,
        data: {
          id: authData.user.id,
          email: email.trim(),
          role,
          profile: profileAfterUpsert,
        },
        message: "Account created. The new user can sign in with their email and password.",
        ...(upsertErrMsg ? { warning: `Profile save issue: ${upsertErrMsg}` } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[/api/admin/create-user] unhandled error:", error);

    // Return enough detail to diagnose without exposing sensitive internals.
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error === "string"
          ? error
          : "Unknown error";

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Internal server error: ${detail}`,
      },
      { status: 500 }
    );
  }
}
