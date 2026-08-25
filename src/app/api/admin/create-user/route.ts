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
 *   │ department_coordinator │ student, faculty_supervisor                    │
 *   │                     │ (within their own department + university only;   │
 *   │                     │  university_id and department_id are FORCED       │
 *   │                     │  from the caller's profile)                       │
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
// their own university, PLUS company_hr: a university admin may register a
// partner company (via /api/companies) and then create that company's HR
// account, the same way super_admin can. The company_id is required and
// validated below; university_id is NOT attached to company_hr profiles
// (see step 3) since company_hr belongs to a company, not a university.
const UNI_ADMIN_TARGET_ROLES: UserRole[] = [
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

// Roles a Department Coordinator can create — students AND faculty
// supervisors, both forced into the coordinator's own department +
// university. (Coordinators manage faculty supervisors in their
// department, per the InternHub role matrix.)
// SECURITY (2026-08-24): "student" removed — Department Coordinators no
// longer create student accounts. Student onboarding belongs to the Program
// Coordinator (via /api/students and the CSV bulk import) and University
// Admins (via /api/students). The only UI that called this route with
// role=student was the DC "Add Student" dialog, which was removed.
const COORD_TARGET_ROLES: UserRole[] = ["faculty_supervisor"];

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

    // SECURITY (2026-08-23 audit): verify the caller's role from the
    // profiles table (server-side source of truth). user_metadata is
    // user-writable and must never authorize account creation.
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const callerRole = callerProfile?.role as UserRole | undefined;

    // SECURITY (2026-08-24): department_coordinator REMOVED from this gate
    // per spec §2/§14 — DC must not create any accounts through this route.
    // DC creates departments+programs (which auto-provision DC/PC accounts
    // via /api/departments and /api/programs respectively); DC does NOT
    // create faculty_supervisor/student accounts.
    if (
      callerProfileError ||
      !callerRole ||
      (callerRole !== "super_admin" && callerRole !== "university_admin")
    ) {
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
      // `specialization` is used only for supervisor-type roles
      // (faculty_supervisor / site_supervisor / external_evaluator).
      // It is stored on the `supervisors` row (NOT on `profiles`) so the
      // department-coordinator/supervisors page can display it.
      // When the coordinator creates a program, the program-creation
      // dialog passes the program name here so the supervisor row has a
      // meaningful specialization without a separate input.
      specialization,
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
      specialization?: string;
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
        : callerRole === "university_admin"
        ? UNI_ADMIN_TARGET_ROLES
        : COORD_TARGET_ROLES;

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
    // 3. Resolve the effective university_id and department_id.
    //    - super_admin: use the values passed in the body (must be set).
    //    - university_admin: FORCE university_id to be the caller's own
    //      university_id. department_id is taken from the body (validated
    //      against the university by RLS).
    //    - department_coordinator: FORCE BOTH university_id and
    //      department_id to be the caller's own — ignore the body values
    //      entirely. This prevents privilege escalation.
    // ==========================================================
    let effectiveUniversityId: string | undefined;
    let effectiveDepartmentId: string | undefined = department_id;

    if (callerRole === "super_admin") {
      effectiveUniversityId = university_id;
      // super_admin creating a company_hr — university_id may be unset,
      // company_id may be set instead. That's fine.
    } else if (callerRole === "university_admin" && role === "company_hr") {
      // University admin creating a company_hr account: company_hr
      // belongs to a company, not a university, so we deliberately do
      // NOT force university_id onto this profile (that would incorrectly
      // scope the HR account as if they were university staff, breaking
      // company_hr-specific RLS policies that key off company_id only).
      if (!company_id) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error: "company_id is required when creating a company_hr account.",
          },
          { status: 400 }
        );
      }
      effectiveUniversityId = undefined;
    } else {
      // university_admin OR department_coordinator: fetch their profile to
      // get university_id (and department_id for coordinators).
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

      // For university_admin: if department_id was passed, validate it
      // belongs to the same university. (We rely on RLS to also enforce
      // this — departments outside the caller's university would not be
      // SELECT-able, so the INSERT below with that department_id would
      // fail the composite FK constraint.)
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
    //
    // IMPORTANT: use `app_role` (not `role`) — migration 0090 renamed this
    // key so GoTrue doesn't expose it as the JWT top-level `role` claim
    // (which PostgREST would misinterpret as a Postgres role name and fail
    // with `role "X" does not exist`).
    const appMetadata: Record<string, unknown> = { app_role: role };
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
    //    profiles row. But the trigger can fail silently (it wraps
    //    exceptions). Call internhub.ensure_profile_exists as a
    //    guaranteed safety net — it's idempotent and creates the
    //    profile from auth.users metadata if missing.
    //    Then upsert the extra fields the caller passed (company_id,
    //    university_id, department_id, job_title, phone, etc.).
    // ==========================================================
    try {
      await adminClient.rpc("ensure_profile_exists", { p_user_id: authData.user.id });
    } catch (ensureErr: any) {
      console.warn(
        "[/api/admin/create-user] ensure_profile_exists RPC failed (non-fatal):",
        ensureErr?.message
      );
    }

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
      // successfully, and ensure_profile_exists likely already inserted
      // a minimal profile row. But DO surface the error to the caller
      // so the UI can warn the admin that the profile may be
      // incomplete (e.g. university_id missing → won't show in lists).
    }

    // ==========================================================
    // 6b. VERIFY the profile was actually written with the correct
    //     university_id AND department_id. If the upsert silently
    //     failed (trigger inserted a row with NULL university_id
    //     and the upsert somehow didn't overwrite it), the new
    //     coordinator won't be visible to the university admin's
    //     RLS-scoped SELECT. In that case, do a forceful UPDATE
    //     with the service role client to fix the profile row.
    //     Also fix department_id if it's NULL but should be set.
    // ==========================================================
    let profileFixed = false;
    let verifyError: string | null = null;

    if (effectiveUniversityId) {
      const { data: verifyRow, error: verifyErr } = await adminClient
        .from("profiles")
        .select("user_id, university_id, department_id, role, is_active")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (verifyErr) {
        verifyError = `Profile verify SELECT failed: ${verifyErr.message}`;
      } else if (!verifyRow) {
        // Profile row doesn't exist at all — INSERT it directly with the
        // service role client (bypasses RLS).
        const { error: insertErr } = await adminClient
          .from("profiles")
          .insert({
            user_id: authData.user.id,
            email: email.trim(),
            full_name: full_name?.trim() || null,
            first_name: firstName,
            last_name: lastName,
            role,
            status: "active",
            is_active: true,
            university_id: effectiveUniversityId,
            ...(company_id ? { company_id } : {}),
            ...(effectiveDepartmentId ? { department_id: effectiveDepartmentId } : {}),
            ...(job_title ? { job_title: job_title.trim() } : {}),
            ...(phone ? { phone: phone.trim() } : {}),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (insertErr) {
          verifyError = `Profile INSERT failed: ${insertErr.message}`;
        } else {
          profileFixed = true;
        }
      } else {
        // Profile exists. Check if university_id OR department_id is
        // wrong/missing. If so, force UPDATE with service role client.
        const needsUniFix = verifyRow.university_id !== effectiveUniversityId;
        const needsDeptFix = effectiveDepartmentId && verifyRow.department_id !== effectiveDepartmentId;

        if (needsUniFix || needsDeptFix) {
          const updatePayload: Record<string, unknown> = {
            role,
            is_active: true,
            updated_at: new Date().toISOString(),
          };
          if (needsUniFix) updatePayload.university_id = effectiveUniversityId;
          if (needsDeptFix) updatePayload.department_id = effectiveDepartmentId;

          const { error: fixErr } = await adminClient
            .from("profiles")
            .update(updatePayload)
            .eq("user_id", authData.user.id);
          if (fixErr) {
            verifyError = `Profile fix failed: ${fixErr.message}`;
          } else {
            profileFixed = true;
          }
        }
      }
    }

    // ==========================================================
    // 6c. For supervisor-type roles (faculty_supervisor, site_supervisor,
    //     external_evaluator), also INSERT a row into the `supervisors`
    //     table. Without this row, the new user has a profile with
    //     role='faculty_supervisor' but no entry in `supervisors`, so:
    //       - /department-coordinator/supervisors (which queries the
    //         `supervisors` table) returns empty
    //       - The program-creation "Allot Faculty Supervisor" dropdown
    //         (which queries `profiles.role='faculty_supervisor'`) WOULD
    //         see them, but the dedicated Supervisors page would not.
    //     Inserting here keeps both views consistent.
    //
    //     Uses the service role client to bypass RLS.
    //     Idempotent: if a row already exists for (user_id, type), the
    //     unique constraint (migration 0024 ensures these columns exist;
    //     the unique index is added below if not already present) prevents
    //     duplicates — we use .onConflict("user_id,type").merge() so a
    //     re-create after a delete is safe.
    // ==========================================================
    const roleToSupervisorType: Record<string, "faculty" | "site" | "external"> = {
      faculty_supervisor: "faculty",
      site_supervisor: "site",
      external_evaluator: "external",
    };

    let supervisorRowWarning: string | undefined;
    const supType = roleToSupervisorType[role];
    if (supType) {
      const supervisorInsert: Record<string, unknown> = {
        user_id: authData.user.id,
        type: supType,
        is_active: true,
        first_name: firstName,
        last_name: lastName,
        email: email.trim(),
        ...(phone ? { phone: phone.trim() } : {}),
        ...(job_title ? { department_focus: job_title.trim() } : {}),
        // `specialization` is displayed on the Supervisors page. If the
        // caller did not pass one, fall back to `job_title` (which for
        // program-creation is "Faculty Supervisor — <program name>") so
        // the column is never empty for newly-created supervisors.
        ...(specialization?.trim()
          ? { specialization: specialization.trim() }
          : job_title?.trim()
            ? { specialization: job_title.trim() }
            : {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (effectiveUniversityId) supervisorInsert.university_id = effectiveUniversityId;
      if (effectiveDepartmentId) supervisorInsert.department_id = effectiveDepartmentId;
      if (company_id) supervisorInsert.company_id = company_id;

      try {
        const { error: supInsertErr } = await adminClient
          .from("supervisors")
          .upsert(supervisorInsert, { onConflict: "user_id,type" });
        if (supInsertErr) {
          console.warn(
            "[/api/admin/create-user] supervisors upsert error (non-fatal):",
            supInsertErr
          );
          supervisorRowWarning = `Supervisor profile row could not be created: ${supInsertErr.message}. The user account and profile were created successfully, but the user may not appear on the Supervisors page until this is fixed.`;
        }
      } catch (supErr: any) {
        console.warn(
          "[/api/admin/create-user] supervisors upsert threw (non-fatal):",
          supErr?.message
        );
        supervisorRowWarning = `Supervisor profile row could not be created: ${supErr?.message || "Unknown error"}. The user account and profile were created successfully, but the user may not appear on the Supervisors page until this is fixed.`;
      }
    }

    // ==========================================================
    // 7. Return the new user's id. The caller's session is NOT
    //    affected — they remain signed in as super_admin /
    //    university_admin.
    //
    //    If the profile upsert failed AND the verify/fix step also
    //    failed, we include a `warning` field with the error message.
    //    If the verify/fix step SUCCEEDED (profileFixed=true), the
    //    warning is suppressed — the coordinator will be visible.
    // ==========================================================
    const upsertErrMsg =
      profileUpsertError instanceof Error
        ? profileUpsertError.message
        : profileUpsertError && typeof profileUpsertError === "object" && "message" in profileUpsertError
          ? String((profileUpsertError as { message: unknown }).message)
          : null;

    // Build the warning: only surface if there was a real problem the
    // verify/fix step couldn't recover from.
    let warning: string | undefined;
    if (verifyError) {
      // Verify/fix failed — this is the most important error to surface
      // because it means the new coordinator likely won't show up.
      warning = `Profile issue: ${verifyError}. The coordinator was created in auth but their profile may be missing university_id — they will not appear in the coordinators list until this is fixed.`;
    } else if (upsertErrMsg && !profileFixed) {
      warning = `Profile save issue: ${upsertErrMsg}`;
    }
    if (supervisorRowWarning) {
      warning = warning ? `${warning} ${supervisorRowWarning}` : supervisorRowWarning;
    }

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
        ...(warning ? { warning } : {}),
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
