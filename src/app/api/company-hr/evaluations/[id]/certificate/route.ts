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

function generateCertificateNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IH-${ts}-${rnd}`;
}

// POST /api/company-hr/evaluations/[id]/certificate — issue (or re-issue) a certificate
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    // Look up the evaluation, ensure it belongs to the company via its
    // student_internship_id.
    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("id, student_user_id, internship_id, student_internship_id, status, rating")
      .eq("id", id)
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
        .eq("company_id", profile.company_id)
        .maybeSingle();
      if (!si) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Evaluation does not belong to your company" } },
          { status: 403 }
        );
      }
    }

    // Idempotency: if a certificate already exists for this student+internship,
    // return it instead of creating a duplicate.
    const { data: existing } = await supabase
      .from("certificates")
      .select("*")
      .eq("student_user_id", evaluation.student_user_id)
      .eq("internship_id", evaluation.internship_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: "Certificate already issued",
      });
    }

    const { data: internship } = await supabase
      .from("internships")
      .select("id, title")
      .eq("id", evaluation.internship_id)
      .maybeSingle();

    const certNumber = generateCertificateNumber();
    const title = `Certificate of Completion — ${internship?.title || "Internship"}`;

    const { data: certificate, error: certError } = await supabase
      .from("certificates")
      .insert({
        student_user_id: evaluation.student_user_id,
        internship_id: evaluation.internship_id,
        company_id: profile.company_id,
        title,
        certificate_number: certNumber,
        issued_by: user.id,
        status: "issued",
        metadata: {
          evaluation_id: evaluation.id,
          rating: evaluation.rating,
          issued_by_company: profile.company_id,
        },
      })
      .select()
      .single();

    if (certError) {
      console.error("Error creating certificate:", certError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to issue certificate" } },
        { status: 500 }
      );
    }

    // Notify the student
    await supabase.from("notifications").insert({
      user_id: evaluation.student_user_id,
      sender_id: user.id,
      title: "Certificate issued",
      message: `Your certificate (${certNumber}) has been issued. View it in your Certificates page.`,
      category: "certificate",
      priority: "high",
      is_read: false,
    });

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "issue_certificate",
      entity_type: "certificate",
      entity_id: certificate.id,
      new_values: { student_user_id: evaluation.student_user_id, internship_id: evaluation.internship_id },
    });

    return NextResponse.json(
      { success: true, data: certificate, message: "Certificate issued" },
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
