import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ReviewWeeklyLogSchema } from "@/lib/validations";
import type { ApiResponse, WeeklyLog, UserRole } from "@/types";

// Roles that can review weekly logs
const REVIEW_ROLES: UserRole[] = [
  "faculty_supervisor",
  "site_supervisor",
  "university_admin",
];

/**
 * PUT /api/weekly-logs/[id]
 * Approve/reject weekly log - Supervisor only
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    const { id } = await params;

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

    if (!profile || !REVIEW_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Only supervisors can review weekly logs" },
        { status: 403 }
      );
    }

    // Check if weekly log exists
    const { data: existingLog } = await supabase
      .from("weekly_logs")
      .select(`
        *,
        student_internships:student_internship_id(
          id,
          faculty_supervisor_id,
          site_supervisor_id,
          students:student_id(user_id)
        )
      `)
      .eq("id", id)
      .single();

    if (!existingLog) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Weekly log not found" },
        { status: 404 }
      );
    }

    // Check if log is in a reviewable state
    if (existingLog.status !== "submitted") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Cannot review a log with status "${existingLog.status}". Only submitted logs can be reviewed.`,
        },
        { status: 400 }
      );
    }

    // Verify supervisor is assigned to this student's internship
    if (
      ["faculty_supervisor", "site_supervisor"].includes(profile.role!)
    ) {
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!supervisorRecord) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Supervisor record not found" },
          { status: 404 }
        );
      }

      const si = existingLog.student_internships as unknown as {
        faculty_supervisor_id?: string;
        site_supervisor_id?: string;
      };

      const isAssigned =
        si.faculty_supervisor_id === supervisorRecord.id ||
        si.site_supervisor_id === supervisorRecord.id;

      if (!isAssigned && profile.role !== "university_admin") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You are not assigned to supervise this student" },
          { status: 403 }
        );
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ReviewWeeklyLogSchema.safeParse(body);

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

    const reviewData = validation.data;

    // Update weekly log status
    const { data: updatedLog, error } = await supabase
      .from("weekly_logs")
      .update({
        status: reviewData.status,
        reviewer_comments: reviewData.reviewer_comments || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error reviewing weekly log:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update weekly log" },
        { status: 500 }
      );
    }

    // If approved, update student internship progress
    if (reviewData.status === "approved") {
      const siId = existingLog.student_internship_id;
      
      // Count total approved logs for this internship
      const { count: approvedCount } = await supabase
        .from("weekly_logs")
        .select("*", { count: "exact", head: true })
        .eq("student_internship_id", siId)
        .eq("status", "approved");

      // Get total weeks from internship
      const { data: siRecord } = await supabase
        .from("student_internships")
        .select("internship_id")
        .eq("id", siId)
        .single();

      if (siRecord) {
        const { data: internship } = await supabase
          .from("internships")
          .select("duration_weeks")
          .eq("id", siRecord.internship_id)
          .single();

        if (internship && approvedCount !== null) {
          const progressPercentage = Math.min(
            Math.round((approvedCount / internship.duration_weeks) * 100),
            100
          );

          await supabase
            .from("student_internships")
            .update({ progress_percentage: progressPercentage })
            .eq("id", siId);
        }
      }
    }

    return NextResponse.json<ApiResponse<WeeklyLog>>({
      success: true,
      data: updatedLog as WeeklyLog,
      message: `Weekly log ${reviewData.status} successfully`,
    });
  } catch (error) {
    console.error("Error in PUT /api/weekly-logs/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
