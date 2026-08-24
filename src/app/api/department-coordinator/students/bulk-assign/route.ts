import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

/**
 * POST /api/department-coordinator/students/bulk-assign
 *
 * Bulk update program_id and/or faculty_supervisor_id and/or
 * external_evaluator_id for one or more students. Designed for the
 * department-coordinator students page's "Assign Program / Supervisor /
 * Evaluator" bulk action — lets the coordinator select multiple students
 * at once and assign/reassign their program, supervisor, and evaluator in
 * a single call.
 *
 * Body:
 *   {
 *     student_user_ids: string[],         // required — at least 1
 *     program_id?: string | null,         // optional — set or clear
 *     faculty_supervisor_id?: string | null,  // optional — set or clear
 *     external_evaluator_id?: string | null,  // optional — set or clear
 *   }
 *
 * Authorization:
 *   - Caller must be signed in.
 *   - Caller's profile.role must be 'department_coordinator' (or 'super_admin').
 *   - Each student must belong to the caller's department (RLS-safe: we
 *     explicitly filter by department_id before updating).
 *   - External evaluators do NOT need to be in the caller's department
 *     (they may be cross-department / industry experts).
 *
 * Returns:
 *   {
 *     success: true,
 *     data: { updated: number, skipped: number, errors: string[] }
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Load caller profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, role, university_id, department_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile" },
        { status: 500 }
      );
    }

    // Program Coordinators own the student workflow (2026-08-24): they
    // assign supervisors to students within their own department/program,
    // enforced by the students UPDATE RLS policy + the department filter
    // below. Department Coordinators keep their existing assignment flow.
    if (
      profile.role !== "department_coordinator" &&
      profile.role !== "program_coordinator" &&
      profile.role !== "super_admin"
    ) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Coordinator access required" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      student_user_ids,
      program_id,
      faculty_supervisor_id,
      external_evaluator_id,
      // When true, students who ALREADY have a faculty_supervisor_id assigned
      // are SKIPPED (not overwritten). Default: false (overwrite — original
      // behavior). Per InternHub spec: "Bulk assignment must never silently
      // overwrite existing assignments."
      skip_if_assigned = true,
    } = body as {
      student_user_ids?: string[];
      program_id?: string | null;
      faculty_supervisor_id?: string | null;
      external_evaluator_id?: string | null;
      skip_if_assigned?: boolean;
    };

    if (!Array.isArray(student_user_ids) || student_user_ids.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "At least one student_user_id is required" },
        { status: 400 }
      );
    }

    if (
      program_id === undefined &&
      faculty_supervisor_id === undefined &&
      external_evaluator_id === undefined
    ) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Provide at least one of program_id, faculty_supervisor_id, or external_evaluator_id" },
        { status: 400 }
      );
    }

    // Validate faculty_supervisor_id (if provided and non-null) is a
    // faculty_supervisor in the caller's department.
    if (faculty_supervisor_id) {
      const { data: supervisorProfile } = await supabase
        .from("profiles")
        .select("user_id, role, department_id")
        .eq("user_id", faculty_supervisor_id)
        .maybeSingle();

      if (!supervisorProfile || supervisorProfile.role !== "faculty_supervisor") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Selected supervisor is not a faculty supervisor" },
          { status: 400 }
        );
      }

      // Department-coordinators can only assign supervisors from their own
      // department (super_admin bypasses).
      if (
        profile.role === "department_coordinator" &&
        supervisorProfile.department_id !== profile.department_id
      ) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Selected supervisor is not in your department" },
          { status: 403 }
        );
      }
    }

    // Validate external_evaluator_id (if provided and non-null) is an
    // external_evaluator. NOTE: department check is intentionally skipped
    // — external evaluators are cross-department industry experts.
    if (external_evaluator_id) {
      const { data: evaluatorProfile } = await supabase
        .from("profiles")
        .select("user_id, role")
        .eq("user_id", external_evaluator_id)
        .maybeSingle();

      if (!evaluatorProfile || evaluatorProfile.role !== "external_evaluator") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Selected evaluator is not an external evaluator" },
          { status: 400 }
        );
      }
    }

    // Validate program_id (if provided and non-null) belongs to caller's
    // department.
    if (program_id) {
      const { data: programRow } = await supabase
        .from("programs")
        .select("id, department_id, university_id")
        .eq("id", program_id)
        .maybeSingle();

      if (!programRow) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Selected program does not exist" },
          { status: 400 }
        );
      }

      if (
        profile.role === "department_coordinator" &&
        programRow.department_id !== profile.department_id
      ) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Selected program is not in your department" },
          { status: 403 }
        );
      }
    }

    // Build update payload for the `students` table. NULL is allowed for
    // both fields (means "clear").
    // NOTE: `students` table has only `faculty_supervisor_id` (no
    // `external_evaluator_id` column — see migration 0041). External
    // evaluator assignments live on `student_internships` only, and are
    // handled in a second pass below.
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (program_id !== undefined) {
      updatePayload.program_id = program_id || null;
    }
    if (faculty_supervisor_id !== undefined) {
      updatePayload.faculty_supervisor_id = faculty_supervisor_id || null;
    }

    // Per InternHub spec: "Bulk assignment must never silently overwrite
    // existing assignments." When skip_if_assigned is true (default), we
    // query the existing students first and split the list into:
    //   - already_assigned: students who already have a faculty_supervisor_id
    //     (when assigning, not clearing). These are SKIPPED.
    //   - to_update: students who don't have one yet (or we're clearing).
    let effectiveStudentIds = student_user_ids;
    let alreadyAssignedCount = 0;
    const alreadyAssignedNames: string[] = [];

    if (skip_if_assigned && faculty_supervisor_id) {
      const { data: existingStudents } = await supabase
        .from("students")
        .select(`
          user_id,
          profiles:user_id (full_name)
        `)
        .in("user_id", student_user_ids)
        .not("faculty_supervisor_id", "is", null);

      const alreadyAssignedIds = new Set(
        (existingStudents || []).map((s: any) => s.user_id)
      );
      alreadyAssignedCount = alreadyAssignedIds.size;

      // Collect names for the response message
      for (const s of (existingStudents || []) as any[]) {
        const name = s.profiles?.full_name || s.user_id;
        alreadyAssignedNames.push(name);
      }

      effectiveStudentIds = student_user_ids.filter(
        (id) => !alreadyAssignedIds.has(id)
      );

      if (effectiveStudentIds.length === 0) {
        // All selected students already have a supervisor assigned.
        return NextResponse.json({
          success: true,
          data: {
            updated: 0,
            skipped: student_user_ids.length,
            already_assigned: alreadyAssignedCount,
            already_assigned_names: alreadyAssignedNames,
            errors: [],
          },
          message: `All ${alreadyAssignedCount} student(s) already have a faculty supervisor assigned. No changes made (use skip_if_assigned=false to force-overwrite).`,
        });
      }
    }

    // Update the students table for the selected user_ids. Use the caller's
    // department_id as an extra filter so cross-department students in the
    // array are silently skipped (defense in depth, even though RLS would
    // also block the update).
    let query = supabase
      .from("students")
      .update(updatePayload)
      .in("user_id", effectiveStudentIds);

    if (profile.role === "department_coordinator" || profile.role === "program_coordinator") {
      query = query.eq("department_id", profile.department_id);
    }

    // NOTE: the students table has no company_id column — selecting it made
    // every bulk-assign UPDATE fail with 42703 after RLS passed.
    const { data: updated, error: updateErr } = await query.select("user_id, department_id, university_id");

    if (updateErr) {
      console.error("[bulk-assign] update error:", updateErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to update students: ${updateErr.message}` },
        { status: 500 }
      );
    }

    const updatedCount = updated?.length || 0;
    const skippedCount = student_user_ids.length - updatedCount - alreadyAssignedCount;

    // Second pass: external_evaluator_id. The `students` table has no such
    // column, so we update each student's `student_internships` row instead.
    // If `external_evaluator_id` is null (clear), we set the column to null
    // on any matching SI rows. If it's a string (set), we either update the
    // existing SI row, or — if no SI row exists — create a placeholder.
    let evaluatorUpdatedCount = 0;
    if (external_evaluator_id !== undefined && updatedCount > 0) {
      const nowIso = new Date().toISOString();
      for (const studentRow of updated || []) {
        const { data: existingSI } = await supabase
          .from("student_internships")
          .select("id")
          .eq("student_user_id", studentRow.user_id)
          .maybeSingle();

        if (existingSI) {
          const { error: siErr } = await supabase
            .from("student_internships")
            .update({
              external_evaluator_id: external_evaluator_id || null,
              updated_at: nowIso,
            })
            .eq("id", existingSI.id);
          if (siErr) {
            console.warn(
              `[bulk-assign] failed to set external_evaluator_id on SI ${existingSI.id}:`,
              siErr
            );
          } else {
            evaluatorUpdatedCount += 1;
          }
        } else if (external_evaluator_id) {
          // No SI row exists yet — create a placeholder carrying the
          // external_evaluator_id (mirrors single-assign behavior).
          const insertPayload: Record<string, unknown> = {
            student_user_id: studentRow.user_id,
            external_evaluator_id,
            status: "assigned",
            start_date: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          };
          if (studentRow.department_id) insertPayload.department_id = studentRow.department_id;
          if (studentRow.university_id) insertPayload.university_id = studentRow.university_id;

          const { error: insertErr } = await supabase
            .from("student_internships")
            .insert(insertPayload);
          if (insertErr) {
            console.warn(
              `[bulk-assign] failed to create placeholder SI for ${studentRow.user_id}:`,
              insertErr
            );
          } else {
            evaluatorUpdatedCount += 1;
          }
        }
        // If external_evaluator_id is null AND there's no SI row, there's
        // nothing to clear — skip silently.
      }
    }

    // Best-effort: send a notification to each student whose supervisor
    // changed, so they know who their new supervisor is. Uses the shared
    // sendNotification helper so push notifications are also fired.
    if (faculty_supervisor_id && updatedCount > 0) {
      try {
        const { data: supervisorProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", faculty_supervisor_id)
          .maybeSingle();

        const supervisorName = supervisorProfile?.full_name || "a new supervisor";
        const { sendNotification } = await import("@/lib/notifications");

        await Promise.all(
          (updated || []).map((row: any) =>
            sendNotification(supabase, {
              userId: row.user_id,
              senderId: user.id,
              title: "Faculty supervisor assigned",
              message: `You have been assigned to ${supervisorName} as your faculty supervisor.`,
              category: "system",
              priority: "medium",
              actionUrl: "/student/internships",
              metadata: { type: "supervisor_assigned", supervisor_user_id: faculty_supervisor_id, supervisor_name: supervisorName },
            })
          )
        );
      } catch (notifErr) {
        console.warn("[bulk-assign] notifications failed (non-fatal):", notifErr);
      }
    }

    // Best-effort: send a notification to each student whose external
    // evaluator changed. Uses the shared sendNotification helper.
    if (external_evaluator_id && evaluatorUpdatedCount > 0) {
      try {
        const { data: evaluatorProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", external_evaluator_id)
          .maybeSingle();

        const evaluatorName = evaluatorProfile?.full_name || "a new external evaluator";
        const { sendNotification } = await import("@/lib/notifications");

        await Promise.all(
          (updated || []).map((row: any) =>
            sendNotification(supabase, {
              userId: row.user_id,
              senderId: user.id,
              title: "External evaluator assigned",
              message: `You have been assigned to ${evaluatorName} as your external evaluator.`,
              category: "system",
              priority: "medium",
              actionUrl: "/student/evaluations",
              metadata: { type: "evaluator_assigned", evaluator_user_id: external_evaluator_id, evaluator_name: evaluatorName },
            })
          )
        );
      } catch (notifErr) {
        console.warn("[bulk-assign] evaluator notifications failed (non-fatal):", notifErr);
      }
    }

    // Audit log entry.
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "bulk_assign_students",
        entity_type: "student",
        details: {
          student_count: updatedCount,
          program_id: program_id ?? null,
          faculty_supervisor_id: faculty_supervisor_id ?? null,
          external_evaluator_id: external_evaluator_id ?? null,
          evaluator_rows_updated: evaluatorUpdatedCount,
        },
      });
    } catch (auditErr) {
      console.warn("[bulk-assign] audit log failed (non-fatal):", auditErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: updatedCount,
        skipped: skippedCount,
        already_assigned: alreadyAssignedCount,
        already_assigned_names: alreadyAssignedNames,
        errors: [] as string[],
      },
      message:
        alreadyAssignedCount > 0
          ? `Updated ${updatedCount} student(s). ${alreadyAssignedCount} student(s) were skipped because they already have a supervisor assigned.`
          : `Updated ${updatedCount} student(s).`,
    });
  } catch (err) {
    console.error("[bulk-assign] unhandled:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
