import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

/**
 * POST /api/department-coordinator/students/bulk-assign
 *
 * Bulk update program_id and/or faculty_supervisor_id for one or more
 * students. Designed for the department-coordinator students page's
 * "Assign Program / Supervisor" bulk action — lets the coordinator
 * select multiple students at once and assign/reassign their program
 * and supervisor in a single call.
 *
 * Body:
 *   {
 *     student_user_ids: string[],         // required — at least 1
 *     program_id?: string | null,         // optional — set or clear
 *     faculty_supervisor_id?: string | null,  // optional — set or clear
 *   }
 *
 * Authorization:
 *   - Caller must be signed in.
 *   - Caller's profile.role must be 'department_coordinator' (or 'super_admin').
 *   - Each student must belong to the caller's department (RLS-safe: we
 *     explicitly filter by department_id before updating).
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

    if (profile.role !== "department_coordinator" && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Department coordinator access required" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      student_user_ids,
      program_id,
      faculty_supervisor_id,
    } = body as {
      student_user_ids?: string[];
      program_id?: string | null;
      faculty_supervisor_id?: string | null;
    };

    if (!Array.isArray(student_user_ids) || student_user_ids.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "At least one student_user_id is required" },
        { status: 400 }
      );
    }

    if (program_id === undefined && faculty_supervisor_id === undefined) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Provide at least one of program_id or faculty_supervisor_id" },
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

    // Build update payload. NULL is allowed for both fields (means "clear").
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (program_id !== undefined) {
      updatePayload.program_id = program_id || null;
    }
    if (faculty_supervisor_id !== undefined) {
      updatePayload.faculty_supervisor_id = faculty_supervisor_id || null;
    }

    // Update the students table for the selected user_ids. Use the caller's
    // department_id as an extra filter so cross-department students in the
    // array are silently skipped (defense in depth, even though RLS would
    // also block the update).
    let query = supabase
      .from("students")
      .update(updatePayload)
      .in("user_id", student_user_ids);

    if (profile.role === "department_coordinator") {
      query = query.eq("department_id", profile.department_id);
    }

    const { data: updated, error: updateErr } = await query.select("user_id");

    if (updateErr) {
      console.error("[bulk-assign] update error:", updateErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to update students: ${updateErr.message}` },
        { status: 500 }
      );
    }

    const updatedCount = updated?.length || 0;
    const skippedCount = student_user_ids.length - updatedCount;

    // Best-effort: send a notification to each student whose supervisor
    // changed, so they know who their new supervisor is.
    if (faculty_supervisor_id && updatedCount > 0) {
      try {
        const { data: supervisorProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", faculty_supervisor_id)
          .maybeSingle();

        const supervisorName = supervisorProfile?.full_name || "a new supervisor";

        const notifRows = (updated || []).map((row: any) => ({
          user_id: row.user_id,
          sender_id: user.id,
          title: "Faculty supervisor assigned",
          message: `You have been assigned to ${supervisorName} as your faculty supervisor.`,
          category: "system",
          priority: "medium",
          is_read: false,
        }));

        await supabase.from("notifications").insert(notifRows);
      } catch (notifErr) {
        console.warn("[bulk-assign] notifications failed (non-fatal):", notifErr);
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
        errors: [] as string[],
      },
      message: `Updated ${updatedCount} student(s)`,
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
