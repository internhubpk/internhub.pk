import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("user_id", userId)
    .single();

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

// GET /api/company-hr/assignments
// ?supervisor_id=...&intern_id=...&active_only=true
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

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const supervisorId = searchParams.get("supervisor_id");
    const internId = searchParams.get("intern_id");
    const activeOnly = searchParams.get("active_only") !== "false";

    // Fetch all of the company's student_internships so we can scope the
    // assignment join by their student_internship_id values.
    const { data: companySIs } = await supabase
      .from("student_internships")
      .select("id, student_user_id, internship_id, status")
      .eq("company_id", profile.company_id);

    const siIds = (companySIs || []).map((r) => r.id);
    if (siIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    let query = supabase
      .from("intern_supervisor_assignments")
      .select(`
        id,
        student_internship_id,
        supervisor_id,
        type,
        assigned_at,
        ended_at,
        created_at,
        is_active,
        intern_id,
        internship_id,
        assigned_by,
        unassigned_at,
        unassigned_by
      `)
      .in("student_internship_id", siIds)
      .order("assigned_at", { ascending: false });

    if (activeOnly) {
      query = query.or(`is_active.eq.true,ended_at.is.null`);
    }
    if (supervisorId) query = query.eq("supervisor_id", supervisorId);

    const { data: assignments, error } = await query;
    if (error) {
      console.error("Error fetching assignments:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch assignments" } },
        { status: 500 }
      );
    }

    // Hydrate with student + supervisor + internship info
    const allAssignments = (assignments || []) as any[];
    // Filter further by intern_id (mapped to student_user_id via companySIs)
    const filteredAssignments = internId
      ? allAssignments.filter((a) => {
          const si = (companySIs || []).find((s) => s.id === a.student_internship_id);
          return si?.student_user_id === internId;
        })
      : allAssignments;

    // Resolve supervisor + student + internship profile rows in batch.
    const supervisorUserIds = Array.from(new Set(filteredAssignments.map((a) => a.supervisor_id)));
    const studentUserIds = Array.from(
      new Set(
        filteredAssignments
          .map((a) => {
            const si = (companySIs || []).find((s) => s.id === a.student_internship_id);
            return si?.student_user_id;
          })
          .filter(Boolean) as string[]
      )
    );
    const internshipIds = Array.from(
      new Set(
        filteredAssignments
          .map((a) => {
            const si = (companySIs || []).find((s) => s.id === a.student_internship_id);
            return si?.internship_id;
          })
          .filter(Boolean) as string[]
      )
    );

    const [supRes, stuRes, intRes] = await Promise.all([
      supervisorUserIds.length
        ? supabase
            .from("supervisors")
            .select("user_id, first_name, last_name, email, company_id, is_active")
            .in("user_id", supervisorUserIds)
        : Promise.resolve({ data: [], error: null }),
      studentUserIds.length
        ? supabase
            .from("profiles")
            .select("user_id, first_name, last_name, email, avatar_url")
            .in("user_id", studentUserIds)
        : Promise.resolve({ data: [], error: null }),
      internshipIds.length
        ? supabase.from("internships").select("id, title").in("id", internshipIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const supervisorMap = new Map((supRes.data || []).map((s: any) => [s.user_id, s]));
    const studentMap = new Map((stuRes.data || []).map((s: any) => [s.user_id, s]));
    const internshipMap = new Map((intRes.data || []).map((i: any) => [i.id, i]));

    const enriched = filteredAssignments.map((a) => {
      const si = (companySIs || []).find((s) => s.id === a.student_internship_id);
      return {
        ...a,
        student_user_id: si?.student_user_id || null,
        internship_id: si?.internship_id || a.internship_id || null,
        student: studentMap.get(si?.student_user_id) || null,
        supervisor: supervisorMap.get(a.supervisor_id) || null,
        internship: internshipMap.get(si?.internship_id) || null,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// POST /api/company-hr/assignments
// body: { supervisor_id, intern_ids: string[], student_internship_ids?: string[] }
export async function POST(request: NextRequest) {
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

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { supervisor_id, intern_ids = [] } = body;

    if (!supervisor_id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "supervisor_id is required" } },
        { status: 400 }
      );
    }
    if (!Array.isArray(intern_ids) || intern_ids.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "intern_ids[] is required" } },
        { status: 400 }
      );
    }

    // Verify supervisor exists and is active.
    //
    // For SITE and FACULTY supervisors, we enforce `company_id` matches the
    // HR's company — site supervisors are company employees, and faculty
    // supervisors (rare from HR) should at minimum be scoped to the company.
    //
    // For EXTERNAL evaluators the `company_id` filter is intentionally
    // SKIPPED — external evaluators are industry experts who never have a
    // `company_id`. Requiring the match would always return null here, so
    // every external-evaluator assignment would fail with 404 even though
    // the evaluator was visible in the dropdown. We instead verify that
    // the evaluator exists, is active, and is type='external'.
    const supervisorFetchQuery = supabase
      .from("supervisors")
      .select("user_id, company_id, is_active, type")
      .eq("user_id", supervisor_id);
    // We can't know the type ahead of time, so we fetch the supervisor row
    // WITHOUT the company_id filter and then check the type explicitly below.
    // (Filtering by company_id would silently drop external evaluators.)
    const { data: supervisor } = await supervisorFetchQuery.maybeSingle();

    if (!supervisor) {
      return NextResponse.json(
        { error: { code: "SUPERVISOR_NOT_FOUND", message: "Supervisor not found" } },
        { status: 404 }
      );
    }
    if (!supervisor.is_active) {
      return NextResponse.json(
        { error: { code: "SUPERVISOR_INACTIVE", message: "Cannot assign to an inactive supervisor" } },
        { status: 400 }
      );
    }
    // Enforce company scoping for non-external supervisors.
    if (
      supervisor.type !== "external" &&
      supervisor.company_id !== profile.company_id
    ) {
      return NextResponse.json(
        { error: { code: "SUPERVISOR_NOT_FOUND", message: "Supervisor not found or does not belong to your company" } },
        { status: 404 }
      );
    }

    // Resolve each intern_id (student_user_id) → student_internships row
    // belonging to this company. Only company interns can be assigned.
    const { data: companySIs } = await supabase
      .from("student_internships")
      .select("id, student_user_id, internship_id, status, site_supervisor_id")
      .eq("company_id", profile.company_id)
      .in("student_user_id", intern_ids);

    const validSIs = (companySIs || []) as any[];

    if (validSIs.length === 0) {
      return NextResponse.json(
        { error: { code: "NO_VALID_INTERNS", message: "No valid interns found for assignment" } },
        { status: 400 }
      );
    }

    // SPEC §13: "A Site Supervisor must NOT be assignable to an application
    // that has not reached the appropriate accepted state." The SI row is
    // created when an application is accepted. Explicitly validate that
    // every target SI is still in an assignable state (the linked
    // application remains accepted AND the internship is not
    // completed/cancelled/expired). The DB trigger
    // (trg_guard_si_site_supervisor, migration 0087) is defense-in-depth.
    if (supervisor.type === "site" || supervisor.type === "external") {
      const unassignable = validSIs.filter(
        (si) => si.status === "completed" || si.status === "cancelled" || si.status === "expired"
      );
      if (unassignable.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: "INTERN_NOT_ASSIGNABLE",
              message: `${unassignable.length} intern(s) are not in an assignable state (completed, cancelled, or expired). Only accepted/active applications can receive a site supervisor.`,
            },
          },
          { status: 400 }
        );
      }
    }

    // Deactivate any currently-active assignments for these
    // student_internship_id values that match the SAME supervisor TYPE
    // we're now assigning. This prevents the new assignment from
    // colliding with a previous assignment of the same role (e.g.
    // reassigning the site supervisor) WITHOUT clobbering an existing
    // assignment of a different role (e.g. assigning an external
    // evaluator should NOT end the existing site-supervisor assignment).
    const siIds = validSIs.map((si) => si.id);
    const assignmentType = supervisor.type || "site";
    await supabase
      .from("intern_supervisor_assignments")
      .update({
        ended_at: new Date().toISOString(),
        is_active: false,
        unassigned_at: new Date().toISOString(),
        unassigned_by: user.id,
      })
      .in("student_internship_id", siIds)
      .eq("type", assignmentType)
      .or(`is_active.eq.true,ended_at.is.null`);

    // Create new assignments. Use the type that matches the supervisor.
    const assignmentsToCreate = validSIs.map((si) => ({
      student_internship_id: si.id,
      supervisor_id,
      type: supervisor.type || "site",
      assigned_at: new Date().toISOString(),
      ended_at: null,
      // Optional convenience columns (migration 0024):
      intern_id: si.student_user_id,
      internship_id: si.internship_id,
      assigned_by: user.id,
      is_active: true,
    }));

    const { data: createdAssignments, error: insertError } = await supabase
      .from("intern_supervisor_assignments")
      .insert(assignmentsToCreate)
      .select();

    if (insertError) {
      console.error("Error creating assignments:", insertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create assignments" } },
        { status: 500 }
      );
    }

    // Also mirror the assignment onto student_internships so existing code
    // that reads the role-specific column continues to work.
    //   - type='site'     → site_supervisor_id
    //   - type='external' → external_evaluator_id (migration 0071)
    //   - type='faculty'  → faculty_supervisor_id (rare from company HR)
    //
    // IMPORTANT: We use the SERVICE-ROLE adminClient for this write, not
    // the cookie-bound `supabase` client. Two reasons:
    //
    //   1. RLS — si_update allows company_hr to update SIs in their own
    //      company, which should match the SIs we just inserted
    //      assignments for. But if the HR's session JWT has a stale
    //      app_meta_data (e.g. company_id was changed by a super_admin
    //      after the HR logged in), the cookie-bound update would
    //      silently return 0 rows and the supervisor's dashboard would
    //      show 0 students. The adminClient bypasses RLS entirely.
    //
    //   2. The guard trigger trg_guard_si_site_supervisor (migration
    //      0087, relaxed in 0093) fires BEFORE UPDATE on
    //      site_supervisor_id regardless of which client issues the
    //      UPDATE. With the relaxed trigger (0093), the only states
    //      that block the update are 'cancelled' and 'expired' — the
    //      pre-check above already returned 400 for those, so the
    //      adminClient write cannot be blocked by the trigger.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || !serviceRoleKey?.trim()) {
      // Without the service-role key the adminClient cannot be created.
      // Fall back to the cookie-bound client so the route still works
      // in local dev — but log loudly so the misconfiguration is visible.
      console.error(
        "[company-hr/assignments POST] SUPABASE_SERVICE_ROLE_KEY is not set — " +
          "falling back to cookie-bound client for the mirror write. " +
          "Supervisor dashboard may silently lose students when the JWT " +
          "is stale or the guard trigger fires."
      );
    }
    const adminClient = supabaseUrl && serviceRoleKey?.trim()
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : supabase;

    const mirrorColumn =
      supervisor.type === "external"
        ? "external_evaluator_id"
        : supervisor.type === "faculty"
          ? "faculty_supervisor_id"
          : "site_supervisor_id";
    const mirrorPayload: Record<string, unknown> = {
      [mirrorColumn]: supervisor_id,
      updated_at: new Date().toISOString(),
    };
    const mirrorResults = await Promise.all(
      validSIs.map((si) =>
        adminClient
          .from("student_internships")
          .update(mirrorPayload)
          .eq("id", si.id)
          .select("id")
      )
    );
    const mirrorFailures = mirrorResults
      .map((res, idx) => ({ res, si: validSIs[idx] }))
      .filter(({ res }) => res.error || !res.data || res.data.length === 0);

    if (mirrorFailures.length > 0) {
      // The assignment row(s) below were already created — don't roll
      // those back (the assignment itself is valid audit history) — but
      // DO surface this to the caller instead of silently reporting
      // success while the supervisor's dashboard (which reads
      // student_internships.<mirror column>, not intern_supervisor_
      // assignments) never reflects the change.
      console.error(
        "[company-hr/assignments POST] mirror update failed for",
        mirrorFailures.map((f) => ({
          student_internship_id: f.si.id,
          error: f.res.error?.message || "0 rows affected (RLS or guard trigger blocked the update)",
        }))
      );
    }

    // Notify each intern with a role-appropriate message.
    const assignLabel =
      supervisor.type === "external"
        ? "external evaluator"
        : supervisor.type === "faculty"
          ? "faculty supervisor"
          : "site supervisor";
    // Notify each assigned student — uses the shared sendNotification helper
    // so the notification is also delivered via web push to subscribed devices.
    const { sendNotification } = await import("@/lib/notifications");
    await Promise.all(
      validSIs.map((si) =>
        sendNotification(supabase, {
          userId: si.student_user_id,
          senderId: user.id,
          title: `${assignLabel.charAt(0).toUpperCase() + assignLabel.slice(1)} assigned`,
          message: `You have been assigned an ${assignLabel}. You can now submit weekly logs and request evaluations.`,
          category: "system",
          priority: "medium",
          actionUrl: "/student/internships",
          metadata: { type: "supervisor_assigned", supervisor_id: (supervisor as any).id, supervisor_type: supervisor.type },
        })
      )
    );

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "assign_supervisor_to_interns",
      entity_type: "intern_supervisor_assignment",
      new_values: {
        supervisor_id,
        intern_count: createdAssignments?.length,
        intern_ids: validSIs.map((i) => i.student_user_id),
      },
    });

    const assignedCount = createdAssignments?.length || 0;
    if (mirrorFailures.length > 0) {
      return NextResponse.json(
        {
          success: true,
          data: createdAssignments,
          warning: `${mirrorFailures.length} of ${assignedCount} assignment(s) were recorded but did not appear on the supervisor's dashboard (the internship may not be in an accepted/active state). Please check those interns and re-assign if needed.`,
          message: `Assigned ${assignedCount} intern(s) to supervisor (${mirrorFailures.length} incomplete)`,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: createdAssignments,
        message: `Successfully assigned ${assignedCount} intern(s) to supervisor`,
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

// PUT /api/company-hr/assignments — reassign a single intern
// body: { intern_id, new_supervisor_id }
export async function PUT(request: NextRequest) {
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

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { intern_id, new_supervisor_id } = body;
    if (!intern_id || !new_supervisor_id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "intern_id and new_supervisor_id are required" } },
        { status: 400 }
      );
    }

    // Verify intern belongs to company
    const { data: si } = await supabase
      .from("student_internships")
      .select("id, internship_id, company_id")
      .eq("student_user_id", intern_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!si) {
      return NextResponse.json(
        { error: { code: "INTERN_NOT_FOUND", message: "Intern not found in your company" } },
        { status: 404 }
      );
    }

    // Verify supervisor (same rules as POST: external evaluators don't
    // have a company_id, so we don't enforce company scoping for them).
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("user_id, company_id, is_active, type")
      .eq("user_id", new_supervisor_id)
      .maybeSingle();

    if (!supervisor || !supervisor.is_active) {
      return NextResponse.json(
        { error: { code: "SUPERVISOR_NOT_FOUND", message: "Supervisor not found or inactive" } },
        { status: 404 }
      );
    }
    if (
      supervisor.type !== "external" &&
      supervisor.company_id !== profile.company_id
    ) {
      return NextResponse.json(
        { error: { code: "SUPERVISOR_NOT_FOUND", message: "Supervisor not found or does not belong to your company" } },
        { status: 404 }
      );
    }

    // Deactivate previous assignments of the SAME TYPE for this
    // student_internship_id. Scoping by `type` ensures that, e.g.,
    // reassigning the site supervisor does NOT end an existing
    // external-evaluator assignment on the same SI.
    const newType = supervisor.type || "site";
    await supabase
      .from("intern_supervisor_assignments")
      .update({
        ended_at: new Date().toISOString(),
        is_active: false,
        unassigned_at: new Date().toISOString(),
        unassigned_by: user.id,
      })
      .eq("student_internship_id", si.id)
      .eq("type", newType)
      .or(`is_active.eq.true,ended_at.is.null`);

    // Insert new assignment
    const { data: newAssignment, error: createError } = await supabase
      .from("intern_supervisor_assignments")
      .insert({
        student_internship_id: si.id,
        supervisor_id: new_supervisor_id,
        type: newType,
        assigned_at: new Date().toISOString(),
        intern_id,
        internship_id: si.internship_id,
        assigned_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating new assignment:", createError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to reassign intern" } },
        { status: 500 }
      );
    }

    // Mirror onto student_internships using the role-appropriate column.
    // Use the SERVICE-ROLE adminClient (same as POST handler) to bypass
    // RLS and avoid the mirror write silently failing.
    const putMirrorColumn =
      supervisor.type === "external"
        ? "external_evaluator_id"
        : supervisor.type === "faculty"
          ? "faculty_supervisor_id"
          : "site_supervisor_id";

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const putAdminClient = supabaseUrl && serviceRoleKey?.trim()
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : supabase;

    const { data: putMirrorRows, error: putMirrorError } = await putAdminClient
      .from("student_internships")
      .update({ [putMirrorColumn]: new_supervisor_id, updated_at: new Date().toISOString() })
      .eq("id", si.id)
      .select("id");

    if (putMirrorError || !putMirrorRows || putMirrorRows.length === 0) {
      console.error(
        "[company-hr/assignments PUT] mirror update failed:",
        putMirrorError?.message || "0 rows affected (RLS or guard trigger blocked the update)"
      );
      return NextResponse.json(
        {
          error: {
            code: "MIRROR_UPDATE_FAILED",
            message:
              "The reassignment record was created, but it could not be reflected on the supervisor's dashboard. The internship may not be in an accepted/active state.",
          },
        },
        { status: 409 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "reassign_intern",
      entity_type: "intern_supervisor_assignment",
      entity_id: newAssignment.id,
      new_values: { intern_id, new_supervisor_id },
    });

    return NextResponse.json({
      success: true,
      data: newAssignment,
      message: "Intern reassigned successfully",
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
// DELETE /api/company-hr/assignments
// Unassign an intern from a supervisor.
// Body: { supervisor_id, intern_id }   OR   { assignment_id }
// ============================================================================
export async function DELETE(request: NextRequest) {
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

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const body = await request.json().catch(() => ({}));
    const { supervisor_id, intern_id, assignment_id } = body || {};

    // Case A: direct assignment_id lookup
    if (assignment_id) {
      const { data: a } = await supabase
        .from("intern_supervisor_assignments")
        .select("id, student_internship_id, supervisor_id, type")
        .eq("id", assignment_id)
        .maybeSingle();

      if (!a) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Assignment not found" } },
          { status: 404 }
        );
      }

      const { data: si } = await supabase
        .from("student_internships")
        .select("id, company_id")
        .eq("id", a.student_internship_id)
        .maybeSingle();

      if (!si || si.company_id !== profile.company_id) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Assignment does not belong to your company" } },
          { status: 403 }
        );
      }

      await supabase
        .from("intern_supervisor_assignments")
        .update({
          ended_at: new Date().toISOString(),
          is_active: false,
          unassigned_at: new Date().toISOString(),
          unassigned_by: user.id,
        })
        .eq("id", assignment_id);

      // Clear the role-appropriate mirror column on student_internships.
      const deleteMirrorColumn =
        a.type === "external"
          ? "external_evaluator_id"
          : a.type === "faculty"
            ? "faculty_supervisor_id"
            : "site_supervisor_id";
      await supabase
        .from("student_internships")
        .update({ [deleteMirrorColumn]: null, updated_at: new Date().toISOString() })
        .eq("id", a.student_internship_id)
        .eq(deleteMirrorColumn, a.supervisor_id);

      return NextResponse.json({ success: true, message: "Assignment removed" });
    }

    // Case B: by supervisor_id + intern_id
    if (!supervisor_id || !intern_id) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Either assignment_id OR (supervisor_id + intern_id) is required",
          },
        },
        { status: 400 }
      );
    }

    const { data: si } = await supabase
      .from("student_internships")
      .select("id, internship_id, company_id, site_supervisor_id, external_evaluator_id, faculty_supervisor_id")
      .eq("student_user_id", intern_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!si) {
      return NextResponse.json(
        { error: { code: "INTERN_NOT_FOUND", message: "Intern not found in your company" } },
        { status: 404 }
      );
    }

    await supabase
      .from("intern_supervisor_assignments")
      .update({
        ended_at: new Date().toISOString(),
        is_active: false,
        unassigned_at: new Date().toISOString(),
        unassigned_by: user.id,
      })
      .eq("supervisor_id", supervisor_id)
      .eq("student_internship_id", si.id)
      .or(`is_active.eq.true,ended_at.is.null`);

    // Clear whichever mirror column currently points at this supervisor.
    // We check all three (site / external / faculty) so the unassign works
    // regardless of the supervisor's type.
    if (si.site_supervisor_id === supervisor_id) {
      await supabase
        .from("student_internships")
        .update({ site_supervisor_id: null, updated_at: new Date().toISOString() })
        .eq("id", si.id);
    } else if (si.external_evaluator_id === supervisor_id) {
      await supabase
        .from("student_internships")
        .update({ external_evaluator_id: null, updated_at: new Date().toISOString() })
        .eq("id", si.id);
    } else if (si.faculty_supervisor_id === supervisor_id) {
      await supabase
        .from("student_internships")
        .update({ faculty_supervisor_id: null, updated_at: new Date().toISOString() })
        .eq("id", si.id);
    }

    return NextResponse.json({ success: true, message: "Intern unassigned successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
