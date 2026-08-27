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

// POST /api/company-hr/attendance — manually create an attendance record
// for an intern of the caller's company (e.g. a missed day, a leave entry
// recorded after the fact).
// body: { student_internship_id, date: YYYY-MM-DD, status, notes? }
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
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

    const body = await request.json();
    const { student_internship_id, date, status, notes } = body;

    const validStatuses = ["present", "absent", "late", "half_day", "leave", "holiday"];
    if (!student_internship_id || !date || !status || !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `student_internship_id, date and a valid status (${validStatuses.join(", ")}) are required`,
          },
        },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "date must be YYYY-MM-DD" } },
        { status: 400 }
      );
    }

    // Verify the placement belongs to this company and get its ids.
    const { data: si } = await supabase
      .from("student_internships")
      .select("id, student_user_id, internship_id, company_id")
      .eq("id", student_internship_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!si) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Intern placement not found in your company" } },
        { status: 404 }
      );
    }

    // Replace any existing record for the same placement + date.
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("student_internship_id", student_internship_id)
      .eq("date", date)
      .maybeSingle();

    const payload = {
      student_internship_id,
      student_user_id: si.student_user_id,
      internship_id: si.internship_id,
      date,
      status,
      notes: notes || null,
    };

    let record;
    if (existing?.id) {
      const { data: updated, error: updateErr } = await supabase
        .from("attendance")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      record = updated;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("attendance")
        .insert(payload)
        .select()
        .single();
      if (insertErr) throw insertErr;
      record = inserted;
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "company_hr.create_attendance",
      entity_type: "attendance",
      entity_id: record.id,
      new_values: { date, status },
    });

    return NextResponse.json(
      { success: true, data: record, message: "Attendance record saved" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Unexpected error in POST attendance:", error);
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: error?.message || "Failed to save attendance record" } },
      { status: 500 }
    );
  }
}
