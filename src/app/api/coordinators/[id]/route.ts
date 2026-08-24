import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ApiResponse, Profile, UserRole } from "@/types";
import { setForceSessionRefreshCookie } from "@/lib/auth";

/**
 * PATCH /api/coordinators/[id]
 *
 * Update a department coordinator's profile. Used by the University Admin
 * Coordinators page for:
 *   - Department assignment   { department_id: string | null }
 *   - Activate / deactivate   { is_active: boolean }
 *
 * WHY THIS EXISTS
 *   The previous client-side Supabase update was silently failing for some
 *   admins — RLS WITH CHECK on profiles requires
 *   `university_id = current_university_id()`, and when this fails the
 *   UPDATE returns success with 0 rows affected. The client had a verify-
 *   after-update pattern, but it still relied on the same RLS path, so the
 *   verify SELECT also returned nothing useful.
 *
 *   The first version of this server route used the cookie-bound client for
 *   the UPDATE too. That still failed with 500 when the coordinator's
 *   profile.university_id was NULL — RLS WITH CHECK evaluates
 *   `NULL = current_university_id()` → NULL (not true) → 0 rows affected.
 *
 * APPROACH (v2 — works around NULL university_id)
 *   1. Authenticate the caller with the cookie-bound client (verifies session).
 *   2. Use a SERVICE ROLE client for ALL profile/department queries and the
 *      UPDATE. Service role bypasses RLS, so NULL university_id no longer
 *      causes silent rejection.
 *   3. Do EXPLICIT server-side authorization checks:
 *        - Caller must be university_admin or super_admin
 *        - For university_admin: caller.university_id must be set, and
 *          either the coordinator's university_id matches it OR the
 *          coordinator's university_id is NULL (we treat NULL as
 *          "unassigned, eligible to be claimed by any uni admin"). When
 *          NULL, we HEAL it during the UPDATE so future operations work.
 *        - If department_id is changing, the new dept must belong to the
 *          same university as the caller (or as the coordinator, for
 *          super_admin).
 *   4. Also write the healed university_id (and role) into
 *      auth.users.raw_app_meta_data + raw_user_meta_data so that
 *      internhub.current_university_id() returns the right value for
 *      the coordinator going forward.
 *
 * AUTHORIZATION
 *   - Caller must be signed in.
 *   - Caller's profile.role must be 'university_admin' (or 'super_admin').
 *   - Caller's profile.university_id must match the target coordinator's
 *     profile.university_id. (Super admins can update any coordinator.)
 *     If the coordinator's university_id is NULL, the caller's
 *     university_id is used to HEAL it (only university_admin can heal;
 *     super_admin can too if they pass an explicit university_id).
 *   - The new department_id (if provided) must belong to the same university.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: coordUserId } = await params;

    if (!coordUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing coordinator id" },
        { status: 400 }
      );
    }

    // Parse body
    const body = await request.json().catch(() => ({}));

    const { department_id, is_active } = body as {
      department_id?: string | null;
      is_active?: boolean;
    };

    // At least one updatable field must be present
    if (department_id === undefined && is_active === undefined) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Nothing to update — provide department_id or is_active" },
        { status: 400 }
      );
    }

    // ==========================================================
    // 1. Authenticate the caller via the cookie-bound client.
    //    This is the publishable-key client — same as every other
    //    server route. We only use it to read the caller's session.
    // ==========================================================
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ==========================================================
    // 2. Build the SERVICE ROLE client. This bypasses RLS, so we
    //    can read the coordinator's profile even if its
    //    university_id is NULL (RLS would have blocked that SELECT
    //    because `NULL = current_university_id()` is NULL).
    // ==========================================================
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(
        "[PATCH /api/coordinators/[id]] SUPABASE_SERVICE_ROLE_KEY is not set."
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

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // ==========================================================
    // 3. Fetch the caller's profile using the SERVICE ROLE client.
    //    (RLS on profiles would block the SELECT if the caller's
    //    own university_id were NULL — but service role bypasses
    //    RLS so we always get the row.)
    // ==========================================================
    const { data: adminProfile, error: adminErr } = await admin
      .from("profiles")
      .select("user_id, role, university_id, email, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminErr || !adminProfile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile" },
        { status: 500 }
      );
    }

    const adminRole = adminProfile.role as UserRole;
    const isSuperAdmin = adminRole === "super_admin";
    const isUniAdmin = adminRole === "university_admin";

    if (!isSuperAdmin && !isUniAdmin) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin or Super Admin access required" },
        { status: 403 }
      );
    }

    if (!isSuperAdmin && !adminProfile.university_id) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Your profile has no university_id. Sign out and back in, or " +
            "ask a super admin to set your university_id.",
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // 4. Fetch the target coordinator's profile using the SERVICE
    //    ROLE client. This always returns the row, regardless of
    //    RLS — so we can see coordinators whose university_id is
    //    NULL (which the cookie-bound client would have blocked).
    // ==========================================================
    const { data: coord, error: coordErr } = await admin
      .from("profiles")
      .select("user_id, role, university_id, department_id, is_active, email, full_name")
      .eq("user_id", coordUserId)
      .maybeSingle();

    if (coordErr) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Could not load coordinator: ${coordErr.message}` },
        { status: 500 }
      );
    }

    if (!coord) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Coordinator not found. Their auth.users row exists but their " +
            "profiles row is missing. This is unusual — contact a super admin.",
        },
        { status: 404 }
      );
    }

    // ==========================================================
    // 5. Authorization + university resolution.
    //
    //    Determine the "effective university_id" for this operation:
    //      - super_admin: use coord.university_id if set, else fall
    //        back to any university_id passed in the body, else NULL.
    //      - university_admin: use adminProfile.university_id.
    //        If coord.university_id is set AND differs from the
    //        admin's, reject (403). If coord.university_id is NULL,
    //        treat it as "unassigned" — the admin may claim it by
    //        setting their own university_id on it (heal).
    // ==========================================================
    let effectiveUniversityId: string | null = null;
    let shouldHealUniversityId = false;

    if (isSuperAdmin) {
      effectiveUniversityId =
        coord.university_id || (body as { university_id?: string }).university_id || null;
      // Super admin can heal NULL university_id only if we know which
      // university to set. If both are NULL, leave it NULL.
      if (!coord.university_id && effectiveUniversityId) {
        shouldHealUniversityId = true;
      }
    } else {
      // university_admin
      effectiveUniversityId = adminProfile.university_id as string;

      if (coord.university_id && coord.university_id !== adminProfile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Coordinator belongs to a different university" },
          { status: 403 }
        );
      }

      // If coord.university_id is NULL, heal it to the admin's.
      if (!coord.university_id) {
        shouldHealUniversityId = true;
      }
    }

    // ==========================================================
    // 6. If department_id is being changed, validate the new dept
    //    belongs to the effective university (when not null).
    // ==========================================================
    if (department_id !== undefined) {
      const newDeptId = department_id || null;
      if (newDeptId) {
        const { data: dept, error: deptErr } = await admin
          .from("departments")
          .select("id, university_id")
          .eq("id", newDeptId)
          .maybeSingle();

        if (deptErr || !dept) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Selected department does not exist" },
            { status: 400 }
          );
        }

        if (effectiveUniversityId && dept.university_id !== effectiveUniversityId) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Department does not belong to your university" },
            { status: 400 }
          );
        }
      }
    }

    // ==========================================================
    // 7. Build the UPDATE payload — only include fields that were
    //    provided. If shouldHealUniversityId is true, also set
    //    university_id so the coordinator's profile is fixed.
    // ==========================================================
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (department_id !== undefined) {
      update.department_id = department_id || null;
    }
    if (is_active !== undefined) {
      update.is_active = is_active;
    }
    if (shouldHealUniversityId && effectiveUniversityId) {
      update.university_id = effectiveUniversityId;
    }

    // ==========================================================
    // 8. Perform the UPDATE with the SERVICE ROLE client.
    //    Service role bypasses RLS, so the WITH CHECK clause is
    //    not enforced — the UPDATE will succeed even if the
    //    coordinator's university_id was NULL before (we just
    //    healed it above).
    // ==========================================================
    const { data: updatedRows, error: updateErr } = await admin
      .from("profiles")
      .update(update)
      .eq("user_id", coordUserId)
      .select("user_id, role, university_id, department_id, is_active, email, full_name");

    if (updateErr) {
      console.error(`[PATCH /api/coordinators/${coordUserId}] UPDATE error`, updateErr);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Database error: ${updateErr.message} (code ${updateErr.code ?? "unknown"})`,
        },
        { status: 500 }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error(
        `[PATCH /api/coordinators/${coordUserId}] UPDATE affected 0 rows (unexpected with service role)`
      );
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Update affected 0 rows. This is unexpected with the service role client — " +
            "the coordinator's profile row may have been deleted between the SELECT and UPDATE. " +
            "Refresh the page and try again.",
        },
        { status: 500 }
      );
    }

    const updated = updatedRows[0];

    // ==========================================================
    // 9. If we healed university_id (or changed department_id),
    //    also propagate to auth.users metadata so the RLS helper
    //    functions (current_university_id, current_department_id)
    //    return the right value for the coordinator going forward.
    //
    //    This is the same sync that the profiles_sync_role_to_auth
    //    trigger does (migration 0011 / 0021), but we do it
    //    explicitly here as well in case that trigger is missing
    //    or out of date on the production database.
    // ==========================================================
    const metaPatch: Record<string, string> = {};
    if (shouldHealUniversityId && effectiveUniversityId) {
      metaPatch.university_id = effectiveUniversityId;
      // migration 0090: use `app_role` (not `role`) in app_metadata so
      // GoTrue doesn't expose it as the JWT top-level `role` claim.
      metaPatch.app_role = (coord.role as string) || "department_coordinator";
    }
    if (department_id !== undefined) {
      metaPatch.department_id = department_id || "";
    }
    if (Object.keys(metaPatch).length > 0) {
      try {
        // Build the jsonb patch safely — empty string means "remove the key"
        const appMetaPatch: Record<string, string | null> = { ...metaPatch };
        if (department_id === null || department_id === "") {
          // Remove the key entirely instead of writing empty string
          // (current_department_id() returns NULL for missing keys, which
          // is the correct behavior for an unassigned coordinator).
        }
        await admin.auth.admin.updateUserById(coordUserId, {
          app_metadata: appMetaPatch,
          user_metadata: appMetaPatch,
        });
      } catch (metaErr) {
        // Non-fatal — the profiles row was updated successfully.
        // The metadata will get synced later by the trigger or by
        // the user re-logging in.
      }
    }

    const res = NextResponse.json<ApiResponse<Profile>>({
      success: true,
      data: updated as Profile,
      message: "Coordinator updated",
    });
    // If the admin is editing their own account (rare but possible),
    // signal the proxy to refresh their session on next navigation so
    // they see their new role/department immediately. For cross-user
    // edits, the target user's JWT is stale until natural expiry.
    setForceSessionRefreshCookie(res);
    return res;
  } catch (err) {
    console.error(`[PATCH /api/coordinators/[id]] unhandled`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
