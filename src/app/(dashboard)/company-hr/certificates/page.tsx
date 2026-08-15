"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Award,
  Upload,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  ShieldCheck,
  ExternalLink,
  Linkedin,
  Ban,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  Eye,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CertificateRow {
  id: string;
  title: string;
  certificate_number: string;
  verification_code: string | null;
  verification_url: string | null;
  issued_at: string;
  file_url: string | null;
  status: "draft" | "issued" | "revoked" | "expired";
  linkedin_added_at: string | null;
  student: { full_name: string; email: string } | null;
  internship: { title: string } | null;
}

interface InternshipOption {
  id: string;
  title: string;
  // student options keyed by internship
}

interface StudentByInternship {
  student_user_id: string;
  full_name: string;
  email: string;
  internship_id: string;
  internship_title: string;
  has_certificate: boolean;
}

export default function CompanyHrCertificatesPage() {
  const { user, profile } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Upload form state
  const [availableStudents, setAvailableStudents] = useState<StudentByInternship[]>([]);
  const [selectedStudentInternship, setSelectedStudentInternship] = useState<string>("");
  const [certTitle, setCertTitle] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [certNumber, setCertNumber] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  const fetchCertificates = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const res = await fetch("/api/company-hr/certificates", { cache: "no-store" });
      const json = await res.json().catch(() => ({ success: false, data: [] }));
      if (res.ok && json.success) {
        setCertificates(json.data || []);
      } else {
        console.error("[company-hr/certificates] fetch error:", json.error);
        setCertificates([]);
      }
    } catch (err) {
      console.error("[company-hr/certificates] fetch exception:", err);
      setCertificates([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch the list of students who have an active student_internships row
  // with this company, so the upload modal can populate the dropdown.
  // We exclude students who already have a certificate for that internship
  // (the API will reject duplicates anyway, but hiding them here is cleaner).
  const fetchAvailableStudents = useCallback(async () => {
    if (!user || profile?.role !== "company_hr") return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("student_internships")
        .select(`
          student_user_id,
          internship_id,
          status,
          student:profiles!student_internships_student_user_id_fkey(full_name, email),
          internship:internships!student_internships_internship_id_fkey(id, title, company_id)
        `)
        .in("status", ["active", "assigned", "completed"])
        .returns<any[]>();

      if (error) throw error;

      // Filter to this company's internships + flatten.
      const rows: StudentByInternship[] = (data || [])
        .filter((r) => r.internship?.company_id === profile.company_id)
        .map((r) => ({
          student_user_id: r.student_user_id,
          full_name: r.student?.full_name || r.student?.email || "Unknown",
          email: r.student?.email || "",
          internship_id: r.internship_id,
          internship_title: r.internship?.title || "Unknown Internship",
          has_certificate: false,
        }));

      // Look up which (student, internship) pairs already have a certificate.
      if (rows.length > 0) {
        const { data: existingCerts } = await supabase
          .from("certificates")
          .select("student_user_id, internship_id")
          .eq("company_id", profile.company_id);

        const existing = new Set(
          (existingCerts || []).map((c: any) => `${c.student_user_id}|${c.internship_id}`)
        );
        rows.forEach((r) => {
          r.has_certificate = existing.has(`${r.student_user_id}|${r.internship_id}`);
        });
      }

      setAvailableStudents(rows);
    } catch (err) {
      console.error("[company-hr/certificates] fetchAvailableStudents error:", err);
      setAvailableStudents([]);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  useEffect(() => {
    if (showUploadModal) {
      fetchAvailableStudents();
    }
  }, [showUploadModal, fetchAvailableStudents]);

  const filtered = certificates.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.certificate_number.toLowerCase().includes(q) ||
      (c.verification_code || "").toLowerCase().includes(q) ||
      (c.student?.full_name || "").toLowerCase().includes(q) ||
      (c.student?.email || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: certificates.length,
    issued: certificates.filter((c) => c.status === "issued").length,
    revoked: certificates.filter((c) => c.status === "revoked").length,
    linkedin: certificates.filter((c) => c.linkedin_added_at).length,
  };

  function resetUploadForm() {
    setSelectedStudentInternship("");
    setCertTitle("");
    setCertNumber("");
    setCertFile(null);
    setIssueDate(new Date().toISOString().slice(0, 10));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedStudentInternship) {
      toast.error("Please select a student");
      return;
    }
    if (!certTitle.trim()) {
      toast.error("Please enter a certificate title");
      return;
    }
    if (!certFile) {
      toast.error("Please choose a certificate file (PDF/PNG/JPEG)");
      return;
    }

    const [student_user_id, internship_id] = selectedStudentInternship.split("|");
    if (!student_user_id || !internship_id) {
      toast.error("Invalid student selection");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("student_user_id", student_user_id);
      formData.append("internship_id", internship_id);
      formData.append("title", certTitle.trim());
      formData.append("issue_date", issueDate);
      if (certNumber.trim()) formData.append("certificate_number", certNumber.trim());
      formData.append("file", certFile);

      const res = await fetch("/api/company-hr/certificates", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({ success: false }));

      if (res.ok && json.success) {
        toast.success("Certificate uploaded", {
          description: `Certificate #${json.data?.certificate_number} issued. Verification: ${json.data?.verification_code}`,
        });
        setShowUploadModal(false);
        resetUploadForm();
        fetchCertificates();
      } else {
        toast.error("Upload failed", {
          description: json.error?.message || json.error || "Please try again.",
        });
      }
    } catch (err) {
      console.error("[company-hr/certificates] upload error:", err);
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRevoke(cert: CertificateRow) {
    if (!confirm(`Revoke certificate #${cert.certificate_number}? The student will be notified and the public verification page will show "REVOKED".`)) {
      return;
    }
    setRevokingId(cert.id);
    try {
      const res = await fetch(`/api/company-hr/certificates/${cert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      const json = await res.json().catch(() => ({ success: false }));
      if (res.ok && json.success) {
        toast.success("Certificate revoked", {
          description: "The student has been notified.",
        });
        fetchCertificates();
      } else {
        toast.error("Couldn't revoke", {
          description: json.error?.message || json.error || "Please try again.",
        });
      }
    } catch (err) {
      toast.error("Couldn't revoke", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setRevokingId(null);
    }
  }

  async function handleReissue(cert: CertificateRow) {
    if (!confirm(`Re-issue certificate #${cert.certificate_number}? This will mark it as valid again.`)) {
      return;
    }
    setRevokingId(cert.id);
    try {
      const res = await fetch(`/api/company-hr/certificates/${cert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "issued" }),
      });
      const json = await res.json().catch(() => ({ success: false }));
      if (res.ok && json.success) {
        toast.success("Certificate re-issued", {
          description: "The student has been notified.",
        });
        fetchCertificates();
      } else {
        toast.error("Couldn't re-issue", {
          description: json.error?.message || json.error || "Please try again.",
        });
      }
    } catch (err) {
      toast.error("Couldn't re-issue", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <PageHeader
              title="Certificates"
              description="Upload, verify, and manage internship completion certificates for your interns"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchCertificates} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowUploadModal(true)} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Upload Certificate
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6"
        >
          <StatCard label="Total" value={stats.total} icon={Award} variant="warning" />
          <StatCard label="Issued & Valid" value={stats.issued} icon={CheckCircle2} variant="success" />
          <StatCard label="Revoked" value={stats.revoked} icon={XCircle} variant="danger" />
          <StatCard
            label="Added to LinkedIn"
            value={stats.linkedin}
            icon={Linkedin}
            variant="info"
          />
        </motion.div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, student, cert #, or verification code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Certificates table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center px-6">
                <Award className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-lg font-semibold mb-1">No certificates yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {certificates.length === 0
                    ? "Upload a certificate for one of your interns. Each certificate gets a unique verification code that students can share with employers and add to LinkedIn."
                    : "No certificates match your filters."}
                </p>
                {certificates.length === 0 && (
                  <Button onClick={() => setShowUploadModal(true)} className="gap-1.5">
                    <Upload className="h-4 w-4" /> Upload your first certificate
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell>
                        <div className="font-medium">{cert.student?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{cert.student?.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm line-clamp-1 max-w-[260px]">
                          {cert.title}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {cert.certificate_number}
                        </div>
                        {cert.internship?.title && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {cert.internship.title}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {cert.verification_code ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs">{cert.verification_code}</div>
                            {cert.verification_url && (
                              <a
                                href={cert.verification_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                Verify <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(cert.issued_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {cert.status === "issued" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Issued
                          </Badge>
                        ) : cert.status === "revoked" ? (
                          <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" /> Revoked
                          </Badge>
                        ) : (
                          <Badge variant="outline">{cert.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {cert.linkedin_added_at ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                            <Linkedin className="mr-1 h-3 w-3" />
                            {new Date(cert.linkedin_added_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {cert.file_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(cert.file_url!, "_blank", "noopener,noreferrer")}
                              title="View certificate file"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {cert.status === "issued" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(cert)}
                              disabled={revokingId === cert.id}
                              title="Revoke certificate"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              {revokingId === cert.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          ) : cert.status === "revoked" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReissue(cert)}
                              disabled={revokingId === cert.id}
                              title="Re-issue certificate"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              {revokingId === cert.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={(o) => { setShowUploadModal(o); if (!o) resetUploadForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload a certificate</DialogTitle>
            <DialogDescription>
              Upload a certificate PDF or image for one of your interns. A unique verification code will be generated automatically so the student (and any third party they share it with) can verify it online.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <form onSubmit={handleUpload} className="space-y-4">
            {/* Student + Internship picker */}
            <div className="space-y-2">
              <Label htmlFor="student_internship">Student & Internship *</Label>
              <Select
                value={selectedStudentInternship}
                onValueChange={setSelectedStudentInternship}
              >
                <SelectTrigger id="student_internship">
                  <SelectValue placeholder="Choose a student..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      No active interns found for your company.
                    </div>
                  ) : (
                    availableStudents.map((s) => (
                      <SelectItem
                        key={`${s.student_user_id}|${s.internship_id}`}
                        value={`${s.student_user_id}|${s.internship_id}`}
                        disabled={s.has_certificate}
                      >
                        <div className="flex flex-col">
                          <span>
                            {s.full_name}
                            {s.has_certificate && (
                              <span className="ml-2 text-xs text-amber-600">(already has cert)</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">{s.internship_title}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Certificate Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Certificate Title *</Label>
              <Input
                id="title"
                value={certTitle}
                onChange={(e) => setCertTitle(e.target.value)}
                placeholder="e.g., Certificate of Completion — Software Engineering Internship"
                required
              />
            </div>

            {/* Issue Date + Cert Number */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert_number">Certificate Number (optional)</Label>
                <Input
                  id="cert_number"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="Auto-generated if blank"
                />
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label htmlFor="file">Certificate File *</Label>
              <div className="border-2 border-dashed border-input rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  id="file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <Label htmlFor="file" className="cursor-pointer justify-center w-full">
                  {certFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="text-center">
                        <div className="font-medium text-sm">{certFile.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(certFile.size / 1024 / 1024).toFixed(2)} MB · {certFile.type}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-sm">Click to upload</div>
                        <div className="text-xs">PDF, PNG, JPEG, or WebP (max 10MB)</div>
                      </div>
                    </div>
                  )}
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading || !certFile || !selectedStudentInternship || !certTitle.trim()}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Upload & Issue
                  </>
                )}
              </Button>
            </DialogFooter>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
