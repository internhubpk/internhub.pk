import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { buildVerificationUrl, buildVerificationUrlFromRequest } from "@/lib/site-url";

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

    // VERIFICATION CODE / URL GENERATION (added 2026-08-15):
    //   Previously this legacy route created a certificate row WITHOUT
    //   verification_code or verification_url. That meant certificates
    //   issued via the "Approve & Issue Certificate" button on the
    //   company-hr evaluations page were unverifiable via /verify/[code]
    //   and the student couldn't add them to LinkedIn. We now generate
    //   a unique verification_code (same IH-XXXX-XXXX format as the
    //   upload-based company-hr certificate route) and the verification_url
    //   using the canonical site URL helper.
    //
    //   This legacy route is still called from the evaluations UI; if it
    //   is later removed in favour of the upload-based route, this fix
    //   becomes a no-op.
    const requestOrigin = new URL(request.url).origin;

    let certificate: any = null;
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const part = () =>
        Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".charAt(b % 32))
          .join("")
          .slice(0, 4);
      const verification_code = `IH-${part()}-${part()}`;
      const verification_url = buildVerificationUrlFromRequest(
        verification_code,
        requestOrigin
      );

      const { data, error: certError } = await supabase
        .from("certificates")
        .insert({
          student_user_id: evaluation.student_user_id,
          internship_id: evaluation.internship_id,
          company_id: profile.company_id,
          title,
          certificate_number: certNumber,
          issued_by: user.id,
          status: "issued",
          verification_code,
          verification_url,
          metadata: {
            evaluation_id: evaluation.id,
            rating: evaluation.rating,
            issued_by_company: profile.company_id,
            issued_via: "company_hr_evaluations_legacy",
          },
        })
        .select()
        .single();

      if (certError) {
        if (certError.code === "23505") {
          lastError = certError;
          continue;
        }
        console.error("Error creating certificate:", certError);
        return NextResponse.json(
          { error: { code: "DATABASE_ERROR", message: "Failed to issue certificate" } },
          { status: 500 }
        );
      }

      certificate = data;
      break;
    }

    if (!certificate) {
      console.error(
        "[/api/company-hr/evaluations/[id]/certificate] verification_code collision after 5 attempts:",
        lastError
      );
      return NextResponse.json(
        { error: { code: "CODE_COLLISION", message: "Failed to generate a unique verification code" } },
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
      {
        success: true,
        // Always regenerate the verification URL from the code via
        // the canonical site-URL helper. The DB-stored
        // `verification_url` may be stale (rows issued before this
        // fix contain Vercel deployment URLs that point to a
        // protected deployment and break public verification).
        data: certificate
          ? {
              ...certificate,
              verification_url: certificate.verification_code
                ? buildVerificationUrl(certificate.verification_code)
                : certificate.verification_url,
            }
          : certificate,
        message: "Certificate issued"
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
