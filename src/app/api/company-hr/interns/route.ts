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

// GET /api/company-hr/interns — list company's active interns with joined
// performance data (attendance rate, weekly logs count, last evaluation rating,
// assigned site supervisor, document flags).
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

    const { data: siRows, error } = await supabase
      .from("student_internships")
      .select(
        `
        id,
        student_user_id,
        internship_id,
        site_supervisor_id,
        status,
        start_date,
        end_date,
        created_at,
        updated_at,
        internships:internship_id (
          id,
          title,
          duration_weeks,
          start_date,
          end_date
        ),
        student:profiles!student_user_id (
          user_id,
          full_name,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          university_id,
          department_id,
          program_id
        ),
        supervisor:profiles!site_supervisor_id (
          user_id,
          full_name,
          first_name,
          last_name
        )
      `
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching interns:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch interns" } },
        { status: 500 }
      );
    }

    const interns = (siRows || []) as any[];
    if (interns.length === 0) {
      return NextResponse.json({ success: true, data: [], supervisors: [] });
    }

    // Resolve university / department / program names for student
    const uniIds = Array.from(new Set(interns.map((i) => i.student?.university_id).filter(Boolean) as string[]));
    const deptIds = Array.from(new Set(interns.map((i) => i.student?.department_id).filter(Boolean) as string[]));
    const progIds = Array.from(new Set(interns.map((i) => i.student?.program_id).filter(Boolean) as string[]));

    const [uniRes, deptRes, progRes] = await Promise.all([
      uniIds.length
        ? supabase.from("universities").select("id, name").in("id", uniIds)
        : Promise.resolve({ data: [], error: null }),
      deptIds.length
        ? supabase.from("departments").select("id, name").in("id", deptIds)
        : Promise.resolve({ data: [], error: null }),
      progIds.length
        ? supabase.from("programs").select("id, name").in("id", progIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const uniMap = new Map((uniRes.data || []).map((u: any) => [u.id, u]));
    const deptMap = new Map((deptRes.data || []).map((d: any) => [d.id, d]));
    const progMap = new Map((progRes.data || []).map((p: any) => [p.id, p]));

    // Fetch aggregate stats for each intern: attendance count, weekly_logs count,
    // last evaluation rating, documents count.
    const siIds = interns.map((i) => i.id);
    const studentUserIds = interns.map((i) => i.student_user_id);

    const [attendanceRes, weeklyLogsRes, evalsRes, docsRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("student_internship_id, status")
        .in("student_internship_id", siIds),
      supabase
        .from("weekly_logs")
        .select("student_internship_id, id, status, week_number")
        .in("student_internship_id", siIds),
      supabase
        .from("evaluations")
        .select("student_internship_id, id, rating, status")
        .in("student_internship_id", siIds)
        .eq("type", "final"),
      supabase
        .from("documents")
        .select("entity_id, type, status")
        .in("entity_id", studentUserIds)
        .eq("entity_type", "student")
        .in("type", ["offer_letter", "certificate"]),
    ]);

    // Aggregate per student_internship_id
    const attendanceBySi = new Map<string, { total: number; present: number }>();
    (attendanceRes.data || []).forEach((a: any) => {
      const cur = attendanceBySi.get(a.student_internship_id) || { total: 0, present: 0 };
      cur.total += 1;
      if (a.status === "present" || a.status === "late" || a.status === "half_day") cur.present += 1;
      attendanceBySi.set(a.student_internship_id, cur);
    });

    const weeklyLogsBySi = new Map<string, number>();
    (weeklyLogsRes.data || []).forEach((w: any) => {
      weeklyLogsBySi.set(w.student_internship_id, (weeklyLogsBySi.get(w.student_internship_id) || 0) + 1);
    });

    const evalBySi = new Map<string, { rating: number; status: string }>();
    (evalsRes.data || []).forEach((e: any) => {
      // Keep the latest one — first in array since we order by created_at desc elsewhere
      if (!evalBySi.has(e.student_internship_id)) {
        evalBySi.set(e.student_internship_id, { rating: Number(e.rating) || 0, status: e.status });
      }
    });

    const offerLettersByStudent = new Set<string>();
    const certsByStudent = new Set<string>();
    (docsRes.data || []).forEach((d: any) => {
      if (d.type === "offer_letter") offerLettersByStudent.add(d.entity_id);
      else if (d.type === "certificate") certsByStudent.add(d.entity_id);
    });

    // Compute expected total weeks from internship duration
    const enriched = interns.map((i) => {
      const internship = Array.isArray(i.internships) ? i.internships[0] : i.internships;
      const student = i.student || {};
      const att = attendanceBySi.get(i.id) || { total: 0, present: 0 };
      const attendanceRate = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
      const weeklyLogsCount = weeklyLogsBySi.get(i.id) || 0;
      const evaluation = evalBySi.get(i.id);
      const durationWeeks = internship?.duration_weeks || 0;
      const siStart = new Date(i.start_date);
      const now = new Date();
      const weeksElapsed = Math.max(
        0,
        Math.floor((now.getTime() - siStart.getTime()) / (1000 * 60 * 60 * 24 * 7))
      );

      return {
        id: i.id,
        student_user_id: i.student_user_id,
        internship_id: i.internship_id,
        site_supervisor_id: i.site_supervisor_id,
        status: i.status,
        start_date: i.start_date,
        end_date: i.end_date,
        created_at: i.created_at,
        updated_at: i.updated_at,
        // Denormalised for UI convenience
        student_name:
          student.full_name || [student.first_name, student.last_name].filter(Boolean).join(" ") || "",
        student_email: student.email || "",
        student_phone: student.phone || "",
        student_avatar: student.avatar_url || null,
        university: uniMap.get(student.university_id)?.name || "",
        department: deptMap.get(student.department_id)?.name || "",
        program: progMap.get(student.program_id)?.name || "",
        internship_title: internship?.title || "",
        internship_duration_weeks: durationWeeks,
        internship_start: internship?.start_date || null,
        internship_end: internship?.end_date || null,
        supervisor_name: i.supervisor
          ? i.supervisor.full_name || [i.supervisor.first_name, i.supervisor.last_name].filter(Boolean).join(" ")
          : null,
        attendance_rate: attendanceRate,
        attendance_total: att.total,
        weekly_logs_submitted: weeklyLogsCount,
        weeks_elapsed: weeksElapsed,
        overall_rating: evaluation?.rating || 0,
        evaluation_status: evaluation?.status || null,
        offer_letter_uploaded: offerLettersByStudent.has(i.student_user_id),
        certificate_issued: certsByStudent.has(i.student_user_id),
      };
    });

    // Also fetch the list of active site supervisors AND external evaluators
    // for the assignment dropdown. Both are returned as separate arrays so the
    // UI can present them as two clearly labeled groups.
    //
    // SITE SUPERVISORS are scoped to this company — they're employees the HR
    // manages, so `company_id = profile.company_id` is correct.
    //
    // EXTERNAL EVALUATORS are NOT company-bound — they're industry experts
    // shared across the ecosystem. Filtering them by `company_id` returns an
    // empty list because external evaluator rows NEVER have a `company_id`.
    // Instead, we fetch external evaluators whose `university_id` matches any
    // of the universities of this company's interns. This ensures HR sees the
    // same pool of external evaluators that the coordinators at those
    // universities assigned from. If no university info is available on any
    // intern, we fall back to fetching all active external evaluators (open
    // marketplace model) so HR can still pick one.
    const internUniversityIds = Array.from(
      new Set(
        interns
          .map((i) => i.student?.university_id)
          .filter(Boolean) as string[]
      )
    );

    const siteSupQuery = supabase
      .from("supervisors")
      .select(
        `
        user_id,
        company_id,
        is_active,
        first_name,
        last_name,
        email,
        profiles:user_id (full_name, first_name, last_name, email)
      `
      )
      .eq("company_id", profile.company_id)
      .eq("type", "site")
      .eq("is_active", true);

    let extEvalQuery = supabase
      .from("supervisors")
      .select(
        `
        user_id,
        is_active,
        first_name,
        last_name,
        email,
        profiles:user_id (full_name, first_name, last_name, email)
      `
      )
      .eq("type", "external")
      .eq("is_active", true);
    if (internUniversityIds.length > 0) {
      // Include evaluators whose university_id is in our list, OR is NULL
      // (truly external industry experts with no university affiliation).
      extEvalQuery = extEvalQuery.or(
        `university_id.in.(${internUniversityIds.join(",")}),university_id.is.null`
      );
    }

    const [siteSupRes, extEvalRes] = await Promise.all([
      siteSupQuery,
      extEvalQuery,
    ]);

    const mapSupervisor = (s: any) => ({
      user_id: s.user_id,
      name:
        s.profiles?.full_name ||
        s.full_name ||
        [s.profiles?.first_name, s.profiles?.last_name].filter(Boolean).join(" ") ||
        s.email,
      email: s.profiles?.email || s.email,
    });

    const supervisorList = (siteSupRes.data || []).map(mapSupervisor);
    const externalEvaluatorList = (extEvalRes.data || []).map(mapSupervisor);

    return NextResponse.json({
      success: true,
      data: enriched,
      supervisors: supervisorList,
      external_evaluators: externalEvaluatorList,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
