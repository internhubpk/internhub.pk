import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  buildVerificationUrl,
  buildVerificationUrlFromRequest,
} from "@/lib/site-url";

/**
 * /api/company-hr/certificates
 *
 * GET  — list certificates issued by the caller's company.
 * POST — upload a new certificate (multipart/form-data):
 *        fields: student_user_id, internship_id, title, issue_date?,
 *                certificate_number? (auto-generated if omitted)
 *        file:   file (PDF/PNG/JPEG, up to 10MB)
 *
 * The certificate is stored in the `certificates` Supabase Storage bucket
 * under the path "<company_hr_user_id>/<timestamp>-<filename>". A
 * verification_code is generated, and the verification_url is built from
 * the app's public URL.
 *
 * This endpoint REPLACES the old "issue certificate" route that lived at
 * /api/company-hr/evaluations/[id]/certificate. That route created a
 * certificate record but never uploaded a file and never produced a
 * verification URL — so the resulting certificate couldn't actually be
 * verified or added to LinkedIn. This new route does both.
 */

/**
 * Resolved inside each request so we can use the request origin as a
 * fallback when NEXT_PUBLIC_APP_URL is unset (local dev, fresh preview).
 * NEVER falls back to VERCEL_URL — that was the source of the
 * rotting-preview-URL bug where certificate verification URLs like
 * `https://internhub-ommxwuglg-intern-hub1.vercel.app/verify/...`
 * were baked into the DB and broke on every new deployment.
 */
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function generateCertificateNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IH-${ts}-${rnd}`;
}

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

// --------------------------------------------------------------------------
// GET — list certificates issued by this company
// --------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const studentFilter = searchParams.get("student_user_id");

    let query = supabase
      .from("certificates")
      .select(`
        id, title, certificate_number, verification_code, verification_url,
        issued_at, file_url, status, linkedin_added_at,
        student:profiles!certificates_student_user_id_fkey(full_name, email),
        internship:internships(title)
      `)
      .eq("company_id", profile.company_id)
      .order("issued_at", { ascending: false });

    if (studentFilter) {
      query = query.eq("student_user_id", studentFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[/api/company-hr/certificates] GET error:", error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch certificates: ${error.message}` },
        { status: 500 }
      );
    }

    // ALWAYS regenerate the verification URL from the code via the
    // canonical site-URL helper. The DB-stored `verification_url`
    // may be stale (rows issued before this fix contain Vercel
    // deployment URLs that point to a protected deployment and
    // break public verification). The verification_code is
    // immutable, so synthesizing the URL here always produces the
    // correct canonical URL for the current deployment.
    const sanitized = (data || []).map((row: any) => ({
      ...row,
      verification_url: row.verification_code
        ? buildVerificationUrl(row.verification_code)
        : row.verification_url ?? null,
    }));

    return NextResponse.json({ success: true, data: sanitized });
  } catch (err) {
    console.error("[/api/company-hr/certificates] GET unhandled:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------------------
// POST — upload a certificate file + create the certificate record
// --------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
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

    // Parse multipart form
    const formData = await request.formData();
    const student_user_id = formData.get("student_user_id") as string | null;
    const internship_id = formData.get("internship_id") as string | null;
    const title = formData.get("title") as string | null;
    const issue_date = formData.get("issue_date") as string | null;
    const certificate_number_param = formData.get("certificate_number") as string | null;
    const file = formData.get("file") as File | null;

    if (!student_user_id || !internship_id || !title) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "student_user_id, internship_id, and title are required" } },
        { status: 400 }
      );
    }
    if (!file) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "A certificate file (PDF/PNG/JPEG) is required" } },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: { code: "FILE_TOO_LARGE", message: `File exceeds the 10MB limit (${Math.round(file.size / 1024 / 1024)}MB)` } },
        { status: 413 }
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: { code: "BAD_FILE_TYPE", message: `Unsupported file type: ${file.type}. Allowed: PDF, PNG, JPEG, WebP.` } },
        { status: 415 }
      );
    }

    // Verify the internship belongs to this company.
    const { data: internshipRow } = await supabase
      .from("internships")
      .select("id, title, company_id")
      .eq("id", internship_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!internshipRow) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Internship not found or does not belong to your company" } },
        { status: 403 }
      );
    }

    // Idempotency: one issued certificate per (student, internship) pair.
    const { data: existing } = await supabase
      .from("certificates")
      .select("id, certificate_number")
      .eq("student_user_id", student_user_id)
      .eq("internship_id", internship_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ALREADY_ISSUED",
            message: `A certificate (${existing.certificate_number}) has already been issued for this student + internship. Revoke the existing one first if you need to re-issue.`,
          },
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------------------------
    // 1. Upload the file to Supabase Storage.
    // --------------------------------------------------------------------
    const safeName = (file.name || "certificate.pdf")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80);
    const filePath = `${user.id}/${Date.now()}-${safeName}`;

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await supabase
      .storage
      .from("certificates")
      .upload(filePath, fileBytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[/api/company-hr/certificates] storage upload error:", uploadErr);
      return NextResponse.json(
        { error: { code: "UPLOAD_FAILED", message: `Failed to upload certificate file: ${uploadErr.message}` } },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase
      .storage
      .from("certificates")
      .getPublicUrl(filePath);

    const fileUrl = publicUrlData?.publicUrl || null;

    // --------------------------------------------------------------------
    // 2. Generate a unique verification_code + verification_url, insert.
    // --------------------------------------------------------------------
    const certificate_number = certificate_number_param?.trim() || generateCertificateNumber();
    const issuedAt = issue_date ? new Date(issue_date).toISOString() : new Date().toISOString();

    let lastError: any = null;

    // Resolve the canonical origin from the incoming request so we can
    // build absolute verification URLs even when NEXT_PUBLIC_APP_URL is
    // unset (local dev, fresh preview). NEVER falls back to VERCEL_URL.
    const requestOrigin = new URL(request.url).origin;

    for (let attempt = 0; attempt < 5; attempt++) {
      const part = () =>
        Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map((b) => ("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567").charAt(b % 32))
          .join("")
          .slice(0, 4);
      const verification_code = `IH-${part()}-${part()}`;
      const verification_url = buildVerificationUrlFromRequest(
        verification_code,
        requestOrigin
      );

      const { data: inserted, error: insErr } = await supabase
        .from("certificates")
        .insert({
          student_user_id,
          internship_id,
          university_id: null,
          company_id: profile.company_id,
          title: title.trim(),
          certificate_number,
          issued_at: issuedAt,
          issued_by: user.id,
          file_url: fileUrl,
          status: "issued",
          verification_code,
          verification_url,
          metadata: {
            uploaded_by: user.id,
            uploaded_at: new Date().toISOString(),
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            source: "company_hr_upload",
          },
        })
        .select("id, verification_code, verification_url")
        .single();

      if (insErr) {
        if (insErr.code === "23505") {
          // verification_code or certificate_number collision — retry.
          lastError = insErr;
          continue;
        }
        console.error("[/api/company-hr/certificates] insert error:", insErr);
        await supabase.storage.from("certificates").remove([filePath]);
        return NextResponse.json(
          { error: { code: "DATABASE_ERROR", message: `Failed to create certificate: ${insErr.message}` } },
          { status: 500 }
        );
      }

      // Success — fetch full row + send notifications.
      const { data: fullRow } = await supabase
        .from("certificates")
        .select(`
          id, title, certificate_number, verification_code, verification_url,
          issued_at, file_url, status, linkedin_added_at
        `)
        .eq("id", inserted.id)
        .single();

      // Notify the student via the shared sendNotification helper —
      // also delivers via web push to subscribed devices.
      const { sendNotification } = await import("@/lib/notifications");
      await sendNotification(supabase, {
        userId: student_user_id,
        senderId: user.id,
        title: "Certificate issued",
        message: `${profile.full_name || "Your company"} issued your certificate "${title}". Certificate #${certificate_number}. You can now add it to LinkedIn.`,
        category: "certificate",
        priority: "high",
        actionUrl: "/student/certificates",
        metadata: { type: "certificate_issued", certificate_id: inserted.id, certificate_number, title },
      });

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "issue_certificate",
        entity_type: "certificate",
        entity_id: inserted.id,
        new_values: {
          student_user_id,
          internship_id,
          certificate_number,
          verification_code,
          file_url: fileUrl,
        },
      });

      return NextResponse.json(
        { success: true, data: fullRow || inserted, message: "Certificate issued" },
        { status: 201 }
      );
    }

    // All 5 attempts collided.
    await supabase.storage.from("certificates").remove([filePath]);
    console.error("[/api/company-hr/certificates] verification_code collision after 5 attempts:", lastError);
    return NextResponse.json(
      { error: { code: "CODE_COLLISION", message: "Failed to generate a unique verification code after 5 attempts. Please try again." } },
      { status: 500 }
    );
  } catch (err) {
    console.error("[/api/company-hr/certificates] POST unhandled:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
