"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  PenTool,
  Image as ImageIcon,
  AlertCircle,
  Eye,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SignaturePad } from "@/components/supervisors/signature-pad";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WeeklyActivityResult {
  day: string;
  date: string;
  tasks: string;
  hours: string;
}

interface EvidenceFile {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface WeeklyLog {
  id: string;
  week_number: number | null;
  week_start_date: string;
  week_end_date: string;
  status: string;
  tasks_completed: string[];
  challenges: string | null;
  challenges_solutions: string | null;
  learnings: string | null;
  learning_outcomes: string | null;
  next_week_goals: string | null;
  hours_worked: number | null;
  supervisor_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  program_name: string | null;
  department_name: string | null;
  university_logo_url: string | null;
  weekly_activities: WeeklyActivityResult[] | null;
  supporting_evidence: EvidenceFile[] | null;
  student_signature_url: string | null;
  student_signed_at: string | null;
  site_supervisor_signature_url: string | null;
  site_supervisor_remarks: string | null;
  site_supervisor_signed_at: string | null;
  faculty_supervisor_signature_url: string | null;
  faculty_supervisor_remarks: string | null;
  faculty_supervisor_signed_at: string | null;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted — Awaiting Site Supervisor",
  site_signed: "Site Supervisor Signed — Awaiting Faculty",
  faculty_signed: "Faculty Signed — Awaiting Site Supervisor",
  approved: "Fully Approved",
  rejected: "Rejected",
  revision_required: "Revision Required",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  site_signed: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  faculty_signed: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  revision_required: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toIso(monday), end: toIso(friday) };
}

