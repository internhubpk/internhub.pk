import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";
import { notifyTaskSubmitted } from "@/lib/notifications";

/**
 * /api/student/tasks
 *
 * GET  — list tasks assigned to this student (via task_assignments), with
 *        the student's submission for each task joined.
 * POST — submit a task (create or update a task_submissions row).
 *        Body: { task_id, notes?, url?, file_url?, file_name? }
 *
 * SCHEMA NOTES (see migration 0023)
 *   tasks: id, title, description, instructions, due_date, status, priority,
 *          university_id, department_id, ...
 *   task_assignments: id, task_id, student_user_id, assigned_by, due_date,
 *          status (task_submission_status: pending/submitted/resubmitted/
 *          approved/rejected)
 *   task_submissions: id, task_assignment_id, task_id, student_user_id,
 *          content, attachment_urls, status, score, feedback, submitted_at,
 *          reviewed_at, reviewed_by,
 *          notes (NEW), url (NEW), file_url (NEW), file_name (NEW)
 *          UNIQUE (task_id, student_user_id) — added in 0023
 *
 * AUTHORIZATION
 *   - Caller must be signed in.
 *   - Caller's profile.role should be 'student' (we don't strictly enforce
 *     here — if a non-student somehow has a task_assignments row, they can
 *     see it; RLS will still scope to their own rows).
 */

interface EnrichedTaskRow {
  // task fields
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  // joined assignment
  assignment_id: string;
  assignment_status: string;
  assignment_due_date: string | null;
  // submission (may be null)
  submission_id: string | null;
  submission_status: string | null;
  submission_notes: string | null;
  submission_url: string | null;
  submission_file_url: string | null;
  submission_file_name: string | null;
  submission_submitted_at: string | null;
  submission_reviewed_at: string | null;
  submission_feedback: string | null;
  submission_score: number | null;
}

