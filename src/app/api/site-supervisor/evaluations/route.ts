import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

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
      .eq("evaluator_role", "site_supervisor");

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

    // Verify the student is assigned to this supervisor. Use real columns:
    // site_supervisor_id (profiles.user_id) and student_user_id.
    const { data: assignment, error: assignError } = await supabase
      .from("student_internships")
      .select("id")
      .eq("site_supervisor_id", supervisorUserId)
      .eq("student_user_id", body.student_user_id)
      .maybeSingle();

    if (assignError || !assignment) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Student is not assigned to this supervisor" } },
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
      evaluator_role: "site_supervisor",
      type: body.type || "site_evaluation",
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
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    // Create audit log entry
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_evaluation",
      entity_type: "evaluation",
      entity_id: evaluation.id,
      new_values: {
        ...evaluation,
        // Don't persist a giant signature blob to the audit log even if it
        // was embedded in comments (it's truncated on the client side
        // before submission, but be defensive).
      },
    });

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

// PUT: Update an evaluation (within 48-hour edit window). Not currently
// called by the page UI, but kept consistent with the schema.
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

    const body = await request.json();
    const { evaluationId, scores, rating, comments, status } = body;

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
      .eq("evaluator_role", "site_supervisor")
      .single();

    if (fetchError || !existingEval) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Evaluation not found or access denied" } },
        { status: 404 }
      );
    }

    const createdAt = new Date(existingEval.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 48) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "EDIT_WINDOW_CLOSED", message: "Edit window closed. Evaluations can only be edited within 48 hours of submission." } },
        { status: 400 }
      );
    }

    // Build the update payload from real columns only.
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (scores && typeof scores === "object") updateData.scores = scores;
    if (typeof rating === "number") updateData.rating = Math.max(0, Math.min(5, rating));
    if (typeof comments === "string") updateData.comments = comments;
    if (typeof status === "string") updateData.status = status;

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
      old_values: { status: existingEval.status },
      new_values: updateData,
    });

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: updatedEval,
    });

  } catch (error) {
    console.error("Unexpected error updating evaluation:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
