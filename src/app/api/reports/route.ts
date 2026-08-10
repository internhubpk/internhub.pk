import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  ReportSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type { ApiResponse, PaginatedResponse, Report, UserRole } from "@/types";

// Roles that can view reports
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "faculty_supervisor",
  "student",
];

/**
 * GET /api/reports
 * Get reports - filtered by user role
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
    const reportType = searchParams.get("report_type");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data
    let query = supabase
      .from("reports")
      .select(`
        *,
        student_internships:student_internship_id(
          id,
          students:student_id(
            enrollment_number,
            profiles:user_id(first_name, last_name)
          )
        )
      `, { count: "exact" });

    // Apply role-based filtering
    if (profile.role === "student") {
      // Students can only see their own reports
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
          return NextResponse.json<ApiResponse<PaginatedResponse<Report>>>({
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
      ["faculty_supervisor", "university_admin"].includes(profile.role!)
    ) {
      // Faculty supervisors see reports of their assigned students
      if (profile.role === "faculty_supervisor") {
        const { data: supervisorRecord } = await supabase
          .from("supervisors")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "faculty")
          .single();

        if (supervisorRecord) {
          const { data: supervisedSIs } = await supabase
            .from("student_internships")
            .select("id")
            .eq("faculty_supervisor_id", supervisorRecord.id);

          if (supervisedSIs && supervisedSIs.length > 0) {
            const siIds = supervisedSIs.map((si) => si.id);
            query = query.in("student_internship_id", siIds);
          }
        }
      }
      // University admins see all reports in their university
      // (no additional filter needed as RLS should handle this)
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

    if (reportType) {
      query = query.eq("report_type", reportType);
    }

    // Apply date range filter
    if (filters.date_from) {
      query = query.gte("submitted_at", filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte("submitted_at", filters.date_to);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: reports, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching reports:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch reports" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Report> = {
      data: reports as unknown as Report[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Report>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/reports:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports
 * Upload/submit report - Student only
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
        { success: false, error: "Forbidden: Only students can submit reports" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ReportSchema.safeParse(body);

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

    const reportData = validation.data;

    // Verify student owns this internship
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!student) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student record not found" },
        { status: 404 }
      );
    }

    const { data: studentInternship } = await supabase
      .from("student_internships")
      .select("*")
      .eq("id", reportData.student_internship_id)
      .eq("student_id", student.id)
      .in("status", ["active"])
      .single();

    if (!studentInternship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Active student internship not found or access denied" },
        { status: 404 }
      );
    }

    // Check for existing report of same type for this internship
    const { data: existingReport } = await supabase
      .from("reports")
      .select("id, status")
      .eq("student_internship_id", reportData.student_internship_id)
      .eq("report_type", reportData.report_type)
      .single();

    if (existingReport) {
      // Allow updating draft or rejected reports
      if (["draft", "rejected"].includes(existingReport.status)) {
        const { data: updatedReport, error: updateError } = await supabase
          .from("reports")
          .update({
            ...reportData,
            status: reportData.status === "submitted" ? "submitted" : "draft",
            submitted_at:
              reportData.status === "submitted"
                ? new Date().toISOString()
                : null,
            reviewed_at: null,
            reviewed_by: null,
            reviewer_comments: null,
          })
          .eq("id", existingReport.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating report:", updateError);
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Failed to update report" },
            { status: 500 }
          );
        }

        return NextResponse.json<ApiResponse<Report>>({
          success: true,
          data: updatedReport as Report,
          message: "Report updated successfully",
        });
      }

      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `A ${reportData.report_type} report already exists and cannot be modified`,
        },
        { status: 409 }
      );
    }

    // Create report
    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        ...reportData,
        status: reportData.status === "submitted" ? "submitted" : "draft",
        submitted_at:
          reportData.status === "submitted"
            ? new Date().toISOString()
            : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating report:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to submit report" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Report>>({
      success: true,
      data: report as Report,
      message: "Report submitted successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/reports:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
