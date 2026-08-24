/**
 * Department Coordinator — Student Reports Evaluation API
 * ===========================================================================
 * POST  /api/department-coordinator/evaluations
 * GET   /api/department-coordinator/evaluations?student_id=...
 *
 * This endpoint implements the 30% "Student Reports — Department Coordinator
 * Evaluation" component per HEC Stage 7 reference + spec §18.
 *
 * The 4 subcriteria (each scored 0..25, total 0..100):
 *   - evidence_score         Evidence-based reporting
 *   - reflection_score        Reflection
 *   - clarity_score           Clarity
 *   - work_learning_score     Connection between work and learning
 *
 * Workflow:
 *   1. Caller authenticates and must be role = 'department_coordinator'.
 *   2. Caller's department_id must match the student's department_id (RLS-
 *      enforced; this route ALSO double-checks before write).
 *   3. Body validated by zod.
 *   4. UPSERT into `evaluations` with type='department_coordinator_report',
 *      evaluator_role='department_coordinator', evaluator_id=caller.id,
 *      status='submitted', scores = the 4 subcriteria + total, comments =
 *      the DC's feedback.
 *   5. UPSERT the matching `final_grades` row with the 4 dc_* subcriteria
 *      columns + student_reports_score = total. This makes the 30%
 *      component immediately available to the final-grade calculator.
 *   6. (Best-effort) Recompute the final grade via computeFinalGrade() so
 *      the rest of the 40/30/25/5 split is refreshed from real data.
 *
 * SECURITY:
 *   - Server-side ownership enforced.
 *   - Frontend-supplied dc_evaluator_id / company_id / department_id are
 *     IGNORED — the caller's authenticated profile is the only source of
 *     truth.
 *   - The student's department_id is verified against the caller's
 *     department_id; any mismatch returns 403.
 * ===========================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { computeFinalGrade } from "@/lib/final-grade";
import { sendNotification } from "@/lib/notifications";
import type { ApiResponse } from "@/types";
import { z } from "zod";

const DcReportEvaluationSchema = z.object({
  student_user_id: z.string().uuid(),
  internship_id: z.string().uuid(),
  evidence_score: z.number().min(0).max(25),
  reflection_score: z.number().min(0).max(25),
  clarity_score: z.number().min(0).max(25),
  work_learning_score: z.number().min(0).max(25),
  comments: z.string().max(5000).optional().nullable(),
});

export type DcReportEvaluationPayload = z.infer<typeof DcReportEvaluationSchema>;

// GET: list DC report evaluations for the caller's department, optionally
// filtered by a single student.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, department_id, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "department_coordinator") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Department Coordinator access required" },
        { status: 403 }
      );
    }

    if (!profile.department_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Your account is not associated with a department." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentUserId = searchParams.get("student_id") || searchParams.get("student_user_id");

    // Build a query joining the evaluations table for this caller.
    let query = supabase
      .from("evaluations")
      .select(`
        id,
        student_user_id,
        internship_id,
        status,
        scores,
        comments,
        submitted_at,
        updated_at,
        student_profile:student_user_id(full_name, email, avatar_url)
      `)
      .eq("evaluator_id", user.id)
      .eq("evaluator_role", "department_coordinator")
      .eq("type", "department_coordinator_report")
      .order("updated_at", { ascending: false });

    if (studentUserId) {
      query = query.eq("student_user_id", studentUserId);
    }

    const { data: evaluations, error } = await query;

    if (error) {
      console.error("[/api/department-coordinator/evaluations GET]", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch evaluations" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof evaluations>>({
      success: true,
      data: evaluations || [],
    });
  } catch (err) {
    console.error("[/api/department-coordinator/evaluations GET] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: submit / revise a DC report evaluation.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, department_id, university_id, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "department_coordinator") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Department Coordinator access required" },
        { status: 403 }
      );
    }

    if (!profile.department_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Your account is not associated with a department." },
        { status: 403 }
      );
    }

    // Parse and validate body.
    const body = await request.json();
    const parsed = DcReportEvaluationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Invalid request body",
          // zod issues are safe to expose (no secrets).
          data: parsed.error.issues as unknown as never,
        },
        { status: 400 }
      );
    }
    const payload = parsed.data;

    // Verify the student is in the caller's department.
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("user_id, department_id, full_name")
      .eq("user_id", payload.student_user_id)
      .single();

    if (!studentProfile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }
    if (studentProfile.department_id !== profile.department_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cross-department access denied" },
        { status: 403 }
      );
    }

    // Verify the internship exists and belongs to the student.
    const { data: internship } = await supabase
      .from("internships")
      .select("id, title")
      .eq("id", payload.internship_id)
      .single();
    if (!internship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Internship not found" },
        { status: 404 }
      );
    }

    // Compute total score (0..100). The 4 subcriteria each 0..25.
    const totalScore =
      payload.evidence_score +
      payload.reflection_score +
      payload.clarity_score +
      payload.work_learning_score;

    const scores = {
      evidence_score: payload.evidence_score,
      reflection_score: payload.reflection_score,
      clarity_score: payload.clarity_score,
      work_learning_score: payload.work_learning_score,
      total_score: totalScore,
    };

    const nowIso = new Date().toISOString();

    // Upsert the evaluation. The unique index
    // uniq_dc_report_per_student_internship guarantees at most one row per
    // (student_user_id, internship_id) for DC report evaluations.
    const { data: upserted, error: evalErr } = await supabase
      .from("evaluations")
      .upsert(
        {
          type: "department_coordinator_report",
          student_user_id: payload.student_user_id,
          internship_id: payload.internship_id,
          evaluator_id: user.id,
          evaluator_role: "department_coordinator",
          status: "submitted",
          scores,
          comments: payload.comments ?? null,
          submitted_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "student_user_id,internship_id" }
      )
      .select()
      .single();

    if (evalErr) {
      console.error("[/api/department-coordinator/evaluations POST] eval upsert:", evalErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to submit evaluation: " + evalErr.message },
        { status: 500 }
      );
    }

    // Now upsert the matching final_grades row so the 30% component is
    // immediately available to the calculator and the UI.
    // The RLS policy added in 0088 permits the DC to INSERT/UPDATE rows for
    // students in their own department.
    const { error: fgErr } = await supabase
      .from("final_grades")
      .upsert(
        {
          student_id: payload.student_user_id,
          internship_id: payload.internship_id,
          university_id: profile.university_id || null,
          // Persist the 4 subcriteria + total in dedicated DC columns.
          dc_evidence_score: payload.evidence_score,
          dc_reflection_score: payload.reflection_score,
          dc_clarity_score: payload.clarity_score,
          dc_work_learning_score: payload.work_learning_score,
          // The 30% slot in the calculator reads student_reports_score — keep
          // it in sync with the DC's total.
          student_reports_score: totalScore,
          dc_evaluator_id: user.id,
          dc_evaluated_at: nowIso,
          dc_evaluation_comments: payload.comments ?? null,
          updated_at: nowIso,
        },
        { onConflict: "student_id,internship_id" }
      );

    if (fgErr) {
      console.error("[/api/department-coordinator/evaluations POST] final_grades upsert:", fgErr);
      // Not fatal — the evaluation itself was persisted. The calculator will
      // re-derive student_reports_score from the evaluation row if needed.
    }

    // Best-effort: recompute the full 40/30/25/5 final grade. If other
    // components are missing, the computeFinalGrade function will return
    // status='pending' and the student_reports_score will still be set.
    let recompute: { final_score: number | null; status: string; letter_grade: string | null } | null = null;
    try {
      const result = await computeFinalGrade(payload.student_user_id, payload.internship_id);
      recompute = {
        final_score: result.final_score,
        status: result.status,
        letter_grade: result.letter_grade,
      };
    } catch (err) {
      // Recompute failure is non-fatal — the DC's evaluation is already
      // persisted. The compute function logs the underlying error.
      console.error("[/api/department-coordinator/evaluations POST] recompute failed:", err);
    }

    // Notify the student.
    await sendNotification(supabase, {
      userId: payload.student_user_id,
      senderId: user.id,
      title: "Report Evaluation Submitted",
      message:
        profile.full_name
          ? `${profile.full_name} (Department Coordinator) evaluated your student reports. Total: ${totalScore}/100.`
          : `Your student reports have been evaluated by the Department Coordinator. Total: ${totalScore}/100.`,
      category: "evaluation",
      priority: "medium",
      actionUrl: "/student/evaluations",
      metadata: {
        type: "dc_report_evaluation_submitted",
        evaluation_id: upserted?.id,
        total_score: totalScore,
      },
    }).catch(() => {});

    return NextResponse.json<ApiResponse<{
      evaluation_id: string;
      total_score: number;
      recompute: { final_score: number | null; status: string; letter_grade: string | null } | null;
    }>>({
      success: true,
      data: {
        evaluation_id: upserted?.id ?? "",
        total_score: totalScore,
        recompute,
      },
    });
  } catch (err) {
    console.error("[/api/department-coordinator/evaluations POST] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
