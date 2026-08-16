import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ApiResponse, UserRole } from "@/types";

/**
 * POST /api/admin/assign-role
 *
 * Allows a Super Admin to assign (or re-assign) a role to an existing user,
 * including all of the role's scope associations (university, department,
 * program, company). This is the "edit user role" counterpart to
 * /api/admin/create-user.
 *
 * WHY THIS EXISTS
 *   When a user self-registers via /register, their profile is created with
 *   role = 'pending_assignment'. The Super Admin needs a way to elevate that
 *   user to a real role (e.g. university_admin, company_hr) with the correct
 *   scope. This route also handles re-assigning an existing user — e.g.
 *   promoting a faculty_supervisor to department_coordinator, or moving a
 *   student from one program to another.
 *
 * WHAT IT DOES
 *   1. Authenticates the caller via the cookie-bound SSR client.
 *   2. Verifies caller.role === 'super_admin' (the only role allowed to
 *      arbitrarily re-assign roles across tenants).
 *   3. Validates the request body (target user_id, target role, scope ids).
 *   4. Calls the SECURITY DEFINER function `internhub.assign_role()` with
 *      a SERVICE_ROLE client. That function (migration 0004_bootstrap_admin)
 *      atomically:
 *        - Validates every scope FK relationship (department→university,
 *          program→department, etc.).
 *        - Updates profiles.role / university_id / department_id / program_id /
 *          company_id / status / is_active.
 *        - Updates auth.users.raw_app_meta_data.role so the next JWT the user
 *          mints carries the new role (proxy.ts reads app_metadata.role).
 *        - Writes an audit_logs row.
 *   5. Returns the updated profile so the UI can refresh without a re-fetch.
 *
 * AUTHORIZATION
 *   Only super_admin can call this route. University Admins who need to
 *   manage roles inside their own university should use the existing
 *   university-admin pages (coordinators, departments, etc.) which call
 *   role-specific APIs with RLS-enforced scoping. Super Admin is the only
 *   role with cross-tenant visibility, so it's the only role that can use
 *   this generic "assign any role to any user" endpoint.
 *
 * SPECIAL CASES
 *   - Assigning role = 'super_admin' is REJECTED here. Super Admin promotion
 *     must go through `internhub.promote_to_super_admin()` (invoked from the
 *     SQL editor or a separate dedicated flow), because that operation has
 *     stricter audit requirements and removes all scope associations.
 *   - Assigning role = 'pending_assignment' is REJECTED. That is a transient
 *     state for newly-registered users; you can't manually assign someone
 *     back to it. Use the "Suspend" action instead.
 */

const ASSIGNABLE_ROLES: UserRole[] = [
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
  "site_supervisor",
  "external_evaluator",
];

// Roles that REQUIRE a university_id (anything university-scoped).
const UNIVERSITY_REQUIRED: UserRole[] = [
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
];

// Roles that REQUIRE a department_id (department-scoped roles).
const DEPARTMENT_REQUIRED: UserRole[] = [
  "department_coordinator",
  "faculty_supervisor",
];

// Roles that REQUIRE a company_id (company-scoped roles).
const COMPANY_REQUIRED: UserRole[] = ["company_hr", "site_supervisor"];

