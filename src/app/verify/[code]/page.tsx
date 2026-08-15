import type { Metadata } from "next";
import { headers } from "next/headers";
import { buildInternalApiUrl, getCanonicalBaseUrl } from "@/lib/site-url";
import {
  CheckCircle2,
  XCircle,
  Award,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  ExternalLink,
  FileText,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /verify/[code]
 *
 * PUBLIC certificate verification page — no login required.
 *
 * Anyone with the verification URL (e.g., an employer the student sent
 * it to, or LinkedIn's verification bot) can land here and confirm the
 * certificate is valid. The page shows:
 *   - Certificate title
 *   - Issuing company (with logo if available)
 *   - Student name
 *   - Issue date
 *   - Verification code + certificate number
 *   - Status (VALID / REVOKED / NOT FOUND / ERROR)
 *
 * This page is deliberately minimal — no navbar, no sidebar, no theme
 * switcher. It's a standalone verification receipt.
 *
 * PUBLIC ROUTE NOTE
 *   This route is listed in `PUBLIC_ROUTES` in `src/proxy.ts`. Without
 *   that listing, the proxy would redirect anonymous visitors to
 *   `/login?returnUrl=/verify/<code>` — which broke public verification
 *   and exposed Vercel deployment URLs in the redirect chain.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VerificationResponse {
  valid: boolean;
  error?: string;
  certificate?: {
    id: string;
    title: string;
    certificate_number: string;
    verification_code: string;
    issued_at: string;
    status: string;
    linkedin_added_at: string | null;
    student_name: string | null;
    internship_title: string | null;
    company_name: string | null;
    company_logo_url: string | null;
  };
}

// ---------------------------------------------------------------------------
// Server-side fetch — uses an ABSOLUTE URL derived from the incoming
// request. Relative URLs (`/api/...`) silently fail server-side because
// `fetch()` requires an absolute URL when invoked from a server component.
// ---------------------------------------------------------------------------
async function fetchVerification(
  code: string,
  requestOrigin: string
): Promise<VerificationResponse> {
  const url = buildInternalApiUrl(
    `/api/certificates/verify/${encodeURIComponent(code)}`,
    requestOrigin
  );

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      // 404 / 400 — invalid code; the body still has {valid:false}.
      // 500 — server error; body has {valid:false, error:"..."}.
      const body = (await res.json().catch(() => ({}))) as VerificationResponse;
      return body;
    }
    return (await res.json()) as VerificationResponse;
  } catch (err) {
    return { valid: false, error: "Network error" };
  }
}

