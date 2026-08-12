import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ReviewReportSchema } from "@/lib/validations";
import type { ApiResponse, Report, UserRole } from "@/types";

// Roles that can review reports
const REVIEW_ROLES: UserRole[] = ["faculty_supervisor", "university_admin"];

/**
 * PUT /api/reports/[id]
 * Review report - Faculty Supervisor or University Admin
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
        { success: false, error: "Forbidden: Only faculty supervisors can review reports" },
        { status: 403 }
      );
    }

    // Check if report exists
    const { data: existingReport } = await supabase
      .from("reports")
      .select(`
        *,
        student_internships:student_internship_id(
          id,
          faculty_supervisor_id,
          students:student_id(user_id)
        )
      `)
      .eq("id", id)
      .single();

    if (!existingReport) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    // Check if report is in a reviewable state
    if (existingReport.status !== "submitted" && existingReport.status !== "under_review") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Cannot review a report with status "${existingReport.status}". Only submitted reports can be reviewed.`,
        },
        { status: 400 }
      );
    }

    // Verify faculty supervisor is assigned to this student's internship
    if (profile.role === "faculty_supervisor") {
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "faculty")
        .single();

      if (!supervisorRecord) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Faculty supervisor record not found" },
          { status: 404 }
        );
      }

      const si = existingReport.student_internships as unknown as {
        faculty_supervisor_id?: string;
      };

      if (si.faculty_supervisor_id !== supervisorRecord.id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You are not assigned to supervise this student" },
          { status: 403 }
        );
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ReviewReportSchema.safeParse(body);

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

    const reviewData = validation.data;

    // Update report status
    const { data: updatedReport, error } = await supabase
      .from("reports")
      .update({
        status: reviewData.status,
        reviewer_comments: reviewData.reviewer_comments || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error reviewing report:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update report" },
        { status: 500 }
      );
    }

    // If this is a final report and it's approved, consider updating certificate status
    if (
      existingReport.report_type === "final" &&
      reviewData.status === "approved"
    ) {
      // Update student internship progress/completion
      const siId = existingReport.student_internship_id;
      
      // Check if all required reports are approved
      const { data: allReports } = await supabase
        .from("reports")
        .select("status")
        .eq("student_internship_id", siId);

      if (allReports) {
        const allApproved = allReports.every((r) => r.status === "approved");
        
        if (allApproved) {
          // Mark internship as completed
          await supabase
            .from("student_internships")
            .update({
              status: "completed",
              progress_percentage: 100,
              updated_at: new Date().toISOString(),
            })
            .eq("id", siId);
        }
      }
    }

    return NextResponse.json<ApiResponse<Report>>({
      success: true,
      data: updatedReport as Report,
      message: `Report ${reviewData.status} successfully`,
    });
  } catch (error) {
    console.error("Error in PUT /api/reports/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
