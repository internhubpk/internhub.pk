import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";
import { notifyTaskAssigned } from "@/lib/notifications";

/**
 * /api/site-supervisor/tasks
 *
 * Site-supervisor task management — supports the Week → Day → Task structure.
 *
 * GET    — list tasks created by this site supervisor, with their assignments
 *          and submissions joined. Supports filtering by week, internship, status.
 * POST   — create a new task + assignments for one or more assigned students.
 *          Required body fields: title, student_user_ids[]
 *          Optional: description, expected_deliverable, resources, youtube_url,
 *                    due_date, week_number, day_number, sort_order,
 *                    requires_previous_completion
 * PUT    — update an existing task (must be the creator).
 * DELETE — delete a task (must be the creator; cascades to assignments).
 *
 * SCHEMA (post-migration 0050)
 *   tasks:
 *     id, program_id?, internship_id?, created_by, title, description,
 *     instructions, due_date, max_score, is_published, status, priority,
 *     university_id, department_id,
 *     week_number, day_number, expected_deliverable, resources, youtube_url,
 *     sort_order, requires_previous_completion,
 *     created_at, updated_at
 *
 *   task_assignments:
 *     id, task_id, student_user_id, assigned_by, due_date, status,
 *     created_at, updated_at
 *
 * AUTHORIZATION
 *   - Caller must be signed in.
 *   - Caller's profile.role must be 'site_supervisor' (or 'super_admin').
 *   - For POST: every assigned student must be in an active student_internships
 *     row where site_supervisor_id = caller's user_id. RLS enforces this too.
 */

interface TaskRow {
  id: string;
  internship_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  expected_deliverable: string | null;
  resources: string | null;
  youtube_url: string | null;
  due_date: string | null;
  status: string;
  priority: string | null;
  week_number: number | null;
  day_number: number | null;
  sort_order: number;
  requires_previous_completion: boolean;
  created_at: string;
  updated_at: string;
}

interface EnrichedTask extends TaskRow {
  assignments: any[];
  submissions: any[];
  total_assigned: number;
  submitted_count: number;
  approved_count: number;
}

