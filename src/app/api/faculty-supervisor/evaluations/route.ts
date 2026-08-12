import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: Get pending/completed evaluations for supervisor
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Get supervised program IDs
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("program_ids")
      .eq("user_id", user.id)
      .eq("type", "faculty")
      .single();

    const programIds = supervisor?.program_ids || [];

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'pending', 'completed', 'all'
    const submissionType = searchParams.get("submission_type"); // 'weekly_log', 'task_submission', etc.
    const studentId = searchParams.get("student_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (type === "pending") {
      // Get submissions pending evaluation
      let query = supabase
        .from("submissions")
        .select(`
          id,
          student_id,
          task_id,
          type,
          title,
          content,
          submitted_at,
          due_date,
          students (
            id,
            full_name,
            email,
            avatar_url,
            program_id
          ),
          tasks (
            id,
            title,
            priority
          )
        `, { count: "exact" })
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      // Filter by supervised programs
      if (programIds.length > 0) {
        query = query.in("students.program_id", programIds);
      }

      if (submissionType) {
        query = query.eq("type", submissionType);
      }
      if (studentId) {
        query = query.eq("student_id", studentId);
      }

      const { data: submissions, count, error } = await query;

      if (error) {
        console.error("Error fetching pending evaluations:", error);
        return NextResponse.json({ error: "Failed to fetch evaluations" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: submissions || [],
        meta: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });

    } else {
      // Get evaluation history
      let query = supabase
        .from("evaluations")
        .select(`
          id,
          type,
          student_id,
          internship_id,
          scores,
          comments,
          status,
          submitted_at,
          evaluated_at,
          students (
            id,
            full_name,
            email
          )
        `, { count: "exact" })
        .eq("evaluator_id", user.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (submissionType) {
        query = query.eq("type", submissionType);
      }
      if (studentId) {
        query = query.eq("student_id", studentId);
      }

      const { data: evaluations, count, error } = await query;

      if (error) {
        console.error("Error fetching evaluation history:", error);
        return NextResponse.json({ error: "Failed to fetch evaluations" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: evaluations || [],
        meta: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }
  } catch (error) {
    console.error("Evaluations API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Submit evaluation (rating, comments, status)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get supervisor's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name")
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
      submission_id,
      decision, // 'approve', 'reject', 'request_revision'
      rating, // 1-5 overall rating
      criteria_scores, // Object with criterion IDs as keys and scores as values
      evaluator_comments, // Internal notes
      feedback, // Visible to student
    } = body;

    if (!submission_id || !decision) {
      return NextResponse.json(
        { error: "Submission ID and decision are required" },
        { status: 400 }
      );
    }

    // Validate decision
    const validDecisions = ["approve", "reject", "request_revision"];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json(
        { error: "Invalid decision. Must be one of: approve, reject, request_revision" },
        { status: 400 }
      );
    }

    // Get the submission
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select(`
        id,
        student_id,
        task_id,
        type,
        status,
        students (
          id,
          user_id,
          full_name,
          program_id
        )
      `)
      .eq("id", submission_id)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Verify student is in supervised programs
    const { data: supervisorData } = await supabase
      .from("supervisors")
      .select("program_ids")
      .eq("user_id", user.id)
      .eq("type", "faculty")
      .single();

    const programIds = supervisorData?.program_ids || [];
    
    if (!programIds.includes(submission.students.program_id)) {
      return NextResponse.json(
        { error: "Not authorized to evaluate this student" },
        { status: 403 }
      );
    }

    // Calculate total score from criteria
    let totalScore = null;
    let maxScore = null;
    if (criteria_scores && typeof criteria_scores === "object") {
      const scores = Object.values(criteria_scores) as number[];
      totalScore = scores.reduce((sum, s) => sum + s, 0);
      maxScore = scores.length * 10; // Assuming each criterion is out of 10
    }

    // Update submission status
    const newStatus = decision === "approve" ? "approved" : 
                       decision === "reject" ? "rejected" : "revision_required";

    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: newStatus,
        evaluated_by: user.id,
        evaluated_at: new Date().toISOString(),
        feedback: feedback || null,
      })
      .eq("id", submission_id);

    if (updateError) {
      console.error("Error updating submission:", updateError);
      return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
    }

    // Create evaluation record
    const { data: evaluation, error: evalError } = await supabase
      .from("evaluations")
      .insert({
        type: submission.type === "weekly_log" ? "weekly_log" : 
             submission.type === "task_submission" ? "supervisor_evaluation" : 
             submission.type,
        student_id: submission.student_id,
        task_id: submission.task_id,
        submission_id: submission.id,
        evaluator_id: user.id,
        evaluator_role: "faculty_supervisor",
        rating: rating || null,
        scores: criteria_scores || null,
        total_score: totalScore,
        max_score: maxScore,
        comments: evaluator_comments || null,
        feedback: feedback || null,
        status: "completed",
        decision: decision,
      })
      .select()
      .single();

    if (evalError) {
      console.error("Error creating evaluation:", evalError);
      return NextResponse.json({ error: "Failed to create evaluation record" }, { status: 500 });
    }

    // Send notification to student about evaluation result
    const notificationTitle = decision === "approve" ? "Submission Approved" :
                              decision === "reject" ? "Submission Requires Attention" :
                              "Revision Requested";
    
    const notificationMessage = decision === "approve" 
      ? `Your "${submission.type.replace("_", " ")}" has been approved by your supervisor.`
      : decision === "reject"
      ? `Your submission requires significant revisions. Please review the feedback provided.`
      : `Please review the feedback and submit a revised version of your work.`;

    await supabase.from("notifications").insert({
      user_id: submission.students.user_id,
      title: notificationTitle,
      message: notificationMessage,
      category: "evaluation",
      priority: decision === "reject" ? "high" : "medium",
      action_url: `/student/evaluations/${evaluation.id}`,
      metadata: { 
        evaluation_id: evaluation.id,
        submission_id: submission_id,
        decision: decision,
      },
    });

    // If approved and it's a weekly log, update the log status too
    if (decision === "approve" && submission.type === "weekly_log") {
      await supabase
        .from("weekly_logs")
        .update({
          status: "approved",
          supervisor_feedback: feedback || evaluator_comments || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submission_id); // Assuming submission_id matches weekly_log id
    }

    return NextResponse.json({
      success: true,
      data: evaluation,
      message: `Submission ${newStatus} successfully`,
    });
  } catch (error) {
    console.error("Submit evaluation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
