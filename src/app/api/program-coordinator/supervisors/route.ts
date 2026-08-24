import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { rateLimiter, RATE_LIMITS, extractClientInfo } from "@/lib/api-security";
import type { ApiResponse, UserRole } from "@/types";

// ============================================================================
// POST /api/program-coordinator/supervisors
// ----------------------------------------------------------------------------
// Program Coordinator creates a SINGLE faculty supervisor account.
//
// SECURITY MODEL — nothing client-supplied is trusted for authorization:
//   - Caller role is read from the profiles table (DB truth, not JWT).
//   - university_id / department_id / program_id are FORCED from the
//     caller's own profile. Any university_id/department_id/program_id
//     field in the request body is IGNORED.
//   - The new supervisor's `program_ids` (jsonb array on the supervisors
//     row — supervisors do NOT have a single program_id column) is set to
//     [pcProgramId] so the supervisor is scoped to the PC's program.
//
// ATOMICITY (spec §19): if any step after auth.user creation fails, the
// partially-created profile row AND the auth.users row are deleted so no
// orphan account is left behind.
//
// BODY:
//   { first_name, last_name, email, password, phone?, specialization?,
//     department_focus? }
// ============================================================================

interface CreatedSupervisor {
  user_id: string;
  email: string;
  full_name: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  try {
    // ==========================================================
    // Rate limit: account creation is a privileged, expensive op.
    // ==========================================================
    const { ipAddress: ip } = extractClientInfo(request);
    const rl = rateLimiter.check(`pc-create-supervisor:${ip}`, RATE_LIMITS.studentCreate);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    // ==========================================================
    // 1. Authenticate caller (cookie-bound SSR client).
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
          setAll() {},
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

    // ==========================================================
    // 2. DB-verified role + scope. ONLY program_coordinator may call.
    //    All tenant ids are taken from the caller's profile.
    // ==========================================================
    const { data: callerProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("university_id, department_id, program_id, role")
      .eq("user_id", user.id)
      .single();

    const callerRole = callerProfile?.role as UserRole | undefined;

    if (profileErr || !callerRole || callerRole !== "program_coordinator") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Program Coordinator access required" },
        { status: 403 }
      );
    }

    const { university_id: pcUniversityId, department_id: pcDepartmentId, program_id: pcProgramId } =
      callerProfile || {};

    if (!pcUniversityId || !pcDepartmentId || !pcProgramId) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Your account must be linked to a university, department, and program.",
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // 3. Service-role client for cross-user writes.
    // ==========================================================
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfiguration: service role key is not set." },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // ==========================================================
    // 4. Parse + validate request body.
    //    NOTE: university_id/department_id/program_id in the body
    //    are deliberately IGNORED — they come from the caller's
    //    profile.
    // ==========================================================
    const body = await request.json().catch(() => ({}));
    const first_name: string = typeof body.first_name === "string" ? body.first_name.trim() : "";
    const last_name: string = typeof body.last_name === "string" ? body.last_name.trim() : "";
    const email: string = typeof body.email === "string" ? body.email.trim() : "";
    const password: string = typeof body.password === "string" ? body.password : "";
    const phone: string | null =
      typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
    const specialization: string | null =
      typeof body.specialization === "string" && body.specialization.trim()
        ? body.specialization.trim()
        : null;
    const department_focus: string | null =
      typeof body.department_focus === "string" && body.department_focus.trim()
        ? body.department_focus.trim()
        : null;

    if (!first_name) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "First name is required." },
        { status: 400 }
      );
    }
    if (!last_name) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Last name is required." },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid email format." },
        { status: 400 }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // ==========================================================
    // 5. Check for duplicate email in profiles (ilike, case-
    //    insensitive). 409 if exists.
    // ==========================================================
    const normalizedEmail = email.toLowerCase();
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("user_id, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // ==========================================================
    // 6. Create auth user (admin.createUser).
    //    app_metadata is tamper-proof and used by the
    //    current_university_id/department_id helpers
    //    (migration 0013/0014) so the new user's RLS resolves
    //    correctly even before the profiles row is fully
    //    populated.
    // ==========================================================
    const fullName = `${first_name} ${last_name}`;

    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name,
        last_name,
      },
      app_metadata: {
        app_role: "faculty_supervisor",  // migration 0090: app_role, not role

        university_id: pcUniversityId,
        department_id: pcDepartmentId,
      },
    });

    if (authErr || !authData?.user) {
      const errMsg = authErr?.message || "";
      // Surface "already registered" as 409 for a friendly UI message.
      if (/already registered|already exists|email.*exists/i.test(errMsg)) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "An account with this email already exists." },
          { status: 409 }
        );
      }
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: errMsg || "Failed to create auth account." },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;

    // ==========================================================
    // 7. ensure_profile_exists RPC (idempotent, non-fatal).
    //    Migration 0084: ensure_profile_exists reads ONLY
    //    app_metadata. The explicit upsert below is the
    //    fallback for full display fields.
    // ==========================================================
    try {
      await adminClient.rpc("ensure_profile_exists", { p_user_id: newUserId });
    } catch {
      // Non-fatal — the explicit upsert below is the fallback.
    }

    // ==========================================================
    // 8. Upsert profiles row.
    // ==========================================================
    const { error: profileUpsertErr } = await adminClient
      .from("profiles")
      .upsert(
        {
          user_id: newUserId,
          email,
          full_name: fullName,
          first_name,
          last_name,
          role: "faculty_supervisor",
          status: "active",
          is_active: true,
          university_id: pcUniversityId,
          department_id: pcDepartmentId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (profileUpsertErr) {
      // ATOMICITY (spec §19): roll back the auth user — do not
      // leave an orphan account.
      await adminClient.from("profiles").delete().eq("user_id", newUserId);
      await adminClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Profile creation failed: ${profileUpsertErr.message}`,
        },
        { status: 500 }
      );
    }

    // ==========================================================
    // 9. Insert supervisors row.
    //    Supervisors do NOT have a single program_id column —
    //    they have program_ids (jsonb array). Set it to
    //    [pcProgramId] so the supervisor is scoped to the
    //    PC's program.
    // ==========================================================
    const { error: supervisorErr } = await adminClient
      .from("supervisors")
      .insert({
        user_id: newUserId,
        university_id: pcUniversityId,
        department_id: pcDepartmentId,
        type: "faculty",
        first_name,
        last_name,
        email,
        phone,
        department_focus,
        specialization,
        program_ids: [pcProgramId],
        is_active: true,
      });

    if (supervisorErr) {
      // ATOMICITY (spec §19): roll back profile + auth user.
      await adminClient.from("profiles").delete().eq("user_id", newUserId);
      await adminClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Supervisor record failed: ${supervisorErr.message}`,
        },
        { status: 500 }
      );
    }

    // ==========================================================
    // 10. Success response.
    // ==========================================================
    return NextResponse.json<ApiResponse<CreatedSupervisor>>(
      {
        success: true,
        data: { user_id: newUserId, email, full_name: fullName },
        message: "Faculty supervisor created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/program-coordinator/supervisors:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