export async function POST(request: NextRequest) {
  try {
    // ==========================================================
    // 1. Authenticate the caller via the cookie-bound SSR client.
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

    // Check role from app_metadata FIRST (synced with profiles.role by the
    // profiles_sync_role_to_auth trigger — migration 0011).
    const callerRole =
      (user.app_metadata?.role as UserRole | undefined) ??
      (user.user_metadata?.role as UserRole | undefined);

    if (callerRole !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Forbidden: Super Admin access required to assign roles",
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // 2. Parse + validate the request body.
    // ==========================================================
    const body = await request.json();
    const {
      user_id,
      role,
      university_id,
      department_id,
      program_id,
      company_id,
    } = body as {
      user_id?: string;
      role?: UserRole;
      university_id?: string;
      department_id?: string;
      program_id?: string;
      company_id?: string;
    };

    // --- target user_id ---
    if (!user_id || typeof user_id !== "string") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }

    // Prevent self-reassignment — super admin should not change their own
    // role through this endpoint (risk of locking themselves out).
    if (user_id === user.id) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "You cannot re-assign your own account. Ask another Super Admin to do this.",
        },
        { status: 400 }
      );
    }

    // --- target role ---
    if (!role || !ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Invalid role. Assignable roles: " + ASSIGNABLE_ROLES.join(", "),
        },
        { status: 400 }
      );
    }

    // --- scope requirements based on role ---
    if (UNIVERSITY_REQUIRED.includes(role) && !university_id) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `A university_id is required when assigning role '${role}'`,
        },
        { status: 400 }
      );
    }
    if (DEPARTMENT_REQUIRED.includes(role) && !department_id) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `A department_id is required when assigning role '${role}'`,
        },
        { status: 400 }
      );
    }
    if (COMPANY_REQUIRED.includes(role) && !company_id) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `A company_id is required when assigning role '${role}'`,
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // 3. Confirm the target user exists in auth.users.
    //    We do this with the service-role client (step 4) so RLS doesn't
    //    interfere. If they don't exist, return a clear error.
    // ==========================================================
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(
        "[/api/admin/assign-role] SUPABASE_SERVICE_ROLE_KEY is not set."
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

    const { data: targetUser, error: lookupError } = await adminClient
      .from("profiles")
      .select("user_id, email, role, status")
      .eq("user_id", user_id)
      .maybeSingle();

    if (lookupError) {
      console.error("[/api/admin/assign-role] lookup error:", lookupError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to look up target user" },
        { status: 500 }
      );
    }
    if (!targetUser) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Target user not found" },
        { status: 404 }
      );
    }

    // ==========================================================
    // 4. Call the SECURITY DEFINER function `internhub.assign_role()`.
    //    This function (migration 0004_bootstrap_admin.sql) validates every
    //    FK relationship and atomically updates profiles + auth.users +
    //    audit_logs. We pass `null` for unspecified scopes so the function
    //    clears them (e.g. assigning 'university_admin' should null out
    //    any previous department_id / company_id / program_id on that user).
    // ==========================================================
    const rpcArgs = {
      p_user_id: user_id,
      p_role: role,
      p_university_id: university_id || null,
      p_department_id: department_id || null,
      p_program_id: program_id || null,
      p_company_id: company_id || null,
    };

    const { error: rpcError } = await adminClient.rpc(
      "internhub.assign_role",
      rpcArgs
    );

    if (rpcError) {
      console.error("[/api/admin/assign-role] RPC error:", rpcError);

      // The SECURITY DEFINER function raises EXCEPTIONs with helpful messages
      // for FK violations. Surface those to the UI.
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: rpcError.message || "Failed to assign role",
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // 5. Fetch the updated profile so the UI can refresh in place.
    // ==========================================================
    const { data: updatedProfile, error: refetchError } = await adminClient
      .from("profiles")
      .select(
        `
        user_id,
        email,
        full_name,
        first_name,
        last_name,
        role,
        status,
        is_active,
        university_id,
        department_id,
        program_id,
        company_id,
        updated_at
      `
      )
      .eq("user_id", user_id)
      .single();

    if (refetchError) {
      // The role assignment itself succeeded — we just couldn't refetch.
      // Return success anyway, the UI will re-fetch the list.
      return NextResponse.json<ApiResponse<{ user_id: string; role: UserRole }>>(
        {
          success: true,
          data: { user_id, role },
        },
        { status: 200 }
      );
    }

    return NextResponse.json<ApiResponse<typeof updatedProfile>>(
      {
        success: true,
        data: updatedProfile,
        message: `Role updated to '${role}' successfully`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/admin/assign-role] unhandled error:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