// ----------------------------------------------------------------------------
// GET — list tasks created by this site supervisor
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

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile" },
        { status: 500 }
      );
    }

    if (profile.role !== "site_supervisor" && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Site supervisor access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const week = searchParams.get("week");
    const internshipId = searchParams.get("internship_id");
    const studentId = searchParams.get("student_id");
    const search = searchParams.get("search");

    // Build the tasks query — only tasks created by this supervisor
    let query = supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .eq("created_by", user.id)
      .order("week_number", { ascending: true, nullsFirst: false })
      .order("day_number", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (week) {
      query = query.eq("week_number", parseInt(week, 10));
    }
    if (internshipId) {
      query = query.eq("internship_id", internshipId);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: tasks, error: tasksErr, count } = await query;
    if (tasksErr) {
      console.error("[/api/site-supervisor/tasks] GET error:", tasksErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to fetch tasks: ${tasksErr.message}` },
        { status: 500 }
      );
    }

    const taskList = (tasks || []) as TaskRow[];
    const taskIds = taskList.map((t) => t.id);

    if (taskIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [] as EnrichedTask[],
        meta: { total: 0 },
      });
    }

    // Fetch assignments (optionally filtered by student)
    let assignmentQuery = supabase
      .from("task_assignments")
      .select(
        `id, task_id, student_user_id, assigned_by, due_date, status,
         created_at, updated_at,
         student:profiles!task_assignments_student_user_id_fkey(user_id, full_name, email, avatar_url)`
      )
      .in("task_id", taskIds);

    if (studentId) {
      assignmentQuery = assignmentQuery.eq("student_user_id", studentId);
    }

    const { data: assignments, error: assignErr } = await assignmentQuery;
    if (assignErr) {
      console.warn("[/api/site-supervisor/tasks] assignments fetch failed:", assignErr);
    }

    // Fetch submissions
    const { data: submissions, error: subErr } = await supabase
      .from("task_submissions")
      .select(
        `id, task_id, student_user_id, status, submitted_at, reviewed_at,
         feedback, score, content, notes, url, links, tools_used,
         skills_learned, problems_solved`
      )
      .in("task_id", taskIds);
    if (subErr) {
      console.warn("[/api/site-supervisor/tasks] submissions fetch failed:", subErr);
    }

    // Group by task_id
    const assignmentsByTask = new Map<string, any[]>();
    for (const a of (assignments || []) as any[]) {
      if (!assignmentsByTask.has(a.task_id)) assignmentsByTask.set(a.task_id, []);
      assignmentsByTask.get(a.task_id)!.push(a);
    }

    const submissionsByTask = new Map<string, any[]>();
    for (const s of (submissions || []) as any[]) {
      if (!submissionsByTask.has(s.task_id)) submissionsByTask.set(s.task_id, []);
      submissionsByTask.get(s.task_id)!.push(s);
    }

    const enriched: EnrichedTask[] = taskList.map((t) => {
      const assigns = assignmentsByTask.get(t.id) || [];
      const subs = submissionsByTask.get(t.id) || [];
      return {
        ...t,
        assignments: assigns,
        submissions: subs,
        total_assigned: assigns.length,
        submitted_count: subs.filter((s) => s.status === "submitted" || s.status === "resubmitted").length,
        approved_count: subs.filter((s) => s.status === "approved").length,
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: { total: count || 0 },
    });
  } catch (err) {
    console.error("[/api/site-supervisor/tasks] GET unhandled:", err);
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
// POST — create a new task + assignments
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

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile" },
        { status: 500 }
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
      title,
      description,
      expected_deliverable,
      resources,
      youtube_url,
      due_date,
      week_number,
      day_number,
      sort_order,
      requires_previous_completion = true,
      priority = "medium",
      internship_id,
      student_user_ids,
    } = body as {
      title?: string;
      description?: string;
      expected_deliverable?: string;
      resources?: string;
      youtube_url?: string;
      due_date?: string;
      week_number?: number;
      day_number?: number;
      sort_order?: number;
      requires_previous_completion?: boolean;
      priority?: string;
      internship_id?: string;
      student_user_ids?: string[];
    };

    // ---- Validation ----
    if (!title || !title.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Task title is required" },
        { status: 400 }
      );
    }
    if (!student_user_ids || !Array.isArray(student_user_ids) || student_user_ids.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "At least one student must be selected" },
        { status: 400 }
      );
    }

    // ---- Verify every student is actively assigned to this supervisor ----
    // RLS will also enforce this, but checking up-front gives a clear 403.
    const { data: assignedStudents, error: assignCheckErr } = await supabase
      .from("student_internships")
      .select("student_user_id, internship_id, id")
      .eq("site_supervisor_id", user.id)
      .in("status", ["assigned", "active"])
      .in("student_user_id", student_user_ids);

    if (assignCheckErr) {
      console.error("[/api/site-supervisor/tasks] assignment check error:", assignCheckErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to verify student assignments" },
        { status: 500 }
      );
    }

    const validStudentIds = new Set((assignedStudents || []).map((r) => r.student_user_id));
    const invalidStudents = student_user_ids.filter((id) => !validStudentIds.has(id));
    if (invalidStudents.length > 0) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `You can only assign tasks to students actively assigned to you. ${invalidStudents.length} student(s) are not assignable.`,
        },
        { status: 403 }
      );
    }

    // Derive internship_id from the first student's assignment if not provided.
    const resolvedInternshipId =
      internship_id || assignedStudents?.[0]?.internship_id || null;

    // ---- Compute sort_order if not provided ----
    let finalSortOrder = typeof sort_order === "number" ? sort_order : 0;
    if (typeof sort_order !== "number") {
      // Auto-assign sort_order as the next sequential position within this internship + week
      const { data: maxRow } = await supabase
        .from("tasks")
        .select("sort_order")
        .eq("created_by", user.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      finalSortOrder = (maxRow?.sort_order || 0) + 1;
    }

    // ---- Insert the task ----
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        expected_deliverable: expected_deliverable?.trim() || null,
        resources: resources?.trim() || null,
        youtube_url: youtube_url?.trim() || null,
        due_date: due_date || null,
        week_number: typeof week_number === "number" ? week_number : null,
        day_number: typeof day_number === "number" ? day_number : null,
        sort_order: finalSortOrder,
        requires_previous_completion: !!requires_previous_completion,
        priority,
        internship_id: resolvedInternshipId,
        created_by: user.id,
        is_published: true,
        status: "published",
      })
      .select("*")
      .single();

    if (taskErr || !task) {
      console.error("[/api/site-supervisor/tasks] task insert error:", taskErr);
      const isRls =
        taskErr?.code === "42501" ||
        /row-level security policy/i.test(taskErr?.message || "");
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to create task: ${taskErr?.message}` },
        { status: isRls ? 403 : 500 }
      );
    }

    // ---- Insert task_assignments for every student ----
    const assignmentRows = student_user_ids.map((sid) => ({
      task_id: task.id,
      student_user_id: sid,
      assigned_by: user.id,
      due_date: due_date || null,
      status: "pending" as const,
    }));

    const { data: insertedAssignments, error: assignErr } = await supabase
      .from("task_assignments")
      .insert(assignmentRows)
      .select("id, student_user_id");

    if (assignErr) {
      console.error("[/api/site-supervisor/tasks] assignments insert error:", assignErr);
      // Roll back the task so we don't leave an orphan
      await supabase.from("tasks").delete().eq("id", task.id);
      const isRls =
        assignErr.code === "42501" ||
        /row-level security policy/i.test(assignErr.message);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to assign students: ${assignErr.message}` },
        { status: isRls ? 403 : 500 }
      );
    }

    // ---- Notify each student about the new task (best-effort) ----
    try {
      const studentIds = (insertedAssignments || []).map((a: any) => a.student_user_id);
      if (studentIds.length > 0 && typeof notifyTaskAssigned === "function") {
        // notifyTaskAssigned accepts a single studentUserId — call once per student
        const dueDateForNotif = due_date || null;
        await Promise.all(
          studentIds.map((sid: string) =>
            notifyTaskAssigned(
              supabase,
              sid,
              task.title,
              dueDateForNotif,
              user.id
            ).catch(() => {})
          )
        );
      }
    } catch (notifErr) {
      console.warn("[/api/site-supervisor/tasks] notification failed (non-fatal):", notifErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...task,
        assignments: insertedAssignments || [],
      },
      message: `Task "${task.title}" created and assigned to ${student_user_ids.length} student(s)`,
    });
  } catch (err) {
    console.error("[/api/site-supervisor/tasks] POST unhandled:", err);
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
// PUT — update a task (title/description/due_date/status/etc.)
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

    const body = await request.json().catch(() => ({}));
    const {
      task_id,
      title,
      description,
      expected_deliverable,
      resources,
      youtube_url,
      due_date,
      week_number,
      day_number,
      sort_order,
      requires_previous_completion,
      priority,
      status,
    } = body as any;

    if (!task_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "task_id is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from("tasks")
      .select("id, created_by")
      .eq("id", task_id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }
    if (existing.created_by !== user.id) {
      // super_admin bypass
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.role !== "super_admin") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You can only edit your own tasks" },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof title === "string") updateData.title = title.trim();
    if (typeof description === "string") updateData.description = description.trim() || null;
    if (typeof expected_deliverable === "string") updateData.expected_deliverable = expected_deliverable.trim() || null;
    if (typeof resources === "string") updateData.resources = resources.trim() || null;
    if (typeof youtube_url === "string") updateData.youtube_url = youtube_url.trim() || null;
    if (typeof due_date === "string") updateData.due_date = due_date || null;
    if (typeof week_number === "number") updateData.week_number = week_number;
    if (typeof day_number === "number") updateData.day_number = day_number;
    if (typeof sort_order === "number") updateData.sort_order = sort_order;
    if (typeof requires_previous_completion === "boolean") updateData.requires_previous_completion = requires_previous_completion;
    if (typeof priority === "string") updateData.priority = priority;
    if (typeof status === "string") updateData.status = status;

    const { data: updated, error: updateErr } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", task_id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[/api/site-supervisor/tasks] update error:", updateErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to update task: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[/api/site-supervisor/tasks] PUT unhandled:", err);
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
// DELETE — delete a task (cascade to assignments/submissions)
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

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("task_id");
    if (!taskId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "task_id query param is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("tasks")
      .select("id, created_by")
      .eq("id", taskId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }
    if (existing.created_by !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.role !== "super_admin") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You can only delete your own tasks" },
          { status: 403 }
        );
      }
    }

    const { error: delErr } = await supabase.from("tasks").delete().eq("id", taskId);
    if (delErr) {
      console.error("[/api/site-supervisor/tasks] delete error:", delErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete task: ${delErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task deleted",
    });
  } catch (err) {
    console.error("[/api/site-supervisor/tasks] DELETE unhandled:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
