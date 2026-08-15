import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";
import { notifyTaskAssigned } from "@/lib/notifications";

/**
 * /api/faculty-supervisor/tasks
 *
 * GET    — list tasks created by this faculty supervisor, with their
 *          assignments and submissions joined.
 * POST   — create a new task + assignments for one or more students.
 * PUT    — update an existing task (title/description/priority/due_date/status).
 * DELETE — delete a task (and cascade to assignments/attachments/submissions).
 *
 * SCHEMA NOTES (see migration 0023)
 *   tasks:
 *     id, program_id?, internship_id?, created_by, title, description,
 *     instructions, due_date, max_score, is_published, status,
 *     priority (NEW), university_id (NEW), department_id (NEW),
 *     created_at, updated_at
 *
 *   task_assignments:
 *     id, task_id, student_user_id, assigned_by, due_date, status,
 *     created_at, updated_at
 *
 *   task_submissions:
 *     id, task_assignment_id, task_id, student_user_id, content,
 *     attachment_urls, status, score, feedback, submitted_at,
 *     reviewed_at, reviewed_by,
 *     notes (NEW), url (NEW), file_url (NEW), file_name (NEW)
 *
 *   task_attachments:
 *     id, task_id, file_name, file_url, file_size, mime_type, uploaded_by
 *
 * AUTHORIZATION
 *   - Caller must be signed in.
 *   - Caller's profile.role must be 'faculty_supervisor' (or 'super_admin').
 *   - For POST: the assigned students must be in an active student_internships
 *     row where faculty_supervisor_id = caller's user_id (i.e. they're under
 *     this supervisor's supervision). If no student_internships link exists,
 *     we fall back to checking that the student's profile.university_id
 *     matches the caller's.
 */

interface TaskRow {
  id: string;
  program_id: string | null;
  internship_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  max_score: number | null;
  is_published: boolean;
  status: string;
  priority: string | null;
  university_id: string | null;
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskAssignmentRow {
  id: string;
  task_id: string;
  student_user_id: string;
  assigned_by: string;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  student?: { user_id: string; full_name: string | null; email: string } | null;
}

interface TaskSubmissionRow {
  id: string;
  task_id: string;
  student_user_id: string;
  status: string;
  submitted_at: string | null;
  notes: string | null;
  url: string | null;
  file_url: string | null;
  file_name: string | null;
}

interface EnrichedTask extends TaskRow {
  assignments: TaskAssignmentRow[];
  submissions: TaskSubmissionRow[];
  submission_count: number;
  total_assigned: number;
}

// ----------------------------------------------------------------------------
// GET — list tasks created by this supervisor
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

