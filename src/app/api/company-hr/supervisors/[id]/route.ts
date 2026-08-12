import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ----------------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------------
async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      ),
    };
  }
  if (profile.role !== "company_hr") {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      ),
    };
  }
  if (!profile.company_id) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      ),
    };
  }
  return { profile, errorResponse: null };
}

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { adminClient: null, errorResponse: NextResponse.json(
      {
        error: {
          code: "SERVER_MISCONFIGURED",
          message: "Server misconfiguration: service role key is not set. Contact the platform administrator.",
        },
      },
      { status: 500 }
    ) };
  }
  return {
    adminClient: createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    ),
    errorResponse: null,
  };
}

// ============================================================================
// PUT /api/company-hr/supervisors/[id]
// Update a site supervisor. Supports:
//   - Profile fields: first_name, last_name, phone, email
//   - Supervisor fields: department_focus, specialization, program_ids
//   - Status toggle: is_active (true = activate, false = deactivate)
//
// When `is_active` is toggled, we also propagate the change to:
//   - profiles.is_active
//   - auth.users.ban_duration (banned if inactive) via admin.updateUserById
//   - intern_supervisor_assignments.is_active (set false on all active
//     assignments for this supervisor when deactivated)
// ============================================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    // Fetch the supervisor row, scoped to the caller's company.
    const { data: existing, error: fetchErr } = await supabase
      .from("supervisors")
      .select("id, user_id, company_id, email, first_name, last_name, is_active")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .eq("type", "site")
      .maybeSingle();

    if (fetchErr) {
      console.error("Error fetching supervisor for update:", fetchErr);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to load supervisor" } },
        { status: 500 }
      );
    }
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Supervisor not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      phone,
      email,
      department_focus,
      specialization,
      program_ids,
      is_active,
    } = body;

    // ---- Build supervisor row update ----
    const supervisorUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    if (first_name !== undefined) supervisorUpdate.first_name = first_name.trim();
    if (last_name !== undefined) supervisorUpdate.last_name = last_name.trim();
    if (email !== undefined) supervisorUpdate.email = email.trim();
    if (phone !== undefined) supervisorUpdate.phone = phone || null;
    if (department_focus !== undefined) supervisorUpdate.department_focus = department_focus || null;
    if (specialization !== undefined) supervisorUpdate.specialization = specialization || null;
    if (program_ids !== undefined) supervisorUpdate.program_ids = program_ids;
    if (is_active !== undefined) supervisorUpdate.is_active = is_active;

    // ---- Update via service role client so RLS WITH CHECK (which requires
    //      university_id = current_university_id()) doesn't silently reject
    //      the UPDATE for company_hr callers whose university_id is NULL.
    const { adminClient, errorResponse: adminErr } = getAdminClient();
    if (adminErr) return adminErr;

    const { data: supervisor, error } = await adminClient
      .from("supervisors")
      .update(supervisorUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating supervisor:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update supervisor" } },
        { status: 500 }
      );
    }

    // ---- Sync profile row (name / phone / email / is_active) ----
    const profileUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    let nameChanged = false;
    if (first_name !== undefined) { profileUpdate.first_name = first_name.trim(); nameChanged = true; }
    if (last_name !== undefined) { profileUpdate.last_name = last_name.trim(); nameChanged = true; }
    if (nameChanged) {
      profileUpdate.full_name = `${first_name?.trim() || existing.first_name || ""} ${last_name?.trim() || existing.last_name || ""}`.trim();
    }
    if (phone !== undefined) profileUpdate.phone = phone || null;
    if (email !== undefined) profileUpdate.email = email.trim();
    if (is_active !== undefined) profileUpdate.is_active = is_active;

    await adminClient.from("profiles").update(profileUpdate).eq("user_id", existing.user_id);

    // ---- Sync auth.users email + ban status (service role only) ----
    const authUpdate: any = {};
    if (email !== undefined) authUpdate.email = email.trim();
    if (is_active !== undefined) {
      // Deactivate → ban the auth user so they cannot log in.
      // Activate → clear the ban.
      authUpdate.ban_duration = is_active ? "none" : "876000h"; // ~100 years
    }
    if (Object.keys(authUpdate).length > 0) {
      try {
        await adminClient.auth.admin.updateUserById(existing.user_id, authUpdate);
      } catch (authSyncErr) {
        console.error("auth.admin.updateUserById failed (non-fatal):", authSyncErr);
      }
    }

    // ---- When deactivating, also deactivate all active intern assignments ----
    if (is_active === false) {
      try {
        await adminClient
          .from("intern_supervisor_assignments")
          .update({
            ended_at: new Date().toISOString(),
            is_active: false,
            unassigned_at: new Date().toISOString(),
            unassigned_by: user.id,
          })
          .eq("supervisor_id", existing.user_id)
          .or(`is_active.eq.true,ended_at.is.null`);
      } catch (deactivateAssignErr) {
        console.error("Failed to deactivate assignments (non-fatal):", deactivateAssignErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: supervisor,
      message: "Supervisor updated successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/company-hr/supervisors/[id]
// HARD delete a site supervisor:
//   1. End all active intern_supervisor_assignments for this supervisor.
//   2. Delete the supervisors row.
//   3. Delete the profiles row.
//   4. Delete the auth.users row (service role only).
//
// NOTE: This is intentionally a HARD delete — for "soft" removal, use the
// PUT endpoint with `{ is_active: false }`. Use this when the supervisor
// should never have existed (typo, test, duplicate) and you want to free
// up the email address.
// ============================================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    // Fetch supervisor (scoped to caller's company)
    const { data: existing, error: fetchErr } = await supabase
      .from("supervisors")
      .select("id, user_id, company_id, email, first_name, last_name")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .eq("type", "site")
      .maybeSingle();

    if (fetchErr) {
      console.error("Error fetching supervisor for delete:", fetchErr);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to load supervisor" } },
        { status: 500 }
      );
    }
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Supervisor not found" } },
        { status: 404 }
      );
    }

    const { adminClient, errorResponse: adminErr } = getAdminClient();
    if (adminErr) return adminErr;

    // 1. End all active assignments for this supervisor.
    try {
      await adminClient
        .from("intern_supervisor_assignments")
        .update({
          ended_at: new Date().toISOString(),
          is_active: false,
          unassigned_at: new Date().toISOString(),
          unassigned_by: user.id,
        })
        .eq("supervisor_id", existing.user_id)
        .or(`is_active.eq.true,ended_at.is.null`);
    } catch (e) {
      console.error("Non-fatal: ending assignments on supervisor delete:", e);
    }

    // 2. Clear student_internships.site_supervisor_id references
    try {
      await adminClient
        .from("student_internships")
        .update({ site_supervisor_id: null, updated_at: new Date().toISOString() })
        .eq("site_supervisor_id", existing.user_id);
    } catch (e) {
      console.error("Non-fatal: clearing site_supervisor_id references:", e);
    }

    // 3. Delete supervisors row (cascades intern_supervisor_assignments via FK)
    const { error: supDeleteErr } = await adminClient
      .from("supervisors")
      .delete()
      .eq("id", id)
      .eq("company_id", profile.company_id);

    if (supDeleteErr) {
      console.error("Error deleting supervisor row:", supDeleteErr);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to remove supervisor record" } },
        { status: 500 }
      );
    }

    // 4. Delete profile row
    try {
      await adminClient.from("profiles").delete().eq("user_id", existing.user_id);
    } catch (e) {
      console.error("Non-fatal: deleting profile row:", e);
    }

    // 5. Delete auth.users row (this is the irreversible step)
    try {
      await adminClient.auth.admin.deleteUser(existing.user_id);
    } catch (e) {
      console.error("Non-fatal: deleting auth.users row (supervisor row already deleted):", e);
    }

    // 6. Audit log
    try {
      await adminClient.from("audit_logs").insert({
        user_id: user.id,
        action: "delete_supervisor",
        entity_type: "supervisor",
        entity_id: id,
        old_values: existing,
      });
    } catch (e) {
      console.error("Non-fatal: audit log insert failed:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Supervisor permanently deleted",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
