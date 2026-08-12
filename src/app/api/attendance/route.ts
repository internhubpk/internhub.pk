import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  AttendanceSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Attendance,
  UserRole,
} from "@/types";

// Roles that can view attendance
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "faculty_supervisor",
  "site_supervisor",
  "student",
  "company_hr",
];

// Roles that can mark attendance
const MARK_ROLES: UserRole[] = ["student", "company_hr", "site_supervisor"];

/**
 * GET /api/attendance
 * Get attendance records - filtered by user role
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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
    const filters = filterResult.success ? filterResult.data : FilterSchema.parse({});
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sort_by") || "date";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data
    let query = supabase
      .from("attendance")
      .select(`
        *,
        student_internships:student_internship_id(
          id,
          students:student_id(
            enrollment_number,
            profiles:user_id(first_name, last_name, avatar_url)
          ),
          internships:internship_id(title, companies:company_id(name))
        )
      `, { count: "exact" });

    // Apply role-based filtering
    if (profile.role === "student") {
      // Students can only see their own attendance
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
          return NextResponse.json<ApiResponse<PaginatedResponse<Attendance>>>({
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
      // Supervisors see attendance of their assigned students
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id, type")
        .eq("user_id", user.id)
        .single();

      if (supervisorRecord) {
        let supervisedSIs;
        
        if (profile.role === "faculty_supervisor") {
          supervisedSIs = await supabase
            .from("student_internships")
            .select("id")
            .eq("faculty_supervisor_id", supervisorRecord.id);
        } else {
          supervisedSIs = await supabase
            .from("student_internships")
            .select("id")
            .eq("site_supervisor_id", supervisorRecord.id);
        }

        if (supervisedSIs.data && supervisedSIs.data.length > 0) {
          const siIds = supervisedSIs.data.map((si) => si.id);
          query = query.in("student_internship_id", siIds);
        }
      }
    } else if (profile.role === "company_hr") {
      // Company HR sees attendance for their company's interns
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (companyUser) {
        const { data: companyInternships } = await supabase
          .from("internships")
          .select("id")
          .eq("company_id", companyUser.company_id);

        if (companyInternships && companyInternships.length > 0) {
          const internshipIds = companyInternships.map((i) => i.id);
          const { data: companySIs } = await supabase
            .from("student_internships")
            .select("id")
            .in("internship_id", internshipIds);

          if (companySIs && companySIs.length > 0) {
            const siIds = companySIs.map((si) => si.id);
            query = query.in("student_internship_id", siIds);
          }
        }
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

    // Apply date range filter
    if (filters.date_from) {
      query = query.gte("date", filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte("date", filters.date_to);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: records, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching attendance records:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch attendance records" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Attendance> = {
      data: records as unknown as Attendance[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Attendance>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/attendance:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attendance
 * Mark attendance - Student or Company HR
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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

    if (!profile || !MARK_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions to mark attendance" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = AttendanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    const attendanceData = validation.data;

    // Verify student internship exists and is active
    const { data: studentInternship } = await supabase
      .from("student_internships")
      .select(`
        *,
        students:student_id(user_id),
        internships:internship_id(company_id)
      `)
      .eq("id", attendanceData.student_internship_id)
      .in("status", ["active"])
      .single();

    if (!studentInternship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Active student internship not found" },
        { status: 404 }
      );
    }

    // Check permissions based on role
    const si = studentInternship as unknown as {
      students: { user_id: string };
      internships: { company_id: string };
    };

    if (profile.role === "student") {
      // Students can only mark their own attendance
      if (si.students.user_id !== user.id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Can only mark your own attendance" },
          { status: 403 }
        );
      }

      // Students can only check in/out themselves
      if (attendanceData.status !== "present" && attendanceData.status !== "absent") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Students can only mark present or absent" },
          { status: 403 }
        );
      }
    }

    if (profile.role === "company_hr") {
      // Company HR can mark attendance for their company's interns
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", si.internships.company_id)
        .in("role", ["admin", "hr"])
        .single();

      if (!companyUser) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You don't have permission to mark attendance for this internship" },
          { status: 403 }
        );
      }
    }

    if (profile.role === "site_supervisor") {
      // Site supervisors can mark attendance for their assigned students
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "site")
        .single();

      if (!supervisorRecord) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Site supervisor record not found" },
          { status: 404 }
        );
      }

      const { data: supervisedSI } = await supabase
        .from("student_internships")
        .select("id")
        .eq("id", attendanceData.student_internship_id)
        .eq("site_supervisor_id", supervisorRecord.id)
        .single();

      if (!supervisedSI) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "This student is not under your supervision" },
          { status: 403 }
        );
      }
    }

    // Check for existing attendance record for same date and internship
    const { data: existingRecord } = await supabase
      .from("attendance")
      .select("id, status")
      .eq("student_internship_id", attendanceData.student_internship_id)
      .eq("date", attendanceData.date.split("T")[0]) // Use date part only
      .single();

    if (existingRecord) {
      // Allow updating existing record
      const { data: updatedRecord, error: updateError } = await supabase
        .from("attendance")
        .update({
          ...attendanceData,
          verified_by:
            profile.role !== "student"
              ? user.id
              : existingRecord.verified_by,
          verified_at:
            profile.role !== "student"
              ? new Date().toISOString()
              : existingRecord.verified_at,
        })
        .eq("id", existingRecord.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating attendance record:", updateError);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Failed to update attendance record" },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse<Attendance>>({
        success: true,
        data: updatedRecord as Attendance,
        message: "Attendance record updated successfully",
      });
    }

    // Create new attendance record
    const { data: record, error } = await supabase
      .from("attendance")
      .insert({
        ...attendanceData,
        verified_by: profile.role !== "student" ? user.id : null,
        verified_at: profile.role !== "student" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating attendance record:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to mark attendance" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Attendance>>({
      success: true,
      data: record as Attendance,
      message: "Attendance marked successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/attendance:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
