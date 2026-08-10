import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  WeeklyLogSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  WeeklyLog,
  UserRole,
} from "@/types";

// Roles that can view weekly logs
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "faculty_supervisor",
  "site_supervisor",
  "student",
];

/**
 * GET /api/weekly-logs
 * Get weekly logs - Students see their own, Supervisors see assigned students' logs
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
    const sortBy = searchParams.get("sort_by") || "week_start";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data
    let query = supabase
      .from("weekly_logs")
      .select(`
        *,
        student_internships:student_internship_id(
          id,
          student_id,
          internship_id,
          status,
          students:student_id(
            enrollment_number,
            profiles:user_id(first_name, last_name)
          )
        )
      `, { count: "exact" });

    // Apply role-based filtering
    if (profile.role === "student") {
      // Students can only see their own logs
      const { data: studentInternships } = await supabase
        .from("student_internships")
        .select("id")
        .eq("student_id", (await supabase.from("students").select("id").eq("user_id", user.id).single()).data?.id ?? "");

      if (studentInternships && studentInternships.length > 0) {
        const siIds = studentInternships.map((si) => si.id);
        query = query.in("student_internship_id", siIds);
      } else {
        // Return empty if no internships found
        return NextResponse.json<ApiResponse<PaginatedResponse<WeeklyLog>>>({
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
    } else if (
      ["faculty_supervisor", "site_supervisor"].includes(profile.role!)
    ) {
      // Supervisors see logs of their assigned students
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (supervisorRecord) {
        const { data: supervisedInternships } = await supabase
          .from("student_internships")
          .select("id")
          .or(`faculty_supervisor_id.eq.${supervisorRecord.id},site_supervisor_id.eq.${supervisorRecord.id}`);

        if (supervisedInternships && supervisedInternships.length > 0) {
          const siIds = supervisedInternships.map((si) => si.id);
          query = query.in("student_internship_id", siIds);
        } else {
          return NextResponse.json<ApiResponse<PaginatedResponse<WeeklyLog>>>({
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
    }

    // Apply additional filters
    if (filters.student_id) {
      // Get student's internship IDs first
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

    // Apply date range filter on week_start
    if (filters.date_from) {
      query = query.gte("week_start", filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte("week_end", filters.date_to);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: logs, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching weekly logs:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch weekly logs" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<WeeklyLog> = {
      data: logs as unknown as WeeklyLog[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<WeeklyLog>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/weekly-logs:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/weekly-logs
 * Submit weekly log - Student only
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
        { success: false, error: "Forbidden: Only students can submit weekly logs" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = WeeklyLogSchema.safeParse(body);

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

    const logData = validation.data;

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
      .eq("id", logData.student_internship_id)
      .eq("student_id", student.id)
      .in("status", ["active"])
      .single();

    if (!studentInternship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Active student internship not found or access denied" },
        { status: 404 }
      );
    }

    // Check if a log for this week already exists
    const { data: existingLog } = await supabase
      .from("weekly_logs")
      .select("id, status")
      .eq("student_internship_id", logData.student_internship_id)
      .eq("week_number", logData.week_number)
      .single();

    if (existingLog) {
      // Allow updating draft or rejected logs
      if (["draft", "rejected"].includes(existingLog.status)) {
        const { data: updatedLog, error: updateError } = await supabase
          .from("weekly_logs")
          .update({
            ...logData,
            status: logData.status === "submitted" ? "submitted" : "draft",
            submitted_at: logData.status === "submitted" ? new Date().toISOString() : null,
            reviewed_at: null,
            reviewer_comments: null,
          })
          .eq("id", existingLog.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating weekly log:", updateError);
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Failed to update weekly log" },
            { status: 500 }
          );
        }

        return NextResponse.json<ApiResponse<WeeklyLog>>({
          success: true,
          data: updatedLog as WeeklyLog,
          message: "Weekly log updated successfully",
        });
      }

      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `A log for week ${logData.week_number} already exists and cannot be modified` },
        { status: 409 }
      );
    }

    // Validate week dates
    const weekStart = new Date(logData.week_start);
    const weekEnd = new Date(logData.week_end);
    if (weekEnd <= weekStart) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Week end must be after week start" },
        { status: 400 }
      );
    }

    // Create weekly log
    const { data: log, error } = await supabase
      .from("weekly_logs")
      .insert({
        ...logData,
        status: logData.status === "submitted" ? "submitted" : "draft",
        submitted_at: logData.status === "submitted" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating weekly log:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to submit weekly log" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<WeeklyLog>>({
      success: true,
      data: log as WeeklyLog,
      message: "Weekly log submitted successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/weekly-logs:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
