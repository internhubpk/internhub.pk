import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      ),
    };
  }
  if (profile.role !== "company_hr") {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      ),
    };
  }
  if (!profile.company_id) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      ),
    };
  }
  return { profile, errorResponse: null };
}

// GET /api/company-hr/reports — aggregated analytics for the company dashboard
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const companyId = profile.company_id;

    // Fetch raw datasets in parallel
    const [
      internshipsRes,
      applicationsRes,
      studentInternshipsRes,
      attendanceRes,
      evaluationsRes,
      supervisorsRes,
      documentsRes,
      weeklyLogsRes,
    ] = await Promise.all([
      supabase
        .from("internships")
        .select("id, title, status, created_at, current_applicants, max_applicants")
        .eq("company_id", companyId),
      supabase
        .from("internship_applications")
        .select("id, status, applied_at, internship_id")
        .eq("company_id", companyId),
      supabase
        .from("student_internships")
        .select("id, status, start_date, end_date, internship_id, student_user_id, site_supervisor_id")
        .eq("company_id", companyId),
      supabase
        .from("attendance")
        .select("id, status, date, internship_id, student_user_id, internships!inner(company_id)")
        .order("date", { ascending: false }),
      supabase
        .from("evaluations")
        .select("id, rating, status, type, student_internship_id, created_at"),
      supabase
        .from("supervisors")
        .select("id, user_id, is_active, created_at, first_name, last_name")
        .eq("company_id", companyId)
        .eq("type", "site"),
      supabase
        .from("documents")
        .select("id, type, status, created_at, entity_id, entity_type")
        .order("created_at", { ascending: false }),
      supabase
        .from("weekly_logs")
        .select("id, status, week_number, student_internship_id, submitted_at")
        .order("submitted_at", { ascending: false }),
    ]);

    // Filter attendance to this company only (we couldn't filter via select
    // because the inner-join syntax above scopes by company but the returned
    // rows still include all columns).
    const companyInternshipIds = new Set((internshipsRes.data || []).map((i) => i.id));
    const companyAttendance = (attendanceRes.data || []).filter((a: any) => {
      const internships = Array.isArray(a.internships) ? a.internships : [a.internships];
      return internships.some((i: any) => i && i.company_id === companyId);
    });

    const siIds = new Set((studentInternshipsRes.data || []).map((s) => s.id));
    const companyEvals = (evaluationsRes.data || []).filter(
      (e: any) => e.student_internship_id && siIds.has(e.student_internship_id)
    );
    const companyWeeklyLogs = (weeklyLogsRes.data || []).filter(
      (w: any) => w.student_internship_id && siIds.has(w.student_internship_id)
    );
    const companyStudentIds = new Set(
      (studentInternshipsRes.data || []).map((s) => s.student_user_id)
    );
    const companyDocuments = (documentsRes.data || []).filter(
      (d: any) => d.entity_type === "student" && companyStudentIds.has(d.entity_id)
    );

    // ---- Compute aggregates -------------------------------------------------
    const internships = internshipsRes.data || [];
    const applications = applicationsRes.data || [];
    const studentInternships = studentInternshipsRes.data || [];
    const supervisors = supervisorsRes.data || [];

    // Hiring funnel
    const funnel = {
      total_openings: internships.length,
      total_applications: applications.length,
      accepted: applications.filter((a) => a.status === "accepted").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
      reviewing: applications.filter((a) => a.status === "reviewing").length,
      pending: applications.filter((a) => a.status === "pending").length,
      withdrawn: applications.filter((a) => a.status === "withdrawn").length,
      conversion_rate:
        applications.length > 0
          ? Number(
              ((applications.filter((a) => a.status === "accepted").length / applications.length) * 100).toFixed(1)
            )
          : 0,
    };

    // Per-internship breakdown
    const perInternship = internships.map((i) => {
      const apps = applications.filter((a) => a.internship_id === i.id);
      const sis = studentInternships.filter((s) => s.internship_id === i.id);
      return {
        id: i.id,
        title: i.title,
        status: i.status,
        total_applicants: apps.length,
        accepted: apps.filter((a) => a.status === "accepted").length,
        rejected: apps.filter((a) => a.status === "rejected").length,
        pending: apps.filter((a) => a.status === "pending" || a.status === "reviewing").length,
        active_interns: sis.filter((s) => s.status === "active" || s.status === "assigned").length,
        completed_interns: sis.filter((s) => s.status === "completed").length,
      };
    });

    // Attendance breakdown
    const attendanceSummary = {
      total_records: companyAttendance.length,
      present: companyAttendance.filter((a) => a.status === "present").length,
      absent: companyAttendance.filter((a) => a.status === "absent").length,
      late: companyAttendance.filter((a) => a.status === "late").length,
      half_day: companyAttendance.filter((a) => a.status === "half_day").length,
      leave: companyAttendance.filter((a) => a.status === "leave").length,
      holiday: companyAttendance.filter((a) => a.status === "holiday").length,
      attendance_rate:
        companyAttendance.length > 0
          ? Number(
              (
                (companyAttendance.filter((a) =>
                  ["present", "late", "half_day"].includes(a.status)
                ).length /
                  companyAttendance.length) *
                100
              ).toFixed(1)
            )
          : 0,
    };

    // Evaluations summary
    const ratedEvals = companyEvals.filter((e) => e.rating && Number(e.rating) > 0);
    const evaluationsSummary = {
      total_evaluations: companyEvals.length,
      submitted: companyEvals.filter((e) => e.status === "submitted").length,
      pending: companyEvals.filter((e) => e.status === "pending" || e.status === "in_progress").length,
      approved: companyEvals.filter((e) => e.status === "approved").length,
      average_rating:
        ratedEvals.length > 0
          ? Number(
              (ratedEvals.reduce((s, e) => s + Number(e.rating), 0) / ratedEvals.length).toFixed(2)
            )
          : 0,
      rating_distribution: [1, 2, 3, 4, 5].map((star) => ({
        star,
        count: ratedEvals.filter((e) => Math.round(Number(e.rating)) === star).length,
      })),
    };

    // Supervisor summary
    const supervisorSummary = supervisors.map((s) => {
      const assignedInterns = studentInternships.filter(
        (si) => si.site_supervisor_id === s.user_id && (si.status === "active" || si.status === "assigned")
      ).length;
      return {
        user_id: s.user_id,
        name: [s.first_name, s.last_name].filter(Boolean).join(" ") || s.user_id,
        is_active: s.is_active,
        assigned_interns: assignedInterns,
      };
    });

    // Documents summary
    const documentsSummary = {
      total: companyDocuments.length,
      offer_letters: companyDocuments.filter((d) => d.type === "offer_letter").length,
      certificates: companyDocuments.filter((d) => d.type === "certificate").length,
      verified: companyDocuments.filter((d) => d.status === "verified").length,
      pending: companyDocuments.filter((d) => d.status === "pending").length,
    };

    // Applications over time (last 12 weeks)
    const now = new Date();
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
    const weeklyApplications: { week: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const count = applications.filter((a) => {
        const d = new Date(a.applied_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeklyApplications.push({ week: weekStart.toISOString().slice(0, 10), count });
    }

    return NextResponse.json({
      success: true,
      data: {
        company_id: companyId,
        generated_at: new Date().toISOString(),
        summary: {
          total_internships: internships.length,
          total_applications: applications.length,
          total_interns: studentInternships.length,
          total_supervisors: supervisors.filter((s) => s.is_active).length,
          total_weekly_logs: companyWeeklyLogs.length,
        },
        funnel,
        per_internship: perInternship,
        attendance: attendanceSummary,
        evaluations: evaluationsSummary,
        supervisors: supervisorSummary,
        documents: documentsSummary,
        weekly_applications: weeklyApplications,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
