import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { ApiResponse } from "@/types";
import { notifyTaskSubmitted } from "@/lib/notifications";
import { sanitizeApiError } from "@/lib/api-error";

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
  // new fields (migration 0050)
  week_number: number | null;
  day_number: number | null;
  expected_deliverable: string | null;
  resources: string | null;
  youtube_url: string | null;
  sort_order: number;
  requires_previous_completion: boolean;
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
  // new submission fields (migration 0050)
  submission_content: string | null;
  submission_links: any[] | null;
  submission_tools_used: string | null;
  submission_skills_learned: string | null;
  submission_problems_solved: string | null;
  // unlock state for "Go to Next Task"
  is_unlocked: boolean;
  is_current: boolean;
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
          priority, created_at, updated_at,
          week_number, day_number, expected_deliverable, resources,
          youtube_url, sort_order, requires_previous_completion
        )
      `,
        { count: "exact" }
      )
      .eq("student_user_id", user.id)
      // Order by week → day → sort_order for the "Go to Next Task" flow
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: assignments, error: assignErr, count } = await query;

    if (assignErr) {
      // RLS recursion / policy errors produce 500 from Postgres. Sanitize
      // the message so the client doesn't see raw SQL/RLS internals —
      // the toast utility will show a friendly "Unable to load tasks"
      // message and the raw error is preserved in server logs.
      const { message, status } = sanitizeApiError(assignErr, "load tasks");
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: message },
        { status }
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

    // Fetch the student's submissions for these tasks (with new fields)
    let submissionsByTask = new Map<string, any>();
    if (taskIds.length > 0) {
      const { data: subs, error: subErr } = await supabase
        .from("task_submissions")
        .select(
          `id, task_id, student_user_id, status, notes, url, file_url, file_name,
           content, links, tools_used, skills_learned, problems_solved,
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

    // Sort the assignmentRows by sort_order (and week/day if available) so we
    // can compute the "current task" (first non-approved) and "locked" state
    // for tasks requiring previous completion.
    const sortedForUnlock = [...assignmentRows]
      .filter((a) => a.task)
      .sort((a, b) => {
        const ta = a.task;
        const tb = b.task;
        // Sort by week → day → sort_order → created_at
        if (ta.week_number != null && tb.week_number != null && ta.week_number !== tb.week_number) {
          return ta.week_number - tb.week_number;
        }
        if (ta.day_number != null && tb.day_number != null && ta.day_number !== tb.day_number) {
          return ta.day_number - tb.day_number;
        }
        if (ta.sort_order !== tb.sort_order) {
          return ta.sort_order - tb.sort_order;
        }
        return new Date(ta.created_at).getTime() - new Date(tb.created_at).getTime();
      });

    // Walk the sorted list and determine each task's unlock state.
    // A task is unlocked if:
    //   - it doesn't require previous completion, OR
    //   - it's the first task, OR
    //   - the previous task's assignment.status === 'approved'
    const unlockStateByTaskId = new Map<string, { is_unlocked: boolean; is_current: boolean }>();
    let foundCurrent = false;
    let prevApproved = true; // first task is always unlocked
    for (const a of sortedForUnlock) {
      const requiresPrev = a.task.requires_previous_completion !== false; // default true
      const isUnlocked = !requiresPrev || prevApproved;
      // "current" = first unlocked task that isn't yet approved
      const isCurrent = isUnlocked && !foundCurrent && a.status !== "approved";
      if (isCurrent) foundCurrent = true;
      unlockStateByTaskId.set(a.task_id, { is_unlocked: isUnlocked, is_current: isCurrent });
      // Update prevApproved for the next iteration
      prevApproved = a.status === "approved";
    }

    // Assemble enriched rows
    const enriched: EnrichedTaskRow[] = assignmentRows
      .filter((a) => a.task) // skip orphaned assignments (task deleted)
      .map((a) => {
        const t = a.task;
        const sub = submissionsByTask.get(a.task_id);
        const unlock = unlockStateByTaskId.get(a.task_id) || { is_unlocked: true, is_current: false };
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
          week_number: t.week_number ?? null,
          day_number: t.day_number ?? null,
          expected_deliverable: t.expected_deliverable ?? null,
          resources: t.resources ?? null,
          youtube_url: t.youtube_url ?? null,
          sort_order: t.sort_order ?? 0,
          requires_previous_completion: t.requires_previous_completion !== false,
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
          submission_content: sub?.content || null,
          submission_links: sub?.links || null,
          submission_tools_used: sub?.tools_used || null,
          submission_skills_learned: sub?.skills_learned || null,
          submission_problems_solved: sub?.problems_solved || null,
          is_unlocked: unlock.is_unlocked,
          is_current: unlock.is_current,
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
    const { message, status } = sanitizeApiError(err, "process task request");
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status }
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
      // New submission fields (migration 0050):
      content,             // markdown description of what was done
      links,               // array of { label, url, type? }
      tools_used,          // comma-separated string
      skills_learned,      // comma-separated string
      problems_solved,     // markdown text
    } = body as {
      task_id?: string;
      notes?: string;
      url?: string;
      file_url?: string;
      file_name?: string;
      content?: string;
      links?: Array<{ label: string; url: string; type?: string }> | string;
      tools_used?: string;
      skills_learned?: string;
      problems_solved?: string;
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

    // Normalize `links` to a JSONB array
    let normalizedLinks: any[] = [];
    if (Array.isArray(links)) {
      normalizedLinks = links.filter((l) => l && typeof l.url === "string" && l.url.trim());
    } else if (typeof links === "string" && links.trim()) {
      // Accept a single URL string as a fallback
      normalizedLinks = [{ label: "Link", url: links.trim(), type: "other" }];
    }

    // Determine submission status — if this is a resubmission (was previously
    // rejected/needs_changes), mark as 'resubmitted'; otherwise 'submitted'.
    const newSubmissionStatus =
      assignment.status === "resubmitted" || assignment.status === "rejected"
        ? "resubmitted"
        : "submitted";

    // Upsert the submission. The UNIQUE (task_id, student_user_id) constraint
    // added in migration 0023 makes this safe.
    const { data: submission, error: subErr } = await supabase
      .from("task_submissions")
      .upsert(
        {
          task_assignment_id: assignment.id,
          task_id,
          student_user_id: user.id,
          // New rich submission fields
          content: content?.trim() || null,
          links: normalizedLinks,
          tools_used: tools_used?.trim() || null,
          skills_learned: skills_learned?.trim() || null,
          problems_solved: problems_solved?.trim() || null,
          // Legacy fields (kept for backward compat)
          notes: notes?.trim() || null,
          url: url?.trim() || (normalizedLinks[0]?.url ?? null),
          file_url: file_url || null,
          file_name: file_name || null,
          status: newSubmissionStatus,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "task_id,student_user_id" }
      )
      .select("*")
      .single();

    if (subErr || !submission) {
      // Log the FULL error details for debugging. The error could be:
      //   - RLS WITH CHECK violation → "new row violates row-level security policy"
      //   - RLS USING violation → "new row violates row-level security policy"
      //   - UNIQUE constraint → "duplicate key value violates unique constraint"
      //   - NOT NULL → "null value in column ... violates not-null constraint"
      //   - FK violation → "violates foreign key constraint"
      // The sanitized message shown to the user is generic; this log
      // preserves the raw error for server-side diagnostics.
      console.error("[/api/student/tasks] POST submit failed:", {
        userId: user.id,
        taskId: task_id,
        assignmentId: assignment.id,
        newSubmissionStatus,
        normalizedLinks,
        error: subErr ? {
          message: subErr.message,
          code: (subErr as any).code,
          details: (subErr as any).details,
          hint: (subErr as any).hint,
        } : "No error object — submission was null",
        submission: submission ? "exists" : "null",
      });

      const { message, status } = sanitizeApiError(subErr || new Error("Submission returned no data"), "submit task");
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: message },
        { status }
      );
    }

    // Update the assignment status to match the submission status so the
    // supervisor's UI shows the student has submitted (or resubmitted).
    const { error: updAssignErr } = await supabase
      .from("task_assignments")
      .update({
        status: newSubmissionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);

    if (updAssignErr) {
      console.warn("[/api/student/tasks] failed to update assignment status (non-fatal):", updAssignErr);
    }

    // ============================================================
    // AUTO-ATTENDANCE on task submission.
    // ------------------------------------------------------------
    // When a student submits a task, that's strong evidence they did
    // internship work today. We upsert an attendance row for today
    // (status = 'present') so the student's attendance dashboard
    // reflects real engagement without requiring a manual check-in.
    // The UNIQUE (student_user_id, internship_id, date) constraint on
    // attendance makes this idempotent — submitting multiple tasks in
    // a day still only marks the student present once.
    // ============================================================
    try {
      const { data: taskRow } = await supabase
        .from("tasks")
        .select("internship_id")
        .eq("id", task_id)
        .maybeSingle();

      const internshipId = taskRow?.internship_id ?? null;
      if (internshipId) {
        const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd

        // Find the active student_internships row so we can also fill
        // student_internship_id (FK on attendance).
        const { data: siRow } = await supabase
          .from("student_internships")
          .select("id, faculty_supervisor_id, site_supervisor_id")
          .eq("student_user_id", user.id)
          .eq("internship_id", internshipId)
          .in("status", ["assigned", "active"])
          .maybeSingle();

        await supabase
          .from("attendance")
          .upsert(
            {
              student_user_id: user.id,
              internship_id: internshipId,
              student_internship_id: siRow?.id || null,
              date: today,
              check_in: new Date().toISOString(),
              status: "present",
              verified: true,
              notes: "Auto-marked present on task submission",
            },
            { onConflict: "student_user_id,internship_id,date" }
          );
      }
    } catch (attErr) {
      console.warn("[/api/student/tasks] auto-attendance failed (non-fatal):", attErr);
    }

    // ============================================================
    // AUTO-CREATE PENDING EVALUATION for the faculty supervisor.
    // ------------------------------------------------------------
    // When a student submits a task, we create a pending `evaluations`
    // row for the faculty supervisor so it appears in their queue.
    // The faculty supervisor can then approve/reject it from their
    // evaluations page. Without this auto-creation, the supervisor
    // would never see anything to evaluate (the evaluations table
    // would stay empty).
    //
    // SECURITY NOTE: We use the service_role client for this insert
    // because the eval_insert RLS policy requires `evaluator_id =
    // auth.uid()`. The student is auth.uid(), but evaluator_id is the
    // faculty supervisor — so the student's own client would be denied
    // by RLS. The service_role client bypasses RLS, which is safe here
    // because:
    //   1. We verified the student has an active student_internships
    //      row with this faculty_supervisor_id (authoritative
    //      relationship check, not client-supplied).
    //   2. We checked no existing pending evaluation exists (prevents
    //      duplicates).
    //   3. The evaluation is created with status='pending' — the
    //      faculty supervisor must still review and approve/reject it.
    //   4. The service_role key is NEVER exposed to the client.
    // ============================================================
    try {
      const { data: taskInfo2 } = await supabase
        .from("tasks")
        .select("internship_id, created_by")
        .eq("id", task_id)
        .maybeSingle();

      const internshipId2 = taskInfo2?.internship_id ?? null;

      if (internshipId2) {
        const { data: siRow2 } = await supabase
          .from("student_internships")
          .select("id, faculty_supervisor_id, site_supervisor_id")
          .eq("student_user_id", user.id)
          .eq("internship_id", internshipId2)
          .in("status", ["assigned", "active"])
          .maybeSingle();

        const facultySupervisorId = siRow2?.faculty_supervisor_id ?? null;

        // Only create an evaluation if (a) there's a faculty supervisor
        // assigned and (b) there isn't already an active evaluation
        // for this task + student combo (avoids duplicates).
        if (facultySupervisorId) {
          const { data: existingEval } = await supabase
            .from("evaluations")
            .select("id")
            .eq("task_id", task_id)
            .eq("student_user_id", user.id)
            .eq("evaluator_id", facultySupervisorId)
            .in("status", ["pending", "in_progress"])
            .maybeSingle();

          if (!existingEval) {
            // Use service_role client to bypass RLS (see SECURITY NOTE above).
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (serviceRoleKey && supabaseUrl) {
              const adminClient = createServiceClient(
                supabaseUrl,
                serviceRoleKey,
                { auth: { persistSession: false } }
              );
              await adminClient.from("evaluations").insert({
                type: "task",
                student_user_id: user.id,
                internship_id: internshipId2,
                student_internship_id: siRow2?.id || null,
                task_id: task_id,
                task_submission_id: submission.id,
                evaluator_id: facultySupervisorId,
                evaluator_role: "faculty_supervisor",
                status: "pending",
                scores: {},
                comments: null,
              });
            } else {
              console.warn("[/api/student/tasks] SUPABASE_SERVICE_ROLE_KEY not set — cannot auto-create faculty evaluation");
            }
          }
        }
      }
    } catch (evalErr) {
      console.warn("[/api/student/tasks] auto-evaluation create failed (non-fatal):", evalErr);
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
    const { message, status } = sanitizeApiError(err, "submit task");
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status }
    );
  }
}
