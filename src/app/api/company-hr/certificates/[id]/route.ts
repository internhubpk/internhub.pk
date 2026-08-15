import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { buildVerificationUrl } from "@/lib/site-url";

/**
 * /api/company-hr/certificates/[id]
 *
 * PATCH  — revoke or re-issue a certificate.
 *          Body: { status: "revoked" | "issued" }
 *          Only the company that issued the certificate can change its status.
 *          Revoking doesn't delete the row (audit trail); it sets status='revoked'
 *          so the public verification page shows "REVOKED".
 *
 * DELETE — same as PATCH {status:"revoked"}. Provided as a convenience for
 *          UIs that use a trash-can icon. We never hard-delete because the
 *          certificate_number + verification_code may already be embedded in
 *          the student's LinkedIn profile or printed copy.
 */

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, company_id, role, full_name")
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
  return { profile, errorResponse: null };
}

async function changeStatus(request: NextRequest, context: { params: Promise<{ id: string }> }, newStatus: "revoked" | "issued") {
  try {
    const { id } = await context.params;
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

    // Fetch the certificate, scoped to this company.
    const { data: cert, error: certErr } = await supabase
      .from("certificates")
      .select("id, company_id, student_user_id, certificate_number, title, status")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (certErr) {
      console.error("[/api/company-hr/certificates/[id]] fetch error:", certErr);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: certErr.message } },
        { status: 500 }
      );
    }
    if (!cert) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Certificate not found or does not belong to your company" } },
        { status: 404 }
      );
    }

    if (cert.status === newStatus) {
      return NextResponse.json({
        success: true,
        data: cert,
        message: `Certificate is already ${newStatus}`,
      });
    }

    const { data: updated, error: updErr } = await supabase
      .from("certificates")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, title, certificate_number, verification_code, verification_url, file_url, issued_at, linkedin_added_at")
      .single();

    if (updErr) {
      console.error("[/api/company-hr/certificates/[id]] update error:", updErr);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: updErr.message } },
        { status: 500 }
      );
    }

    // Notify the student about the status change.
    await supabase.from("notifications").insert({
      user_id: cert.student_user_id,
      sender_id: user.id,
      title: newStatus === "revoked" ? "Certificate revoked" : "Certificate re-issued",
      message:
        newStatus === "revoked"
          ? `Your certificate "${cert.title}" (#${cert.certificate_number}) has been revoked. Please contact your company HR for details.`
          : `Your certificate "${cert.title}" (#${cert.certificate_number}) has been re-issued and is now valid.`,
      category: "certificate",
      priority: newStatus === "revoked" ? "high" : "normal",
      is_read: false,
    });

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: newStatus === "revoked" ? "revoke_certificate" : "reissue_certificate",
      entity_type: "certificate",
      entity_id: id,
      old_values: { status: cert.status },
      new_values: { status: newStatus },
    });

    return NextResponse.json({
      success: true,
      // Always regenerate the verification URL from the code via the
      // canonical site-URL helper. The DB-stored `verification_url`
      // may be stale (rows issued before this fix contain Vercel
      // deployment URLs that break public verification).
      data: updated
        ? {
            ...updated,
            verification_url: updated.verification_code
              ? buildVerificationUrl(updated.verification_code)
              : updated.verification_url,
          }
        : updated,
      message: `Certificate ${newStatus === "revoked" ? "revoked" : "re-issued"}`,
    });
  } catch (err) {
    console.error("[/api/company-hr/certificates/[id]] unhandled:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}));
    const status = (body as { status?: string }).status;
    if (status !== "revoked" && status !== "issued") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "status must be 'revoked' or 'issued'" } },
        { status: 400 }
      );
    }
    return changeStatus(request, context, status);
  } catch (err) {
    console.error("[/api/company-hr/certificates/[id]] PATCH unhandled:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return changeStatus(request, context, "revoked");
}
