import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ============================================================================
// GET /api/student/weekly-logs
//   Returns the authenticated student's weekly logs (newest first), with
//   the student's program / department / registration no joined in so the
//   UI can render the universal report header without an extra round-trip.
//   Also returns holidays for the student's university and daily entries
//   for each log.
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

    // Fetch daily entries for ALL of the student's logs in a single query.
    const logIds = (logs || []).map((l: any) => l.id);
    let dailyEntriesMap: Record<string, any[]> = {};
    if (logIds.length > 0) {
      const { data: allDailyEntries } = await supabase
        .from("weekly_log_daily_entries")
        .select("id, weekly_log_id, day_of_week, entry_date, tasks_performed, hours_worked, is_holiday, notes")
        .in("weekly_log_id", logIds)
        .order("day_of_week", { ascending: true });

      if (allDailyEntries) {
        for (const de of allDailyEntries) {
          const wlId = (de as any).weekly_log_id;
          if (!dailyEntriesMap[wlId]) dailyEntriesMap[wlId] = [];
          dailyEntriesMap[wlId].push(de);
        }
      }
    }

    // Attach daily entries to each log.
    const logsWithEntries = (logs || []).map((log: any) => ({
      ...log,
      daily_entries: dailyEntriesMap[log.id] || [],
    }));

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
        university_id,
        departments:department_id ( id, name, code ),
        programs:program_id ( id, name, code ),
        universities:university_id ( id, name, slug, logo_url )
        `
      )
      .eq("user_id", user.id)
      .maybeSingle();

    // The canonical student_id_number (e.g. "FA21-BSCS-001") lives on the
    // `students` table — the coordinator sets it via the Add Student dialog.
    const { data: studentRow } = await supabase
      .from("students")
      .select("student_id_number, program_id, department_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileWithRegNo = {
      ...(profile as any),
      student_id_number:
        (profile as any)?.student_id_number ||
        studentRow?.student_id_number ||
        null,
      program_id:
        (profile as any)?.program_id ||
        studentRow?.program_id ||
        null,
      department_id:
        (profile as any)?.department_id ||
        studentRow?.department_id ||
        null,
    };

    // Active internship
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

    // Fetch holidays for the student's university (next 90 days) so the UI
    // can mark holidays in the day-by-day form.
    const universityId = (profile as any)?.university_id;
    let holidays: any[] = [];
    if (universityId) {
      const today = new Date().toISOString().slice(0, 10);
      const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: holidaysData } = await supabase
        .from("holidays")
        .select("id, name, holiday_date, end_date, is_active, restrict_submissions")
        .eq("university_id", universityId)
        .eq("is_active", true)
        .gte("holiday_date", today)
        .lte("holiday_date", threeMonthsLater)
        .order("holiday_date", { ascending: true });
      holidays = holidaysData || [];
    }

    // List all programs in the student's department.
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
        logs: logsWithEntries,
        profile: profileWithRegNo,
        activeInternship,
        programs,
        holidays,
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
//   Create a new weekly log with day-by-day daily entries.
//   Flow: INSERT weekly_log (draft) → INSERT daily_entries → UPDATE status=submitted
//   This 3-step flow is required because the wlde_insert_policy RLS only
//   allows daily entry inserts when the parent log is in draft/revision_required.
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
        university_id,
        departments:department_id ( name ),
        programs:program_id ( name ),
        universities:university_id ( logo_url )
        `
      )
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: studentRow } = await supabase
      .from("students")
      .select("student_id_number, program_id, department_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileRow = profile as any;
    let programName = Array.isArray(profileRow?.programs)
      ? profileRow.programs[0]?.name
      : profileRow?.programs?.name;
    let departmentName = Array.isArray(profileRow?.departments)
      ? profileRow.departments[0]?.name
      : profileRow?.departments?.name;

    // FALLBACK (bug fix 2026-08-26): many existing student rows have
    // program_id / department_id set on `students` but NOT on `profiles`
    // (older creation flows only wrote the students table). Without this
    // fallback the weekly_log.program_name snapshot is written as NULL and
    // the generated Word report shows "—" for Program.
    const snapshotProgramId =
      profileRow?.program_id || studentRow?.program_id || null;
    const snapshotDepartmentId =
      profileRow?.department_id || studentRow?.department_id || null;
    if (!programName && snapshotProgramId) {
      const { data: progRow } = await supabase
        .from("programs")
        .select("name")
        .eq("id", snapshotProgramId)
        .maybeSingle();
      programName = (progRow as any)?.name || null;
    }
    if (!departmentName && snapshotDepartmentId) {
      const { data: deptRow } = await supabase
        .from("departments")
        .select("name")
        .eq("id", snapshotDepartmentId)
        .maybeSingle();
      departmentName = (deptRow as any)?.name || null;
    }

    const studentRegistrationNo =
      profileRow?.student_id_number ||
      studentRow?.student_id_number ||
      null;
    // University logo: the profiles select above embeds
    // universities:university_id(logo_url) — the previous select omitted the
    // embed entirely, so this snapshot was always NULL and generation had to
    // fall back to the live universities row every time.
    const universityLogoUrl = Array.isArray(profileRow?.universities)
      ? profileRow.universities[0]?.logo_url
      : profileRow?.universities?.logo_url;

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

    // Build daily entries from the request body.
    // body.daily_entries is an array of:
    //   { day_of_week: 1-7, entry_date: "YYYY-MM-DD", tasks_performed: string, hours_worked: number, is_holiday: boolean, notes?: string }
    const dailyEntries = Array.isArray(body.daily_entries) ? body.daily_entries : [];

    // Build the legacy tasks_completed text[] from daily entries for back-compat.
    const tasksArr: string[] = dailyEntries
      .filter((de: any) => !de.is_holiday && de.tasks_performed?.trim())
      .map((de: any) => `${de.tasks_performed.trim()} (${de.hours_worked || 0}h)`);

    // Also accept the old-style tasks_completed textarea.
    if (tasksArr.length === 0 && body.tasks_completed) {
      const legacyTasks = (body.tasks_completed as string)
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);
      tasksArr.push(...legacyTasks);
    }

    // Compute total hours from daily entries.
    const totalHours = dailyEntries.reduce(
      (sum: number, de: any) => sum + (de.is_holiday ? 0 : Number(de.hours_worked) || 0),
      0
    );

    // Legacy weekly_activities JSONB column — keep in sync.
    const weeklyActivities = dailyEntries
      .filter((de: any) => !de.is_holiday)
      .map((de: any) => ({
        tasks: de.tasks_performed || "",
        hours: de.hours_worked || 0,
      }));

    const supportingEvidence = Array.isArray(body.supporting_evidence)
      ? body.supporting_evidence
      : null;

    // ---- STEP 1: Insert weekly_log with status "draft" ----
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
      hours_worked: totalHours || body.hours_worked || null,
      // New columns
      program_name: programName || body.program_name || null,
      department_name: departmentName || body.department_name || null,
      student_registration_no: studentRegistrationNo || body.student_registration_no || null,
      university_logo_url: universityLogoUrl || body.university_logo_url || null,
      weekly_activities: weeklyActivities.length > 0 ? weeklyActivities : null,
      supporting_evidence: supportingEvidence,
      student_signature_url: body.student_signature_url || null,
      student_signed_at: body.student_signature_url ? new Date().toISOString() : null,
      status: "draft", // Start as draft so daily entries can be inserted (RLS)
    };

    const { data: inserted, error: insertError } = await supabase
      .from("weekly_logs")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique violation on (student_user_id, week_start_date) — a log for
        // these dates already exists.
        //
        // OVERWRITE GUARD (bug fix 2026-08-26 — "generating a log deletes the
        // other log"): the old flow ALWAYS replaced the existing row. When the
        // form defaulted every submission's dates to the CURRENT calendar
        // week, each new week number silently deleted the previous week's
        // submission. Now a replacement only happens when the week NUMBER
        // matches too (a genuine resubmission of the same week); a different
        // week number on the same dates is rejected with 409 so the student
        // can fix the dates instead of losing data.
        const { data: existingLog } = await supabase
          .from("weekly_logs")
          .select("id, status, week_number")
          .eq("student_user_id", user.id)
          .eq("week_start_date", body.week_start_date)
          .maybeSingle();

        if (existingLog) {
          const submittedWeekNumber = body.week_number ? Number(body.week_number) : null;
          const existingWeekNumber = existingLog.week_number ?? null;

          if (
            submittedWeekNumber !== null &&
            existingWeekNumber !== null &&
            submittedWeekNumber !== existingWeekNumber
          ) {
            return NextResponse.json<ApiResponse<null>>(
              {
                success: false,
                error: {
                  code: "WEEK_DATE_CONFLICT",
                  message: `These dates (${body.week_start_date} to ${body.week_end_date}) are already used by your Week ${existingWeekNumber} log. Change the week dates so Week ${submittedWeekNumber} has its own date range — existing submissions are never deleted.`,
                },
              },
              { status: 409 }
            );
          }

          // Same week number + same start date = legitimate resubmission.
          // ORDER MATTERS. The weekly_log_daily_entries RLS policies
          // (wlde_delete_policy / wlde_insert_policy) only allow
          // delete/insert while the parent log's status is 'draft' or
          // 'revision_required'. The previous order (delete → set draft →
          // insert) silently skipped the delete (RLS filters it out while
          // the log is 'submitted'), so the subsequent insert hit the
          // (weekly_log_id, day_of_week) unique constraint and the client
          // kept seeing the STALE daily entries despite a "success"
          // response. Correct order: set draft FIRST, then delete, then
          // insert.

          // 1. Temporarily set to draft so daily entries can be deleted
          //    and re-inserted.
          const { error: draftErr } = await supabase
            .from("weekly_logs")
            .update({ status: "draft" })
            .eq("id", existingLog.id);
          if (draftErr) {
            console.error("[student/weekly-logs POST] draft-status update error:", draftErr);
          }

          // 2. Delete old daily entries.
          const { error: delErr } = await supabase
            .from("weekly_log_daily_entries")
            .delete()
            .eq("weekly_log_id", existingLog.id);
          if (delErr) {
            console.error("[student/weekly-logs POST] daily entries delete error:", delErr);
          }

          // 3. Insert new daily entries.
          if (dailyEntries.length > 0) {
            const { error: deInsertErr } = await supabase
              .from("weekly_log_daily_entries")
              .insert(
                dailyEntries.map((de: any) => ({
                  weekly_log_id: existingLog.id,
                  day_of_week: Number(de.day_of_week),
                  entry_date: de.entry_date,
                  tasks_performed: de.tasks_performed || "",
                  hours_worked: Number(de.hours_worked) || 0,
                  is_holiday: !!de.is_holiday,
                  notes: de.notes || null,
                }))
              );
            if (deInsertErr) {
              console.error("[student/weekly-logs POST] daily entries insert error:", deInsertErr);
            }
          }

          // Update the weekly log with new data and set status to submitted
          const { data: updated, error: updateError } = await supabase
            .from("weekly_logs")
            .update({
              ...insertPayload,
              status: "submitted",
              submitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingLog.id)
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
      }

      console.error("[student/weekly-logs POST] insert error:", insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    // ---- STEP 2: Insert daily entries ----
    if (dailyEntries.length > 0) {
      const dailyInsertPayload = dailyEntries.map((de: any) => ({
        weekly_log_id: inserted.id,
        day_of_week: Number(de.day_of_week),
        entry_date: de.entry_date,
        tasks_performed: de.tasks_performed || "",
        hours_worked: Number(de.hours_worked) || 0,
        is_holiday: !!de.is_holiday,
        notes: de.notes || null,
      }));

      const { error: deError } = await supabase
        .from("weekly_log_daily_entries")
        .insert(dailyInsertPayload);

      if (deError) {
        console.error("[student/weekly-logs POST] daily entries insert error:", deError);
        // Non-fatal: the weekly_log is already created. Daily entries can be
        // added later. Log the error but don't fail the whole request.
      }
    }

    // ---- STEP 3: Update status to "submitted" ----
    const { data: finalLog, error: statusUpdateError } = await supabase
      .from("weekly_logs")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id)
      .select()
      .single();

    if (statusUpdateError) {
      console.error("[student/weekly-logs POST] status update error:", statusUpdateError);
      // The log is still in draft status — return it with a warning.
      return NextResponse.json<ApiResponse<any>>({
        success: true,
        data: inserted,
        message: "Weekly log created but could not be marked as submitted. It is in draft status.",
        warning: "status_update_failed",
      });
    }

    // Notify the supervisor(s) — best-effort.
    if (supervisorId) {
      const weekLabel = new Date(body.week_start_date).toLocaleDateString();
      try {
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
            log_id: finalLog?.id,
            student_user_id: user.id,
            week_start_date: body.week_start_date,
            sent_by: "student",
          },
        });
      } catch (notifErr) {
        console.warn("[student/weekly-logs POST] notification error:", notifErr);
      }
    }

    // Fetch the daily entries we just inserted to return them.
    let returnedDailyEntries: any[] = [];
    if (dailyEntries.length > 0) {
      const { data: fetchedEntries } = await supabase
        .from("weekly_log_daily_entries")
        .select("id, weekly_log_id, day_of_week, entry_date, tasks_performed, hours_worked, is_holiday, notes")
        .eq("weekly_log_id", finalLog?.id || inserted.id)
        .order("day_of_week", { ascending: true });
      returnedDailyEntries = fetchedEntries || [];
    }

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          ...(finalLog || inserted),
          daily_entries: returnedDailyEntries,
        },
        message: "Weekly log submitted.",
      },
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
