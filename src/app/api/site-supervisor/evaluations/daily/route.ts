import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

/**
 * /api/site-supervisor/evaluations/daily
 *
 * Daily + Weekly supervisor evaluations tied to tasks/weeks.
 *
 * GET  - List daily/weekly evaluations for the supervisor's students.
 *        Query params: student_id?, week_number?, type? (task|weekly)
 *
 * POST - Create or update a daily/weekly evaluation.
 *        Body:
 *          - type: "task" | "weekly"  (required)
 *          - student_user_id: string  (required)
 *          - scores: Record<string, number> (0-5 Likert)
 *          - comments: string
 *          - rating: number (0-5 overall)
 *          - task_id?: string (required for type="task")
 *          - task_submission_id?: string
 *          - week_number?: number (required for type="weekly")
 *          - evaluation_id?: string (if updating an existing evaluation)
 *
 * HEC-aligned evaluation criteria (stored in scores jsonb):
 *   - technical_knowledge       (Technical knowledge / application of theory)
 *   - quality_of_work           (Quality of work)
 *   - problem_solving           (Problem-solving & analytical ability)
 *   - task_completion           (Productivity / task completion)
 *   - communication             (Communication skills)
 *   - teamwork                  (Teamwork & cooperation)
 *   - professionalism           (Professionalism & ethics)
 *   - time_management           (Time management & efficiency)
 *   - learning_ability          (Learning ability & initiative)
 *   - punctuality               (Punctuality & attendance)
 *
 * Each criterion is rated 1-5 (Likert):
 *   5 = Excellent, 4 = Very Good, 3 = Average, 2 = Marginal, 1 = Unsatisfactory
 *
 * Per HEC Undergraduate Education Policy, internship evaluation criteria are
 * delegated to universities — these dimensions are based on COMSATS Lahore's
 * published supervisor evaluation form and standard South-Asian academic
 * practice. They are configurable via the scores jsonb.
 */

