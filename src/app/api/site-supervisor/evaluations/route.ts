import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";
import { notifyEvaluationSubmitted } from "@/lib/notifications";
import { getSupervisorColumn, getEvaluatorRoleValue, isSupervisorRole } from "@/lib/supervisor-role";

// Real `evaluations` columns (from 0001_initial_schema.sql):
//   id, type, student_user_id, internship_id, student_internship_id,
//   task_id, task_submission_id, evaluator_id, evaluator_role, status,
//   scores (jsonb), comments, rating (0-5), submitted_at, created_at, updated_at
//
// NOTE: `evaluator_id` references profiles.user_id, NOT supervisors.id.
// `site_supervisor_evaluations` is just a SELECT view on this table for
// evaluator_role = 'site_supervisor' — we write to `evaluations` directly
// so we can set every column explicitly.

interface EvaluationPostBody {
  student_user_id?: string;
  evaluator_id?: string;
  evaluator_role?: string;
  type?: string;
  scores?: Record<string, number>;
  rating?: number;
  comments?: string;
  status?: string;
  submitted_at?: string;
  internship_id?: string | null;
  student_internship_id?: string | null;
}

// GET: Get evaluation history for the supervisor's assigned students.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user — evaluations.evaluator_id references profiles.user_id.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const supervisorUserId = user.id;

    // Determine which supervisor role the caller has so we can filter on the
    // correct evaluator_role value (site_supervisor vs external_evaluator).
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!callerProfile || !isSupervisorRole(callerProfile.role as any)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Supervisor access required" } },
        { status: 403 }
      );
    }
    const evaluatorRoleValue = getEvaluatorRoleValue(callerProfile.role as any);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const studentId = searchParams.get("studentId");

    // Build query against `evaluations` (not the view). Use real columns only
    // and join `profiles` via `student_user_id`.
    let query = supabase
      .from("evaluations")
      .select(
        `
        id,
        student_user_id,
        internship_id,
        student_internship_id,
        type,
        evaluator_id,
        evaluator_role,
        status,
        scores,
        rating,
        comments,
        submitted_at,
        created_at,
        updated_at,
        student_profile:student_user_id(full_name, first_name, last_name, email, avatar_url)
        `,
        { count: "exact" }
      )
      .eq("evaluator_id", supervisorUserId)
      .eq("evaluator_role", evaluatorRoleValue);

    if (status) {
      query = query.eq("status", status);
    }
    if (studentId) {
      query = query.eq("student_user_id", studentId);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: evaluations, error, count } = await query;

    if (error) {
      console.error("Error fetching evaluations:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<any> = {
      items: evaluations || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
      hasNextPage: (page * pageSize) < (count || 0),
      hasPrevPage: page > 1,
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<any>>>({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Unexpected error in site-supervisor/evaluations:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// POST: Submit a new site-supervisor evaluation.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // evaluator_id must be the supervisor's user_id (profiles.user_id) —
    // NOT the supervisors table PK — so the FK constraint and the
    // `evaluator_id = auth.uid()` RLS policy both match.
    const supervisorUserId = user.id;

    const body: EvaluationPostBody = await request.json();

    // Validate required fields
    if (!body.student_user_id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "student_user_id is required" } },
        { status: 400 }
      );
    }

    if (!body.scores || typeof body.scores !== "object") {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "scores object is required" } },
        { status: 400 }
      );
    }

    // Validate score ranges (0-10) for every entry in the scores object.
    for (const [key, value] of Object.entries(body.scores)) {
      if (typeof value !== "number" || value < 0 || value > 10) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `${key} must be a number between 0 and 10`,
            },
          },
          { status: 400 }
        );
      }
    }

    // --- Defense-in-depth: verify caller role BEFORE the insert -------------
    // The `eval_insert` RLS policy (0028_security_hardening.sql) requires:
    //   evaluator_id = auth.uid()
    //   evaluator_role = internhub.current_role()    <-- profiles.role
    //   internhub.is_assigned_supervisor(student_user_id)
    //     <-- requires student_internships.status IN ('assigned','active')
    //
    // If any of these fail, RLS rejects the INSERT with a 42501 error which
    // we previously surfaced as a 500. We now check all three up-front and
    // return a clear 403 so the client can show an actionable message.
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", supervisorUserId)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "PROFILE_NOT_FOUND", message: "Your supervisor profile could not be loaded. Please re-login." } },
        { status: 403 }
      );
    }
    if (!isSupervisorRole(profile.role as any) && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: `Your account role is "${profile.role}". Only site supervisors or external evaluators can submit evaluations.` } },
        { status: 403 }
      );
    }

    const supervisorColumn = getSupervisorColumn(profile.role as any);
    const evaluatorRoleValue = getEvaluatorRoleValue(profile.role as any);

    // Verify the student is actively assigned to this supervisor.
    // RLS requires status IN ('assigned','active') — we mirror that here so
    // we can return 403 with a helpful message instead of letting RLS fail.
    const { data: assignment, error: assignError } = await supabase
      .from("student_internships")
      .select("id, status")
      .eq(supervisorColumn, supervisorUserId)
      .eq("student_user_id", body.student_user_id)
      .in("status", ["assigned", "active"])
      .maybeSingle();

    if (assignError || !assignment) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "This student is not actively assigned to you. Internship status must be 'assigned' or 'active' for evaluations." } },
        { status: 403 }
      );
    }

    // Coerce `rating` to 0-5 (evaluations.rating is a 0-5 numeric column).
    const ratingRaw = typeof body.rating === "number" ? body.rating : 0;
    const rating = Math.max(0, Math.min(5, ratingRaw));

    // Insert into `evaluations` directly (real columns only).
    const insertPayload = {
      student_user_id: body.student_user_id,
      evaluator_id: supervisorUserId,
      evaluator_role: evaluatorRoleValue,
      // `evaluation_type` enum: weekly_log, midterm, final,
      // company_evaluation, supervisor_evaluation, task.
      // "site_evaluation" is NOT a valid enum value — use supervisor_evaluation.
      type: body.type || "supervisor_evaluation",
      scores: body.scores,
      rating,
      comments: body.comments ?? null,
      status: body.status || "submitted",
      submitted_at: body.submitted_at || new Date().toISOString(),
      internship_id: body.internship_id ?? null,
      student_internship_id: body.student_internship_id ?? assignment.id ?? null,
    };

    const { data: evaluation, error: insertError } = await supabase
      .from("evaluations")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating evaluation:", insertError);
      // RLS violations (42501) should be 403, not 500 — we've already done
      // the defense-in-depth checks above, so an RLS rejection here means
      // either a race condition or a policy mismatch the API didn't catch.
      const isRlsViolation =
        insertError.code === "42501" ||
        /row-level security policy/i.test(insertError.message);
      const status = isRlsViolation ? 403 : 500;
      const code = isRlsViolation ? "RLS_DENIED" : "DB_ERROR";
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code, message: insertError.message } },
        { status }
      );
    }

    // Create audit log entry. `audit_logs` has a single `details` jsonb column.
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_evaluation",
      entity_type: "evaluation",
      entity_id: evaluation.id,
      details: {
        new: {
          student_user_id: evaluation.student_user_id,
          evaluator_id: evaluation.evaluator_id,
          evaluator_role: evaluation.evaluator_role,
          type: evaluation.type,
          status: evaluation.status,
          rating: evaluation.rating,
          // Don't persist a giant signature blob to the audit log even if it
          // was embedded in comments (it's truncated on the client side
          // before submission, but be defensive).
        },
      },
    });

    // Notify the student that their site-supervisor evaluation was submitted.
    // Best-effort: the helper swallows its own errors, so this can never
    // break the evaluation flow.
    try {
      const { data: evaluatorProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", supervisorUserId)
        .maybeSingle();
      const evaluatorName = evaluatorProfile?.full_name || "Site Supervisor";

      await notifyEvaluationSubmitted(
        supabase,
        body.student_user_id!,
        evaluation.type || "supervisor_evaluation",
        evaluatorName,
        "site_supervisor"
      ).catch(() => {});
    } catch (notifErr) {
      console.warn(
        "[/api/site-supervisor/evaluations] student notification failed (non-fatal):",
        notifErr
      );
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: evaluation,
    });

  } catch (error) {
    console.error("Unexpected error creating evaluation:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PUT: Update an evaluation. Site supervisors own the evaluations they
// create, so they can revise them at any time (ownership-scoped).
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const supervisorUserId = user.id;

    // Determine evaluator_role from caller's profile (PUT supports both
    // site_supervisor and external_evaluator).
    const { data: putProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!putProfile || !isSupervisorRole(putProfile.role as any)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Supervisor access required" } },
        { status: 403 }
      );
    }
    const evaluatorRoleValue = getEvaluatorRoleValue(putProfile.role as any);

    const body = await request.json();
    const { evaluationId, scores, rating, comments, status, submitted_at } = body;

    if (!evaluationId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Evaluation ID is required" } },
        { status: 400 }
      );
    }

    // Fetch existing evaluation and check ownership & edit window.
    const { data: existingEval, error: fetchError } = await supabase
      .from("evaluations")
      .select("id, evaluator_id, status, created_at")
      .eq("id", evaluationId)
      .eq("evaluator_id", supervisorUserId)
      .eq("evaluator_role", evaluatorRoleValue)
      .single();

    if (fetchError || !existingEval) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Evaluation not found or access denied" } },
        { status: 404 }
      );
    }

    // Build the update payload from real columns only.
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (scores && typeof scores === "object") updateData.scores = scores;
    if (typeof rating === "number") updateData.rating = Math.max(0, Math.min(5, rating));
    if (typeof comments === "string") updateData.comments = comments;
    if (typeof status === "string") updateData.status = status;
    if (typeof submitted_at === "string") updateData.submitted_at = submitted_at;

    const { data: updatedEval, error: updateError } = await supabase
      .from("evaluations")
      .update(updateData)
      .eq("id", evaluationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating evaluation:", updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update_evaluation",
      entity_type: "evaluation",
      entity_id: evaluationId,
      details: { old: { status: existingEval.status }, new: updateData },
    });

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: updatedEval,
    });

  } catch (error) {
    console.error("Unexpected error updating evaluation:");
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// DELETE: Permanently delete one of the site supervisor's OWN
// evaluations. ?id=<evaluation uuid>
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!profile || !isSupervisorRole(profile.role as any)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Supervisor access required" } },
        { status: 403 }
      );
    }
    const evaluatorRoleValue = getEvaluatorRoleValue(profile.role as any);

    const { searchParams } = new URL(request.url);
    const evalId = searchParams.get("id");
    if (!evalId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Missing ?id=<evaluation uuid>" } },
        { status: 400 }
      );
    }

    // Ownership: the supervisor can only delete their OWN evaluations.
    const { data: evaluation, error: fetchError } = await supabase
      .from("evaluations")
      .select("id, evaluator_id, evaluator_role, student_user_id")
      .eq("id", evalId)
      .maybeSingle();

    if (fetchError || !evaluation) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Evaluation not found" } },
        { status: 404 }
      );
    }

    if (
      evaluation.evaluator_id !== user.id ||
      evaluation.evaluator_role !== evaluatorRoleValue
    ) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "You can only delete evaluations you wrote" } },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("evaluations")
      .delete()
      .eq("id", evalId);

    if (deleteError) {
      console.error("Error deleting evaluation:", deleteError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: deleteError.message } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "delete_evaluation",
      entity_type: "evaluation",
      entity_id: evalId,
      old_values: { student_user_id: evaluation.student_user_id },
    });

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: "Evaluation deleted",
    });
  } catch (error) {
    console.error("Unexpected error deleting evaluation:");
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
