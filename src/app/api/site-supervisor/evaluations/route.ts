import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

// Site Supervisor Evaluation interface matching HEC requirements
interface SiteSupervisorEvaluationInput {
  student_internship_id?: string;
  student_id?: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  // Technical Skills (0-10 each)
  technical_knowledge: number;
  problem_solving: number;
  code_quality: number;
  learning_agility: number;
  // Professional Skills (0-10 each)
  communication: number;
  teamwork: number;
  punctuality: number;
  initiative: number;
  adaptability: number;
  // Work Quality (0-10 each)
  task_completion_rate: number;
  deliverable_quality: number;
  deadline_adherence: number;
  documentation_quality: number;
  // Overall
  decision: 'satisfactory' | 'needs_improvement' | 'unsatisfactory';
  // Comments (Markdown)
  strengths: string;
  areas_for_improvement: string;
  general_remarks: string;
  recommendations: string;
  // Signature
  signature_image: string;
}

// GET: Get evaluation queue/history for assigned students
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get site supervisor record
    const { data: supervisor, error: supervisorError } = await supabase
      .from("supervisors")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "site")
      .single();

    if (supervisorError || !supervisor) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "No site supervisor record found" } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status"); // pending, submitted, approved
    const studentId = searchParams.get("studentId");

    // Build query
    let query = supabase
      .from("site_supervisor_evaluations")
      .select(`
        *,
        student_internship:student_internships(
          id,
          student_id,
          student:students(id, full_name, email, avatar_url),
          internship:internships(id, title)
        )
      `, { count: "exact" })
      .eq("evaluator_id", supervisor.id);

    if (status) {
      query = query.eq("status", status);
    }
    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: evaluations, error, count } = await query;

    if (error) {
      console.error("Error fetching evaluations:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<any> = {
      items: evaluations || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
      hasNextPage: (page * pageSize) < (count || 0),
      hasPrevPage: page > 1,
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<any>>>({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Unexpected error in site-supervisor/evaluations:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// POST: Submit new evaluation with scores, comments, signature
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get site supervisor record
    const { data: supervisor, error: supervisorError } = await supabase
      .from("supervisors")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "site")
      .single();

    if (supervisorError || !supervisor) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "No site supervisor record found" } },
        { status: 404 }
      );
    }

    // Parse request body
    const body: SiteSupervisorEvaluationInput = await request.json();

    // Validate required fields
    if (!body.evaluation_period_start || !body.evaluation_period_end) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Evaluation period dates are required" } },
        { status: 400 }
      );
    }

    if (!body.signature_image) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Digital signature is required" } },
        { status: 400 }
      );
    }

    // Validate score ranges (0-10)
    const scoreFields = [
      'technical_knowledge', 'problem_solving', 'code_quality', 'learning_agility',
      'communication', 'teamwork', 'punctuality', 'initiative', 'adaptability',
      'task_completion_rate', 'deliverable_quality', 'deadline_adherence', 'documentation_quality'
    ];

    for (const field of scoreFields) {
      const value = body[field as keyof SiteSupervisorEvaluationInput] as number;
      if (typeof value !== 'number' || value < 0 || value > 10) {
        return NextResponse.json<ApiResponse<null>>(
          { 
            success: false, 
            error: { 
              code: "VALIDATION_ERROR", 
              message: `${field} must be a number between 0 and 10` 
            } 
          },
          { status: 400 }
        );
      }
    }

    // Calculate weighted average for overall rating
    // Technical Skills: 30%
    const technicalAvg = (
      body.technical_knowledge + body.problem_solving + 
      body.code_quality + body.learning_agility
    ) / 4;
    
    // Professional Skills: 35%
    const professionalAvg = (
      body.communication + body.teamwork + 
      body.punctuality + body.initiative + body.adaptability
    ) / 5;
    
    // Work Quality: 35%
    const workQualityAvg = (
      body.task_completion_rate + body.deliverable_quality + 
      body.deadline_adherence + body.documentation_quality
    ) / 4;

    const overallRating = Math.round(
      (technicalAvg * 0.30) + (professionalAvg * 0.35) + (workQualityAvg * 0.35)
      * 100
    ) / 100;

    // Verify student is assigned to this supervisor
    if (body.student_id) {
      const { data: assignment, error: assignError } = await supabase
        .from("student_internships")
        .select("id")
        .eq("site_supervisor_id", supervisor.id)
        .eq("student_id", body.student_id)
        .maybeSingle();

      if (assignError || !assignment) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: { code: "FORBIDDEN", message: "Student is not assigned to this supervisor" } },
          { status: 403 }
        );
      }
    }

    // Create evaluation record
    const { data: evaluation, error: insertError } = await supabase
      .from("site_supervisor_evaluations")
      .insert({
        evaluator_id: supervisor.id,
        student_internship_id: body.student_internship_id,
        student_id: body.student_id,
        evaluation_period_start: body.evaluation_period_start,
        evaluation_period_end: body.evaluation_period_end,
        technical_knowledge: body.technical_knowledge,
        problem_solving: body.problem_solving,
        code_quality: body.code_quality,
        learning_agility: body.learning_agility,
        communication: body.communication,
        teamwork: body.teamwork,
        punctuality: body.punctuality,
        initiative: body.initiative,
        adaptability: body.adaptability,
        task_completion_rate: body.task_completion_rate,
        deliverable_quality: body.deliverable_quality,
        deadline_adherence: body.deadline_adherence,
        documentation_quality: body.documentation_quality,
        overall_rating: overallRating,
        decision: body.decision,
        strengths: body.strengths,
        areas_for_improvement: body.areas_for_improvement,
        general_remarks: body.general_remarks,
        recommendations: body.recommendations,
        signature_image: body.signature_image,
        signed_at: new Date().toISOString(),
        status: "submitted",
        version: 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating evaluation:", insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    // Update student_internship with last evaluation date
    if (body.student_id) {
      await supabase
        .from("student_internships")
        .update({ last_evaluation_at: new Date().toISOString() })
        .eq("site_supervisor_id", supervisor.id)
        .eq("student_id", body.student_id);
    }

    // Create audit log entry
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_evaluation",
      entity_type: "site_supervisor_evaluation",
      entity_id: evaluation.id,
      new_values: { ...evaluation, signature_image: "[REDACTED]" },
    });

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        ...evaluation,
        signature_image: undefined, // Don't return signature in list view
      },
    });

  } catch (error) {
    console.error("Unexpected error creating evaluation:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PUT: Update evaluation (if within edit window - 48 hours)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get site supervisor record
    const { data: supervisor, error: supervisorError } = await supabase
      .from("supervisors")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "site")
      .single();

    if (supervisorError || !supervisor) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "No site supervisor record found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { evaluationId, ...updates } = body;

    if (!evaluationId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Evaluation ID is required" } },
        { status: 400 }
      );
    }

    // Fetch existing evaluation and check ownership & edit window
    const { data: existingEval, error: fetchError } = await supabase
      .from("site_supervisor_evaluations")
      .select("*")
      .eq("id", evaluationId)
      .eq("evaluator_id", supervisor.id)
      .single();

    if (fetchError || !existingEval) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Evaluation not found or access denied" } },
        { status: 404 }
      );
    }

    // Check edit window (48 hours)
    const createdAt = new Date(existingEval.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > 48) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "EDIT_WINDOW_CLOSED", message: "Edit window closed. Evaluations can only be edited within 48 hours of submission." } },
        { status: 400 }
      );
    }

    // Recalculate overall rating if scores are being updated
    let updateData = { ...updates };
    if (scoreFields.some(field => updates[field])) {
      const technicalAvg = (
        (updates.technical_knowledge ?? existingEval.technical_knowledge) +
        (updates.problem_solving ?? existingEval.problem_solving) +
        (updates.code_quality ?? existingEval.code_quality) +
        (updates.learning_agility ?? existingEval.learning_agility)
      ) / 4;
      
      const professionalAvg = (
        (updates.communication ?? existingEval.communication) +
        (updates.teamwork ?? existingEval.teamwork) +
        (updates.punctuality ?? existingEval.punctuality) +
        (updates.initiative ?? existingEval.initiative) +
        (updates.adaptability ?? existingEval.adaptability)
      ) / 5;
      
      const workQualityAvg = (
        (updates.task_completion_rate ?? existingEval.task_completion_rate) +
        (updates.deliverable_quality ?? existingEval.deliverable_quality) +
        (updates.deadline_adherence ?? existingEval.deadline_adherence) +
        (updates.documentation_quality ?? existingEval.documentation_quality)
      ) / 4;

      updateData.overall_rating = Math.round(
        (technicalAvg * 0.30) + (professionalAvg * 0.35) + (workQualityAvg * 0.35)
        * 100
      ) / 100;
    }

    // Update with version increment
    const { data: updatedEval, error: updateError } = await supabase
      .from("site_supervisor_evaluations")
      .update({
        ...updateData,
        version: existingEval.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", evaluationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating evaluation:", updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update_evaluation",
      entity_type: "site_supervisor_evaluation",
      entity_id: evaluationId,
      old_values: existingEval,
      new_values: updateData,
    });

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: updatedEval,
    });

  } catch (error) {
    console.error("Unexpected error updating evaluation:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
