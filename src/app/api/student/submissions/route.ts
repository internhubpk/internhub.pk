import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/student/submissions - Fetch submissions for authenticated student
// POST /api/student/submissions - Create a new submission
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
    const taskId = searchParams.get("task_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("task_submissions")
      .select("*", { count: "exact" })
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Filter by task_id if provided
    if (taskId) {
      query = query.eq("task_id", taskId);
    }

    const { data: submissions, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: submissions,
      meta: {
        total: count,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0),
      },
    });
  } catch (error: any) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to fetch submissions",
          details: process.env.NODE_ENV === "development" ? error.message : undefined 
        } 
      },
      { status: 500 }
    );
  }
}

// POST - Create new submission
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
    const { task_id, notes, url, file_data } = body;

    // Validate required fields
    if (!task_id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Task ID is required" } },
        { status: 400 }
      );
    }

    // Check if task exists and belongs to this student
    const { data: profile } = await supabase
      .from("profiles")
      .select("student_id")
      .eq("user_id", user.id)
      .single();

    const studentId = profile?.student_id || user.id;

    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", task_id)
      .eq("student_id", studentId)
      .single();

    if (!task) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found or access denied" } },
        { status: 404 }
      );
    }

    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    // Handle file upload if provided (base64)
    if (file_data) {
      const { file_name, file_content, mime_type } = file_data;
      
      if (!file_content || !file_name) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "File name and content are required for file upload" } },
          { status: 400 }
        );
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(file_content, "base64");
      
      // Generate unique filename
      const ext = file_name.split(".").pop();
      const uniqueName = `submission_${studentId}_${task_id}_${Date.now()}.${ext}`;
      const filePath = `submissions/${uniqueName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, buffer, {
          contentType: mime_type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      fileUrl = urlData.publicUrl;
      fileName = file_name;
      fileSize = buffer.length;
    }

    // Create or update submission
    const submissionData = {
      task_id,
      student_id: studentId,
      notes: notes?.trim() || null,
      url: url?.trim() || null,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      status: "pending",
      submitted_at: new Date().toISOString(),
    };

    // Use upsert to handle re-submissions
    const { data: submission, error } = await supabase
      .from("task_submissions")
      .upsert(submissionData, {
        onConflict: "task_id,student_id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Update task status to submitted
    await supabase
      .from("tasks")
      .update({ 
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", task_id);

    // Auto-mark attendance when submitting tasks
    const today = new Date().toISOString().split("T")[0];
    
    // Check if attendance already exists for today
    const { data: existingAttendance } = await supabase
      .from("attendance")
      .select("id")
      .eq("student_id", studentId)
      .eq("date", today)
      .maybeSingle();

    if (!existingAttendance) {
      // Create attendance record
      await supabase.from("attendance").insert({
        student_id: studentId,
        internship_id: task.internship_id || null,
        date: today,
        check_in: new Date().toTimeString().slice(0, 5),
        status: "present",
        notes: "Auto-marked on task submission",
      });
    }

    return NextResponse.json({
      success: true,
      data: submission,
      message: "Task submitted successfully",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating submission:", error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to submit task",
          details: process.env.NODE_ENV === "development" ? error.message : undefined 
        } 
      },
      { status: 500 }
    );
  }
}
