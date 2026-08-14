import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";
import { notifyTaskEvaluated } from "@/lib/notifications";

/**
 * /api/site-supervisor/tasks/[id]/review
 *
 * Supervisor reviews a student's task submission.
 *
 * POST body:
 *   - submission_id: string  (required)
 *   - action: "approve" | "request_changes" | "feedback"  (required)
 *   - feedback: string       (optional for approve; required for request_changes/feedback)
 *   - score: number          (optional 0-100)
 *
 * Actions:
 *   approve         -> task_submissions.status = "approved"
 *                      task_assignments.status = "approved"
 *                      task.status = "completed" (if all assignments approved)
 *   request_changes -> task_submissions.status = "resubmitted"
 *                      task_assignments.status = "resubmitted"
 *   feedback        -> no status change, just adds feedback (re-saves the row)
 *
 * AUTHORIZATION
 *   - Caller must be site_supervisor (or super_admin).
 *   - The submission's task must have been created by the caller OR the
 *     submission's student must be actively assigned to the caller via
 *     student_internships.site_supervisor_id.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: taskId } = await params;
    const body = await request.json().catch(() => ({}));
    const { submission_id, action, feedback, score } = body as {
      submission_id?: string;
      action?: "approve" | "request_changes" | "feedback";
      feedback?: string;
      score?: number;
    };

    if (!submission_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "submission_id is required" },
        { status: 400 }
      );
    }
    if (!action || !["approve", "request_changes", "feedback"].includes(action)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "action must be 'approve', 'request_changes', or 'feedback'" },
        { status: 400 }
      );
    }
    if ((action === "request_changes" || action === "feedback") && !feedback?.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Feedback is required when requesting changes or providing feedback" },
        { status: 400 }
      );
    }

    // Fetch the submission with its task. Supabase returns nested joins as
    // arrays unless we use the !fk() hint; normalize to a single object.
    const { data: subRaw, error: subErr } = await supabase
      .from("task_submissions")
      .select(
        `id, task_id, student_user_id, status, content, notes, url, links,
         tools_used, skills_learned, problems_solved, submitted_at,
         task:tasks(id, created_by, title)`
      )
      .eq("id", submission_id)
      .maybeSingle();

    if (subErr || !subRaw) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Submission not found" },
        { status: 404 }
      );
    }

    // Normalize: Supabase returns `task` as an array — unwrap to object.
    const submission: any = {
      ...subRaw,
      task: Array.isArray((subRaw as any).task)
        ? (subRaw as any).task[0]
        : (subRaw as any).task,
    };

    // Verify task_id matches the route
    if (submission.task_id !== taskId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Submission does not belong to this task" },
        { status: 400 }
      );
    }

    // Authorization: caller must be the task creator OR an actively assigned
    // site_supervisor of this student.
    const isCreator = submission.task?.created_by === user.id;
    let isAssignedSupervisor = false;
    if (!isCreator) {
      const { data: si } = await supabase
        .from("student_internships")
        .select("id")
        .eq("student_user_id", submission.student_user_id)
        .eq("site_supervisor_id", user.id)
        .in("status", ["assigned", "active"])
        .maybeSingle();
      isAssignedSupervisor = !!si;
    }
    if (!isCreator && !isAssignedSupervisor && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You are not authorized to review this submission" },
        { status: 403 }
      );
    }

    // Don't allow re-reviewing an already-approved submission
    if (submission.status === "approved" && action !== "feedback") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This submission has already been approved" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // Determine new statuses
    let newSubmissionStatus: string = submission.status;
    let newAssignmentStatus: string = "submitted"; // default if not approved

    if (action === "approve") {
      newSubmissionStatus = "approved";
      newAssignmentStatus = "approved";
    } else if (action === "request_changes") {
      newSubmissionStatus = "resubmitted";
      newAssignmentStatus = "resubmitted";
    }
    // action === "feedback" leaves status unchanged

    // Update the submission
    const updatePayload: Record<string, unknown> = {
      reviewed_at: nowIso,
      reviewed_by: user.id,
      feedback: feedback?.trim() || submission.feedback || null,
      updated_at: nowIso,
    };
    if (action !== "feedback") {
      updatePayload.status = newSubmissionStatus;
    }
    if (typeof score === "number" && score >= 0 && score <= 100) {
      updatePayload.score = score;
    }

    const { data: updatedSub, error: updateErr } = await supabase
      .from("task_submissions")
      .update(updatePayload)
      .eq("id", submission_id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[/api/site-supervisor/tasks/[id]/review] update error:", updateErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to update submission: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // Update the assignment status to match
    if (action !== "feedback") {
      const { error: assignUpdErr } = await supabase
        .from("task_assignments")
        .update({ status: newAssignmentStatus, updated_at: nowIso })
        .eq("task_id", taskId)
        .eq("student_user_id", submission.student_user_id);
      if (assignUpdErr) {
        console.warn("[review] failed to update assignment status (non-fatal):", assignUpdErr);
      }
    }

    // If approved, check if all assignments for this task are approved.
    // If so, mark the task itself as completed.
    if (action === "approve") {
      const { data: remainingAssignments } = await supabase
        .from("task_assignments")
        .select("status")
        .eq("task_id", taskId);
      const allApproved =
        (remainingAssignments || []).length > 0 &&
        (remainingAssignments || []).every((a: any) => a.status === "approved");
      if (allApproved) {
        await supabase
          .from("tasks")
          .update({ status: "completed", updated_at: nowIso })
          .eq("id", taskId);
      }
    }

    // Auto-create a pending daily evaluation for this approved task (if not already there)
    // so the supervisor can fill in a daily evaluation tied to this task/submission.
    if (action === "approve") {
      try {
        const { data: existingEval } = await supabase
          .from("evaluations")
          .select("id")
          .eq("task_id", taskId)
          .eq("task_submission_id", submission_id)
          .eq("evaluator_id", user.id)
          .maybeSingle();
        if (!existingEval) {
          // Fetch internship_id from task
          const { data: taskRow } = await supabase
            .from("tasks")
            .select("internship_id, week_number, day_number")
            .eq("id", taskId)
            .maybeSingle();
          // Fetch student_internship_id
          const { data: siRow } = await supabase
            .from("student_internships")
            .select("id")
            .eq("student_user_id", submission.student_user_id)
            .in("status", ["assigned", "active"])
            .maybeSingle();
          await supabase.from("evaluations").insert({
            type: "task",
            student_user_id: submission.student_user_id,
            internship_id: taskRow?.internship_id ?? null,
            student_internship_id: siRow?.id ?? null,
            task_id: taskId,
            task_submission_id: submission_id,
            evaluator_id: user.id,
            evaluator_role: "site_supervisor",
            status: "pending",
            scores: {},
            comments: null,
            week_number: taskRow?.week_number ?? null,
          });
        }
      } catch (evalErr) {
        console.warn("[review] auto-create daily evaluation failed (non-fatal):", evalErr);
      }
    }

    // Notify the student about the review outcome (best-effort)
    try {
      const { data: evaluatorProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const evaluatorName = evaluatorProfile?.full_name || "Site Supervisor";
      const taskTitle = submission.task?.title || "your task";
      // notifyTaskEvaluated accepts status: "approved" | "rejected" | "submitted"
      // Map our actions:
      //   approve         -> "approved"
      //   request_changes -> "rejected"
      //   feedback        -> "submitted"
      const statusForNotif =
        action === "approve" ? "approved" :
        action === "request_changes" ? "rejected" :
        "submitted";
      await notifyTaskEvaluated(
        supabase,
        submission.student_user_id,
        taskTitle,
        statusForNotif as "approved" | "rejected" | "submitted",
        evaluatorName
      ).catch(() => {});
    } catch (notifErr) {
      console.warn("[review] student notification failed (non-fatal):", notifErr);
    }

    return NextResponse.json({
      success: true,
      data: updatedSub,
      message:
        action === "approve"
          ? "Submission approved. Task unlocked for the student."
          : action === "request_changes"
            ? "Changes requested. Student has been notified to resubmit."
            : "Feedback added.",
    });
  } catch (err) {
    console.error("[/api/site-supervisor/tasks/[id]/review] unhandled:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
