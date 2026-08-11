import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: List tasks created by supervisor (program-scoped)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get supervisor's profile and assigned programs
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    // Get supervisor's assigned programs
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("program_ids")
      .eq("user_id", user.id)
      .eq("type", "faculty")
      .single();

    const programIds = supervisor?.program_ids || [];

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build query for tasks created by this supervisor
    let query = supabase
      .from("tasks")
      .select(`
        *,
        task_assignments (
          id,
          student_id,
          status,
          students (
            id,
            full_name,
            email,
            program_id
          )
        ),
        submissions (
          id,
          student_id,
          status,
          submitted_at
        )
      `, { count: "exact" })
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }
    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data: tasks, count, error } = await query;

    if (error) {
      console.error("Error fetching tasks:", error);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tasks || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Tasks API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create new task with student assignments
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get supervisor's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const {
      title,
      description,
      priority = "medium",
      due_date,
      student_ids = [],
      attachments = [],
    } = body;

    // Validate required fields
    if (!title || !due_date) {
      return NextResponse.json(
        { error: "Title and due date are required" },
        { status: 400 }
      );
    }

    if (student_ids.length === 0) {
      return NextResponse.json(
        { error: "At least one student must be assigned" },
        { status: 400 }
      );
    }

    // Verify that all students belong to supervised programs
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("program_ids")
      .eq("user_id", user.id)
      .eq("type", "faculty")
      .single();

    const programIds = supervisor?.program_ids || [];

    const { data: students } = await supabase
      .from("students")
      .select("id, program_id, user_id")
      .in("id", student_ids);

    if (!students || students.length === 0) {
      return NextResponse.json(
        { error: "No valid students found" },
        { status: 400 }
      );
    }

    // Check if students are in supervised programs
    const invalidStudents = students.filter(s => !programIds.includes(s.program_id));
    if (invalidStudents.length > 0) {
      return NextResponse.json(
        { error: "Some students are not in your supervised programs" },
        { status: 400 }
      );
    }

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title,
        description: description || null,
        priority,
        due_date,
        status: "draft",
        created_by: user.id,
        university_id: profile.university_id,
        department_id: profile.department_id,
      })
      .select()
      .single();

    if (taskError) {
      console.error("Error creating task:", taskError);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    // Create task assignments for each student
    const assignments = students.map(student => ({
      task_id: task.id,
      student_id: student.id,
      user_id: student.user_id,
      status: "assigned",
    }));

    const { error: assignmentError } = await supabase
      .from("task_assignments")
      .insert(assignments);

    if (assignmentError) {
      console.error("Error creating assignments:", assignmentError);
      // Rollback task creation
      await supabase.from("tasks").delete().eq("id", task.id);
      return NextResponse.json(
        { error: "Failed to assign task to students" },
        { status: 500 }
      );
    }

    // Handle attachments if provided
    if (attachments.length > 0) {
      const attachmentRecords = attachments.map((att: { name: string; url: string; size: number; type: string }) => ({
        task_id: task.id,
        name: att.name,
        url: att.url,
        size: att.size,
        type: att.type,
        uploaded_by: user.id,
      }));

      const { error: attError } = await supabase
        .from("task_attachments")
        .insert(attachmentRecords);

      if (attError) {
        console.error("Error saving attachments:", attError);
        // Non-fatal error - task is still created
      }
    }

    // Send notifications to assigned students
    for (const student of students) {
      await supabase.from("notifications").insert({
        user_id: student.user_id,
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${title}`,
        category: "task",
        priority: priority === "urgent" ? "high" : "medium",
        action_url: `/student/tasks/${task.id}`,
        metadata: { task_id: task.id },
      });
    }

    return NextResponse.json({
      success: true,
      data: task,
      message: `Task created and assigned to ${students.length} student(s)`,
    });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Update task
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { task_id, ...updates } = body;

    if (!task_id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Verify ownership
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id, created_by")
      .eq("id", task_id)
      .single();

    if (!existingTask || existingTask.created_by !== user.id) {
      return NextResponse.json({ error: "Not authorized to update this task" }, { status: 403 });
    }

    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete task
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Verify ownership
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id, created_by, status")
      .eq("id", taskId)
      .single();

    if (!existingTask || existingTask.created_by !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this task" }, { status: 403 });
    }

    // Don't allow deletion of in-progress or completed tasks with submissions
    if (["in_progress", "completed"].includes(existingTask.status)) {
      const { count } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("task_id", taskId)
        .in("status", ["submitted", "approved"]);

      if ((count || 0) > 0) {
        return NextResponse.json(
          { error: "Cannot delete task with approved/submitted work" },
          { status: 400 }
        );
      }
    }

    // Delete related records first
    await supabase.from("task_assignments").delete().eq("task_id", taskId);
    await supabase.from("task_attachments").delete().eq("task_id", taskId);

    // Delete the task
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      console.error("Error deleting task:", error);
      return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
