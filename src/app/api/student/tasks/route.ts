import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/student/tasks - Fetch tasks for authenticated student
// POST /api/student/tasks - Create a new task (for supervisors only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Get student profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("student_id")
      .eq("user_id", user.id)
      .single();

    const studentId = profile?.student_id || user.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .eq("student_id", studentId)
      .order("due_date", { ascending: true })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: tasks, error, count } = await query;

    if (error) throw error;

    // Fetch submissions for these tasks
    const taskIds = (tasks || []).map(t => t.id);
    let submissionsMap: Record<string, any> = {};

    if (taskIds.length > 0) {
      const { data: submissions } = await supabase
        .from("task_submissions")
        .select("*")
        .eq("student_id", studentId)
        .in("task_id", taskIds);

      (submissions || []).forEach((sub: any) => {
        submissionsMap[sub.task_id] = sub;
      });
    }

    // Combine tasks with submissions
    const tasksWithSubmissions = (tasks || []).map(task => ({
      ...task,
      submission: submissionsMap[task.id] || null,
    }));

    return NextResponse.json({
      success: true,
      data: tasksWithSubmissions,
      meta: {
        total: count,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0),
      },
    });
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to fetch tasks",
          details: process.env.NODE_ENV === "development" ? error.message : undefined 
        } 
      },
      { status: 500 }
    );
  }
}

// POST - Create task (typically for supervisors, but can be used for self-assigned tasks)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, description, course_name, due_date, priority } = body;

    // Validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Title is required" } },
        { status: 400 }
      );
    }

    // Get student ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("student_id")
      .eq("user_id", user.id)
      .single();

    const studentId = profile?.student_id || user.id;

    // Create task
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        course_name: course_name?.trim() || null,
        due_date: due_date || null,
        priority: priority || "medium",
        student_id: studentId,
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: task,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to create task",
          details: process.env.NODE_ENV === "development" ? error.message : undefined 
        } 
      },
      { status: 500 }
    );
  }
}