// ----------------------------------------------------------------------------
// GET — list daily/weekly evaluations
// ----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id");
    const weekNumber = searchParams.get("week_number");
    const type = searchParams.get("type");

    let query = supabase
      .from("evaluations")
      .select(
        `id, type, student_user_id, internship_id, student_internship_id,
         task_id, task_submission_id, evaluator_id, evaluator_role, status,
         scores, comments, rating, week_number, submitted_at, created_at, updated_at,
         student:profiles!evaluations_student_user_id_fkey(user_id, full_name, email, avatar_url),
         task:tasks(id, title, week_number, day_number)`,
        { count: "exact" }
      )
      .eq("evaluator_id", user.id)
      .eq("evaluator_role", "site_supervisor")
      .in("type", ["task", "weekly"])
      .order("created_at", { ascending: false });

    if (studentId) query = query.eq("student_user_id", studentId);
    if (weekNumber) query = query.eq("week_number", parseInt(weekNumber, 10));
    if (type && ["task", "weekly"].includes(type)) query = query.eq("type", type);

    const { data: evaluations, error, count } = await query;
    if (error) {
      console.error("[/api/site-supervisor/evaluations/daily] GET error:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to fetch evaluations: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: evaluations || [],
      meta: { total: count || 0 },
    });
  } catch (err) {
    console.error("[/api/site-supervisor/evaluations/daily] GET unhandled:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// POST — create or update a daily/weekly evaluation
// ----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 403 }
      );
    }
    if (profile.role !== "site_supervisor" && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Site supervisor access required" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      type,
      student_user_id,
      scores,
      comments,
      rating,
      task_id,
      task_submission_id,
      week_number,
      evaluation_id, // if provided, update existing
    } = body as {
      type?: "task" | "weekly";
      student_user_id?: string;
      scores?: Record<string, number>;
      comments?: string;
      rating?: number;
      task_id?: string;
      task_submission_id?: string;
      week_number?: number;
      evaluation_id?: string;
    };

    // ---- Validation ----
    if (!type || !["task", "weekly"].includes(type)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "type must be 'task' or 'weekly'" },
        { status: 400 }
      );
    }
    if (!student_user_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "student_user_id is required" },
        { status: 400 }
      );
    }
    if (type === "task" && !task_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "task_id is required for daily (type=task) evaluations" },
        { status: 400 }
      );
    }
    if (type === "weekly" && (typeof week_number !== "number" || week_number < 1)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "week_number (>=1) is required for weekly evaluations" },
        { status: 400 }
      );
    }
    if (scores && typeof scores !== "object") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "scores must be an object" },
        { status: 400 }
      );
    }
    if (scores) {
      for (const [key, value] of Object.entries(scores)) {
        if (typeof value !== "number" || value < 0 || value > 5) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: `Score ${key} must be a number between 0 and 5` },
            { status: 400 }
          );
        }
      }
    }

    // ---- Verify student is actively assigned to this supervisor ----
    const { data: assignment } = await supabase
      .from("student_internships")
      .select("id, internship_id")
      .eq("site_supervisor_id", user.id)
      .eq("student_user_id", student_user_id)
      .in("status", ["assigned", "active"])
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "This student is not actively assigned to you. Status must be 'assigned' or 'active'.",
        },
        { status: 403 }
      );
    }

    let internshipId = assignment.internship_id;
    let taskRow: any = null;
    if (type === "task" && task_id) {
      const { data: tr } = await supabase
        .from("tasks")
        .select("id, created_by, internship_id, week_number")
        .eq("id", task_id)
        .maybeSingle();
      taskRow = tr;
      if (!taskRow) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Task not found" },
          { status: 404 }
        );
      }
      if (taskRow.internship_id) internshipId = taskRow.internship_id;
    }

    const nowIso = new Date().toISOString();

    const payload: Record<string, unknown> = {
      type,
      student_user_id,
      evaluator_id: user.id,
      evaluator_role: "site_supervisor",
      status: "submitted",
      scores: scores || {},
      comments: comments?.trim() || null,
      rating:
        typeof rating === "number" ? Math.max(0, Math.min(5, rating)) : null,
      submitted_at: nowIso,
      internship_id: internshipId,
      student_internship_id: assignment.id,
      week_number: type === "weekly" ? week_number : taskRow?.week_number ?? null,
      task_id: type === "task" ? task_id : null,
      task_submission_id: type === "task" ? task_submission_id || null : null,
      updated_at: nowIso,
    };

    // ---- Update existing if evaluation_id provided ----
    if (evaluation_id) {
      const { data: existing } = await supabase
        .from("evaluations")
        .select("id, evaluator_id")
        .eq("id", evaluation_id)
        .maybeSingle();
      if (!existing || existing.evaluator_id !== user.id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Evaluation not found or access denied" },
          { status: 404 }
        );
      }
      const { data: updated, error: updErr } = await supabase
        .from("evaluations")
        .update(payload)
        .eq("id", evaluation_id)
        .select("*")
        .single();
      if (updErr) {
        console.error("[daily] update error:", updErr);
        const isRls = updErr.code === "42501" || /row-level security/i.test(updErr.message);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to update evaluation: ${updErr.message}` },
          { status: isRls ? 403 : 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: updated,
        message: "Evaluation updated",
      });
    }

    // ---- Upsert on natural key (task+student+evaluator for daily,
    //      student+evaluator+week for weekly) ----
    if (type === "task" && task_id) {
      const { data: existingEval } = await supabase
        .from("evaluations")
        .select("id")
        .eq("task_id", task_id)
        .eq("student_user_id", student_user_id)
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "site_supervisor")
        .eq("type", "task")
        .maybeSingle();
      if (existingEval) {
        const { data: updated, error: updErr } = await supabase
          .from("evaluations")
          .update(payload)
          .eq("id", existingEval.id)
          .select("*")
          .single();
        if (updErr) {
          console.error("[daily] upsert-on-conflict update error:", updErr);
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: `Failed to update evaluation: ${updErr.message}` },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          data: updated,
          message: "Evaluation updated",
        });
      }
    }
    if (type === "weekly") {
      const { data: existingEval } = await supabase
        .from("evaluations")
        .select("id")
        .eq("student_user_id", student_user_id)
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "site_supervisor")
        .eq("type", "weekly")
        .eq("week_number", week_number)
        .maybeSingle();
      if (existingEval) {
        const { data: updated, error: updErr } = await supabase
          .from("evaluations")
          .update(payload)
          .eq("id", existingEval.id)
          .select("*")
          .single();
        if (updErr) {
          console.error("[weekly] upsert-on-conflict update error:", updErr);
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: `Failed to update evaluation: ${updErr.message}` },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          data: updated,
          message: "Weekly evaluation updated",
        });
      }
    }

    const { data: created, error: insErr } = await supabase
      .from("evaluations")
      .insert(payload)
      .select("*")
      .single();

    if (insErr) {
      console.error("[daily] insert error:", insErr);
      const isRls = insErr.code === "42501" || /row-level security/i.test(insErr.message);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to create evaluation: ${insErr.message}` },
        { status: isRls ? 403 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: created,
      message: type === "weekly" ? "Weekly evaluation submitted" : "Daily evaluation submitted",
    });
  } catch (err) {
    console.error("[/api/site-supervisor/evaluations/daily] POST unhandled:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
