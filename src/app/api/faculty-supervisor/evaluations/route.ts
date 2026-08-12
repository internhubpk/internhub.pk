import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: Get pending/completed evaluations for the faculty supervisor
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get supervisor's profile. profiles has no `id` column — PK is user_id.
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'pending', 'completed', 'all'
    const studentUserId = searchParams.get("student_id") || searchParams.get("student_user_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // evaluation_status enum: pending, in_progress, submitted, approved, rejected
    // (no "completed" value).
    if (type === "pending") {
      let query = supabase
        .from("evaluations")
        .select(
          `
          id,
          type,
          status,
          comments,
          created_at,
          submitted_at,
          student_user_id,
          student_profile:student_user_id(full_name, email, avatar_url)
        `,
          { count: "exact" }
        )
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "faculty_supervisor")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      if (studentUserId) {
        query = query.eq("student_user_id", studentUserId);
      }

      const { data: evaluations, count, error } = await query;

      if (error) {
        console.error("Error fetching pending evaluations:", error);
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
    } else {
      // History: evaluations with a terminal status.
      let query = supabase
        .from("evaluations")
        .select(
          `
          id,
          type,
          status,
          rating,
          scores,
          comments,
          created_at,
          submitted_at,
          student_user_id,
          student_profile:student_user_id(full_name, email)
        `,
          { count: "exact" }
        )
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "faculty_supervisor")
        .in("status", ["submitted", "approved", "rejected"])
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (studentUserId) {
        query = query.eq("student_user_id", studentUserId);
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

// POST: Submit an evaluation (rating, scores, comments, status).
//
// Body shape:
//   {
//     evaluation_id: string,         // required — the pending evaluation to update
//     decision: "approve" | "reject" | "request_revision",
//     rating?: number,               // 0-5
//     criteria_scores?: Record<string, number>, // stored as JSONB `scores`
//     evaluator_comments?: string,   // internal notes
//     feedback?: string              // visible to student (combined into comments)
//   }
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get supervisor's profile (profiles PK is user_id, not id).
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      evaluation_id,
      decision,
      rating,
      criteria_scores,
      evaluator_comments,
      feedback,
    } = body;

    if (!evaluation_id || !decision) {
      return NextResponse.json(
        { error: "evaluation_id and decision are required" },
        { status: 400 }
      );
    }

    const validDecisions = ["approve", "reject", "request_revision"];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json(
        { error: "Invalid decision. Must be one of: approve, reject, request_revision" },
        { status: 400 }
      );
    }

    // Load the evaluation (and verify ownership).
    const { data: evaluation, error: evalError } = await supabase
      .from("evaluations")
      .select("id, student_user_id, type, status")
      .eq("id", evaluation_id)
      .eq("evaluator_id", user.id)
      .eq("evaluator_role", "faculty_supervisor")
      .single();

    if (evalError || !evaluation) {
      return NextResponse.json(
        { error: "Evaluation not found or not owned by this supervisor" },
        { status: 404 }
      );
    }

    // Map decision → evaluation status (enum: pending, in_progress, submitted, approved, rejected).
    const newStatus =
      decision === "approve"
        ? "approved"
        : decision === "reject"
        ? "rejected"
        : "submitted"; // request_revision → submitted with feedback

    // Combine internal comments and student-visible feedback into the single
    // `comments` column (the table has no separate `feedback` column).
    const combinedComments =
      [evaluator_comments, feedback].filter(Boolean).join("\n\n--- Feedback for student ---\n") || null;

    // Build scores JSONB (only valid numeric values).
    const scores: Record<string, number> = {};
    if (criteria_scores && typeof criteria_scores === "object") {
      for (const [k, v] of Object.entries(criteria_scores)) {
        if (typeof v === "number" && !Number.isNaN(v)) scores[k] = v;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("evaluations")
      .update({
        rating: typeof rating === "number" ? rating : null,
        scores,
        comments: combinedComments,
        status: newStatus,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", evaluation_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating evaluation:", updateError);
      return NextResponse.json({ error: "Failed to submit evaluation" }, { status: 500 });
    }

    // Notify the student.
    const notificationTitle =
      decision === "approve"
        ? "Evaluation Approved"
        : decision === "reject"
        ? "Evaluation Rejected"
        : "Evaluation Submitted — Revision Requested";

    const notificationMessage =
      feedback || evaluator_comments || "Your evaluation has been updated.";

    await supabase.from("notifications").insert({
      user_id: evaluation.student_user_id,
      sender_id: user.id,
      title: notificationTitle,
      message: notificationMessage,
      category: "evaluation",
      priority: decision === "reject" ? "high" : "medium",
      is_read: false,
      metadata: { evaluation_id: evaluation.id, decision },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Evaluation ${newStatus} successfully`,
    });
  } catch (error) {
    console.error("Submit evaluation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
