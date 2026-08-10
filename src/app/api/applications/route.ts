import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateApplicationSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import {
  requireAuth,
  requireRole,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import { validateTenantOwnership } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { sanitizeInput, extractClientInfo, validatePaginationParams } from "@/lib/api-security";
import type {
  ApiResponse,
  PaginatedResponse,
  InternshipApplication,
  UserRole,
} from "@/types";

// Roles that can view applications
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

// Roles that can submit applications
const SUBMIT_ROLES: UserRole[] = ["student"];

// Roles that can approve/reject applications
const APPROVE_ROLES: UserRole[] = ["company_hr", "university_admin", "department_coordinator"];

// Allowed sort fields to prevent SQL injection
const ALLOWED_SORT_FIELDS = [
  "applied_at",
  "updated_at",
  "status",
  "reviewed_at",
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
    : "applied_at";
  
  return {
    sortBy: validSort,
    ascending: sortOrder === "asc",
  };
}

/**
 * GET /api/applications
 * List applications - filtered by user role
 * SECURITY: Students see own, Company HR sees their internships, Uni Admin sees all for university
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authContext = await requireAuth();
    
    if (!authContext.profile || !VIEW_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to view applications");
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
    
    // Validate sort parameters
    const { sortBy, ascending } = validateSortParam(
      searchParams.get("sort_by"),
      searchParams.get("sort_order")
    );

    // Build query with related data
    let query = supabase
      .from("internship_applications")
      .select(`
        *,
        internships:internship_id(title, company_id, universities:university_id(name)),
        students:student_id(
          id,
          user_id,
          enrollment_number,
          profiles:user_id(first_name, last_name)
        )
      `, { count: "exact" });

    // Apply strict role-based filtering for security
    const userRole = authContext.profile.role as UserRole;
    const userId = authContext.user!.id;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    // SECURITY: Students can ONLY see their own applications
    if (userRole === "student") {
      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!studentRecord) {
        // Student record not found - return empty results
        return NextResponse.json<ApiResponse<PaginatedResponse<InternshipApplication>>>({
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

      // Force filter by student's own ID
      query = query.eq("student_id", studentRecord.id);
      
      // Security: Ignore any attempted student_id filter
      if (filters.student_id && filters.student_id !== studentRecord.id) {
        console.warn(`Student ${userId} attempted to access another student's applications`);
      }
    }
    // SECURITY: Company HR can ONLY see applications to their company's internships
    else if (userRole === "company_hr") {
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", userId)
        .single();

      if (!companyUser) {
        return authorizationError("No company association found");
      }

      // Get all internship IDs for this company
      const { data: companyInternships } = await supabase
        .from("internships")
        .select("id")
        .eq("company_id", companyUser.company_id);

      if (!companyInternships || companyInternships.length === 0) {
        return NextResponse.json<ApiResponse<PaginatedResponse<InternshipApplication>>>({
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

      const internshipIds = companyInternships.map((i) => i.id);
      query = query.in("internship_id", internshipIds);
    }
    // SECURITY: University Admin can see ALL applications for their university
    else if (userRole === "university_admin") {
      if (!userUniversityId) {
        return authorizationError("No university assigned to your account");
      }

      // Get all internship IDs for this university
      const { data: uniInternships } = await supabase
        .from("internships")
        .select("id")
        .eq("university_id", userUniversityId);

      if (uniInternships && uniInternships.length > 0) {
        const internshipIds = uniInternships.map((i) => i.id);
        query = query.in("internship_id", internshipIds);
      } else {
        // No internships for this university yet
        return NextResponse.json<ApiResponse<PaginatedResponse<InternshipApplication>>>({
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
    // Department Coordinator sees applications from their department only
    else if (userRole === "department_coordinator") {
      if (!userUniversityId) {
        return authorizationError("No university assigned to your account");
      }

      // First get university's internships
      const { data: uniInternships } = await supabase
        .from("internships")
        .select("id")
        .eq("university_id", userUniversityId);

      if (uniInternships && uniInternships.length > 0) {
        const internshipIds = uniInternships.map((i) => i.id);
        query = query.in("internship_id", internshipIds);

        // Further filter by department students
        if (userDepartmentId) {
          const { data: deptStudents } = await supabase
            .from("students")
            .select("id")
            .eq("department_id", userDepartmentId);

          if (deptStudents && deptStudents.length > 0) {
            const studentIds = deptStudents.map((s) => s.id);
            query = query.in("student_id", studentIds);
          } else {
            // No department students
            return NextResponse.json<ApiResponse<PaginatedResponse<InternshipApplication>>>({
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
      } else {
        return NextResponse.json<ApiResponse<PaginatedResponse<InternshipApplication>>>({
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
    // Faculty Supervisor sees applications of their assigned students
    else if (userRole === "faculty_supervisor") {
      if (!userUniversityId) {
        return authorizationError("No university assigned to your account");
      }

      // Get supervisor record
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "faculty")
        .single();

      if (supervisorRecord) {
        // Get assigned student internships
        const { data: assignedSIs } = await supabase
          .from("student_internships")
          .select("id")
          .eq("faculty_supervisor_id", supervisorRecord.id);

        if (assignedSIs && assignedSIs.length > 0) {
          const siIds = assignedSIs.map((si) => si.id);
          // Need to get application IDs for these student internships
          // For now, we'll use a different approach
        }
      }

      // Fallback: show university-level applications
      const { data: uniInternships } = await supabase
        .from("internships")
        .select("id")
        .eq("university_id", userUniversityId);

      if (uniInternships && uniInternships.length > 0) {
        const internshipIds = uniInternships.map((i) => i.id);
        query = query.in("internship_id", internshipIds);
      }
    }
    // Super Admin can see everything
    else if (userRole === "super_admin") {
      // Apply explicit filters if provided
      if (filters.university_id) {
        // Would need to get internships for this university
      }
    }

    // Apply additional filters (with security constraints already applied above)
    if (filters.internship_id) {
      query = query.eq("internship_id", filters.internship_id);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Apply date range filter
    if (filters.date_from) {
      query = query.gte("applied_at", filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte("applied_at", filters.date_to);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: applications, error } = await query
      .order(sortBy, { ascending })
      .range(start, end);

    if (error) {
      console.error("Error fetching applications:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch applications" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<InternshipApplication> = {
      data: applications as unknown as InternshipApplication[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<InternshipApplication>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/applications:", error);
    
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
 * POST /api/applications
 * Submit application - Student only
 * SECURITY: Ownership verification, audit logging
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication and student role
    const authContext = await requireRole(SUBMIT_ROLES);
    
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateApplicationSchema.safeParse(body);

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

    const applicationData = validation.data;
    const userId = authContext.user!.id;

    // SECURITY: Verify student record exists and belongs to THIS authenticated user
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", userId)
      .eq("id", applicationData.student_id)
      .single();

    if (!student) {
      console.warn(`Student ${userId} attempted application with mismatched student_id`);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student record not found or access denied" },
        { status: 404 }
      );
    }

    // Check student status is active
    if (student.status !== "active") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Only active students can apply for internships" },
        { status: 403 }
      );
    }

    // Verify internship exists and is accepting applications
    const { data: internship } = await supabase
      .from("internships")
      .select("*")
      .eq("id", applicationData.internship_id)
      .single();

    if (!internship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Internship not found" },
        { status: 404 }
      );
    }

    // Check if internship is open for applications
    if (!["published", "active"].includes(internship.status)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This internship is not currently accepting applications" },
        { status: 400 }
      );
    }

    // Check if application deadline has passed
    if (internship.application_deadline) {
      const deadline = new Date(internship.application_deadline);
      const now = new Date();
      if (now > deadline) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "The application deadline for this internship has passed" },
          { status: 400 }
        );
      }
    }

    // Sanitize text inputs
    if (applicationData.cover_letter) {
      applicationData.cover_letter = sanitizeInput(applicationData.cover_letter);
    }

    // Check if student has already applied to this internship
    const { data: existingApplication } = await supabase
      .from("internship_applications")
      .select("id, status")
      .eq("internship_id", applicationData.internship_id)
      .eq("student_id", applicationData.student_id)
      .single();

    if (existingApplication) {
      if (existingApplication.status === "withdrawn") {
        // Allow re-application after withdrawal
        const clientInfo = extractClientInfo(request);
        
        const { data: updatedApp, error: updateError } = await supabase
          .from("internship_applications")
          .update({
            cover_letter: applicationData.cover_letter,
            resume_url: applicationData.resume_url,
            status: "pending",
            applied_at: new Date().toISOString(),
            reviewed_at: null,
            reviewed_by: null,
            company_response: null,
            university_response: null,
          })
          .eq("id", existingApplication.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating withdrawn application:", updateError);
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Failed to submit application" },
            { status: 500 }
          );
        }

        // AUDIT LOG: Log re-application
        await audit.applicationSubmit(updatedApp!.id, applicationData.student_id, applicationData.internship_id);

        return NextResponse.json<ApiResponse<InternshipApplication>>({
          success: true,
          data: updatedApp as InternshipApplication,
          message: "Application submitted successfully",
        });
      }

      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You have already applied to this internship" },
        { status: 409 }
      );
    }

    // Get client info for audit logging
    const clientInfo = extractClientInfo(request);

    // Create application
    const { data: application, error } = await supabase
      .from("internship_applications")
      .insert({
        ...applicationData,
        status: "pending",
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating application:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to submit application" },
        { status: 500 }
      );
    }

    // AUDIT LOG: Log application submission
    await audit.applicationSubmit(application!.id, applicationData.student_id, applicationData.internship_id);

    return NextResponse.json<ApiResponse<InternshipApplication>>({
      success: true,
      data: application as InternshipApplication,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/applications:", error);
    
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
