import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { CheckCircle2, XCircle, Award, Building2, Calendar, User, ShieldCheck, ExternalLink, FileText, AlertTriangle } from "lucide-react";
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
 *   - Status (VALID / REVOKED / NOT FOUND)
 *
 * This page is deliberately minimal — no navbar, no sidebar, no theme
 * switcher. It's a standalone verification receipt.
 */

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

async function fetchVerification(code: string): Promise<VerificationResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  // Use a relative URL when no base URL is configured (server component).
  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/api/certificates/verify/${encodeURIComponent(code)}`
    : `/api/certificates/verify/${encodeURIComponent(code)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    return (await res.json()) as VerificationResponse;
  } catch (err) {
    return { valid: false, error: "Network error" };
  }
}

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = await fetchVerification(code);

  const cert = result.certificate;
  const isValid = result.valid && cert?.status === "issued";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/30">
      {/* Top brand strip */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
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
        {!cert ? (
          // Not found or invalid
          <div className="text-center max-w-md mx-auto">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-6">
              <XCircle className="h-9 w-9 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Certificate not verified
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              We couldn't find a certificate matching the verification code
              <span className="font-mono text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mx-1">
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
          // Certificate found — show the verification card
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
                    {isValid ? "Valid Certificate" : `${cert.status.toUpperCase()}`}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
                    {cert.title}
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
              <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  Certificate Details
                </h2>
              </div>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                <DetailRow
                  icon={<User className="h-4 w-4" />}
                  label="Certified Individual"
                  value={cert.student_name || "—"}
                />
                <DetailRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Issuing Organization"
                  value={
                    <div className="flex items-center gap-2">
                      {cert.company_logo_url ? (
                        <img
                          src={cert.company_logo_url}
                          alt={cert.company_name || "company logo"}
                          className="h-5 w-5 rounded object-cover"
                        />
                      ) : null}
                      <span>{cert.company_name || "—"}</span>
                    </div>
                  }
                />
                {cert.internship_title ? (
                  <DetailRow
                    icon={<Award className="h-4 w-4" />}
                    label="Internship Program"
                    value={cert.internship_title}
                  />
                ) : null}
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Issue Date"
                  value={new Date(cert.issued_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <DetailRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Certificate Number"
                  value={<span className="font-mono text-sm">{cert.certificate_number}</span>}
                />
                <DetailRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Verification Code"
                  value={<span className="font-mono text-sm">{cert.verification_code}</span>}
                />
                {cert.linkedin_added_at ? (
                  <DetailRow
                    icon={<ExternalLink className="h-4 w-4" />}
                    label="Added to LinkedIn"
                    value={new Date(cert.linkedin_added_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  />
                ) : null}
              </dl>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-500 dark:text-slate-500">
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
    <div className="px-6 py-4 flex items-center justify-between gap-4">
      <dt className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-shrink-0">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-sm font-medium text-slate-900 dark:text-white text-right break-words min-w-0">
        {value}
      </dd>
    </div>
  );
}
