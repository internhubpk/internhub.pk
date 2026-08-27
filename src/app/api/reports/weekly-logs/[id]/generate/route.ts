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
import { assembleWeeklyReportData, populateWeeklyReportTemplate, saveGeneratedReport, getServiceRoleClient } from "@/lib/document-generation/document-service";
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
    //    weekly_logs uses `student_user_id` (NOT `student_id`).
    //    NOTE: this is a PLAIN query on purpose. The previous shape embedded
    //    `students:student_user_id ( profiles:user_id ( university_id ) )`,
    //    which PostgREST cannot resolve on the live schema — the `students`
    //    table has TWO foreign keys to `profiles` (user_id and
    //    faculty_supervisor_id), so the `profiles:user_id` embed is ambiguous
    //    ("Could not embed because more than one relationship was found") and
    //    the whole request failed with a 404. The student's university is now
    //    fetched with a separate simple query.
    const { data: weeklyLog, error: wlErr } = await supabase
      .from("weekly_logs")
      .select("id, student_user_id, internship_id, status, week_number")
      .eq("id", weeklyLogId)
      .single();

    if (wlErr || !weeklyLog) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Weekly log not found or access denied" },
        { status: 404 }
      );
    }

    // 1b. Fetch the owning student's university id (for authorization +
    //     report scoping). Kept as a separate, unambiguous query.
    const { data: studentRow } = await supabase
      .from("students")
      .select("user_id, university_id, program_id, department_id")
      .eq("user_id", weeklyLog.student_user_id)
      .maybeSingle();

    const studentUniversityId = (studentRow as any)?.university_id ?? null;
    const studentProfileRow = studentRow as any;

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
    //    The student's profile/department/program data comes from the
    //    separate queries above (studentProfileRow + callerProfile).
    const studentUserId = weeklyLog.student_user_id;

    const isOwner = studentUserId === user.id;
    const isSuperAdmin = callerProfile.role === "super_admin";
    const isUniversityAdmin =
      callerProfile.role === "university_admin" &&
      callerProfile.university_id === studentUniversityId;
    const isProgramCoordinator =
      callerProfile.role === "program_coordinator" &&
      callerProfile.program_id === studentProfileRow?.program_id;
    const isDepartmentCoordinator =
      callerProfile.role === "department_coordinator" &&
      callerProfile.department_id === studentProfileRow?.department_id;

    // Supervisors: check via student_internships assignments.
    //    student_internships uses `student_user_id` (NOT `student_id`).
    //
    //    BUG FIX 2026-08-27 (supervisors got 403 on the Word download): the
    //    columns `faculty_supervisor_id` / `site_supervisor_id` store the
    //    supervisor's AUTH USER id (the same convention as
    //    src/lib/supervised-students.ts and the faculty-supervisor tasks
    //    API: `.eq("faculty_supervisor_id", user.id)`), but this check
    //    compared them against the SUPERVISORS-TABLE row id — they only
    //    matched by coincidence. Compare against user.id first, and keep
    //    the supervisors-row comparison as a legacy fallback.
    let isAssignedSupervisor = false;
    if (callerProfile.role === "faculty_supervisor" || callerProfile.role === "site_supervisor") {
      const { data: si } = await supabase
        .from("student_internships")
        .select("faculty_supervisor_id, site_supervisor_id")
        .eq("internship_id", weeklyLog.internship_id)
        .eq("student_user_id", weeklyLog.student_user_id)
        .maybeSingle();
      if (si) {
        // Primary check — direct user-id match on the assignment columns.
        if (si.faculty_supervisor_id === user.id || si.site_supervisor_id === user.id) {
          isAssignedSupervisor = true;
        } else {
          // Legacy fallback — rows written with the supervisors-table id.
          const { data: sup } = await supabase
            .from("supervisors")
            .select("id, type")
            .eq("user_id", user.id)
            .maybeSingle();
          if (sup) {
            if (sup.type === "faculty" && si.faculty_supervisor_id === sup.id) isAssignedSupervisor = true;
            if (sup.type === "site" && si.site_supervisor_id === sup.id) isAssignedSupervisor = true;
          }
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
    //    Authorization is DONE (step 4) — use a service-role client so RLS
    //    on students/internships/profiles (which company-side site
    //    supervisors legitimately fail) cannot block assembly.
    const data = await assembleWeeklyReportData(
      weeklyLogId,
      getServiceRoleClient()
    );

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
