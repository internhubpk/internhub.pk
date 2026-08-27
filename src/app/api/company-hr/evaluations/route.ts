import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role, first_name, last_name, full_name")
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

// GET /api/company-hr/evaluations — list final evaluations for company interns
// Returns evaluations where the evaluator is a site_supervisor within the
// company, joined with student + internship + supervisor.
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

    // Fetch all student_internships for the company to scope evaluations.
    const { data: companySIs } = await supabase
      .from("student_internships")
      .select("id, student_user_id, internship_id, site_supervisor_id, status")
      .eq("company_id", profile.company_id);

    const siIds = (companySIs || []).map((r) => r.id);
    if (siIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch ALL evaluations for these student_internships. The previous
    // filter `type IN (final, company_evaluation, supervisor_evaluation)`
    // excluded the 'weekly' and 'task' evaluation types — which are the
    // actual types site/faculty supervisors create during the internship.
    // Techify has 2 real evals (1 weekly + 1 task, both rating=5.00) that
    // were being hidden by the old filter.
    const { data: evals, error } = await supabase
      .from("evaluations")
      .select("*")
      .in("student_internship_id", siIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching evaluations:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch evaluations" } },
        { status: 500 }
      );
    }

    // Resolve student / internship / supervisor / certificate
    const studentIds = Array.from(new Set((evals || []).map((e: any) => e.student_user_id).filter(Boolean)));
    const internshipIds = Array.from(new Set((evals || []).map((e: any) => e.internship_id).filter(Boolean)));
    const evaluatorIds = Array.from(new Set((evals || []).map((e: any) => e.evaluator_id).filter(Boolean)));

    const [stuRes, intRes, evalRes, certRes] = await Promise.all([
      studentIds.length
        ? supabase
            .from("profiles")
            .select("user_id, full_name, first_name, last_name, email, avatar_url, university_id, department_id")
            .in("user_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      internshipIds.length
        ? supabase.from("internships").select("id, title, duration_weeks, start_date, end_date").in("id", internshipIds)
        : Promise.resolve({ data: [], error: null }),
      evaluatorIds.length
        ? supabase
            .from("profiles")
            .select("user_id, full_name, first_name, last_name")
            .in("user_id", evaluatorIds)
        : Promise.resolve({ data: [], error: null }),
      // certificates for these SIs / students
      studentIds.length
        ? supabase
            .from("certificates")
            .select("id, student_user_id, internship_id, status, certificate_number, issued_at, file_url")
            .in("student_user_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const studentMap = new Map((stuRes.data || []).map((s: any) => [s.user_id, s]));
    const internshipMap = new Map((intRes.data || []).map((i: any) => [i.id, i]));
    const evaluatorMap = new Map((evalRes.data || []).map((e: any) => [e.user_id, e]));
    const certMap = new Map(
      (certRes.data || []).map((c: any) => [`${c.student_user_id}:${c.internship_id}`, c])
    );

    const enriched = (evals || []).map((e: any) => {
      const scores = (e.scores && typeof e.scores === "object") ? e.scores : {};
      const student = studentMap.get(e.student_user_id);
      const internship = internshipMap.get(e.internship_id);
      const evaluator = evaluatorMap.get(e.evaluator_id);
      const certificate = certMap.get(`${e.student_user_id}:${e.internship_id}`);
      return {
        id: e.id,
        type: e.type,
        status: e.status,
        rating: e.rating,
        scores,
        comments: e.comments,
        submitted_at: e.submitted_at,
        created_at: e.created_at,
        updated_at: e.updated_at,
        student_user_id: e.student_user_id,
        internship_id: e.internship_id,
        student_internship_id: e.student_internship_id,
        evaluator_id: e.evaluator_id,
        evaluator_role: e.evaluator_role,
        // convenience
        student_name: student?.full_name || [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "",
        student_email: student?.email || "",
        student_avatar: student?.avatar_url || null,
        internship_title: internship?.title || "",
        internship_duration: internship?.duration_weeks || null,
        internship_start: internship?.start_date || null,
        internship_end: internship?.end_date || null,
        evaluator_name:
          evaluator?.full_name || [evaluator?.first_name, evaluator?.last_name].filter(Boolean).join(" ") || "",
        certificate_issued: certificate?.status === "issued",
        certificate_id: certificate?.id || null,
        certificate_number: certificate?.certificate_number || null,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// POST /api/company-hr/evaluations — submit / save draft of a final evaluation
// body: {
//   student_internship_id, student_user_id, internship_id,
//   scores: { overall, technical, attitude, punctuality, quality } (0-5),
//   comments, strengths, areas_for_improvement, recommendation,
//   status: 'submitted' | 'in_progress' (=draft)
// }
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      student_internship_id,
      student_user_id,
      internship_id,
      scores = {},
      comments,
      strengths,
      areas_for_improvement,
      recommendation,
      status = "submitted",
    } = body;

    if (!student_internship_id || !student_user_id || !internship_id) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "student_internship_id, student_user_id, internship_id are required",
          },
        },
        { status: 400 }
      );
    }

    // Verify the student_internship belongs to this company
    const { data: si } = await supabase
      .from("student_internships")
      .select("id, company_id")
      .eq("id", student_internship_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!si) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Intern placement not found in your company" } },
        { status: 404 }
      );
    }

    // Build scores payload (stored as jsonb)
    const scoresPayload: Record<string, any> = {
      overall: Number(scores.overall) || 0,
      technical: Number(scores.technical) || 0,
      attitude: Number(scores.attitude) || 0,
      punctuality: Number(scores.punctuality) || 0,
      quality: Number(scores.quality) || 0,
      strengths: strengths || "",
      areas_for_improvement: areas_for_improvement || "",
      recommendation: recommendation || "",
    };

    const evalStatus = status === "in_progress" ? "in_progress" : "submitted";
    const nowIso = new Date().toISOString();
    const overallRating = Number(scores.overall) || 0;

    // UPSERT semantics: if this HR already has a final evaluation for the
    // same placement, UPDATE it instead of inserting a duplicate row.
    // (Previously every "Evaluate" click created a new row.)
    const { data: existingEval } = await supabase
      .from("evaluations")
      .select("id")
      .eq("student_internship_id", student_internship_id)
      .eq("evaluator_role", "company_hr")
      .eq("type", "final")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let evaluation: Record<string, unknown> | null = null;
    let insertError: { message?: string } | null = null;

    if (existingEval?.id) {
      const { data: updated, error: updateErr } = await supabase
        .from("evaluations")
        .update({
          scores: scoresPayload,
          comments: comments || null,
          rating: overallRating,
          status: evalStatus,
          submitted_at: evalStatus === "submitted" ? nowIso : null,
          updated_at: nowIso,
        })
        .eq("id", existingEval.id)
        .select()
        .single();
      evaluation = updated;
      insertError = updateErr;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("evaluations")
        .insert({
          type: "final",
          student_user_id,
          internship_id,
          student_internship_id,
          evaluator_id: user.id,
          evaluator_role: "company_hr",
          status: evalStatus,
          scores: scoresPayload,
          comments: comments || null,
          rating: overallRating,
          submitted_at: evalStatus === "submitted" ? nowIso : null,
        })
        .select()
        .single();
      evaluation = inserted;
      insertError = insertErr;
    }

    if (insertError || !evaluation) {
      console.error("Error saving evaluation:", insertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to save evaluation" } },
        { status: 500 }
      );
    }

    // Notify student — uses the shared sendNotification helper so the
    // notification is also delivered via web push to subscribed devices.
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(supabase, {
      userId: student_user_id,
      senderId: user.id,
      title: evalStatus === "submitted" ? "Final evaluation submitted" : "Evaluation draft saved",
      message:
        evalStatus === "submitted"
          ? "Your final evaluation has been submitted by the company. View details in your Evaluations page."
          : "A draft of your final evaluation has been saved by the company.",
      category: "evaluation",
      priority: "medium",
      actionUrl: "/student/evaluations",
      metadata: { type: "evaluation_submitted", evaluation_id: evaluation.id, status: evalStatus },
    });

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: evalStatus === "submitted" ? "submit_final_evaluation" : "save_evaluation_draft",
      entity_type: "evaluation",
      entity_id: evaluation.id,
      new_values: { student_user_id, internship_id, rating: overallRating },
    });

    return NextResponse.json(
      {
        success: true,
        data: evaluation,
        message: evalStatus === "submitted" ? "Final evaluation submitted" : "Draft saved",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
