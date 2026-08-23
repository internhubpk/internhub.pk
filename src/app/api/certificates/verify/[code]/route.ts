import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { rateLimiter, RATE_LIMITS, extractClientInfo } from "@/lib/api-security";

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
 *
 * SERVICE-ROLE CLIENT
 * -------------------
 * This endpoint MUST use the Supabase service-role key, NOT the
 * user-bound `createClient()` from `@/utils/supabase/server`. The
 * user-bound client inherits RLS policies from the (anonymous)
 * request session — and the `profiles` table's SELECT policy
 * requires an authenticated session. Anonymous visitors (employers,
 * LinkedIn's verification bot, anyone the student shared the link
 * with) have no session, so RLS returns null for the student name
 * lookup and the page renders "Certified Individual: —".
 *
 * The service-role key bypasses RLS entirely. We only return a
 * curated subset of fields (see comment above), so this is safe —
 * we never expose email, file_url, or other PII through this
 * endpoint.
 */

export const dynamic = "force-dynamic";

// Lazy-init the service-role client so we don't construct it on
// every request. Cached across warm invocations.
let _adminClient: ReturnType<typeof createAdminClient> | null = null;
function getAdminClient() {
  if (_adminClient) return _adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for public certificate verification."
    );
  }
  _adminClient = createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _adminClient;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Rate limit (2026-08-23 audit): public code-probing protection.
    const { ipAddress: ip } = extractClientInfo(_request);
    const rl = rateLimiter.check(`cert-verify:${ip}`, RATE_LIMITS.general);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const { code } = await params;

    if (!code || !/^[A-Z0-9-]+$/i.test(code)) {
      return NextResponse.json(
        { valid: false, error: "Invalid verification code format" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: cert, error } = await supabase
      .from("certificates")
      .select(`
        id, title, certificate_number, verification_code,
        issued_at, status, linkedin_added_at,
        student_user_id, internship_id, company_id
      `)
      .eq("verification_code", code.toUpperCase())
      .maybeSingle() as { data: any | null; error: any };

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
    //
    // Using the service-role client (no RLS) — see file-level comment.
    const [studentRes, internshipRes, companyRes] = await Promise.all([
      cert.student_user_id
        ? supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", cert.student_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
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
