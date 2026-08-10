import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  EvaluationSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import {
  requireAuth,
  requireRole,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import { audit } from "@/lib/audit";
import { sanitizeInput, extractClientInfo, validatePaginationParams } from "@/lib/api-security";
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

// Allowed sort fields to prevent SQL injection
const ALLOWED_SORT_FIELDS = [
  "created_at",
  "updated_at",
  "submitted_at",
  "total_score",
  "status",
  "evaluation_period",
] as const;

// Valid evaluation periods
const VALID_EVALUATION_PERIODS = [
  "midterm",
  "final",
  "weekly",
  "monthly",
  "special",
] as const;

/**
 * Validate and sanitize sort parameters
 */
function validateSortParam(sortBy: string | null, sortOrder: string | null): {
  sortBy: typeof ALLOWED_SORT_FIELDS[number];
  ascending: boolean;
} {
  const validSort = ALLOWED_SORT_FIELDS.includes(sortBy as any)
    ? (sortBy as typeof ALLOWED_SORT_FIELDS[number])
    : "created_at";
  
  return {
    sortBy: validSort,
    ascending: sortOrder === "asc",
  };
}

/**
 * Validate evaluation period
 */
function validateEvaluationPeriod(period: string): boolean {
  return VALID_EVALUATION_PERIODS.includes(period as typeof VALID_EVALUATION_PERIODS[number]);
}

/**
 * GET /api/evaluations
 * Get evaluations - filtered by user role
 * SECURITY: Faculty/site supervisors only see assigned students, external evaluators only their assignments
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authContext = await requireAuth();
    
    if (!authContext.profile || !VIEW_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to view evaluations");
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    const filterResult = FilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    // Validate pagination bounds
    const validatedPagination = validatePaginationParams(searchParams);
    const page = paginationResult.success ? paginationResult.data.page : validatedPagination.page;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : validatedPagination.pageSize;
    const filters = filterResult.success ? filterResult.data : {};
    
    const status = searchParams.get("status");
    const evaluatorType = searchParams.get("evaluator_type");
    
    // Validate evaluator_type parameter
    if (evaluatorType && !["faculty", "site", "external", "company"].includes(evaluatorType)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid evaluator type" },
        { status: 400 }
      );
    }

    // Validate sort parameters
    const { sortBy, ascending } = validateSortParam(
      searchParams.get("sort_by"),
      searchParams.get("sort_order")
    );

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

    // Apply strict role-based filtering for security
    const userRole = authContext.profile.role as UserRole;
    const userId = authContext.user!.id;

    // SECURITY: Students can ONLY see their own evaluations
    if (userRole === "student") {
      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!studentRecord) {
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

      // Get student's internship records
      const { data: studentSIs } = await supabase
        .from("student_internships")
        .select("id")
        .eq("student_id", studentRecord.id);

      if (!studentSIs || studentSIs.length === 0) {
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

      const siIds = studentSIs.map((si) => si.id);
      query = query.in("student_internship_id", siIds);
      
      // Security: Ignore any attempted student_id filter
      if (filters.student_id) {
        console.warn(`Student ${userId} attempted to access another student's evaluations`);
      }
    }
    // SECURITY: Faculty supervisors can ONLY evaluate assigned students
    else if (userRole === "faculty_supervisor") {
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id, type, status")
        .eq("user_id", userId)
        .eq("type", "faculty")
        .single();

      if (!supervisorRecord || supervisorRecord.status !== "active") {
        return authorizationError("No active faculty supervisor record found");
      }

      // Only show evaluations created by this supervisor
      query = query.eq("evaluator_id", supervisorRecord.id).eq("evaluator_type", "faculty");
    }
    // SECURITY: Site supervisors can ONLY evaluate assigned students
    else if (userRole === "site_supervisor") {
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id, type, status")
        .eq("user_id", userId)
        .eq("type", "site")
        .single();

      if (!supervisorRecord || supervisorRecord.status !== "active") {
        return authorizationError("No active site supervisor record found");
      }

      // Only show evaluations created by this supervisor
      query = query.eq("evaluator_id", supervisorRecord.id).eq("evaluator_type", "site");
    }
    // SECURITY: External evaluators ONLY see their assigned evaluations
    else if (userRole === "external_evaluator") {
      const { data: extEvaluator } = await supabase
        .from("external_evaluators")
        .select("id, status, user_id")
        .eq("user_id", userId)
        .single();

      if (!extEvaluator || extEvaluator.status !== "active") {
        return authorizationError("No active external evaluator record found");
      }

      // Only show evaluations assigned to this external evaluator
      query = query.eq("evaluator_id", extEvaluator.id).eq("evaluator_type", "external");
    }
    // University admin sees all evaluations for their university
    else if (userRole === "university_admin") {
      const universityId = authContext.profile.university_id;
      
      if (!universityId) {
        return authorizationError("No university assigned to your account");
      }
      
      // Would need to join through student_internships to filter by university
      // For now, we allow viewing all and rely on RLS or application-level filtering
    }
    // Super admin sees everything
    // No additional filtering needed

    // Apply additional filters
    if (filters.student_id && userRole !== "student") {
      // For non-student roles, allow filtering by student
      const { data: studentSIs } = await supabase
        .from("student_internships")
        .select("id")
        .eq("student_id", filters.student_id);

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
      .order(sortBy, { ascending })
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
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    if (error instanceof Error && error.message.includes("Access")) {
      return authorizationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evaluations
 * Create/submit evaluation - Supervisors and Company HR
 * SECURITY: Assignment verification, duplicate prevention, audit logging
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication and appropriate role
    const authContext = await requireRole(CREATE_ROLES);
    
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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
    const userId = authContext.user!.id;
    const userRole = authContext.profile!.role as UserRole;

    // Validate evaluation period
    if (!validateEvaluationPeriod(evaluationData.evaluation_period)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Invalid evaluation period. Must be one of: ${VALID_EVALUATION_PERIODS.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify student internship exists and is in valid state
    const { data: studentInternship } = await supabase
      .from("student_internships")
      .select("*")
      .eq("id", evaluationData.student_internship_id)
      .in("status", ["active", "completed"])
      .single();

    if (!studentInternship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student internship not found or not in active/completed state" },
        { status: 404 }
      );
    }

    // Determine evaluator ID based on role with strict assignment verification
    let evaluatorId: string | null = null;
    let expectedEvaluatorType = evaluationData.evaluator_type;

    // SECURITY: Faculty supervisors can only evaluate ASSIGNED students
    if (userRole === "faculty_supervisor") {
      expectedEvaluatorType = "faculty";
      
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id, type, status")
        .eq("user_id", userId)
        .eq("type", "faculty")
        .single();

      if (!supervisor || supervisor.status !== "active") {
        return authorizationError("No active faculty supervisor record found");
      }

      evaluatorId = supervisor.id;

      // CRITICAL: Verify this supervisor is ASSIGNED to this specific student internship
      if (studentInternship.faculty_supervisor_id !== evaluatorId) {
        console.warn(`Faculty Supervisor ${userId} attempted to evaluate unassigned student`);
        return authorizationError("You are not assigned as faculty supervisor for this student");
      }
    }
    // SECURITY: Site supervisors can only evaluate ASSIGNED students
    else if (userRole === "site_supervisor") {
      expectedEvaluatorType = "site";
      
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id, type, status")
        .eq("user_id", userId)
        .eq("type", "site")
        .single();

      if (!supervisor || supervisor.status !== "active") {
        return authorizationError("No active site supervisor record found");
      }

      evaluatorId = supervisor.id;

      // CRITICAL: Verify this supervisor is ASSIGNED to this specific student internship
      if (studentInternship.site_supervisor_id !== evaluatorId) {
        console.warn(`Site Supervisor ${userId} attempted to evaluate unassigned student`);
        return authorizationError("You are not assigned as site supervisor for this student");
      }
    }
    // SECURITY: External evaluators can only evaluate THEIR assigned evaluations
    else if (userRole === "external_evaluator") {
      expectedEvaluatorType = "external";
      
      const { data: extEval } = await supabase
        .from("external_evaluators")
        .select("id, status, user_id")
        .eq("user_id", userId)
        .single();

      if (!extEval || extEval.status !== "active") {
        return authorizationError("No active external evaluator record found");
      }

      evaluatorId = extEval.id;

      // CRITICAL: Verify this evaluator is ASSIGNED to this specific student internship
      if (studentInternship.external_evaluator_id !== evaluatorId) {
        console.warn(`External Evaluator ${userId} attempted to evaluate unassigned student`);
        return authorizationError("You are not assigned as external evaluator for this student");
      }
    }
    // Company HR evaluates interns at their company
    else if (userRole === "company_hr") {
      expectedEvaluatorType = "company";
      
      // Verify company HR has access to this internship's company
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", userId)
        .single();

      if (!companyUser) {
        return authorizationError("No company association found");
      }

      // Get the internship for this student internship to verify company ownership
      const { data: internship } = await supabase
        .from("internships")
        .select("company_id")
        .eq("id", studentInternship.internship_id)
        .single();

      if (!internship || internship.company_id !== companyUser.company_id) {
        console.warn(`Company HR ${userId} attempted to evaluate intern from different company`);
        return authorizationError("You can only evaluate interns at your company");
      }

      evaluatorId = userId;
    }

    if (!evaluatorId) {
      return authorizationError("Could not determine your evaluator identity");
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
      // Validate scores are within reasonable range
      const invalidScores = scores.some((s: number) => s < 0 || s > 100);
      if (invalidScores) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Criteria scores must be between 0 and 100" },
          { status: 400 }
        );
      }
      evaluationData.total_score = scores.reduce((sum: number, score: number) => sum + score, 0);
    }

    // Sanitize text inputs
    if (evaluationData.comments) {
      evaluationData.comments = sanitizeInput(evaluationData.comments);
    }
    if (evaluationData.feedback) {
      evaluationData.feedback = sanitizeInput(evaluationData.feedback);
    }
    if (evaluationData.recommendations) {
      evaluationData.recommendations = sanitizeInput(evaluationData.recommendations);
    }

    // SECURITY: Check for DUPLICATE evaluations of same type for same period
    const { data: existingEvaluation } = await supabase
      .from("evaluations")
      .select("id, status, evaluator_id")
      .eq("student_internship_id", evaluationData.student_internship_id)
      .eq("evaluator_type", evaluationData.evaluator_type)
      .eq("evaluation_period", evaluationData.evaluation_period)
      .single();

    if (existingEvaluation) {
      // Security: Verify the existing evaluation belongs to this evaluator
      if (existingEvaluation.evaluator_id !== evaluatorId) {
        console.warn(`User ${userId} attempted to overwrite another evaluator's evaluation`);
        return authorizationError("An evaluation already exists for this criteria");
      }

      // Allow updating in_progress evaluations
      if (existingEvaluation.status === "in_progress") {
        const clientInfo = extractClientInfo(request);
        
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
            updated_at: new Date().toISOString(),
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

        // AUDIT LOG: Log evaluation update
        if (evaluationData.status === "completed") {
          await audit.evaluationSubmit(
            updatedEvaluation!.id,
            evaluatorId,
            evaluationData.evaluator_type
          );
        }

        return NextResponse.json<ApiResponse<Evaluation>>({
          success: true,
          data: updatedEvaluation as Evaluation,
          message: "Evaluation updated successfully",
        });
      }

      // Prevent duplicate completed evaluations
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `An ${evaluationData.evaluator_type} evaluation for period "${evaluationData.evaluation_period}" already exists and cannot be modified`,
        },
        { status: 409 }
      );
    }

    // Get client info for audit logging
    const clientInfo = extractClientInfo(request);

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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

    // AUDIT LOG: Log evaluation submission
    if (evaluationData.status === "completed") {
      await audit.evaluationSubmit(
        evaluation!.id,
        evaluatorId,
        evaluationData.evaluator_type
      );
    }

    return NextResponse.json<ApiResponse<Evaluation>>({
      success: true,
      data: evaluation as Evaluation,
      message: "Evaluation submitted successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/evaluations:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    if (error instanceof Error && error.message.includes("role")) {
      return authorizationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
