import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/faculty-supervisor/evaluations/submit
 *
 * Create OR update a faculty-supervisor evaluation for a student.
 *
 * This endpoint mirrors the site-supervisor daily-evaluation upsert
 * pattern (/api/site-supervisor/evaluations/daily): if an evaluation
 * already exists for the same (student, type, task_id?, week_number?,
 * evaluator_role='faculty_supervisor') tuple, it is UPDATED; otherwise
 * a new row is INSERTED with status='submitted'.
 *
 * This fixes the "faculty supervisor cannot create evaluations" bug
 * (G.4 in the production-readiness audit): the existing
 * /api/faculty-supervisor/evaluations POST route only UPDATEs existing
 * pending rows, but nothing in the system creates those pending rows
 * with evaluator_role='faculty_supervisor'. As a result, the faculty
 * supervisor's evaluation queue was always empty and they could never
 * actually evaluate anything.
 *
 * Authorization:
 *   - Caller must be authenticated.
 *   - Caller's profile.role must be 'faculty_supervisor' (or 'super_admin'
 *     for cross-tenant debugging).
 *   - The student must be actively assigned to this faculty supervisor
 *     via student_internships.faculty_supervisor_id (RLS-enforced).
 *
 * Body:
 *   - type: "task" | "weekly" | "midterm" | "final"  (required)
 *   - student_user_id: string                          (required)
 *   - scores?: Record<string, number>  (0-5 Likert per criterion)
 *   - comments?: string
 *   - rating?: number  (0-5 overall)
 *   - task_id?: string  (required for type="task")
 *   - task_submission_id?: string
 *   - week_number?: number  (required for type="weekly")
 *
 * The faculty supervisor CANNOT modify site-supervisor evaluations —
 * the upsert key includes evaluator_role='faculty_supervisor', so a
 * faculty supervisor can only create/update their OWN evaluations.
 */

const VALID_TYPES = ["task", "weekly", "midterm", "final"] as const;
type EvalType = (typeof VALID_TYPES)[number];

