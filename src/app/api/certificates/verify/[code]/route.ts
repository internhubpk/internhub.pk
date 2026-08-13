import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * /api/certificates/verify/[code]
 *
 * PUBLIC endpoint — no authentication required.
 *
 * Looks up a certificate by its verification_code and returns just enough
 * information for a third party (employer, LinkedIn verifier) to confirm
 * the certificate is real. We deliberately do NOT return:
 *   - the student's email
 *   - the file_url (the file is public on storage, but we don't surface it
 *     here to keep this endpoint scannable; the verification PAGE links to
 *     the file if the student/company has chosen to make it visible)
 *
 * Response shape:
 *   {
 *     valid: true,
 *     certificate: {
 *       title, certificate_number, verification_code,
 *       issued_at, status, company_name, student_name,
 *       internship_title, linkedin_added_at
 *     }
 *   }
 *
 * If the code doesn't match any certificate, we return { valid: false }
 * with a 404. We do NOT distinguish "code doesn't exist" from "code
 * exists but revoked" in the response shape — both return valid:false
 * because a revoked certificate should fail verification just like a
 * non-existent one. (The detailed status IS shown on the verification
 * PAGE for transparency, but not in this JSON response.)
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || !/^[A-Z0-9-]+$/i.test(code)) {
      return NextResponse.json(
        { valid: false, error: "Invalid verification code format" },
        { status: 400 }
      );
    }

    // Use the service role to bypass RLS — this is a public lookup, and
    // the certificates table's SELECT policy requires authentication.
    // We only return a curated subset of fields (see comment above).
    const supabase = await createClient();

    const { data: cert, error } = await supabase
      .from("certificates")
      .select(`
        id, title, certificate_number, verification_code,
        issued_at, status, linkedin_added_at,
        student_user_id, internship_id, company_id
      `)
      .eq("verification_code", code.toUpperCase())
      .maybeSingle();

    if (error) {
      console.error("[/api/certificates/verify] lookup error:", error);
      return NextResponse.json(
        { valid: false, error: "Lookup failed" },
        { status: 500 }
      );
    }

    if (!cert) {
      return NextResponse.json(
        { valid: false, error: "Certificate not found" },
        { status: 404 }
      );
    }

    // Hydrate the student name, internship title, and company name in
    // parallel. Each is best-effort — if any one fails we still return
    // the certificate with that field as null.
    const [studentRes, internshipRes, companyRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", cert.student_user_id)
        .maybeSingle(),
      cert.internship_id
        ? supabase
            .from("internships")
            .select("title")
            .eq("id", cert.internship_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      cert.company_id
        ? supabase
            .from("companies")
            .select("name, logo_url")
            .eq("id", cert.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const isValid = cert.status === "issued";

    return NextResponse.json({
      valid: isValid,
      certificate: {
        id: cert.id,
        title: cert.title,
        certificate_number: cert.certificate_number,
        verification_code: cert.verification_code,
        issued_at: cert.issued_at,
        status: cert.status,
        linkedin_added_at: cert.linkedin_added_at,
        student_name: (studentRes.data as any)?.full_name || null,
        internship_title: (internshipRes.data as any)?.title || null,
        company_name: (companyRes.data as any)?.name || null,
        company_logo_url: (companyRes.data as any)?.logo_url || null,
      },
    });
  } catch (err) {
    console.error("[/api/certificates/verify] unhandled:", err);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
