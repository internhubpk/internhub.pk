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

// GET /api/company-hr/attendance
// ?date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD&internship_id=...
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

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const internshipId = searchParams.get("internship_id");

    // Resolve internships that belong to the company so we can scope attendance.
    const { data: companyInternships } = await supabase
      .from("internships")
      .select("id, title, duration_weeks, start_date, end_date")
      .eq("company_id", profile.company_id);

    const internshipIds = (companyInternships || []).map((r) => r.id);
    if (internshipIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        internships: [],
        stats: { total: 0, present: 0, absent: 0, late: 0, half_day: 0, leave: 0, holiday: 0 },
      });
    }

    let query = supabase
      .from("attendance")
      .select(
        `
        id,
        student_user_id,
        internship_id,
        student_internship_id,
        date,
        check_in,
        check_out,
        status,
        notes,
        verified,
        created_at,
        profiles:student_user_id (
          user_id,
          full_name,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `,
        { count: "exact" }
      )
      .in("internship_id", internshipIds)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (date) query = query.eq("date", date);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    if (internshipId) query = query.eq("internship_id", internshipId);

    const { data: records, count, error } = await query.limit(200);

    if (error) {
      console.error("Error fetching attendance:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch attendance" } },
        { status: 500 }
      );
    }

    // Internship title lookup
    const internshipMap = new Map((companyInternships || []).map((i: any) => [i.id, i]));

    const enriched = (records || []).map((r: any) => {
      const p = r.profiles || {};
      return {
        id: r.id,
        student_user_id: r.student_user_id,
        internship_id: r.internship_id,
        student_internship_id: r.student_internship_id,
        date: r.date,
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.status,
        notes: r.notes,
        verified: r.verified,
        created_at: r.created_at,
        student_name:
          p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "",
        student_email: p.email || "",
        student_avatar: p.avatar_url || null,
        internship_title: internshipMap.get(r.internship_id)?.title || "",
      };
    });

    // Compute summary stats
    const stats = (enriched || []).reduce(
      (acc, r) => {
        acc.total += 1;
        if (r.status === "present") acc.present += 1;
        else if (r.status === "absent") acc.absent += 1;
        else if (r.status === "late") acc.late += 1;
        else if (r.status === "half_day") acc.half_day += 1;
        else if (r.status === "leave") acc.leave += 1;
        else if (r.status === "holiday") acc.holiday += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, half_day: 0, leave: 0, holiday: 0 }
    );

    return NextResponse.json({
      success: true,
      data: enriched,
      internships: companyInternships,
      stats,
      meta: { total: count || 0 },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
