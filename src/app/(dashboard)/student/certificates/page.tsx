"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  Download,
  Eye,
  Calendar,
  CheckCircle2,
  Building2,
  FileText,
  ExternalLink,
  ShieldCheck,
  Linkedin,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { buildVerificationUrl } from "@/lib/site-url";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { toast } from "sonner";

// `certificates.status` uses the `certificate_status` enum
// (draft, issued, revoked, expired).
// Migration 0044 added: verification_code, verification_url, linkedin_added_at.
interface Certificate {
  id: string;
  title: string;
  company: string;
  company_logo_url?: string | null;
  issueDate: string;
  status: "draft" | "issued" | "revoked" | "expired";
  certificateNumber: string;
  fileUrl: string | null;
  verificationCode: string | null;
  verificationUrl: string | null;
  linkedinAddedAt: string | null;
  internshipTitle?: string | null;
}

const DEFAULT_CERTIFICATES: Certificate[] = [];

export default function StudentCertificatesPage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>(DEFAULT_CERTIFICATES);
  const [isLoading, setIsLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCertificates();
  }, [user]);

  async function fetchCertificates() {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          id,
          title,
          certificate_number,
          verification_code,
          verification_url,
          issued_at,
          issued_by,
          file_url,
          status,
          linkedin_added_at,
          metadata,
          created_at,
          company:companies(name, logo_url),
          internship:internships(title)
        `)
        .eq('student_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const certList: Certificate[] = data.map((cert: any) => {
          // ALWAYS regenerate the verification URL from the code via
          // the canonical site-URL helper — never trust the
          // `verification_url` column directly. Rows issued before
          // the site-url helper existed may contain stale Vercel
          // deployment URLs that point to a protected deployment
          // (https://internhub-xxxxx.vercel.app/verify/...), which
          // breaks public verification and leaks deployment IDs.
          // The verification_code is immutable, so the URL we
          // synthesize here is always correct for the current
          // canonical production domain.
          const code = cert.verification_code || null;
          const verificationUrl = code ? buildVerificationUrl(code) : null;
          return {
            id: cert.id,
            title: cert.title || 'Certificate',
            company: cert.company?.name || 'Issuing Organization',
            company_logo_url: cert.company?.logo_url ?? null,
            issueDate: cert.issued_at || cert.created_at,
            status: cert.status || 'issued',
            certificateNumber: cert.certificate_number || `CERT-${(cert.id || '').slice(0, 8)}`,
            fileUrl: cert.file_url || null,
            verificationCode: code,
            verificationUrl,
            linkedinAddedAt: cert.linkedin_added_at || null,
            internshipTitle: cert.internship?.title ?? null,
          };
        });
        setCertificates(certList);
      }
    } catch (error) {
      console.error("Error fetching certificates:", error);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Build the LinkedIn "Add to Profile" URL for a certificate.
   *
   * LinkedIn accepts these query params (certification_name, org_name,
   * issueYear, issueMonth, certId, certUrl). The URL opens LinkedIn's
   * "Add certification" form pre-filled with our certificate data.
   *
   * After opening LinkedIn, we POST to our backend to record that the
   * student clicked through — this gives us uptake analytics without
   * depending on a LinkedIn callback (which LinkedIn doesn't provide).
   */
  function buildLinkedInUrl(cert: Certificate): string {
    const params = new URLSearchParams();
    params.set("startTask", "CERTIFICATION_NAME");
    if (cert.title) params.set("name", cert.title);
    if (cert.company) params.set("organizationName", cert.company);
    if (cert.issueDate) {
      const d = new Date(cert.issueDate);
      if (!isNaN(d.getTime())) {
        params.set("issueYear", String(d.getFullYear()));
        params.set("issueMonth", String(d.getMonth() + 1).padStart(2, "0"));
      }
    }
    if (cert.certificateNumber) params.set("certId", cert.certificateNumber);
    if (cert.verificationUrl) params.set("certUrl", cert.verificationUrl);
    return `https://www.linkedin.com/profile/add?${params.toString()}`;
  }

  async function handleAddToLinkedIn(cert: Certificate) {
    // Open LinkedIn in a new tab first (so the user doesn't lose our page)
    const linkedInUrl = buildLinkedInUrl(cert);
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");

    // Record the click — best-effort, never blocks the LinkedIn redirect.
    setMarkingId(cert.id);
    try {
      const res = await fetch(`/api/student/certificates/${cert.id}/linkedin`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        // Update local state so the "Added to LinkedIn" badge appears
        // without a re-fetch.
        setCertificates((prev) =>
          prev.map((c) =>
            c.id === cert.id
              ? { ...c, linkedinAddedAt: json.data?.linkedin_added_at || new Date().toISOString() }
              : c
          )
        );
        if (!json.data?.already_marked) {
          toast.success("Opening LinkedIn", {
            description: "We've marked this certificate as added to LinkedIn. Complete the form on LinkedIn to finish.",
          });
        }
      } else {
        toast.error("Couldn't mark certificate", {
          description: json.error || "Please try again.",
        });
      }
    } catch (err) {
      // Network error — LinkedIn still opened, just no tracking.
      console.warn("LinkedIn mark failed:", err);
    } finally {
      setMarkingId(null);
    }
  }

  async function handleCopyVerificationUrl(cert: Certificate) {
    if (!cert.verificationUrl) return;
    try {
      await navigator.clipboard.writeText(cert.verificationUrl);
      setCopiedId(cert.id);
      toast.success("Verification link copied", {
        description: "Share this link so employers can verify your certificate.",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("Couldn't copy link", {
        description: "Please copy the URL manually from the address bar.",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6 lg:px-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-12" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PageHeader
              title="My Certificates"
              description="View, download, verify, and add your internship completion certificates to LinkedIn"
            />
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="grid gap-4 sm:grid-cols-3 mb-6"
        >
          <StatCard label="Total Certificates" value={certificates.length} icon={Award} variant="warning" />
          <StatCard label="Issued & Valid" value={certificates.filter(c => c.status === "issued").length} icon={CheckCircle2} variant="success" />
          <StatCard
            label="Added to LinkedIn"
            value={certificates.filter(c => c.linkedinAddedAt).length}
            icon={Linkedin}
            variant="info"
          />
        </motion.div>

        {/* Certificates List */}
        <div className="grid gap-6 md:grid-cols-2">
          {certificates.map((certificate, index) => (
            <motion.div
              key={certificate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <Card className="overflow-hidden">
                {/* Certificate Preview Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-3 bg-primary/10 rounded-full flex-shrink-0">
                        <Award className="h-8 w-8 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <Badge variant="secondary" className="mb-1 font-mono">
                          {certificate.certificateNumber}
                        </Badge>
                        <h3 className="font-semibold text-lg line-clamp-2">
                          {certificate.title}
                        </h3>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {certificate.status === "issued" && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Issued
                        </Badge>
                      )}
                      {certificate.linkedinAddedAt && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                          <Linkedin className="mr-1 h-3 w-3" /> On LinkedIn
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <CardContent className="p-6 space-y-4">
                  {/* Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      {certificate.company_logo_url ? (
                        <img
                          src={certificate.company_logo_url}
                          alt={certificate.company}
                          className="h-4 w-4 rounded object-cover"
                        />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{certificate.company}</span>
                    </div>

                    {certificate.internshipTitle && (
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{certificate.internshipTitle}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Issued:{" "}
                        {new Date(certificate.issueDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {certificate.verificationCode && (
                      <div className="flex items-center gap-2 text-sm">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Verification:</span>
                        <span className="font-mono">{certificate.verificationCode}</span>
                      </div>
                    )}

                    {certificate.linkedinAddedAt && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                        <Linkedin className="h-4 w-4" />
                        <span>
                          Added to LinkedIn on{" "}
                          {new Date(certificate.linkedinAddedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status badge for non-issued certs */}
                  {certificate.status !== "issued" && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge
                        variant={certificate.status === "revoked" || certificate.status === "expired" ? "destructive" : "outline"}
                      >
                        {certificate.status}
                      </Badge>
                    </div>
                  )}

                  {/* Primary action — View Certificate (full width).
                      Opens the certificate file (PDF/image) when available.
                      If the file isn't available (e.g. faculty-supervisor-
                      issued certificates that have no file_url), this falls
                      back to opening the public verification page so the
                      student can still SEE the certificate record. */}
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => {
                      if (certificate.fileUrl) {
                        window.open(certificate.fileUrl, "_blank", "noopener,noreferrer");
                      } else if (certificate.verificationUrl) {
                        window.open(certificate.verificationUrl, "_blank", "noopener,noreferrer");
                      } else if (certificate.verificationCode) {
                        window.open(`/verify/${certificate.verificationCode}`, "_blank", "noopener,noreferrer");
                      } else {
                        toast.error("Certificate is not yet available to view.");
                      }
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Certificate
                  </Button>

                  {/* Secondary actions — Add to LinkedIn + Verify (only when issued) */}
                  {certificate.status === "issued" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/5"
                        onClick={() => handleAddToLinkedIn(certificate)}
                        disabled={markingId === certificate.id}
                      >
                        {markingId === certificate.id ? (
                          <Check className="h-3.5 w-3.5 animate-pulse" />
                        ) : (
                          <Linkedin className="h-3.5 w-3.5" />
                        )}
                        {certificate.linkedinAddedAt ? "Re-add" : "LinkedIn"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <a
                          href={certificate.verificationUrl || `/verify/${certificate.verificationCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verify
                        </a>
                      </Button>
                    </div>
                  )}

                  {/* Tertiary actions — Download + Copy link */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        if (!certificate.fileUrl) {
                          toast.error("Certificate file is not yet available for download.");
                          return;
                        }
                        const a = document.createElement("a");
                        a.href = certificate.fileUrl;
                        a.download = `${certificate.certificateNumber}.pdf`;
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      disabled={!certificate.fileUrl}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleCopyVerificationUrl(certificate)}
                      disabled={!certificate.verificationUrl}
                    >
                      {copiedId === certificate.id ? (
                        <><Check className="h-3.5 w-3.5" /> Copied</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5" /> Copy Link</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {certificates.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center"
          >
            <Award className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No certificates yet</h3>
            <p className="mt-2 text-muted-foreground">
              Complete an internship to receive your certificate. Your company
              HR will upload it here, and you'll be able to add it to LinkedIn
              and share a verification link with employers.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