// ----------------------------------------------------------------------------
// GET — list tasks assigned to this student
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Fetch task_assignments for this student, with the task joined.
    // We query task_assignments (not tasks) because tasks has no
    // student_user_id column — the assignment is the link.
    let query = supabase
      .from("task_assignments")
      .select(
        `
        id,
        task_id,
        student_user_id,
        assigned_by,
        due_date,
        status,
        created_at,
        updated_at,
        task:tasks(
          id, title, description, instructions, due_date, status,
          priority, created_at, updated_at
        )
      `,
        { count: "exact" }
      )
      .eq("student_user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: assignments, error: assignErr, count } = await query;

    if (assignErr) {
      console.error("[/api/student/tasks] GET error:", assignErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to fetch tasks: ${assignErr.message}` },
        { status: 500 }
      );
    }

    const assignmentRows = (assignments || []) as unknown as Array<{
      id: string;
      task_id: string;
      student_user_id: string;
      assigned_by: string;
      due_date: string | null;
      status: string;
      created_at: string;
      updated_at: string;
      task: any;
    }>;

    const taskIds = assignmentRows.map((a) => a.task_id).filter(Boolean);

    // Fetch the student's submissions for these tasks
    let submissionsByTask = new Map<string, any>();
    if (taskIds.length > 0) {
      const { data: subs, error: subErr } = await supabase
        .from("task_submissions")
        .select(
          `id, task_id, student_user_id, status, notes, url, file_url, file_name,
           submitted_at, reviewed_at, feedback, score`
        )
        .eq("student_user_id", user.id)
        .in("task_id", taskIds);

      if (subErr) {
        console.warn("[/api/student/tasks] submissions fetch failed (non-fatal):", subErr);
      }
      for (const s of (subs || []) as any[]) {
        submissionsByTask.set(s.task_id, s);
      }
    }

    // Assemble enriched rows
    const enriched: EnrichedTaskRow[] = assignmentRows
      .filter((a) => a.task) // skip orphaned assignments (task deleted)
      .map((a) => {
        const t = a.task;
        const sub = submissionsByTask.get(a.task_id);
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          instructions: t.instructions,
          due_date: t.due_date,
          status: t.status,
          priority: t.priority,
          created_at: t.created_at,
          updated_at: t.updated_at,
          assignment_id: a.id,
          assignment_status: a.status,
          assignment_due_date: a.due_date,
          submission_id: sub?.id || null,
          submission_status: sub?.status || null,
          submission_notes: sub?.notes || null,
          submission_url: sub?.url || null,
          submission_file_url: sub?.file_url || null,
          submission_file_name: sub?.file_name || null,
          submission_submitted_at: sub?.submitted_at || null,
          submission_reviewed_at: sub?.reviewed_at || null,
          submission_feedback: sub?.feedback || null,
          submission_score: sub?.score ?? null,
        };
      });

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (err) {
    console.error("[/api/student/tasks] GET unhandled:", err);
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
// POST — submit a task (create or update task_submissions row)
// Body: { task_id, notes?, url?, file_url?, file_name? }
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

    const body = await request.json().catch(() => ({}));
    const {
      task_id,
      notes,
      url,
      file_url,
      file_name,
    } = body as {
      task_id?: string;
      notes?: string;
      url?: string;
      file_url?: string;
      file_name?: string;
    };

    if (!task_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "task_id is required" },
        { status: 400 }
      );
    }

    // Verify this student has an assignment for the task
    const { data: assignment, error: assignErr } = await supabase
      .from("task_assignments")
      .select("id, task_id, student_user_id, status")
      .eq("task_id", task_id)
      .eq("student_user_id", user.id)
      .maybeSingle();

    if (assignErr || !assignment) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Task not assigned to you" },
        { status: 404 }
      );
    }

    // Don't allow re-submission if already approved
    if (assignment.status === "approved") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This task has already been approved and cannot be re-submitted" },
        { status: 400 }
      );
    }

    // Upsert the submission. The UNIQUE (task_id, student_user_id) constraint
    // added in migration 0023 makes this safe.
    const { data: submission, error: subErr } = await supabase
      .from("task_submissions")
      .upsert(
        {
          task_assignment_id: assignment.id,
          task_id,
          student_user_id: user.id,
          notes: notes?.trim() || null,
          url: url?.trim() || null,
          file_url: file_url || null,
          file_name: file_name || null,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "task_id,student_user_id" }
      )
      .select("*")
      .single();

    if (subErr || !submission) {
      console.error("[/api/student/tasks] submission upsert error:", subErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to submit task: ${subErr?.message || "unknown"}` },
        { status: 500 }
      );
    }

    // Update the assignment status to 'submitted' so the supervisor's
    // UI shows the student has submitted.
    const { error: updAssignErr } = await supabase
      .from("task_assignments")
      .update({
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);

    if (updAssignErr) {
      console.warn("[/api/student/tasks] failed to update assignment status (non-fatal):", updAssignErr);
    }

    // Notify supervisors (faculty + site) and the task creator that the
    // student submitted. Best-effort: failures inside the helper are logged
    // but never thrown, so they can't break the submission flow.
    try {
      const [taskInfo, studentProfile, supervisorRows] = await Promise.all([
        supabase
          .from("tasks")
          .select("title, created_by")
          .eq("id", task_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("student_internships")
          .select("faculty_supervisor_id, site_supervisor_id")
          .eq("student_user_id", user.id)
          .in("status", ["assigned", "active"]),
      ]);

      const taskTitle = taskInfo.data?.title ?? "a task";
      const studentName =
        studentProfile.data?.full_name || "A student";
      const taskCreatorId = taskInfo.data?.created_by ?? null;

      // Collect unique, non-null supervisor user_ids.
      const supervisorIds = new Set<string>();
      for (const row of (supervisorRows.data || []) as Array<{
        faculty_supervisor_id: string | null;
        site_supervisor_id: string | null;
      }>) {
        if (row.faculty_supervisor_id) supervisorIds.add(row.faculty_supervisor_id);
        if (row.site_supervisor_id) supervisorIds.add(row.site_supervisor_id);
      }
      // Also notify the task creator (if not already in the set).
      if (taskCreatorId) supervisorIds.add(taskCreatorId);

      if (supervisorIds.size > 0) {
        await notifyTaskSubmitted(
          supabase,
          Array.from(supervisorIds),
          studentName,
          taskTitle,
          user.id
        ).catch(() => {});
      }
    } catch (notifErr) {
      console.warn(
        "[/api/student/tasks] supervisor notification failed (non-fatal):",
        notifErr
      );
    }

    return NextResponse.json({
      success: true,
      data: submission,
      message: "Task submitted successfully",
    });
  } catch (err) {
    console.error("[/api/student/tasks] POST unhandled:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
