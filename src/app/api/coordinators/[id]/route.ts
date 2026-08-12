import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { ApiResponse, Profile, UserRole } from "@/types";

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
 *   Doing the update server-side lets us:
 *     1. Re-authenticate the caller explicitly (defense in depth).
 *     2. Re-fetch the coordinator row first and verify ownership BEFORE
 *        attempting the UPDATE — so we can return a precise 403/404 instead
 *        of a silent 0-row update.
 *     3. Return the updated row in the response so the client doesn't need
 *        to re-fetch.
 *
 * AUTHORIZATION
 *   - Caller must be signed in.
 *   - Caller's profile.role must be 'university_admin' (or 'super_admin').
 *   - Caller's profile.university_id must match the target coordinator's
 *     profile.university_id. (Super admins can update any coordinator.)
 *   - The new department_id (if provided) must belong to the same university.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[PATCH /api/coordinators/[id]] ${requestId} start`);

  try {
    const { id: coordUserId } = await params;
    console.log(`[PATCH /api/coordinators/[id]] ${requestId} target=`, coordUserId);

    if (!coordUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing coordinator id" },
        { status: 400 }
      );
    }

    // Parse body first so we can log it
    const body = await request.json().catch(() => ({}));
    console.log(`[PATCH /api/coordinators/[id]] ${requestId} body=`, body);

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

    // Build the Supabase client bound to the caller's cookies
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    // Authenticate the caller
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      console.log(`[PATCH /api/coordinators/[id]] ${requestId} no auth session`);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch the caller's profile to check role + university_id
    const { data: adminProfile, error: adminErr } = await supabase
      .from("profiles")
      .select("user_id, role, university_id")
      .eq("user_id", user.id)
      .single();

    if (adminErr || !adminProfile) {
      console.log(`[PATCH /api/coordinators/[id]] ${requestId} admin profile fetch failed`, adminErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile" },
        { status: 500 }
      );
    }

    const adminRole = adminProfile.role as UserRole;
    const isSuperAdmin = adminRole === "super_admin";
    const isUniAdmin = adminRole === "university_admin";

    if (!isSuperAdmin && !isUniAdmin) {
      console.log(`[PATCH /api/coordinators/[id]] ${requestId} forbidden role=`, adminRole);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin or Super Admin access required" },
        { status: 403 }
      );
    }

    // Fetch the target coordinator's profile (RLS will let the admin see
    // rows in their own university; if this returns nothing, the coordinator
    // is in a different university or doesn't exist).
    const { data: coord, error: coordErr } = await supabase
      .from("profiles")
      .select("user_id, role, university_id, department_id, is_active, email, full_name")
      .eq("user_id", coordUserId)
      .single();

    if (coordErr || !coord) {
      console.log(`[PATCH /api/coordinators/[id]] ${requestId} coordinator not visible to admin`, coordErr);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Coordinator not found, or you do not have permission to view them. " +
            "They may belong to a different university, or their profile.university_id may be NULL.",
        },
        { status: 404 }
      );
    }

    // Enforce university scope (super admins skip this)
    if (!isSuperAdmin) {
      if (!adminProfile.university_id) {
        console.log(`[PATCH /api/coordinators/[id]] ${requestId} admin has no university_id`);
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

      if (coord.university_id !== adminProfile.university_id) {
        console.log(
          `[PATCH /api/coordinators/[id]] ${requestId} uni mismatch: coord=`,
          coord.university_id,
          "admin=",
          adminProfile.university_id
        );
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Coordinator belongs to a different university" },
          { status: 403 }
        );
      }
    }

    // If department_id is being changed, validate the new dept belongs to
    // the same university (when not null).
    if (department_id !== undefined) {
      const newDeptId = department_id || null;
      if (newDeptId) {
        const { data: dept, error: deptErr } = await supabase
          .from("departments")
          .select("id, university_id")
          .eq("id", newDeptId)
          .single();

        if (deptErr || !dept) {
          console.log(`[PATCH /api/coordinators/[id]] ${requestId} dept not found`, deptErr);
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Selected department does not exist" },
            { status: 400 }
          );
        }

        const targetUni = isSuperAdmin
          ? coord.university_id
          : adminProfile.university_id;

        if (dept.university_id !== targetUni) {
          console.log(
            `[PATCH /api/coordinators/[id]] ${requestId} dept uni mismatch: dept=`,
            dept.university_id,
            "target=",
            targetUni
          );
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Department does not belong to your university" },
            { status: 400 }
          );
        }
      }
    }

    // Build the UPDATE payload — only include fields that were provided.
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (department_id !== undefined) {
      update.department_id = department_id || null;
    }
    if (is_active !== undefined) {
      update.is_active = is_active;
    }

    console.log(`[PATCH /api/coordinators/[id]] ${requestId} performing UPDATE`, update);

    // Perform the UPDATE. RLS will still apply (this client uses the caller's
    // cookies, not the service role), but since we've already verified
    // ownership above, the UPDATE should affect exactly 1 row.
    const { data: updated, error: updateErr, count } = await supabase
      .from("profiles")
      .update(update, { count: "exact" })
      .eq("user_id", coordUserId)
      .select("user_id, role, university_id, department_id, is_active, email, full_name")
      .single();

    if (updateErr) {
      console.error(`[PATCH /api/coordinators/[id]] ${requestId} UPDATE error`, updateErr);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Database error: ${updateErr.message} (code ${updateErr.code ?? "unknown"})`,
        },
        { status: 500 }
      );
    }

    if (count === 0 || !updated) {
      // RLS silently rejected the UPDATE. This shouldn't happen now that we
      // pre-flight check, but if it does, surface it explicitly.
      console.error(`[PATCH /api/coordinators/[id]] ${requestId} UPDATE silently affected 0 rows`);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Update was rejected by the database (0 rows affected). " +
            "This is almost always an RLS issue — the coordinator's profile.university_id " +
            "may be NULL or mismatched. Run the backfill migration 0018.",
        },
        { status: 500 }
      );
    }

    console.log(`[PATCH /api/coordinators/[id]] ${requestId} success`, updated);

    return NextResponse.json<ApiResponse<Profile>>({
      success: true,
      data: updated as Profile,
      message: "Coordinator updated",
    });
  } catch (err) {
    console.error(`[PATCH /api/coordinators/[id]] unhandled`, err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
