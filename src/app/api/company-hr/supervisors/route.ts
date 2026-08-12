import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ============================================================================
// GET /api/company-hr/supervisors
// List site supervisors for the current HR's company.
// ----------------------------------------------------------------------------
// Query params:
//   include_inactive=true  → also include inactive supervisors
//   page=1                 → 1-indexed page number
//   limit=20               → page size
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      );
    }

    if (profile.role !== "company_hr") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      );
    }

    if (!profile.company_id) {
      return NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("supervisors")
      .select(
        `
        *,
        profiles:user_id (
          first_name,
          last_name,
          email,
          phone,
          avatar_url
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", profile.company_id)
      .eq("type", "site")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: supervisors, count, error } = await query;

    if (error) {
      console.error("Error fetching supervisors:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch supervisors" } },
        { status: 500 }
      );
    }

    // ---- Intern counts ---------------------------------------------------
    // `intern_supervisor_assignments.supervisor_id` is a FK to
    // `profiles.user_id` (NOT to `supervisors.id`). So we must collect
    // `user_id` values from the supervisor rows, not `id` values.
    const supervisorUserIds = (supervisors || [])
      .map((s: any) => s.user_id)
      .filter(Boolean) as string[];

    let internCounts: Record<string, number> = {};
    if (supervisorUserIds.length > 0) {
      const { data: assignments, error: assignErr } = await supabase
        .from("intern_supervisor_assignments")
        .select("supervisor_id")
        .in("supervisor_id", supervisorUserIds)
        .eq("is_active", true);

      if (assignErr) {
        console.error("Error fetching assignment counts:", assignErr);
        // Don't fail the whole request — just return 0 counts.
      } else {
        internCounts = (assignments || []).reduce((acc: Record<string, number>, a: any) => {
          acc[a.supervisor_id] = (acc[a.supervisor_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    const supervisorsWithCounts = (supervisors || []).map((supervisor: any) => ({
      ...supervisor,
      assigned_interns_count: internCounts[supervisor.user_id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: supervisorsWithCounts,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
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
// POST /api/company-hr/supervisors
// Create a new site supervisor (auth.users + profiles + supervisors row).
// ----------------------------------------------------------------------------
// Requires SUPABASE_SERVICE_ROLE_KEY because `auth.admin.createUser()` is an
// admin-only API and cannot be called with the publishable (anon) key. The
// service role client is also used for the profiles + supervisors INSERTs to
// avoid RLS silently rejecting rows whose `company_id` is set but
// `university_id` is NULL (RLS WITH CHECK clause on profiles requires
// university_id = current_university_id() which is NULL for company_hr
// callers).
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // ---- 1. Authenticate caller (cookie-bound publishable-key client) ----
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      );
    }

    if (profile.role !== "company_hr") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      );
    }

    if (!profile.company_id) {
      return NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      );
    }

    // ---- 2. Parse + validate request body ----
    const body = await request.json();
    const {
      first_name,
      last_name,
      email,
      password,
      phone,
      department_focus,
      specialization,
      program_ids = [],
    } = body;

    if (!first_name?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "First name is required" } },
        { status: 400 }
      );
    }
    if (!last_name?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Last name is required" } },
        { status: 400 }
      );
    }
    if (!email?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Email is required" } },
        { status: 400 }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    // ---- 3. Build the service-role admin client ----
    //    Only used for createUser + profile/supervisor INSERTs. The caller's
    //    session (cookie-bound publishable-key client) is unaffected.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(
        "[/api/company-hr/supervisors] SUPABASE_SERVICE_ROLE_KEY is not set. " +
          "Set it in your environment variables (Vercel project settings → Environment Variables → add SUPABASE_SERVICE_ROLE_KEY)."
      );
      return NextResponse.json(
        {
          error: {
            code: "SERVER_MISCONFIGURED",
            message: "Server misconfiguration: service role key is not set. Contact the platform administrator.",
          },
        },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // ---- 4. Check for duplicate email ----
    const { data: existingUser, error: listErr } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      ...( { filter: `email.eq.${email.trim()}` } as any ),
    } as any);

    if (listErr) {
      console.error("Error checking existing user:", listErr);
      // Continue anyway — the createUser call below will return a clear error
      // if the email is taken.
    }
    if (existingUser && existingUser.users && existingUser.users.length > 0) {
      return NextResponse.json(
        { error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" } },
        { status: 409 }
      );
    }

    // ---- 5. Create auth.users row ----
    //    We populate BOTH raw_user_meta_data (via user_metadata) AND
    //    raw_app_meta_data (via app_metadata) with the role + company_id.
    //    - user_metadata is read by the on_auth_user_created trigger to
    //      populate the profiles row.
    //    - app_metadata is tamper-proof and used by the
    //      `current_university_id/department_id/company_id` helpers
    //      (migration 0013/0014) so the new user's RLS resolves correctly
    //      even before the profiles row is fully populated.
    const trimmedEmail = email.trim();
    const trimmedFirst = first_name.trim();
    const trimmedLast = last_name.trim();

    const userMetadata: Record<string, unknown> = {
      full_name: `${trimmedFirst} ${trimmedLast}`,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      role: "site_supervisor",
      company_id: profile.company_id,
    };
    if (phone?.trim()) userMetadata.phone = phone.trim();
    if (department_focus?.trim()) userMetadata.department_focus = department_focus.trim();
    if (specialization?.trim()) userMetadata.specialization = specialization.trim();

    const appMetadata: Record<string, unknown> = {
      role: "site_supervisor",
      company_id: profile.company_id,
    };

    const { data: newUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    });

    if (createAuthError || !newUser?.user) {
      console.error("Error creating auth user:", createAuthError);
      return NextResponse.json(
        {
          error: {
            code: "AUTH_ERROR",
            message: createAuthError?.message || "Failed to create user account",
          },
        },
        { status: 500 }
      );
    }

    const newUserId = newUser.user.id;

    // ---- 6. Upsert the profiles row ----
    //    The on_auth_user_created trigger should have inserted a minimal row.
    //    We upsert to ensure all display fields + company_id are set.
    const profileUpsert: Record<string, unknown> = {
      user_id: newUserId,
      email: trimmedEmail,
      full_name: `${trimmedFirst} ${trimmedLast}`,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      role: "site_supervisor",
      status: "active",
      is_active: true,
      company_id: profile.company_id,
      updated_at: new Date().toISOString(),
    };
    if (phone?.trim()) profileUpsert.phone = phone.trim();
    if (department_focus?.trim()) profileUpsert.department_focus = department_focus.trim();

    const { data: newProfile, error: profileInsertError } = await adminClient
      .from("profiles")
      .upsert(profileUpsert, { onConflict: "user_id" })
      .select()
      .single();

    if (profileInsertError) {
      console.error("Error creating profile:", profileInsertError);
      // Rollback auth user
      await adminClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create user profile" } },
        { status: 500 }
      );
    }

    // ---- 7. Create the supervisors row ----
    const { data: supervisor, error: supervisorInsertError } = await adminClient
      .from("supervisors")
      .insert({
        user_id: newUserId,
        company_id: profile.company_id,
        type: "site",
        first_name: trimmedFirst,
        last_name: trimmedLast,
        email: trimmedEmail,
        phone: phone?.trim() || null,
        department_focus: department_focus?.trim() || null,
        specialization: specialization?.trim() || null,
        program_ids: Array.isArray(program_ids) ? program_ids : [],
        is_active: true,
      })
      .select()
      .single();

    if (supervisorInsertError) {
      console.error("Error creating supervisor record:", supervisorInsertError);
      // Rollback profile + auth user
      await adminClient.from("profiles").delete().eq("user_id", newUserId);
      await adminClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create supervisor record" } },
        { status: 500 }
      );
    }

    // ---- 8. Audit log ----
    try {
      await adminClient.from("audit_logs").insert({
        user_id: user.id,
        action: "create_supervisor",
        entity_type: "supervisor",
        entity_id: supervisor.id,
        new_values: { ...supervisor, created_user_email: trimmedEmail },
      });
    } catch (auditErr) {
      console.error("Audit log insert failed (non-fatal):", auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: { ...supervisor, profile: newProfile },
        message: "Site supervisor created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
