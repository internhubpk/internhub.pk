import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ============================================================================
// GET /api/student/weekly-logs
//   Returns the authenticated student's weekly logs (newest first), with
//   the student's program / department / registration no joined in so the
//   UI can render the universal report header without an extra round-trip.
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Pull all of the student's weekly logs + the new signature/evidence
    // columns added by migration 0058.
    const { data: logs, error } = await supabase
      .from("weekly_logs")
      .select(
        `
        id,
        student_user_id,
        internship_id,
        student_internship_id,
        week_number,
        week_start_date,
        week_end_date,
        tasks_completed,
        challenges,
        learnings,
        next_week_goals,
        hours_worked,
        status,
        supervisor_feedback,
        supervisor_id,
        reviewed_at,
        submitted_at,
        created_at,
        updated_at,
        program_name,
        department_name,
        student_registration_no,
        university_logo_url,
        weekly_activities,
        learning_outcomes,
        challenges_solutions,
        supporting_evidence,
        student_signature_url,
        student_signed_at,
        site_supervisor_id,
        site_supervisor_signature_url,
        site_supervisor_remarks,
        site_supervisor_signed_at,
        faculty_supervisor_id,
        faculty_supervisor_signature_url,
        faculty_supervisor_remarks,
        faculty_supervisor_signed_at
        `
      )
      .eq("student_user_id", user.id)
      .order("week_start_date", { ascending: false });

    if (error) {
      console.error("[student/weekly-logs GET] db error:", error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    // Profile with program / department / university joins for the form's
    // auto-populated header.
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        `
        user_id,
        full_name,
        first_name,
        last_name,
        student_id_number,
        department_id,
        program_id,
        departments:department_id ( id, name, code ),
        programs:program_id ( id, name, code ),
        universities:university_id ( id, name, slug, logo_url )
        `
      )
      .eq("user_id", user.id)
      .maybeSingle();

    // The canonical student_id_number (e.g. "FA21-BSCS-001") lives on the
    // `students` table — the coordinator sets it via the Add Student dialog.
    // `profiles.student_id_number` is sometimes NULL for legacy accounts.
    // Fall back to the students table so the report header always shows the
    // registration number the coordinator assigned.
    const { data: studentRow } = await supabase
      .from("students")
      .select("student_id_number, program_id, department_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Merge: prefer profiles.student_id_number, fall back to students.student_id_number.
    const profileWithRegNo = {
      ...(profile as any),
      student_id_number:
        (profile as any)?.student_id_number ||
        studentRow?.student_id_number ||
        null,
      // If profile.program_id is null but students.program_id is set, use it
      // so the program checkboxes can still highlight the right one.
      program_id:
        (profile as any)?.program_id ||
        studentRow?.program_id ||
        null,
      department_id:
        (profile as any)?.department_id ||
        studentRow?.department_id ||
        null,
    };

    // Active internship — used by the form to derive week_number bounds
    // and the host org / supervisor name.
    const { data: activeInternship } = await supabase
      .from("student_internships")
      .select(
        `
        id,
        internship_id,
        student_user_id,
        site_supervisor_id,
        faculty_supervisor_id,
        status,
        start_date,
        end_date,
        internships:internship_id ( id, title, company_id, companies:company_id ( name ) ),
        site_supervisor:site_supervisor_id ( full_name, first_name, last_name, email ),
        faculty_supervisor:faculty_supervisor_id ( full_name, first_name, last_name, email )
        `
      )
      .eq("student_user_id", user.id)
      .in("status", ["assigned", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // List all programs in the student's department so the form can render
    // the program checkboxes (matching the PDF layout: CS / SE / AI / Robotics & AI).
    let programs: any[] = [];
    if (profileWithRegNo?.department_id) {
      const { data: programsData } = await supabase
        .from("programs")
        .select("id, name, code, is_active")
        .eq("department_id", profileWithRegNo.department_id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      programs = programsData || [];
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        logs: logs || [],
        profile: profileWithRegNo,
        activeInternship,
        programs,
      },
    });
  } catch (error: any) {
    console.error("[student/weekly-logs GET] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/student/weekly-logs
//   Create a new weekly log. Auto-fills program_name + department_name from
//   the student's profile at submit time (snapshot for stable report data).
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ----- Required fields -----
    const required = ["week_start_date", "week_end_date"];
    for (const k of required) {
      if (!body[k]) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: { code: "VALIDATION_ERROR", message: `Missing field: ${k}` } },
          { status: 400 }
        );
      }
    }

    // Snapshot program / department names from the student's profile.
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        `
        full_name,
        first_name,
        last_name,
        student_id_number,
        department_id,
        program_id,
        departments:department_id ( name ),
        programs:program_id ( name )
        `
      )
      .eq("user_id", user.id)
      .maybeSingle();

    // The canonical student_id_number lives on the `students` table
    // (set by the coordinator via the Add Student dialog). Fall back to it
    // when profiles.student_id_number is NULL (legacy accounts).
    const { data: studentRow } = await supabase
      .from("students")
      .select("student_id_number, program_id, department_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // PostgREST may return an array for `programs:program_id` if the FK is
    // ambiguous. Normalize to a single object.
    const profileRow = profile as any;
    const programName = Array.isArray(profileRow?.programs)
      ? profileRow.programs[0]?.name
      : profileRow?.programs?.name;
    const departmentName = Array.isArray(profileRow?.departments)
      ? profileRow.departments[0]?.name
      : profileRow?.departments?.name;
    const studentRegistrationNo =
      profileRow?.student_id_number ||
      studentRow?.student_id_number ||
      null;

    const { data: activeInternship } = await supabase
      .from("student_internships")
      .select(
        `id, internship_id, site_supervisor_id, faculty_supervisor_id, status,
         internships:internship_id ( title, company_id, companies:company_id ( name ) )`
      )
      .eq("student_user_id", user.id)
      .in("status", ["assigned", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const supervisorId =
      activeInternship?.site_supervisor_id ||
      activeInternship?.faculty_supervisor_id ||
      null;

    // Legacy tasks_completed text[] — keep in sync with new weekly_activities
    // for back-compat with any code that reads the text[] column.
    const weeklyActivities = Array.isArray(body.weekly_activities)
      ? body.weekly_activities
      : null;
    const tasksArr: string[] = weeklyActivities
      ? weeklyActivities
          .map((r: any) => (r?.tasks ? String(r.tasks).trim() : ""))
          .filter(Boolean)
      : ((body.tasks_completed || "")
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean) as string[]);

    const totalHours = weeklyActivities
      ? weeklyActivities.reduce(
          (sum: number, r: any) => sum + (r?.hours ? Number(r.hours) || 0 : 0),
          0
        )
      : body.hours_worked
        ? Number(body.hours_worked)
        : null;

    const supportingEvidence = Array.isArray(body.supporting_evidence)
      ? body.supporting_evidence
      : null;

    const insertPayload: Record<string, any> = {
      student_user_id: user.id,
      internship_id: activeInternship?.internship_id || null,
      student_internship_id: activeInternship?.id || null,
      supervisor_id: supervisorId,
      site_supervisor_id: activeInternship?.site_supervisor_id || null,
      faculty_supervisor_id: activeInternship?.faculty_supervisor_id || null,
      week_number: body.week_number ? Number(body.week_number) : 1,
      week_start_date: body.week_start_date,
      week_end_date: body.week_end_date,
      // Legacy / shared columns
      tasks_completed: tasksArr,
      challenges: body.challenges_solutions || body.challenges || null,
      challenges_solutions: body.challenges_solutions || body.challenges || null,
      learnings: body.learning_outcomes || body.learnings || null,
      learning_outcomes: body.learning_outcomes || body.learnings || null,
      next_week_goals: body.next_week_goals || null,
      hours_worked: totalHours,
      // New columns
      program_name: programName || body.program_name || null,
      department_name: departmentName || body.department_name || null,
      student_registration_no: studentRegistrationNo || body.student_registration_no || null,
      university_logo_url: body.university_logo_url || null,
      weekly_activities: weeklyActivities,
      supporting_evidence: supportingEvidence,
      student_signature_url: body.student_signature_url || null,
      student_signed_at: body.student_signature_url ? new Date().toISOString() : null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from("weekly_logs")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique violation — update existing log for this week.
        const { data: updated, error: updateError } = await supabase
          .from("weekly_logs")
          .update({
            ...insertPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("student_user_id", user.id)
          .eq("week_start_date", body.week_start_date)
          .select()
          .single();

        if (updateError) {
          console.error("[student/weekly-logs POST] upsert error:", updateError);
          return NextResponse.json<ApiResponse<null>>(
            { success: false, error: { code: "DB_ERROR", message: updateError.message } },
            { status: 500 }
          );
        }
        return NextResponse.json<ApiResponse<any>>({
          success: true,
          data: updated,
          message: "Weekly log updated (existing entry for this week was replaced).",
        });
      }

      console.error("[student/weekly-logs POST] insert error:", insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    // Notify the supervisor(s) — best-effort. Uses the shared sendNotification
    // helper which also fires a web push notification to subscribed devices.
    if (supervisorId) {
      const weekLabel = new Date(body.week_start_date).toLocaleDateString();
      const { sendNotification } = await import("@/lib/notifications");
      await sendNotification(supabase, {
        userId: supervisorId,
        senderId: user.id,
        category: "evaluation",
        priority: "medium",
        title: "New Weekly Log Submitted",
        message: `Your student ${profile?.full_name || ""} submitted a weekly log for the week of ${weekLabel}. Please review and sign.`,
        actionUrl: "/site-supervisor/weekly-logs",
        metadata: {
          type: "weekly_log_submitted",
          log_id: inserted?.id,
          student_user_id: user.id,
          week_start_date: body.week_start_date,
          sent_by: "student",
        },
      });
    }

    return NextResponse.json<ApiResponse<any>>(
      { success: true, data: inserted, message: "Weekly log submitted." },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[student/weekly-logs POST] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
