import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateApplicationSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
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

/**
 * GET /api/applications
 * List applications - filtered by user role
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

    // Get user profile with role info
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id, department_id")
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
    const sortBy = searchParams.get("sort_by") || "applied_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

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

    // Apply role-based filtering
    if (profile.role === "student") {
      // Students can only see their own applications
      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (studentRecord) {
        query = query.eq("student_id", studentRecord.id);
      }
    } else if (profile.role === "company_hr") {
      // Company HR can see applications for their company's internships
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (companyUser) {
        // First get internship IDs for this company
        const { data: companyInternships } = await supabase
          .from("internships")
          .select("id")
          .eq("company_id", companyUser.company_id);

        if (companyInternships && companyInternships.length > 0) {
          const internshipIds = companyInternships.map((i) => i.id);
          query = query.in("internship_id", internshipIds);
        } else {
          // Return empty if no internships found
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
    } else if (
      ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
        profile.role
      ) &&
      profile.university_id
    ) {
      // University staff see applications for their university's internships
      const { data: uniInternships } = await supabase
        .from("internships")
        .select("id")
        .eq("university_id", profile.university_id);

      if (uniInternships && uniInternships.length > 0) {
        const internshipIds = uniInternships.map((i) => i.id);
        query = query.in("internship_id", internshipIds);
      }

      // Department coordinators further filter by department
      if (
        profile.role === "department_coordinator" &&
        profile.department_id
      ) {
        const { data: deptStudents } = await supabase
          .from("students")
          .select("id")
          .eq("department_id", profile.department_id);

        if (deptStudents && deptStudents.length > 0) {
          const studentIds = deptStudents.map((s) => s.id);
          query = query.in("student_id", studentIds);
        }
      }
    }

    // Apply additional filters
    if (filters.internship_id) {
      query = query.eq("internship_id", filters.internship_id);
    }
    if (filters.student_id) {
      query = query.eq("student_id", filters.student_id);
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
      .order(sortBy, { ascending: sortOrder })
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
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications
 * Submit application - Student only
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

    // Check if user is a student
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "student") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Only students can submit applications" },
        { status: 403 }
      );
    }

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

    // Verify student record exists and belongs to this user
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", applicationData.student_id)
      .single();

    if (!student) {
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
        // Update existing record instead of creating new one
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

    return NextResponse.json<ApiResponse<InternshipApplication>>({
      success: true,
      data: application as InternshipApplication,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/applications:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