// ---------------------------------------------------------------------------
// Metadata — SEO + LinkedIn/OG sharing
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const canonicalBase = getCanonicalBaseUrl();
  const canonicalPath = `/verify/${code}`;
  const canonicalUrl = canonicalBase
    ? `${canonicalBase}${canonicalPath}`
    : canonicalPath;

  const title = `Certificate Verification — ${code}`;
  const description = `Verify the authenticity of InternHub certificate ${code}. Public, no login required.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: "InternHub",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      // Allow indexing so LinkedIn / Google can verify the URL is real.
      index: true,
      follow: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Resolve the request origin from the `host` / `x-forwarded-*` headers.
//
// Why we need this:
//   In a server component, `fetch("/api/...")` (relative URL) silently
//   fails because the server-side fetch implementation requires an
//   absolute URL. We derive the origin from the incoming request's
//   headers so the verify page can call its own backing API endpoint.
//
//   Priority:
//     1. `x-forwarded-proto` + `x-forwarded-host` (set by Vercel, etc.)
//     2. `host` header (set in all environments; protocol defaults to https
//        in production, http in local dev)
//
//   This is ONLY used as a fallback when NEXT_PUBLIC_APP_URL is unset.
//   In production, NEXT_PUBLIC_APP_URL=https://internhub.pk is set, so
//   the canonical helper takes precedence and we never leak the
//   deployment-derived host into the response.
// ---------------------------------------------------------------------------
async function getRequestOrigin(): Promise<string> {
  const canonical = getCanonicalBaseUrl();
  if (canonical) return canonical;

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ||
    headerList.get("host") ||
    "internhub.pk";
  const proto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Derive the request origin so the server-side fetch to our own API
  // has an absolute URL. Falls back to NEXT_PUBLIC_APP_URL when set
  // (production), otherwise uses the incoming request's host header.
  const requestOrigin = await getRequestOrigin();

  const result = await fetchVerification(code, requestOrigin);
  const cert = result.certificate;

  // Determine which state to render.
  //   - verified   : valid && status === "issued"
  //   - revoked    : cert exists but status !== "issued"
  //   - not-found  : no cert returned AND no error
  //   - server-error : error message indicates a server/network failure
  const isServerError =
    !cert && !!result.error && result.error !== "Certificate not found";
  const isNotFound = !cert && !isServerError;

  // Once we're past the not-found / server-error branches, `cert` is
  // guaranteed to be defined. Capture it as a non-null local so
  // TypeScript can narrow it inside the certificate-found JSX branch.
  // (Without this, TS won't propagate the narrowing through the
  // ternary chain below and emits TS18048 on every `cert.x` access.)
  const foundCert = cert!;
  const isValid = result.valid && foundCert.status === "issued";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/30">
      {/* Top brand strip */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            InternHub
          </Link>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Certificate Verification
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* ================================================================
            SERVER ERROR STATE
            ================================================================ */}
        {isServerError ? (
          <div className="text-center max-w-md mx-auto">
            <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mb-6">
              <AlertTriangle className="h-9 w-9 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Verification temporarily unavailable
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              We couldn&apos;t verify this certificate right now due to a
              temporary server issue. Please try again in a few moments.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-4 font-mono">
              Error: {result.error}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 mt-8 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Go to InternHub homepage
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : isNotFound ? (
          /* ================================================================
             NOT FOUND / INVALID STATE
             ================================================================ */
          <div className="text-center max-w-md mx-auto">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-6">
              <XCircle className="h-9 w-9 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Certificate not verified
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              We couldn&apos;t find a certificate matching the verification code
              <span className="font-mono text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mx-1 break-all">
                {code}
              </span>
              in our system.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              The certificate may have been revoked, the code may be mistyped,
              or the certificate was not issued through InternHub.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 mt-8 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Go to InternHub homepage
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          /* ================================================================
             CERTIFICATE FOUND — VERIFIED OR REVOKED
             ================================================================ */
          <div className="space-y-6">
            {/* Status banner */}
            <div
              className={`rounded-2xl border p-6 sm:p-8 shadow-sm ${
                isValid
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex-shrink-0 flex items-center justify-center ${
                    isValid
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-600 text-white"
                  }`}
                >
                  {isValid ? (
                    <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
                  ) : (
                    <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-bold tracking-widest uppercase mb-1 ${
                      isValid
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {isValid ? "Valid Certificate" : `${foundCert.status.toUpperCase()}`}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
                    {foundCert.title}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {isValid
                      ? "This certificate has been verified as authentic and currently valid."
                      : "This certificate exists in our system but is not currently valid."}
                  </p>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  Certificate Details
                </h2>
              </div>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                <DetailRow
                  icon={<User className="h-4 w-4" />}
                  label="Certified Individual"
                  value={foundCert.student_name || "—"}
                />
                <DetailRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Issuing Organization"
                  value={
                    <div className="flex items-center gap-2 justify-end">
                      {foundCert.company_logo_url ? (
                        <img
                          src={foundCert.company_logo_url}
                          alt={foundCert.company_name || "company logo"}
                          className="h-5 w-5 rounded object-cover flex-shrink-0"
                        />
                      ) : null}
                      <span className="min-w-0 break-words">
                        {foundCert.company_name || "—"}
                      </span>
                    </div>
                  }
                />
                {foundCert.internship_title ? (
                  <DetailRow
                    icon={<Award className="h-4 w-4" />}
                    label="Internship Program"
                    value={foundCert.internship_title}
                  />
                ) : null}
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Issue Date"
                  value={new Date(foundCert.issued_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <DetailRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Certificate Number"
                  value={
                    <span className="font-mono text-sm break-all">
                      {foundCert.certificate_number}
                    </span>
                  }
                />
                <DetailRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Verification Code"
                  value={
                    <span className="font-mono text-sm break-all">
                      {foundCert.verification_code}
                    </span>
                  }
                />
                {foundCert.linkedin_added_at ? (
                  <DetailRow
                    icon={<ExternalLink className="h-4 w-4" />}
                    label="Added to LinkedIn"
                    value={new Date(foundCert.linkedin_added_at).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  />
                ) : null}
              </dl>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-500 dark:text-slate-500 px-4">
              <p>
                Verified by InternHub at{" "}
                {new Date().toLocaleString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </p>
              <p className="mt-1">
                This verification is authoritative. For disputes, contact the
                issuing organization directly.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4">
      <dt className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-shrink-0 min-w-0">
        <span className="text-slate-400 flex-shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </dt>
      <dd className="text-sm font-medium text-slate-900 dark:text-white text-right break-words min-w-0">
        {value}
      </dd>
    </div>
  );
}
