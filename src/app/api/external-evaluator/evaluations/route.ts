import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/external-evaluator/evaluations
 *
 * Returns everything the External Evaluator dashboard needs:
 *   - assigned: active student_internships where external_evaluator_id = me
 *               (student profile, internship title, company, week range)
 *   - evaluations: evaluations the evaluator has written
 *               (evaluator_id = me AND evaluator_role = 'external_evaluator')
 *
 * POST /api/external-evaluator/evaluations
 *   Create OR update (upsert) the evaluator's evaluation for one of their
 *   ASSIGNED students.
 *   body: {
 *     student_internship_id, student_user_id, internship_id,
 *     type: 'final' | 'midterm',
 *     scores: { overall, technical, attitude, punctuality, quality },
 *     comments?
 *   }
 *
 * DELETE /api/external-evaluator/evaluations?id=<uuid>
 *   Delete one of the evaluator's own evaluations.
 */

async function requireEvaluator() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, role, full_name")
    .eq("user_id", user.id)
    .single();
  if (!profile || profile.role !== "external_evaluator") {
    return { error: NextResponse.json({ success: false, error: "Forbidden: External Evaluator access required" }, { status: 403 }) };
  }
  return { user, profile, supabase, error: null };
}

export async function GET() {
  const ctx = await requireEvaluator();
  if (ctx.error) return ctx.error;
  const { user, supabase } = ctx;

  try {
    // 1. Assigned students (active placements where I am the evaluator).
    //    NOTE: student_internship_status enum values are
    //    assigned|active|paused|completed|terminated — "pending" is NOT a
    //    valid value and made this query fail with a 500 for every caller.
    const { data: assignments, error: assignError } = await supabase
      .from("student_internships")
      .select(
        `
        id,
        student_user_id,
        internship_id,
        status,
        start_date,
        end_date,
        student:student_user_id(full_name, email, avatar_url),
        internship:internship_id(title, duration_weeks, company:companies(name))
      `
      )
      .eq("external_evaluator_id", user.id)
      .in("status", ["assigned", "active", "paused", "completed"])
      .order("created_at", { ascending: false });

    if (assignError) throw assignError;

    // 2. My evaluations.
    const { data: evaluations, error: evalError } = await supabase
      .from("evaluations")
      .select("id, type, status, rating, scores, comments, submitted_at, created_at, student_user_id, internship_id, student_internship_id")
      .eq("evaluator_id", user.id)
      .eq("evaluator_role", "external_evaluator")
      .order("created_at", { ascending: false });

    if (evalError) throw evalError;

    return NextResponse.json({ success: true, data: { assignments: assignments || [], evaluations: evaluations || [] } });
  } catch (error: any) {
    console.error("[GET /api/external-evaluator/evaluations]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireEvaluator();
  if (ctx.error) return ctx.error;
  const { user, supabase } = ctx;

  try {
    const body = await request.json();
    const {
      student_internship_id,
      student_user_id,
      internship_id,
      type = "final",
      scores = {},
      comments,
    } = body;

    if (!student_internship_id || !student_user_id || !internship_id) {
      return NextResponse.json(
        { success: false, error: "student_internship_id, student_user_id and internship_id are required" },
        { status: 400 }
      );
    }

    // Verify the placement is ASSIGNED to this evaluator.
    const { data: si } = await supabase
      .from("student_internships")
      .select("id, student_user_id, internship_id, external_evaluator_id")
      .eq("id", student_internship_id)
      .maybeSingle();

    if (!si || si.external_evaluator_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "This student is not assigned to you" },
        { status: 403 }
      );
    }

    const nowIso = new Date().toISOString();
    const scoresPayload: Record<string, unknown> = {
      overall: Number(scores.overall) || 0,
      technical: Number(scores.technical) || 0,
      attitude: Number(scores.attitude) || 0,
      punctuality: Number(scores.punctuality) || 0,
      quality: Number(scores.quality) || 0,
    };
    const rating = Number(scores.overall) || 0;

    // Upsert: one evaluation per evaluator + placement + type.
    const { data: existing } = await supabase
      .from("evaluations")
      .select("id")
      .eq("student_internship_id", student_internship_id)
      .eq("evaluator_id", user.id)
      .eq("evaluator_role", "external_evaluator")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let evaluation;
    if (existing?.id) {
      const { data: updated, error: updateErr } = await supabase
        .from("evaluations")
        .update({
          type: type === "midterm" ? "midterm" : "final",
          scores: scoresPayload,
          comments: comments || null,
          rating,
          status: "submitted",
          submitted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      evaluation = updated;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("evaluations")
        .insert({
          type: type === "midterm" ? "midterm" : "final",
          student_user_id,
          internship_id,
          student_internship_id,
          evaluator_id: user.id,
          evaluator_role: "external_evaluator",
          status: "submitted",
          scores: scoresPayload,
          comments: comments || null,
          rating,
          submitted_at: nowIso,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      evaluation = inserted;
    }

    // Notify the student.
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(supabase, {
      userId: student_user_id,
      senderId: user.id,
      title: "External evaluation submitted",
      message: "An external evaluation of your internship has been submitted. View it in your Evaluations page.",
      category: "evaluation",
      priority: "medium",
      actionUrl: "/student/evaluations",
      metadata: { type: "evaluation_submitted", evaluation_id: evaluation.id },
    });

    return NextResponse.json({ success: true, data: evaluation, message: "Evaluation submitted" }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/external-evaluator/evaluations]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireEvaluator();
  if (ctx.error) return ctx.error;
  const { user, supabase } = ctx;

  try {
    const { searchParams } = new URL(request.url);
    const evalId = searchParams.get("id");
    if (!evalId) {
      return NextResponse.json({ success: false, error: "Missing ?id=<evaluation uuid>" }, { status: 400 });
    }

    // Ownership: only the evaluator's own rows.
    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("id, evaluator_id, evaluator_role, status")
      .eq("id", evalId)
      .maybeSingle();

    if (!evaluation) {
      return NextResponse.json({ success: false, error: "Evaluation not found" }, { status: 404 });
    }
    if (evaluation.evaluator_id !== user.id || evaluation.evaluator_role !== "external_evaluator") {
      return NextResponse.json({ success: false, error: "You can only delete your own evaluations" }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from("evaluations")
      .delete()
      .eq("id", evalId)
      .eq("evaluator_id", user.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: "Evaluation deleted" });
  } catch (error: any) {
    console.error("[DELETE /api/external-evaluator/evaluations]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