function computeInternshipWeek(dateStr: string, startDateStr: string | null): number | null {
  if (!dateStr || !startDateStr) return null;
  const date = new Date(dateStr);
  const start = new Date(startDateStr);
  if (isNaN(date.getTime()) || isNaN(start.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  if (date < start) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.floor((date.getTime() - start.getTime()) / msPerDay);
  return Math.floor(daysDiff / 7) + 1;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

// Convert a base64 data URL (from SignaturePad canvas) to a File object.
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:([^;]+)/)?.[1] || "image/png";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

// ===========================================================================
// PAGE
// ===========================================================================
export default function StudentWeeklyLogsPage() {
  const { user, profile } = useAuth();

  const [logs, setLogs] = useState<WeeklyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-fetched context
  const [programs, setPrograms] = useState<{ id: string; name: string; code: string }[]>([]);
  const [activeInternship, setActiveInternship] = useState<any>(null);

  // View-existing-log dialog
  const [viewLog, setViewLog] = useState<WeeklyLog | null>(null);

  // ----- Form state -----
  const initialForm = () => {
    const { start, end } = getCurrentWeekRange();
    return {
      week_number: "",
      week_start_date: start,
      week_end_date: end,
      program_id: profile?.programs?.id || "",
      // Pre-populate Mon-Fri rows with the right dates for the picked week.
      weekly_activities: DAYS.map((day, i) => {
        const monday = new Date(start);
        monday.setDate(monday.getDate() + i);
        return {
          day,
          date: monday.toISOString().slice(0, 10),
          tasks: "",
          hours: "",
        };
      }) as WeeklyActivityResult[],
      learning_outcomes: "",
      challenges_solutions: "",
      next_week_goals: "",
      university_logo_url: "",
      supporting_evidence: [] as EvidenceFile[],
      student_signature_url: "",
    };
  };
  const [formData, setFormData] = useState(initialForm());
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch logs + auto-fetched context
  // -------------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/student/weekly-logs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs || []);
        setPrograms(json.data.programs || []);
        setActiveInternship(json.data.activeInternship || null);
        // Set initial week_number from internship start_date
        if (json.data.activeInternship?.start_date) {
          const wn = computeInternshipWeek(
            formData.week_start_date,
            json.data.activeInternship.start_date
          );
          if (wn) {
            setFormData((prev) => ({ ...prev, week_number: String(wn) }));
          }
        }
      }
    } catch (err) {
      console.error("Error fetching weekly logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // When the week_start_date changes, recompute Mon-Fri dates + week number.
  const onWeekStartChange = (newStart: string) => {
    const monday = new Date(newStart);
    monday.setDate(monday.getDate() + 0); // already Monday
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    setFormData((prev) => ({
      ...prev,
      week_start_date: newStart,
      week_end_date: friday.toISOString().slice(0, 10),
      weekly_activities: prev.weekly_activities.map((row, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { ...row, date: d.toISOString().slice(0, 10) };
      }),
      week_number:
        activeInternship?.start_date
          ? String(computeInternshipWeek(newStart, activeInternship.start_date) || "")
          : prev.week_number,
    }));
  };

  // -------------------------------------------------------------------------
  // File handlers
  // -------------------------------------------------------------------------
  const onLogoSelected = (file: File | null) => {
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onEvidenceSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingEvidence(true);
    try {
      // Just stage them — actual upload happens on submit.
      setEvidenceFiles((prev) => [...prev, ...Array.from(files)]);
    } finally {
      setUploadingEvidence(false);
    }
  };

  const removeEvidence = (idx: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  const handleSubmit = async () => {
    setSubmitError(null);

    if (!formData.week_start_date || !formData.week_end_date) {
      setSubmitError("Week start and end dates are required.");
      return;
    }

    // Require at least one task across the week.
    const anyTask = formData.weekly_activities.some((r) => r.tasks.trim());
    if (!anyTask) {
      setSubmitError("Please fill in tasks for at least one day.");
      return;
    }

    if (!signatureData) {
      setSubmitError("Please sign the report at the bottom before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Insert the log first so we have an ID.
      const createRes = await fetch("/api/student/weekly-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tasks_completed: formData.weekly_activities
            .map((r) => r.tasks)
            .filter(Boolean)
            .join("\n"),
          hours_worked: formData.weekly_activities.reduce(
            (sum, r) => sum + (Number(r.hours) || 0),
            0
          ),
          // supporting_evidence + signature + logo will be uploaded next and
          // patched in via a second POST call.
          supporting_evidence: [],
          student_signature_url: null,
          university_logo_url: null,
        }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${createRes.status}`);
      }

      const created = await createRes.json();
      const logId = created.data.id;

      // Step 2: Upload the signature (if drawn/typed).
      let signatureUrl: string | null = null;
      if (signatureData) {
        const sigFile = dataUrlToFile(signatureData, `student_signature_${logId}.png`);
        const sigForm = new FormData();
        sigForm.append("file", sigFile);
        const sigRes = await fetch(`/api/student/weekly-logs/${logId}/signature`, {
          method: "POST",
          body: sigForm,
        });
        if (!sigRes.ok) {
          console.warn("Signature upload failed — proceeding anyway");
        } else {
          const sigJson = await sigRes.json();
          signatureUrl = sigJson.data?.signature_url || null;
        }
      }

      // Step 3: Upload the university logo (if selected).
      let logoUrl: string | null = null;
      if (logoFile) {
        const logoForm = new FormData();
        logoForm.append("file", logoFile);
        const logoRes = await fetch(`/api/student/weekly-logs/${logId}/logo`, {
          method: "POST",
          body: logoForm,
        });
        if (!logoRes.ok) {
          console.warn("Logo upload failed — proceeding anyway");
        } else {
          const logoJson = await logoRes.json();
          logoUrl = logoJson.data?.logo_url || null;
        }
      }

      // Step 4: Upload each evidence file.
      const uploadedEvidence: EvidenceFile[] = [];
      for (const f of evidenceFiles) {
        const evForm = new FormData();
        evForm.append("file", f);
        const evRes = await fetch(`/api/student/weekly-logs/${logId}/evidence`, {
          method: "POST",
          body: evForm,
        });
        if (evRes.ok) {
          const evJson = await evRes.json();
          if (evJson.data) uploadedEvidence.push(evJson.data);
        }
      }

      // Step 5: Patch the log with the uploaded URLs (signature is already
      // saved by the signature route; we just need logo + evidence).
      // The signature route already updated student_signature_url on the row,
      // so we only need to persist logo + evidence.
      const patchRes = await fetch("/api/student/weekly-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Sending the same payload again will upsert (same week_start_date
          // → unique constraint → falls into the update branch). This is
          // wasteful but works. Better: a dedicated PATCH /api/student/weekly-logs/[id].
          // For now we accept the redundancy.
          ...formData,
          tasks_completed: formData.weekly_activities
            .map((r) => r.tasks)
            .filter(Boolean)
            .join("\n"),
          hours_worked: formData.weekly_activities.reduce(
            (sum, r) => sum + (Number(r.hours) || 0),
            0
          ),
          supporting_evidence: uploadedEvidence,
          student_signature_url: signatureUrl,
          university_logo_url: logoUrl,
        }),
      });

      if (!patchRes.ok) {
        console.warn("Final patch failed — log was still created.");
      }

      // Close + refresh
      setIsDialogOpen(false);
      resetForm();
      await fetchAll();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit weekly log.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(initialForm());
    setSignatureData(null);
    setLogoFile(null);
    setLogoPreview("");
    setEvidenceFiles([]);
    setSubmitError(null);
  };

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = logs.length;
    const submitted = logs.filter((l) => ["submitted", "site_signed", "faculty_signed"].includes(l.status)).length;
    const approved = logs.filter((l) => l.status === "approved").length;
    const totalHours = logs.reduce((sum, l) => sum + (Number(l.hours_worked) || 0), 0);
    return { total, submitted, approved, totalHours };
  }, [logs]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Activity Reports"
        description="Fill, sign, and submit your weekly internship activity report. Both supervisors must sign for full approval."
        actions={
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Weekly Report
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Reports"
          value={stats.total}
          icon={FileText}
          variant="info"
        />
        <StatCard
          label="Pending Review"
          value={stats.submitted}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Total Hours"
          value={stats.totalHours}
          icon={Clock}
          variant="default"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-sm">No weekly reports yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "New Weekly Report" to submit your first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">
                            Week {log.week_number || "—"}
                          </h3>
                          <Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[log.status] || "")}>
                            {STATUS_LABELS[log.status] || log.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(log.week_start_date)} → {formatDate(log.week_end_date)}
                          {log.hours_worked ? ` · ${log.hours_worked}h` : ""}
                        </p>
                        {log.tasks_completed?.[0] && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                            {log.tasks_completed[0]}
                          </p>
                        )}
                        {/* Signature status pills */}
                        <div className="flex items-center gap-3 mt-2 text-[10px]">
                          <SigPill
                            label="Student"
                            signed={Boolean(log.student_signature_url)}
                            date={log.student_signed_at}
                          />
                          <SigPill
                            label="Site Sup."
                            signed={Boolean(log.site_supervisor_signature_url)}
                            date={log.site_supervisor_signed_at}
                          />
                          <SigPill
                            label="Faculty Sup."
                            signed={Boolean(log.faculty_supervisor_signature_url)}
                            date={log.faculty_supervisor_signed_at}
                          />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewLog(log)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBMIT DIALOG                                                */}
      {/* ============================================================ */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly Internship Activity Report</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Fill in all fields, attach supporting evidence, upload your university logo, and sign at the bottom.
              Your site supervisor and faculty supervisor will both need to sign off.
            </p>
          </DialogHeader>

          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/5 border border-destructive/30 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="space-y-6 mt-2">
            {/* ===== University logo upload ===== */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">University Logo</Label>
              <p className="text-xs text-muted-foreground">
                The template is universal — upload your own university&apos;s logo to appear in the report header.
              </p>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="University logo preview"
                      className="h-20 w-20 object-contain rounded-md border bg-white p-1"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-5 w-5 absolute -top-1 -right-1"
                      onClick={() => { setLogoFile(null); setLogoPreview(""); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-20 w-20 rounded-md border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onLogoSelected(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>PNG, JPG, or WebP · max 5MB</p>
                  <p className="text-[10px]">Logo will appear in the top-right of the report.</p>
                </div>
              </div>
            </div>

            {/* ===== Program (auto-fetched as checkbox list) ===== */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Program</Label>
              <p className="text-xs text-muted-foreground">
                Auto-fetched from your department. Tick your program.
              </p>
              <div className="flex flex-wrap gap-2">
                {programs.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    No programs found for your department. Contact your coordinator.
                  </span>
                )}
                {programs.map((p) => (
                  <label
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer text-xs transition-colors",
                      formData.program_id === p.id
                        ? "bg-primary/10 border-primary/40 text-primary font-medium"
                        : "border-border hover:bg-accent/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={formData.program_id === p.id}
                      onChange={() => setFormData((prev) => ({ ...prev, program_id: p.id }))}
                      className="h-3 w-3"
                    />
                    <span>{p.name} {p.code ? `(${p.code})` : ""}</span>
                  </label>
                ))}
              </div>
              {/* Auto-fetched department name (read-only display) */}
              <div className="text-xs text-muted-foreground mt-1">
                Department: <span className="font-medium text-foreground">{profile?.departments?.name || "—"}</span>
              </div>
            </div>

            {/* ===== Student info (auto-fetched) ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-md bg-muted/30">
              <InfoField label="Student Name" value={profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "—"} />
              <InfoField label="Registration No." value={profile?.student_id_number || "—"} />
              <InfoField
                label="Host Organization"
                value={
                  activeInternship?.internships?.host_org_name ||
                  activeInternship?.internships?.title ||
                  "—"
                }
              />
              <InfoField
                label="Supervisor"
                value={
                  activeInternship?.site_supervisor?.full_name ||
                  activeInternship?.faculty_supervisor?.full_name ||
                  "—"
                }
              />
            </div>

            {/* ===== Week picker ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ws" className="text-xs">Week Start (Mon)</Label>
                <Input
                  id="ws"
                  type="date"
                  value={formData.week_start_date}
                  onChange={(e) => onWeekStartChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="we" className="text-xs">Week End (Fri)</Label>
                <Input
                  id="we"
                  type="date"
                  value={formData.week_end_date}
                  onChange={(e) => setFormData((p) => ({ ...p, week_end_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wn" className="text-xs">Week No.</Label>
                <Input
                  id="wn"
                  type="number"
                  min={1}
                  value={formData.week_number}
                  onChange={(e) => setFormData((p) => ({ ...p, week_number: e.target.value }))}
                  placeholder="Auto"
                />
              </div>
            </div>

            {/* ===== Weekly activities table (Mon-Fri) ===== */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Weekly Activities</Label>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left font-medium p-2 w-24">Day</th>
                      <th className="text-left font-medium p-2 w-28">Date</th>
                      <th className="text-left font-medium p-2">Tasks Performed</th>
                      <th className="text-right font-medium p-2 w-20">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.weekly_activities.map((row, idx) => (
                      <tr key={row.day} className="border-t">
                        <td className="p-2 font-medium">{row.day}</td>
                        <td className="p-2 text-muted-foreground">{row.date}</td>
                        <td className="p-2">
                          <Textarea
                            rows={1}
                            value={row.tasks}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                weekly_activities: prev.weekly_activities.map((r, i) =>
                                  i === idx ? { ...r, tasks: v } : r
                                ),
                              }));
                            }}
                            placeholder="What did you do today?"
                            className="text-xs min-h-[36px] resize-y"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={row.hours}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                weekly_activities: prev.weekly_activities.map((r, i) =>
                                  i === idx ? { ...r, hours: v } : r
                                ),
                              }));
                            }}
                            placeholder="0"
                            className="text-xs h-8 text-right"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t">
                    <tr>
                      <td colSpan={3} className="p-2 text-right font-medium">Total Hours:</td>
                      <td className="p-2 text-right font-semibold">
                        {formData.weekly_activities.reduce((s, r) => s + (Number(r.hours) || 0), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ===== Learning outcomes ===== */}
            <div className="space-y-1.5">
              <Label htmlFor="lo" className="text-sm font-medium">Learning Outcomes / Skills Gained</Label>
              <Textarea
                id="lo"
                rows={3}
                value={formData.learning_outcomes}
                onChange={(e) => setFormData((p) => ({ ...p, learning_outcomes: e.target.value }))}
                placeholder="What did you learn this week? What skills did you gain?"
              />
            </div>

            {/* ===== Challenges ===== */}
            <div className="space-y-1.5">
              <Label htmlFor="cs" className="text-sm font-medium">Challenges Faced and Solutions</Label>
              <Textarea
                id="cs"
                rows={3}
                value={formData.challenges_solutions}
                onChange={(e) => setFormData((p) => ({ ...p, challenges_solutions: e.target.value }))}
                placeholder="Any challenges? How did you solve them?"
              />
            </div>

            {/* ===== Supporting evidence (mandatory) ===== */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Supporting Evidence <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">
                Attach at least one supporting document: attendance record, screenshots, code commits,
                design docs, meeting minutes, certificates, etc.
              </p>
              <label className="flex flex-col items-center justify-center w-full py-6 rounded-md border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">
                  {uploadingEvidence ? "Uploading..." : "Click to attach files"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">PDF, PNG, JPG, TXT, DOCX, XLSX · max 10MB each</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx,.doc,.xls"
                  className="hidden"
                  onChange={(e) => onEvidenceSelected(e.target.files)}
                  disabled={uploadingEvidence}
                />
              </label>

              {evidenceFiles.length > 0 && (
                <div className="space-y-1.5">
                  {evidenceFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeEvidence(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ===== Student signature ===== */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Student Signature</Label>
              <p className="text-xs text-muted-foreground">
                Draw or type your signature. This will be applied to the report.
              </p>
              <SignaturePad
                onSignatureChange={setSignatureData}
                value={signatureData}
                label=""
                showDownload={false}
              />
              {!signatureData && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Signature is required before submitting.
                </p>
              )}
            </div>
          </div>

          {/* ===== Footer ===== */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4 sticky bottom-0 bg-background">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !signatureData}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4 mr-2" />
                  Sign & Submit
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* VIEW LOG DIALOG                                              */}
      {/* ============================================================ */}
      <Dialog open={!!viewLog} onOpenChange={(o) => !o && setViewLog(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly Activity Report — Week {viewLog?.week_number || "—"}</DialogTitle>
          </DialogHeader>
          {viewLog && <ReportView log={viewLog} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function SigPill({ label, signed, date }: { label: string; signed: boolean; date: string | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]",
        signed
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", signed ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      {label}
      {signed && date && <span className="opacity-70">· {formatDate(date)}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Read-only report view (used in the View dialog)
// ---------------------------------------------------------------------------
function ReportView({ log }: { log: WeeklyLog }) {
  const activities: WeeklyActivityResult[] = log.weekly_activities || [];
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-md border bg-muted/20">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Weekly Internship Activity Report</p>
          <p className="text-sm font-semibold">
            {log.program_name || "—"} · {log.department_name || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Week {log.week_number || "—"}: {formatDate(log.week_start_date)} → {formatDate(log.week_end_date)}
          </p>
        </div>
        {log.university_logo_url && (
          <img src={log.university_logo_url} alt="University logo" className="h-16 w-16 object-contain" />
        )}
      </div>

      {/* Status badge */}
      <Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[log.status] || "")}>
        {STATUS_LABELS[log.status] || log.status}
      </Badge>

      {/* Activities table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left font-medium p-2">Day</th>
              <th className="text-left font-medium p-2">Date</th>
              <th className="text-left font-medium p-2">Tasks</th>
              <th className="text-right font-medium p-2">Hours</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  {log.tasks_completed?.length
                    ? log.tasks_completed.map((t, i) => <div key={i}>• {t}</div>)
                    : "No tasks recorded"}
                </td>
              </tr>
            ) : (
              activities.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2 font-medium">{r.day}</td>
                  <td className="p-2 text-muted-foreground">{r.date}</td>
                  <td className="p-2 whitespace-pre-wrap">{r.tasks || "—"}</td>
                  <td className="p-2 text-right">{r.hours || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
          {log.hours_worked != null && (
            <tfoot className="bg-muted/30 border-t">
              <tr>
                <td colSpan={3} className="p-2 text-right font-medium">Total Hours:</td>
                <td className="p-2 text-right font-semibold">{log.hours_worked}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Learning outcomes + challenges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium">Learning Outcomes / Skills Gained</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {log.learning_outcomes || log.learnings || "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">Challenges Faced and Solutions</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {log.challenges_solutions || log.challenges || "—"}
          </p>
        </div>
      </div>

      {/* Supporting evidence */}
      {log.supporting_evidence && log.supporting_evidence.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Supporting Evidence</p>
          <div className="space-y-1">
            {log.supporting_evidence.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 hover:bg-accent/40 text-xs"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Supervisor remarks */}
      {(log.site_supervisor_remarks || log.faculty_supervisor_remarks || log.supervisor_feedback) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {log.site_supervisor_remarks && (
            <div className="space-y-1 p-3 rounded-md border bg-amber-50/40 dark:bg-amber-950/20">
              <p className="text-xs font-medium">Site Supervisor Remarks</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{log.site_supervisor_remarks}</p>
            </div>
          )}
          {log.faculty_supervisor_remarks && (
            <div className="space-y-1 p-3 rounded-md border bg-purple-50/40 dark:bg-purple-950/20">
              <p className="text-xs font-medium">Faculty Supervisor Remarks</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{log.faculty_supervisor_remarks}</p>
            </div>
          )}
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t">
        <SignatureBox label="Student" url={log.student_signature_url} signedAt={log.student_signed_at} />
        <SignatureBox label="Industry Supervisor" url={log.site_supervisor_signature_url} signedAt={log.site_supervisor_signed_at} />
        <SignatureBox label="Faculty Supervisor" url={log.faculty_supervisor_signature_url} signedAt={log.faculty_supervisor_signed_at} />
      </div>
    </div>
  );
}

function SignatureBox({ label, url, signedAt }: { label: string; url: string | null; signedAt: string | null }) {
  return (
    <div className="space-y-1 text-center">
      <div className="h-16 flex items-center justify-center border-b border-dashed border-border">
        {url ? (
          <img src={url} alt={`${label} signature`} className="max-h-14 max-w-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Not signed</span>
        )}
      </div>
      <p className="text-[10px] font-medium">{label}</p>
      {signedAt && (
        <p className="text-[10px] text-muted-foreground">{formatDate(signedAt)}</p>
      )}
    </div>
  );
}
