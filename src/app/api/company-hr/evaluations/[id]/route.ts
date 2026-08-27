import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * PUT /api/company-hr/evaluations/[id]
 * Edit an existing final evaluation (drafts and submitted ones).
 *
 * DELETE /api/company-hr/evaluations/[id]
 * Delete an evaluation. Blocked when a certificate has been issued from it
 * (revoke the certificate first).
 *
 * Both verify the evaluation belongs to a student_internship of the
 * caller's company (HR scope).
 */

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, role, company_id")
    .eq("user_id", userId)
    .single();
  if (!profile || profile.role !== "company_hr" || !profile.company_id) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Company HR access required" } },
        { status: 403 }
      ),
    };
  }
  return { profile, errorResponse: null as NextResponse | null };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evaluationId } = await params;
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

    // Fetch the evaluation + verify company scope via student_internships.
    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("id, student_internship_id, student_user_id, internship_id, status, type, evaluator_role")
      .eq("id", evaluationId)
      .maybeSingle();

    if (!evaluation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Evaluation not found" } },
        { status: 404 }
      );
    }

    if (evaluation.student_internship_id) {
      const { data: si } = await supabase
        .from("student_internships")
        .select("id, company_id")
        .eq("id", evaluation.student_internship_id)
        .maybeSingle();
      if (!si || si.company_id !== profile.company_id) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "This evaluation belongs to another company" } },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const {
      scores = {},
      comments,
      strengths,
      areas_for_improvement,
      recommendation,
      status,
    } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const scoreKeys = Object.keys(scores);
    if (scoreKeys.length > 0) {
      const existing = (evaluation as { scores?: Record<string, unknown> }).scores || {};
      updates.scores = {
        ...existing,
        overall: Number(scores.overall) || 0,
        technical: Number(scores.technical) || 0,
        attitude: Number(scores.attitude) || 0,
        punctuality: Number(scores.punctuality) || 0,
        quality: Number(scores.quality) || 0,
        strengths: strengths ?? existing.strengths ?? "",
        areas_for_improvement: areas_for_improvement ?? existing.areas_for_improvement ?? "",
        recommendation: recommendation ?? existing.recommendation ?? "",
      };
      if (scores.overall !== undefined) updates.rating = Number(scores.overall) || 0;
    } else {
      // allow textual-only edits
      if (strengths !== undefined || areas_for_improvement !== undefined || recommendation !== undefined) {
        const existing = (evaluation as { scores?: Record<string, unknown> }).scores || {};
        updates.scores = {
          ...existing,
          ...(strengths !== undefined ? { strengths } : {}),
          ...(areas_for_improvement !== undefined ? { areas_for_improvement } : {}),
          ...(recommendation !== undefined ? { recommendation } : {}),
        };
      }
    }
    if (comments !== undefined) updates.comments = comments || null;
    if (status === "in_progress" || status === "submitted") {
      updates.status = status;
      updates.submitted_at = status === "submitted" ? new Date().toISOString() : null;
    }

    const { data: updated, error: updateError } = await supabase
      .from("evaluations")
      .update(updates)
      .eq("id", evaluationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating evaluation:", updateError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update evaluation" } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "company_hr.update_evaluation",
      entity_type: "evaluation",
      entity_id: evaluationId,
      new_values: { status: (updated as { status?: string }).status },
    });

    return NextResponse.json({ success: true, data: updated, message: "Evaluation updated" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evaluationId } = await params;
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

    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("id, student_internship_id, student_user_id, internship_id, status")
      .eq("id", evaluationId)
      .maybeSingle();

    if (!evaluation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Evaluation not found" } },
        { status: 404 }
      );
    }

    if (evaluation.student_internship_id) {
      const { data: si } = await supabase
        .from("student_internships")
        .select("id, company_id")
        .eq("id", evaluation.student_internship_id)
        .maybeSingle();
      if (!si || si.company_id !== profile.company_id) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "This evaluation belongs to another company" } },
          { status: 403 }
        );
      }
    }

    // Block deleting evaluations that already produced a certificate.
    // (certificates link via student + internship + issued metadata.)
    const { data: certificate } = await supabase
      .from("certificates")
      .select("id, certificate_number, status")
      .eq("student_user_id", evaluation.student_user_id)
      .eq("internship_id", evaluation.internship_id)
      .eq("status", "issued")
      .limit(1)
      .maybeSingle();

    if (certificate) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: `Certificate ${certificate.certificate_number} was issued from this evaluation. Revoke or delete the certificate first.`,
          },
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("evaluations")
      .delete()
      .eq("id", evaluationId);

    if (deleteError) {
      console.error("Error deleting evaluation:", deleteError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to delete evaluation" } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "company_hr.delete_evaluation",
      entity_type: "evaluation",
      entity_id: evaluationId,
      old_values: { status: evaluation.status },
      new_values: null,
    });

    return NextResponse.json({ success: true, message: "Evaluation deleted" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
