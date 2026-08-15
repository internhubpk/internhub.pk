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

// GET /api/company-hr/dashboard/stats — aggregated counts for dashboard cards
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

    // Run all the counts in parallel
    const [
      internshipsRes,
      applicationsRes,
      pendingAppsRes,
      activeSIsRes,
      supervisorsRes,
      completedSIsRes,
      recentAppsRes,
      activeInternshipsRes,
      attendanceRes,
      evalsRes,
    ] = await Promise.all([
      supabase
        .from("internships")
        .select("id, status, title, max_applicants, current_applicants, created_at", { count: "exact", head: false })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("internship_applications")
        .select("id, status, applied_at, student_user_id, internship_id", { count: "exact", head: false })
        .eq("company_id", companyId)
        .order("applied_at", { ascending: false }),
      supabase
        .from("internship_applications")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("status", ["pending", "reviewing"]),
      supabase
        .from("student_internships")
        .select(`
          id, status, student_user_id, internship_id, start_date,
          student:profiles!student_internships_student_user_id_fkey(full_name, first_name, last_name, email, avatar_url),
          internship:internship_id(title)
        `, { count: "exact", head: false })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("supervisors")
        .select("id, is_active, user_id", { count: "exact", head: false })
        .eq("company_id", companyId)
        .eq("type", "site"),
      supabase
        .from("student_internships")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "completed"),
      // recent 5 applications joined with student + internship
      Promise.resolve({ data: null, error: null }), // placeholder — recentAppsRes fetched below
      Promise.resolve({ data: null, error: null }),
      Promise.resolve({ data: null, error: null }),
      Promise.resolve({ data: null, error: null }),
    ]);

    // Re-fetch recent applications and active internships with proper joins.
    const [recentApps, activeInternships, attendanceSample, evalsSample] = await Promise.all([
      supabase
        .from("internship_applications")
        .select(
          `
          id,
          status,
          applied_at,
          student_user_id,
          internship_id,
          internships:internship_id (id, title),
          profiles:student_user_id (user_id, full_name, first_name, last_name, email, avatar_url)
        `
        )
        .eq("company_id", companyId)
        .order("applied_at", { ascending: false })
        .limit(5),
      supabase
        .from("internships")
        .select("id, title, status, max_applicants, current_applicants, application_deadline, created_at")
        .eq("company_id", companyId)
        .in("status", ["open", "active"])
        .order("created_at", { ascending: false })
        .limit(5),
      // Last 30 days attendance sample for avg rate
      supabase
        .from("attendance")
        .select("id, status, internship_id, student_user_id, internships!inner(company_id)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("evaluations")
        .select("id, rating, type, status, student_internship_id")
        .in("type", ["final", "company_evaluation", "supervisor_evaluation"]),
    ]);

    // Compute the dashboard stats
    const allInternships = internshipsRes.data || [];
    const activeCount = allInternships.filter((i) => ["open", "active"].includes(i.status)).length;
    const totalApplications = applicationsRes.count || 0;
    const pendingReviews = pendingAppsRes.count || 0;
    const allSIs = activeSIsRes.data || [];
    const activeInterns = allSIs.filter((s) => s.status === "active").length;
    const completedInterns = completedSIsRes.count || 0;
    const totalSupervisors = (supervisorsRes.data || []).filter((s) => s.is_active).length;
    const totalInterns = allSIs.length;
    const completionRate =
      totalInterns > 0 ? Math.round((completedInterns / totalInterns) * 100) : 0;

    // Attendance rate (scoped to company internships only)
    const companyInternshipIds = new Set(allInternships.map((i) => i.id));
    const companyAttendance = (attendanceSample.data || []).filter((a: any) => {
      const internships = Array.isArray(a.internships) ? a.internships : [a.internships];
      return internships.some((i: any) => i && companyInternshipIds.has(i.id));
    });
    const attendancePresent = companyAttendance.filter((a: any) =>
      ["present", "late", "half_day"].includes(a.status)
    ).length;
    const avgAttendanceRate =
      companyAttendance.length > 0
        ? Math.round((attendancePresent / companyAttendance.length) * 100)
        : 0;

    // Average rating across company evaluations
    const companySiIds = new Set(allSIs.map((s) => s.id));
    const companyEvals = (evalsSample.data || []).filter(
      (e: any) => e.student_internship_id && companySiIds.has(e.student_internship_id)
    );
    const ratedEvals = companyEvals.filter((e: any) => e.rating && Number(e.rating) > 0);
    const avgRating =
      ratedEvals.length > 0
        ? ratedEvals.reduce((sum, e) => sum + Number(e.rating), 0) / ratedEvals.length
        : 0;

    // Intern performance table — show top interns by attendance + rating
    const performance = allSIs.slice(0, 10).map((si: any) => {
      const siAttendance = companyAttendance.filter((a: any) => a.student_user_id === si.student_user_id);
      const presentCount = siAttendance.filter((a: any) =>
        ["present", "late", "half_day"].includes(a.status)
      ).length;
      const attRate = siAttendance.length > 0 ? Math.round((presentCount / siAttendance.length) * 100) : 0;
      const siEvals = companyEvals.filter((e: any) => e.student_internship_id === si.id);
      const submittedEvals = siEvals.filter((e: any) => e.status === "submitted" && e.rating);
      const rating =
        submittedEvals.length > 0
          ? submittedEvals.reduce((s, e) => s + Number(e.rating), 0) / submittedEvals.length
          : 0;
      const studentProfile = si.student && (Array.isArray(si.student) ? si.student[0] : si.student) || {};
      const internshipInfo = si.internship && (Array.isArray(si.internship) ? si.internship[0] : si.internship) || {};
      return {
        student_internship_id: si.id,
        student_user_id: si.student_user_id,
        student_name: studentProfile.full_name || [studentProfile.first_name, studentProfile.last_name].filter(Boolean).join(" ") || "",
        student_email: studentProfile.email || "",
        student_avatar: studentProfile.avatar_url || null,
        internship_id: si.internship_id,
        internship_title: internshipInfo.title || "",
        attendance_rate: attRate,
        rating: Number(rating.toFixed(2)),
        status: si.status,
        start_date: si.start_date,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          activeInternships: activeCount,
          totalApplications,
          pendingReviews,
          activeInterns,
          totalSupervisors,
          completionRate,
          totalInterns,
          completedInterns,
          avgAttendanceRate,
          avgRating: Number(avgRating.toFixed(2)),
        },
        recentApplications: (recentApps.data || []).map((a: any) => {
          const p = a.profiles || {};
          const i = (a.internships && (Array.isArray(a.internships) ? a.internships[0] : a.internships)) || {};
          return {
            id: a.id,
            student_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "",
            student_email: p.email || "",
            student_avatar: p.avatar_url || null,
            internship_title: i.title || "",
            status: a.status,
            applied_at: a.applied_at,
          };
        }),
        activePrograms: (activeInternships.data || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          applicants_count: i.current_applicants || 0,
          max_applicants: i.max_applicants,
          application_deadline: i.application_deadline,
          created_at: i.created_at,
        })),
        internPerformance: performance,
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