    // Caller profile — use user_id, NOT id (profiles PK is user_id)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, role, university_id, department_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile" },
        { status: 500 }
      );
    }

    if (profile.role !== "faculty_supervisor" && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    // Query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    // scope=mine (default) returns tasks created by this faculty supervisor.
    // scope=assigned returns tasks assigned to this faculty supervisor's
    // students (regardless of who created them — typically the site
    // supervisor). This is the PRIMARY view per the production brief:
    // "Faculty supervisors should see the tasks assigned by the SITE
    // SUPERVISOR" and "Faculty supervisors should NOT create/assign
    // their own internship tasks." The faculty supervisor evaluates
    // students based on the site-supervisor task/submission workflow,
    // not a duplicate task system.
    const scope = searchParams.get("scope") || "mine";

    // Build the list of supervised student IDs (for scope=assigned).
    // RLS on student_internships restricts to rows where the caller is
    // the assigned faculty_supervisor.
    let supervisedStudentIds: string[] = [];
    if (scope === "assigned") {
      const { data: assignedStudents, error: assignStudentsErr } = await supabase
        .from("student_internships")
        .select("student_user_id")
        .eq("faculty_supervisor_id", user.id)
        .in("status", ["assigned", "active"]);
      if (assignStudentsErr) {
        console.error("[/api/faculty-supervisor/tasks] assigned students error:", assignStudentsErr);
        // Non-fatal — return empty list
      }
      supervisedStudentIds = Array.from(
        new Set((assignedStudents || []).map((a: any) => a.student_user_id))
      );
      if (supervisedStudentIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [] as EnrichedTask[],
          meta: { page, limit, total: 0, totalPages: 0 },
        });
      }
    }

    // Build tasks query
    let query = supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (scope === "assigned") {
      // Tasks assigned to my students — query task_assignments for my
      // students' user IDs, then fetch the corresponding tasks. We use
      // a two-step query because PostgREST doesn't support
      // "tasks WHERE EXISTS (assignment with student_user_id IN (...))".
      const { data: assignmentRows, error: assignmentErr } = await supabase
        .from("task_assignments")
        .select("task_id")
        .in("student_user_id", supervisedStudentIds);
      if (assignmentErr) {
        console.error("[/api/faculty-supervisor/tasks] scope=assigned task_assignments error:", assignmentErr);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Failed to fetch assigned tasks: ${assignmentErr.message}` },
          { status: 500 }
        );
      }
      const taskIdsForMyStudents = Array.from(
        new Set((assignmentRows || []).map((a: any) => a.task_id))
      );
      if (taskIdsForMyStudents.length === 0) {
        return NextResponse.json({
          success: true,
          data: [] as EnrichedTask[],
          meta: { page, limit, total: 0, totalPages: 0 },
        });
      }
      query = query.in("id", taskIdsForMyStudents);
    } else {
      // scope=mine — tasks created by this faculty supervisor.
      query = query.eq("created_by", user.id);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: tasks, error: tasksErr, count } = await query;

    if (tasksErr) {
      console.error("[/api/faculty-supervisor/tasks] GET error:", tasksErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to fetch tasks: ${tasksErr.message}` },
        { status: 500 }
      );
    }

    const taskList = (tasks || []) as TaskRow[];
    const taskIds = taskList.map((t) => t.id);

    // If no tasks, return early
    if (taskIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [] as EnrichedTask[],
        meta: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    // Fetch assignments for these tasks, with student profile joined
    const { data: assignments, error: assignErr } = await supabase
      .from("task_assignments")
      .select(
        `id, task_id, student_user_id, assigned_by, due_date, status,
         created_at, updated_at,
         student:profiles!task_assignments_student_user_id_fkey(user_id, full_name, email)`
      )
      .in("task_id", taskIds);

    if (assignErr) {
      console.error("[/api/faculty-supervisor/tasks] assignments fetch error:", assignErr);
      // Non-fatal — return tasks without assignments
    }

    // Fetch submissions for these tasks
    const { data: submissions, error: subErr } = await supabase
      .from("task_submissions")
      .select(
        `id, task_id, student_user_id, status, submitted_at,
         notes, url, file_url, file_name`
      )
      .in("task_id", taskIds);

    if (subErr) {
      console.error("[/api/faculty-supervisor/tasks] submissions fetch error:", subErr);
      // Non-fatal
    }

    // Group assignments + submissions by task_id
    const assignmentsByTask = new Map<string, TaskAssignmentRow[]>();
    for (const a of (assignments || []) as unknown as TaskAssignmentRow[]) {
      const list = assignmentsByTask.get(a.task_id) || [];
      list.push(a);
      assignmentsByTask.set(a.task_id, list);
    }

    const submissionsByTask = new Map<string, TaskSubmissionRow[]>();
    for (const s of (submissions || []) as TaskSubmissionRow[]) {
      const list = submissionsByTask.get(s.task_id) || [];
      list.push(s);
      submissionsByTask.set(s.task_id, list);
    }

    // Assemble enriched tasks
    const enriched: EnrichedTask[] = taskList.map((t) => {
      const assigns = assignmentsByTask.get(t.id) || [];
      const subs = submissionsByTask.get(t.id) || [];
      return {
        ...t,
        assignments: assigns,
        submissions: subs,
        submission_count: subs.length,
        total_assigned: assigns.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error("[/api/faculty-supervisor/tasks] GET unhandled:", err);
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
// POST — create a new task with student assignments
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

    // Caller profile (use user_id, NOT id)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, role, full_name, university_id, department_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile" },
        { status: 500 }
      );
    }

    if (profile.role !== "faculty_supervisor" && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    // Per the production brief, faculty supervisors do NOT create tasks —
    // they only view and evaluate site-supervisor-created tasks. Block the
    // POST for faculty_supervisor role; only super_admin can bypass for
    // out-of-band admin work.
    if (profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Faculty supervisors cannot create tasks. Tasks are created by the site supervisor; faculty supervisors view and evaluate them.",
        },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json().catch(() => ({}));
    const {
      title,
      description,
      instructions,
      priority = "medium",
      due_date,
      status = "draft",
      is_published = false,
      program_id,
      internship_id,
      student_user_ids = [],
    } = body as {
      title?: string;
      description?: string;
      instructions?: string;
      priority?: string;
      due_date?: string;
      status?: string;
      is_published?: boolean;
      program_id?: string;
      internship_id?: string;
      student_user_ids?: string[];
    };

    // Validate
    if (!title || !title.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }
    if (!due_date) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Due date is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(student_user_ids) || student_user_ids.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "At least one student must be assigned" },
        { status: 400 }
      );
    }

    // Validate priority
    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate the students are under this supervisor's supervision.
    // Check student_internships for an active link.
    const { data: internships, error: internErr } = await supabase
      .from("student_internships")
      .select("student_user_id, program_id, internship_id, university_id, department_id")
      .eq("faculty_supervisor_id", user.id)
      .in("status", ["assigned", "active"]);

    if (internErr) {
      console.error("[/api/faculty-supervisor/tasks] supervisor internships fetch error:", internErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not verify student supervision" },
        { status: 500 }
      );
    }

    const supervisedUserIds = new Set((internships || []).map((i) => i.student_user_id));
    const invalidIds = student_user_ids.filter((id) => !supervisedUserIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Some students are not under your supervision: ${invalidIds.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Derive program_id/internship_id/university_id from the first supervised
    // student's internship if not explicitly provided.
    const firstInternship = (internships || []).find(
      (i) => i.student_user_id === student_user_ids[0]
    );

    const effectiveProgramId = program_id || firstInternship?.program_id || null;
    const effectiveInternshipId = internship_id || firstInternship?.internship_id || null;
    const effectiveUniversityId = profile.university_id || firstInternship?.university_id || null;
    const effectiveDepartmentId = profile.department_id || firstInternship?.department_id || null;

    // Insert the task
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        instructions: instructions?.trim() || null,
        priority,
        due_date,
        status,
        is_published,
        program_id: effectiveProgramId,
        internship_id: effectiveInternshipId,
        university_id: effectiveUniversityId,
        department_id: effectiveDepartmentId,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (taskErr || !task) {
      console.error("[/api/faculty-supervisor/tasks] task insert error:", taskErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to create task: ${taskErr?.message || "unknown"}` },
        { status: 500 }
      );
    }

    // Insert task_assignments — use correct column names
    // (student_user_id, assigned_by, status default 'pending')
    const assignmentRows = student_user_ids.map((student_user_id) => ({
      task_id: task.id,
      student_user_id,
      assigned_by: user.id,
      due_date: due_date,
      status: "pending" as const,
    }));

    const { error: assignErr } = await supabase
      .from("task_assignments")
      .insert(assignmentRows);

    if (assignErr) {
      console.error("[/api/faculty-supervisor/tasks] assignments insert error:", assignErr);
      // Rollback the task
      await supabase.from("tasks").delete().eq("id", task.id);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to assign students: ${assignErr.message}` },
        { status: 500 }
      );
    }

    // Send notifications to assigned students (best-effort — failures are
    // logged inside the helper but never throw, so they can't break the
    // task-creation flow).
    const senderName = profile.full_name || "Faculty Supervisor";
    await Promise.all(
      student_user_ids.map((studentUserId) =>
        notifyTaskAssigned(
          supabase,
          studentUserId,
          title.trim(),
          due_date ?? null,
          user.id,
          senderName
        ).catch(() => {})
      )
    );

    return NextResponse.json({
      success: true,
      data: task,
      message: `Task created and assigned to ${student_user_ids.length} student(s)`,
    });
  } catch (err) {
    console.error("[/api/faculty-supervisor/tasks] POST unhandled:", err);
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
// PUT — update an existing task
// Per the production brief, faculty supervisors do NOT edit tasks. Only
// super_admin can use this endpoint for out-of-band admin fixes.
// ----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
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

    // Block faculty_supervisor from editing tasks. Only super_admin can.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Faculty supervisors cannot edit tasks. Tasks are managed by the site supervisor.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { task_id, ...updates } = body as {
      task_id?: string;
      title?: string;
      description?: string;
      instructions?: string;
      priority?: string;
      due_date?: string;
      status?: string;
      is_published?: boolean;
      student_user_ids?: string[];
    };

    if (!task_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "task_id is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: existErr } = await supabase
      .from("tasks")
      .select("id, created_by")
      .eq("id", task_id)
      .maybeSingle();

    if (existErr || !existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }
    if (existing.created_by !== user.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Not authorized to update this task" },
        { status: 403 }
      );
    }

    // Build the update payload — only known columns
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof updates.title === "string") update.title = updates.title.trim();
    if (updates.description !== undefined) update.description = updates.description?.trim() || null;
    if (updates.instructions !== undefined) update.instructions = updates.instructions?.trim() || null;
    if (updates.priority !== undefined) update.priority = updates.priority;
    if (updates.due_date !== undefined) update.due_date = updates.due_date;
    if (updates.status !== undefined) update.status = updates.status;
    if (updates.is_published !== undefined) update.is_published = updates.is_published;

    const { data: updated, error: updateErr } = await supabase
      .from("tasks")
      .update(update)
      .eq("id", task_id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[/api/faculty-supervisor/tasks] update error:", updateErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to update task: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // If student_user_ids was provided, sync the assignments
    if (Array.isArray(updates.student_user_ids)) {
      // Validate supervision
      const { data: internships } = await supabase
        .from("student_internships")
        .select("student_user_id")
        .eq("faculty_supervisor_id", user.id)
        .in("status", ["assigned", "active"]);
      const supervisedIds = new Set((internships || []).map((i) => i.student_user_id));
      const invalidIds = updates.student_user_ids.filter((id) => !supervisedIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error: `Some students are not under your supervision: ${invalidIds.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Fetch existing assignments
      const { data: existingAssignments } = await supabase
        .from("task_assignments")
        .select("id, student_user_id")
        .eq("task_id", task_id);
      const existingIds = new Set((existingAssignments || []).map((a) => a.student_user_id));
      const newIds = updates.student_user_ids.filter((id) => !existingIds.has(id));
      const removedIds = (existingAssignments || [])
        .filter((a) => !updates.student_user_ids!.includes(a.student_user_id))
        .map((a) => a.id);

      // Insert new assignments
      if (newIds.length > 0) {
        const newRows = newIds.map((student_user_id) => ({
          task_id,
          student_user_id,
          assigned_by: user.id,
          due_date: updates.due_date || null,
          status: "pending" as const,
        }));
        const { error: insErr } = await supabase.from("task_assignments").insert(newRows);
        if (insErr) {
          console.warn("[/api/faculty-supervisor/tasks] new assignments insert failed (non-fatal):", insErr);
        }
      }

      // Delete removed assignments (won't cascade to submissions because
      // task_submissions references task_assignments via ON DELETE CASCADE,
      // so this will also delete those submissions)
      if (removedIds.length > 0) {
        const { error: delErr } = await supabase
          .from("task_assignments")
          .delete()
          .in("id", removedIds);
        if (delErr) {
          console.warn("[/api/faculty-supervisor/tasks] removed assignments delete failed (non-fatal):", delErr);
        }
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[/api/faculty-supervisor/tasks] PUT unhandled:", err);
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
// DELETE — delete a task
// Per the production brief, faculty supervisors do NOT delete tasks. Only
// super_admin can use this endpoint for out-of-band admin work.
// ----------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
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

    // Block faculty_supervisor from deleting tasks. Only super_admin can.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Faculty supervisors cannot delete tasks. Tasks are managed by the site supervisor.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("task_id");
    if (!taskId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "task_id query parameter is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: existErr } = await supabase
      .from("tasks")
      .select("id, created_by, status")
      .eq("id", taskId)
      .maybeSingle();

    if (existErr || !existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }
    if (existing.created_by !== user.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Not authorized to delete this task" },
        { status: 403 }
      );
    }

    // Don't allow deletion of tasks with approved submissions
    if (["completed", "in_progress"].includes(existing.status)) {
      const { count } = await supabase
        .from("task_submissions")
        .select("*", { count: "exact", head: true })
        .eq("task_id", taskId)
        .in("status", ["approved"]);

      if ((count || 0) > 0) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot delete task with approved submissions" },
          { status: 400 }
        );
      }
    }

    // Cascade delete — task_assignments, task_attachments, task_submissions
    // all have ON DELETE CASCADE so we just delete the task.
    const { error: delErr } = await supabase.from("tasks").delete().eq("id", taskId);
    if (delErr) {
      console.error("[/api/faculty-supervisor/tasks] delete error:", delErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete task: ${delErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (err) {
    console.error("[/api/faculty-supervisor/tasks] DELETE unhandled:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
