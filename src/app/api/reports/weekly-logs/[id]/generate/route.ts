/**
 * POST /api/reports/weekly-logs/[id]/generate
 *
 * Generates a Word document for the specified weekly log, populating the
 * supplied Weekly Activity Report template with real Supabase data.
 *
 * Security:
 *   - The caller must be authenticated.
 *   - The caller must be authorized to access this weekly log:
 *     * the student who owns it
 *     * their assigned site/faculty supervisor
 *     * their program/department coordinator
 *     * their university admin
 *     * super_admin
 *   - The weekly log must NOT be in "draft" status (only submitted or
 *     approved logs can be exported to a Word document).
 *
 * Returns the generated_reports.id and a download URL (which is itself
 * auth-protected).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { assembleWeeklyReportData, populateWeeklyReportTemplate, saveGeneratedReport } from "@/lib/document-generation/document-service";
import { notifyReportFinalized } from "@/lib/notify";
import type { ApiResponse } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: weeklyLogId } = await params;
    if (!weeklyLogId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing weekly log id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 1. Fetch the weekly log (RLS-enforced — only authorized users can see it).
    //    weekly_logs uses `student_user_id` (NOT `student_id`) on the live DB.
    const { data: weeklyLog, error: wlErr } = await supabase
      .from("weekly_logs")
      .select("id, student_user_id, internship_id, status, week_number, students:student_user_id ( user_id, profiles:user_id ( university_id ) )")
      .eq("id", weeklyLogId)
      .single();

    if (wlErr || !weeklyLog) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Weekly log not found or access denied" },
        { status: 404 }
      );
    }

    // 2. Verify the weekly log is in a submittable state (not draft).
    if (weeklyLog.status === "draft") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cannot generate a report for a draft weekly log. Please submit it first." },
        { status: 400 }
      );
    }

    // 3. Fetch the caller's profile (to record generated_by + university scope).
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, university_id, department_id, program_id")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Caller profile not found" },
        { status: 403 }
      );
    }

    // 4. Authorization check (defense-in-depth in addition to RLS).
    const student = weeklyLog.students as any;
    const studentProfile = student?.profiles as any;
    const studentUserId = student?.user_id;
    const studentUniversityId = studentProfile?.university_id;

    const isOwner = studentUserId === user.id;
    const isSuperAdmin = callerProfile.role === "super_admin";
    const isUniversityAdmin =
      callerProfile.role === "university_admin" &&
      callerProfile.university_id === studentUniversityId;
    const isProgramCoordinator =
      callerProfile.role === "program_coordinator" &&
      callerProfile.program_id === studentProfile?.program_id;
    const isDepartmentCoordinator =
      callerProfile.role === "department_coordinator" &&
      callerProfile.department_id === studentProfile?.department_id;

    // Supervisors: check via student_internships assignments.
    //    student_internships uses `student_user_id` (NOT `student_id`).
    let isAssignedSupervisor = false;
    if (callerProfile.role === "faculty_supervisor" || callerProfile.role === "site_supervisor") {
      const { data: si } = await supabase
        .from("student_internships")
        .select("faculty_supervisor_id, site_supervisor_id")
        .eq("internship_id", weeklyLog.internship_id)
        .eq("student_user_id", weeklyLog.student_user_id)
        .single();
      if (si) {
        const { data: sup } = await supabase
          .from("supervisors")
          .select("id, type")
          .eq("user_id", user.id)
          .single();
        if (sup) {
          if (sup.type === "faculty" && si.faculty_supervisor_id === sup.id) isAssignedSupervisor = true;
          if (sup.type === "site" && si.site_supervisor_id === sup.id) isAssignedSupervisor = true;
        }
      }
    }

    if (!isOwner && !isSuperAdmin && !isUniversityAdmin && !isProgramCoordinator && !isDepartmentCoordinator && !isAssignedSupervisor) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: you are not authorized to generate this report" },
        { status: 403 }
      );
    }

    // 5. Assemble the data (fetches all related records).
    const data = await assembleWeeklyReportData(weeklyLogId);

    // 6. Populate the template.
    const result = await populateWeeklyReportTemplate(data);
    if (!result.success || !result.buffer) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: result.error || "Document generation failed" },
        { status: 500 }
      );
    }

    // 7. Save to Supabase Storage + insert generated_reports row.
    const safeStudentName = (data.studentName || "student").replace(/\s+/g, "-").toLowerCase();
    const filename = `${safeStudentName}-weekly-report-week-${data.weekNumber}.docx`;
    const saveResult = await saveGeneratedReport({
      studentId: weeklyLog.student_user_id,
      internshipId: weeklyLog.internship_id,
      weeklyLogId,
      weekNumber: data.weekNumber,
      reportType: "weekly_log_template",
      buffer: result.buffer,
      filename,
      generatedBy: user.id,
      universityId: studentUniversityId || null,
      metadata: {
        templateUsed: result.metadata.templateUsed,
        fieldsPopulated: result.metadata.fieldsPopulated,
        imagesEmbedded: result.metadata.imagesEmbedded,
        durationMs: result.metadata.durationMs,
      },
    });

    if (!saveResult.reportId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: saveResult.error || "Failed to save generated report" },
        { status: 500 }
      );
    }

    // 8. Notify the student (if the generator is not the student themselves).
    if (!isOwner) {
      await notifyReportFinalized(
        studentUserId,
        "weekly activity report",
        saveResult.reportId
      );
    }

    return NextResponse.json<ApiResponse<{ reportId: string; downloadUrl: string }>>({
      success: true,
      data: {
        reportId: saveResult.reportId,
        downloadUrl: `/api/reports/generated/${saveResult.reportId}/download`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/reports/weekly-logs/[id]/generate] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