function isValidType(t: unknown): t is EvalType {
  return typeof t === "string" && (VALID_TYPES as readonly string[]).includes(t);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (profile.role !== "faculty_supervisor" && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
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
    } = body as {
      type?: EvalType;
      student_user_id?: string;
      scores?: Record<string, number>;
      comments?: string;
      rating?: number;
      task_id?: string;
      task_submission_id?: string;
      week_number?: number;
    };

    // ---- Validation ----
    if (!isValidType(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!student_user_id) {
      return NextResponse.json(
        { error: "student_user_id is required" },
        { status: 400 }
      );
    }
    if (type === "task" && !task_id) {
      return NextResponse.json(
        { error: "task_id is required for task evaluations" },
        { status: 400 }
      );
    }
    if (type === "weekly" && (typeof week_number !== "number" || week_number < 1)) {
      return NextResponse.json(
        { error: "week_number (>=1) is required for weekly evaluations" },
        { status: 400 }
      );
    }
    if (scores && typeof scores !== "object") {
      return NextResponse.json(
        { error: "scores must be an object" },
        { status: 400 }
      );
    }
    if (scores) {
      for (const [k, v] of Object.entries(scores)) {
        if (typeof v !== "number" || v < 0 || v > 5) {
          return NextResponse.json(
            { error: `Score ${k} must be a number between 0 and 5` },
            { status: 400 }
          );
        }
      }
    }

    // ---- Verify student is actively assigned to this faculty supervisor ----
    // RLS on student_internships further restricts: only rows where the
    // caller is the assigned faculty_supervisor (or a tenant admin) are
    // visible.
    const { data: assignment } = await supabase
      .from("student_internships")
      .select("id, internship_id")
      .eq("faculty_supervisor_id", user.id)
      .eq("student_user_id", student_user_id)
      .in("status", ["assigned", "active"])
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "This student is not actively assigned to you. Status must be 'assigned' or 'active'.",
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
        return NextResponse.json(
          { error: "Task not found" },
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
      evaluator_role: "faculty_supervisor",
      status: "submitted",
      scores: scores || {},
      comments: comments?.trim() || null,
      // Default rating to 0 (NOT null) — null renders as "—" on the
      // student evaluations page, making it look like the eval has no
      // data. Consistent with the site-supervisor daily route.
      rating: typeof rating === "number" ? Math.max(0, Math.min(5, rating)) : 0,
      submitted_at: nowIso,
      internship_id: internshipId,
      student_internship_id: assignment.id,
      week_number: type === "weekly" ? week_number : taskRow?.week_number ?? null,
      task_id: type === "task" ? task_id : null,
      task_submission_id: type === "task" ? task_submission_id || null : null,
      updated_at: nowIso,
    };

    // ---- Upsert on natural key ----
    // For task evals: (task_id, student_user_id, evaluator_role='faculty_supervisor', type='task')
    // For weekly: (student_user_id, evaluator_role='faculty_supervisor', type='weekly', week_number)
    // For midterm/final: (student_user_id, evaluator_role='faculty_supervisor', type)
    //
    // The 0051 unique index `uniq_eval_task_evaluator_role` only applies
    // WHERE task_id IS NOT NULL. So task evals are constrained at the DB
    // level. Weekly/midterm/final evals are constrained here at the
    // application level (SELECT-then-UPDATE/INSERT).
    let existingEvalId: string | null = null;

    if (type === "task" && task_id) {
      const { data: existing } = await supabase
        .from("evaluations")
        .select("id")
        .eq("task_id", task_id)
        .eq("student_user_id", student_user_id)
        .eq("evaluator_role", "faculty_supervisor")
        .eq("type", "task")
        .maybeSingle();
      existingEvalId = existing?.id ?? null;
    } else if (type === "weekly") {
      const { data: existing } = await supabase
        .from("evaluations")
        .select("id")
        .eq("student_user_id", student_user_id)
        .eq("evaluator_role", "faculty_supervisor")
        .eq("type", "weekly")
        .eq("week_number", week_number)
        .maybeSingle();
      existingEvalId = existing?.id ?? null;
    } else {
      // midterm / final — at most one per type per student per evaluator.
      const { data: existing } = await supabase
        .from("evaluations")
        .select("id")
        .eq("student_user_id", student_user_id)
        .eq("evaluator_role", "faculty_supervisor")
        .eq("type", type)
        .maybeSingle();
      existingEvalId = existing?.id ?? null;
    }

    let data: any;
    let error: any;

    if (existingEvalId) {
      const result = await supabase
        .from("evaluations")
        .update(payload)
        .eq("id", existingEvalId)
        .select("*")
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("evaluations")
        .insert(payload)
        .select("*")
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("[/api/faculty-supervisor/evaluations/submit] upsert error:", error);
      const isRls = error.code === "42501" || /row-level security/i.test(error.message);
      return NextResponse.json(
        { error: `Failed to submit evaluation: ${error.message}` },
        { status: isRls ? 403 : 500 }
      );
    }

    // ---- Notify the student (also fires web push) ----
    try {
      const { sendNotification } = await import("@/lib/notifications");
      await sendNotification(supabase, {
        userId: student_user_id,
        senderId: user.id,
        title: "Faculty Evaluation Submitted",
        message:
          comments?.trim() ||
          `Your ${type === "task" ? "task" : type === "weekly" ? "weekly" : type} evaluation has been submitted by ${profile.full_name || "your faculty supervisor"}.`,
        category: "evaluation",
        priority: "medium",
        actionUrl: "/student/evaluations",
        metadata: { type: "evaluation_submitted", evaluation_id: data.id, eval_type: type, evaluator_role: "faculty_supervisor" },
      });
    } catch (notifErr) {
      // Best-effort — don't fail the evaluation submission if the notification fails.
      console.error("[/api/faculty-supervisor/evaluations/submit] notification error:", notifErr);
    }

    return NextResponse.json({
      success: true,
      data,
      message:
        type === "weekly"
          ? "Weekly evaluation submitted"
          : type === "task"
          ? "Task evaluation submitted"
          : `${type} evaluation submitted`,
    });
  } catch (err) {
    console.error("[/api/faculty-supervisor/evaluations/submit] unhandled:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
