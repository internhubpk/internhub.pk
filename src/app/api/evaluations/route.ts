import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  EvaluationSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Evaluation,
  UserRole,
} from "@/types";

// Roles that can view evaluations
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "faculty_supervisor",
  "site_supervisor",
  "external_evaluator",
  "student",
];

// Roles that can create/submit evaluations
const CREATE_ROLES: UserRole[] = [
  "faculty_supervisor",
  "site_supervisor",
  "external_evaluator",
  "company_hr",
];

/**
 * GET /api/evaluations
 * Get evaluations - filtered by user role
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !VIEW_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    const filterResult = FilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;
    const filters = filterResult.success ? filterResult.data : {};
    const status = searchParams.get("status");
    const evaluatorType = searchParams.get("evaluator_type");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data
    let query = supabase
      .from("evaluations")
      .select(`
        *,
        student_internships:student_internship_id(
          id,
          students:student_id(
            enrollment_number,
            profiles:user_id(first_name, last_name, avatar_url)
          )
        ),
        evaluators:evaluator_id(
          id,
          profiles:user_id(first_name, last_name),
          external_evaluators:id(name, organization)
        )
      `, { count: "exact" });

    // Apply role-based filtering
    if (profile.role === "student") {
      // Students can only see their own evaluations
      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (studentRecord) {
        const { data: studentSIs } = await supabase
          .from("student_internships")
          .select("id")
          .eq("student_id", studentRecord.id);

        if (studentSIs && studentSIs.length > 0) {
          const siIds = studentSIs.map((si) => si.id);
          query = query.in("student_internship_id", siIds);
        } else {
          return NextResponse.json<ApiResponse<PaginatedResponse<Evaluation>>>({
            success: true,
            data: {
              data: [],
              total: 0,
              page,
              pageSize,
              totalPages: 0,
            },
          });
        }
      }
    } else if (
      ["faculty_supervisor", "site_supervisor"].includes(profile.role!)
    ) {
      // Supervisors see evaluations they created
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id, type")
        .eq("user_id", user.id)
        .single();

      if (supervisorRecord) {
        query = query.eq("evaluator_id", supervisorRecord.id);
        if (profile.role === "faculty_supervisor") {
          query = query.eq("evaluator_type", "faculty");
        } else if (profile.role === "site_supervisor") {
          query = query.eq("evaluator_type", "site");
        }
      }
    } else if (profile.role === "external_evaluator") {
      // External evaluators see their own evaluations
      const { data: extEvaluator } = await supabase
        .from("external_evaluators")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (extEvaluator) {
        query = query.eq("evaluator_id", extEvaluator.id).eq("evaluator_type", "external");
      }
    }

    // Apply additional filters
    if (filters.student_id) {
      const { data: studentSIs } = await supabase
        .from("student_internships")
        .select("id")
        .eq("student_id", filters.student_id);

      if (studentSIs && studentSIs.length > 0) {
        const siIds = studentSIs.map((si) => si.id);
        query = query.in("student_internship_id", siIds);
      }
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (evaluatorType) {
      query = query.eq("evaluator_type", evaluatorType);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: evaluations, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching evaluations:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch evaluations" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Evaluation> = {
      data: evaluations as unknown as Evaluation[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Evaluation>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/evaluations:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evaluations
 * Create/submit evaluation - Supervisors and Company HR
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !CREATE_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Only supervisors can submit evaluations" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = EvaluationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.errors[0]?.message,
        },
        { status: 400 }
      );
    }

    const evaluationData = validation.data;

    // Verify student internship exists
    const { data: studentInternship } = await supabase
      .from("student_internships")
      .select("*")
      .eq("id", evaluationData.student_internship_id)
      .in("status", ["active", "completed"])
      .single();

    if (!studentInternship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student internship not found or not active/completed" },
        { status: 404 }
      );
    }

    // Determine evaluator ID based on role
    let evaluatorId: string | null = null;
    let expectedEvaluatorType = evaluationData.evaluator_type;

    if (profile.role === "faculty_supervisor") {
      expectedEvaluatorType = "faculty";
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "faculty")
        .single();
      
      if (supervisor) {
        evaluatorId = supervisor.id;
        
        // Verify this supervisor is assigned to this internship
        if (studentInternship.faculty_supervisor_id !== evaluatorId) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "You are not assigned as faculty supervisor for this student" },
            { status: 403 }
          );
        }
      }
    } else if (profile.role === "site_supervisor") {
      expectedEvaluatorType = "site";
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "site")
        .single();
      
      if (supervisor) {
        evaluatorId = supervisor.id;
        
        // Verify this supervisor is assigned to this internship
        if (studentInternship.site_supervisor_id !== evaluatorId) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "You are not assigned as site supervisor for this student" },
            { status: 403 }
          );
        }
      }
    } else if (profile.role === "external_evaluator") {
      expectedEvaluatorType = "external";
      const { data: extEval } = await supabase
        .from("external_evaluators")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (extEval) {
        evaluatorId = extEval.id;
        
        // Verify this evaluator is assigned to this internship
        if (studentInternship.external_evaluator_id !== evaluatorId) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "You are not assigned as external evaluator for this student" },
            { status: 403 }
          );
        }
      }
    } else if (profile.role === "company_hr") {
      expectedEvaluatorType = "company";
      // For company HR, we use user ID as evaluator
      evaluatorId = user.id;
    }

    if (!evaluatorId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not determine your evaluator identity" },
        { status: 400 }
      );
    }

    // Validate evaluator type matches role
    if (evaluationData.evaluator_type !== expectedEvaluatorType) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Evaluator type must be "${expectedEvaluatorType}" for your role`,
        },
        { status: 400 }
      );
    }

    // Calculate total score if not provided
    if (!evaluationData.total_score && evaluationData.criteria_scores) {
      const scores = Object.values(evaluationData.criteria_scores);
      evaluationData.total_score = scores.reduce((sum, score) => sum + score, 0);
    }

    // Check for existing evaluation of same type for this internship
    const { data: existingEvaluation } = await supabase
      .from("evaluations")
      .select("id, status")
      .eq("student_internship_id", evaluationData.student_internship_id)
      .eq("evaluator_type", evaluationData.evaluator_type)
      .eq("evaluation_period", evaluationData.evaluation_period)
      .single();

    if (existingEvaluation) {
      // Allow updating in_progress evaluations
      if (existingEvaluation.status === "in_progress") {
        const { data: updatedEvaluation, error: updateError } = await supabase
          .from("evaluations")
          .update({
            ...evaluationData,
            evaluator_id: evaluatorId,
            status: evaluationData.status || "in_progress",
            submitted_at:
              evaluationData.status === "completed"
                ? new Date().toISOString()
                : null,
          })
          .eq("id", existingEvaluation.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating evaluation:", updateError);
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Failed to update evaluation" },
            { status: 500 }
          );
        }

        return NextResponse.json<ApiResponse<Evaluation>>({
          success: true,
          data: updatedEvaluation as Evaluation,
          message: "Evaluation updated successfully",
        });
      }

      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `An ${evaluationData.evaluator_type} evaluation for period "${evaluationData.evaluation_period}" already exists`,
        },
        { status: 409 }
      );
    }

    // Create evaluation
    const { data: evaluation, error } = await supabase
      .from("evaluations")
      .insert({
        ...evaluationData,
        evaluator_id: evaluatorId,
        status: evaluationData.status || "in_progress",
        submitted_at:
          evaluationData.status === "completed"
            ? new Date().toISOString()
            : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating evaluation:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to submit evaluation" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Evaluation>>({
      success: true,
      data: evaluation as Evaluation,
      message: "Evaluation submitted successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/evaluations:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
