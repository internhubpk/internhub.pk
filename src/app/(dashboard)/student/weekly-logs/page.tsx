"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  Send,
  Calendar,
  ListChecks,
  Lightbulb,
  Target,
  Timer,
  AlertCircle,
  Download,
  Printer,
  Sun,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Paperclip,
  PenTool,
  Trash2,
  GraduationCap,
  Upload,
  X,
  Link2,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { EVIDENCE_OPTIONS } from "@/lib/constants/evidence-options";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SignaturePad } from "@/components/supervisors/signature-pad";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DailyEntry {
  day_of_week: number;
  day_name: string;
  entry_date: string;
  tasks_performed: string;
  hours_worked: string;
  is_holiday: boolean;
  holiday_name?: string;
  notes?: string;
}

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  end_date: string | null;
  is_active: boolean;
  restrict_submissions: boolean;
}

interface WeeklyLog {
  id: string;
  week_number: number | null;
  week_start_date: string;
  week_end_date: string;
  status: string;
  tasks_completed: string[];
  challenges: string | null;
  learnings: string | null;
  next_week_goals: string | null;
  hours_worked: number | null;
  supervisor_feedback: string | null;
  learning_outcomes: string | null;
  challenges_solutions: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  daily_entries?: any[];
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// Read-only report header info (auto-filled from the student's profile) that
// the generated Word report shows in its header + Student Information table.
interface ReportHeaderInfo {
  universityName: string | null;
  departmentName: string | null;
  programName: string | null;
  studentName: string | null;
  registrationNo: string | null;
  hostOrganization: string | null;
  supervisorName: string | null;
  universityLogoUrl: string | null;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Convert a data URL (e.g. canvas signature PNG) to a File for multipart upload.
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

// Render a typed name as a PNG data URL (italic script-style) so typed
// signatures can be embedded in the Word report like drawn ones.
function typedNameToPngDataUrl(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "italic 52px 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

// Small read-only info tile used in the "Report Header" preview section.
function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate" title={value || ""}>{value || "\u2014"}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function StudentWeeklyLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WeeklyLog[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Delete confirmation state (per submitted log).
  const [deleteLogTarget, setDeleteLogTarget] = useState<WeeklyLog | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  const [weekFromDate, setWeekFromDate] = useState("");
  const [weekToDate, setWeekToDate] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState("");
  const [challengesSolutions, setChallengesSolutions] = useState("");
  const [nextWeekGoals, setNextWeekGoals] = useState("");

  // Internship dates (from the GET response) — used to derive each week's
  // From/To dates from the week NUMBER so distinct weeks can never collide
  // on the same week_start_date (the DB unique constraint that previously
  // caused a new submission to silently REPLACE an earlier log).
  const [internshipStartDate, setInternshipStartDate] = useState<string | null>(null);

  // Live mirror of `logs` readable from effects that must NOT re-run when
  // the logs refresh (the dialog-open effect below). Without the ref, a
  // background refetch (e.g. Supabase TOKEN_REFRESHED → new user object →
  // fetchWeeklyLogs) reset the ENTIRE form while the student was typing
  // — losing every field, picked files included.
  const logsRef = useRef<WeeklyLog[]>([]);

  // Word-report extras: university logo, supporting evidence, student signature.
  const [headerInfo, setHeaderInfo] = useState<ReportHeaderInfo | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  // Evidence links (URLs typed by the student — rendered as live hyperlinks
  // in the generated Word report's Attachments section).
  const [evidenceLinks, setEvidenceLinks] = useState<string[]>([]);
  const [evidenceLinkInput, setEvidenceLinkInput] = useState("");
  // Evidence TYPES the student TICKED (multi-select checkbox list). The Word
  // report renders the same list with ☑ on these and ☐ on the rest
  // (request 2026-08-27).
  const [evidenceTicks, setEvidenceTicks] = useState<string[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState("");

  const isHolidayDate = useCallback(
    (dateStr: string): { isHoliday: boolean; name?: string } => {
      if (!dateStr) return { isHoliday: false };
      const d = new Date(dateStr + "T00:00:00");
      for (const h of holidays) {
        const hStart = new Date(h.holiday_date + "T00:00:00");
        const hEnd = h.end_date ? new Date(h.end_date + "T00:00:00") : hStart;
        if (d >= hStart && d <= hEnd) return { isHoliday: true, name: h.name };
      }
      return { isHoliday: false };
    },
    [holidays]
  );

  const generateDayRows = useCallback(
    (fromDate: string, toDate: string): DailyEntry[] => {
      if (!fromDate) return [];
      const start = new Date(fromDate + "T00:00:00");
      const end = toDate ? new Date(toDate + "T00:00:00") : new Date(start);
      if (!toDate) end.setDate(end.getDate() + 5);

      const rows: DailyEntry[] = [];
      const current = new Date(start);
      while (current <= end) {
        const dow = current.getDay();
        if (dow !== 0) {
          const dateStr = current.toISOString().slice(0, 10);
          const { isHoliday, name: holidayName } = isHolidayDate(dateStr);
          rows.push({
            day_of_week: dow,
            day_name: DAY_NAMES[dow - 1] || ("Day " + dow),
            entry_date: dateStr,
            tasks_performed: "",
            hours_worked: "",
            is_holiday: isHoliday,
            holiday_name: holidayName,
          });
        }
        current.setDate(current.getDate() + 1);
      }
      return rows;
    },
    [isHolidayDate]
  );

  // Regenerate the day rows whenever the selected week dates change — but
  // PRESERVE anything the student already typed for dates that still exist
  // (merging keeps tasks/hours across holiday re-detection and refetches;
  // the old version wiped every typed entry on each regeneration).
  useEffect(() => {
    if (weekFromDate) {
      setDailyEntries((prev) => {
        const fresh = generateDayRows(weekFromDate, weekToDate);
        const prevByDate = new Map(prev.map((p) => [p.entry_date, p]));
        return fresh.map((row) => {
          const old = prevByDate.get(row.entry_date);
          if (!old) return row;
          return {
            ...row,
            tasks_performed: old.tasks_performed,
            hours_worked: old.hours_worked,
            notes: old.notes,
          };
        });
      });
    } else {
      setDailyEntries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekFromDate, weekToDate]);

  // Derive the week's From/To dates from the week number + internship start
  // date. Week N starts exactly (internshipStart + (N-1)·7 days), so every
  // week number maps to a distinct date range — submitting Week 8 can never
  // land on Week 7's dates (which used to overwrite/delete that log via the
  // (student, week_start_date) unique constraint).
  const applyWeekNumber = useCallback((n: number) => {
    setWeekNumber(n);
    if (internshipStartDate) {
      const start = new Date(internshipStartDate + "T00:00:00");
      start.setDate(start.getDate() + (Math.max(1, n) - 1) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 5);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      setWeekFromDate(fmt(start));
      setWeekToDate(fmt(end));
    }
  }, [internshipStartDate]);

  // Pre-fill the dialog when it opens. The week number is a SUGGESTION only —
  // the student can freely type any week number (it is no longer hardcoded or
  // auto-locked to the calendar week of the chosen date).
  //
  // Runs ONLY on the open transition — it deliberately does NOT depend on
  // `logs` (read via logsRef instead) so background refetches can never wipe
  // an in-progress form.
  useEffect(() => {
    if (isDialogOpen) {
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      // Default dates: derived from the internship start when available,
      // otherwise the current calendar week (the student can still edit them).
      const currentLogs = logsRef.current;
      const suggested = currentLogs.length > 0
        ? Math.max(0, ...currentLogs.map((l) => l.week_number || 0)) + 1
        : 1;
      setLearningOutcomes("");
      setChallengesSolutions("");
      setNextWeekGoals("");
      if (internshipStartDate) {
        const start = new Date(internshipStartDate + "T00:00:00");
        start.setDate(start.getDate() + (Math.max(1, suggested) - 1) * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 5);
        setWeekFromDate(fmt(start));
        setWeekToDate(fmt(end));
      } else {
        setWeekFromDate(fmt(monday));
        setWeekToDate(fmt(saturday));
      }
      setWeekNumber(suggested);
      // Reset Word-report extras.
      setLogoFile(null);
      setLogoPreview(null);
      setEvidenceFiles([]);
      setEvidenceLinks([]);
      setEvidenceLinkInput("");
      setEvidenceTicks([]);
      setSignatureData(null);
      setSignatureFile(null);
      setUploadStage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen]);

  // Fetch on login/logout only (user IDENTITY), not on every Supabase
  // TOKEN_REFRESHED event — the auth provider emits a new `user` object on
  // token refresh, which previously re-triggered this fetch mid-typing and
  // (through the logs-dependent effects) reset the whole dialog form,
  // including files the student had just attached.
  useEffect(() => {
    if (!user?.id) { setIsLoading(false); return; }
    fetchWeeklyLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function fetchWeeklyLogs() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/student/weekly-logs");
      const json = await res.json();
      if (json.success && json.data) {
        setLogs(
          (json.data.logs || []).map((log: any) => ({
            id: log.id,
            week_number: log.week_number ?? null,
            week_start_date: log.week_start_date || "",
            week_end_date: log.week_end_date || "",
            status: log.status || "draft",
            tasks_completed: Array.isArray(log.tasks_completed) ? log.tasks_completed : [],
            challenges: log.challenges,
            learnings: log.learnings,
            next_week_goals: log.next_week_goals,
            hours_worked: log.hours_worked != null ? Number(log.hours_worked) : null,
            supervisor_feedback: log.supervisor_feedback,
            learning_outcomes: log.learning_outcomes,
            challenges_solutions: log.challenges_solutions,
            submittedAt: log.submitted_at,
            reviewedAt: log.reviewed_at,
            daily_entries: log.daily_entries || [],
          }))
        );
        // Keep the ref in sync for effects that must not re-run on refetch.
        logsRef.current = (json.data.logs || []).map((log: any) => ({
          id: log.id,
          week_number: log.week_number ?? null,
          status: log.status || "draft",
        }));
        setHolidays(json.data.holidays || []);

        const ai = json.data.activeInternship;
        const internship = ai && !Array.isArray(ai) ? ai.internships : null;
        const internshipStart =
          ai && !Array.isArray(ai) && ai.start_date ? String(ai.start_date).slice(0, 10) : null;
        setInternshipStartDate(internshipStart);

        // Extract the read-only report header info (profile + active
        // internship) so the form can preview exactly what the generated
        // Word report will show.
        const p = json.data.profile || {};
        const uni = Array.isArray(p.universities) ? p.universities[0] : p.universities;
        const dept = Array.isArray(p.departments) ? p.departments[0] : p.departments;
        const prog = Array.isArray(p.programs) ? p.programs[0] : p.programs;
        const company =
          internship && !Array.isArray(internship) && internship.companies && !Array.isArray(internship.companies)
            ? internship.companies
            : null;
        const siteSup = ai && !Array.isArray(ai) ? ai.site_supervisor : null;
        const facultySup = ai && !Array.isArray(ai) ? ai.faculty_supervisor : null;
        setHeaderInfo({
          universityName: uni?.name || null,
          departmentName: dept?.name || null,
          programName: prog?.name || null,
          studentName: p.full_name || null,
          registrationNo: p.student_id_number || null,
          hostOrganization: company?.name || null,
          supervisorName:
            (siteSup && !Array.isArray(siteSup) ? siteSup.full_name : null) ||
            (facultySup && !Array.isArray(facultySup) ? facultySup.full_name : null) ||
            null,
          universityLogoUrl: uni?.logo_url || null,
        });
      }
    } catch (err) {
      console.error("Error fetching weekly logs:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Delete one of the student's own submitted logs — always by the LOG's id
  // (never the student id, which previously wiped every week at once).
  // Approved logs are blocked server-side with a 409; that message is
  // surfaced through the error toast below.
  async function handleDeleteLog() {
    if (!deleteLogTarget) return;
    setIsDeletingLog(true);
    try {
      const res = await fetch(`/api/student/weekly-logs/${encodeURIComponent(deleteLogTarget.id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || json?.error || "Request failed");
      }
      toast.success("Weekly log deleted", {
        description:
          json?.message ||
          `Your ${deleteLogTarget.week_number ? `Week ${deleteLogTarget.week_number}` : formatDate(deleteLogTarget.week_start_date)} log has been removed.`,
      });
      setDeleteLogTarget(null);
      setExpandedLogId(null);
      fetchWeeklyLogs();
    } catch (err) {
      console.error("Error deleting weekly log:", err);
      toast.error("Failed to delete log", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsDeletingLog(false);
    }
  }

  // -------------------------------------------------------------------------
  // File handlers: university logo, supporting evidence, student signature
  // -------------------------------------------------------------------------
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    // Only PNG/JPEG can be embedded in the generated Word document — SVG and
    // WebP uploads previously produced corrupted .docx files.
    if (!["image/png", "image/jpeg"].includes(f.type)) {
      toast.error("Invalid File", { description: "The university logo must be a PNG or JPG image (other formats cannot be embedded in the Word report)." });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File Too Large", { description: "The logo must be 5MB or smaller." });
      return;
    }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error("File Too Large", { description: `"${f.name}" is over 10MB and was skipped.` });
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) {
      setEvidenceFiles((prev) => [...prev, ...valid].slice(0, 10));
    }
  };

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addEvidenceLink = () => {
    const url = evidenceLinkInput.trim();
    if (!url) return;
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      new URL(normalized);
    } catch {
      toast.error("Invalid Link", { description: "Please enter a valid URL (e.g. https://github.com/…)." });
      return;
    }
    if (evidenceLinks.includes(normalized)) {
      setEvidenceLinkInput("");
      return;
    }
    if (evidenceLinks.length >= 10) {
      toast.error("Too Many Links", { description: "You can attach up to 10 evidence links." });
      return;
    }
    setEvidenceLinks((prev) => [...prev, normalized]);
    setEvidenceLinkInput("");
  };

  const removeEvidenceLink = (index: number) => {
    setEvidenceLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/png", "image/jpeg"].includes(f.type)) {
      toast.error("Invalid File", { description: "The signature must be a PNG or JPEG image." });
      return;
    }
    if (f.size > 1024 * 1024) {
      toast.error("File Too Large", { description: "The signature image must be 1MB or smaller." });
      return;
    }
    setSignatureFile(f);
    setSignatureData(null); // uploaded file takes precedence over the pad
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!weekNumber || weekNumber < 1) {
      toast.error("Validation Error", { description: "Please enter a valid week number (1 or higher)." });
      return;
    }
    if (!weekFromDate) {
      toast.error("Validation Error", { description: "Please select the week start date." });
      return;
    }
    setIsSubmitting(true);
    try {
      const workingDays = dailyEntries.filter((de) => !de.is_holiday);
      const hasAnyWork = workingDays.some((de) => de.tasks_performed.trim());
      if (!hasAnyWork && !learningOutcomes.trim() && !challengesSolutions.trim()) {
        toast.error("Validation Error", { description: "Please describe your work for at least one day." });
        setIsSubmitting(false);
        return;
      }

      // ---- STEP 1: Create / update the weekly log row ----
      setUploadStage("Submitting log...");
      const res = await fetch("/api/student/weekly-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start_date: weekFromDate,
          week_end_date: weekToDate || weekFromDate,
          week_number: weekNumber,
          daily_entries: dailyEntries.map((de) => ({
            day_of_week: de.day_of_week,
            entry_date: de.entry_date,
            tasks_performed: de.is_holiday ? "" : de.tasks_performed,
            hours_worked: de.is_holiday ? 0 : Number(de.hours_worked) || 0,
            is_holiday: de.is_holiday,
            notes: de.notes || null,
          })),
          learning_outcomes: learningOutcomes.trim() || null,
          challenges_solutions: challengesSolutions.trim() || null,
          next_week_goals: nextWeekGoals.trim() || null,
          // Evidence LINKS are stored up-front as supporting_evidence entries
          // (files are uploaded after creation and appended by the evidence
          // upload route). The Word report renders links as live hyperlinks
          // in its Attachments section. Ticked evidence TYPES are stored as
          // { type: "checklist", ticked: true } entries — the report renders
          // the full option list with ☑ on the ticked ones.
          supporting_evidence:
            evidenceLinks.length > 0 || evidenceTicks.length > 0
              ? [
                  ...evidenceLinks.map((url) => ({
                    name: url,
                    url,
                    link: true,
                    type: "link",
                  })),
                  ...evidenceTicks.map((t) => ({
                    name: t,
                    ticked: true,
                    type: "checklist",
                  })),
                ]
              : null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Submit Failed", { description: (json.error && typeof json.error === "object" ? json.error.message : json.error) || "Failed to submit weekly log." });
        setIsSubmitting(false);
        setUploadStage("");
        return;
      }
      const logId: string | undefined = json.data?.id;

      // ---- STEP 2: Upload the university logo (Word report header) ----
      if (logId && logoFile) {
        setUploadStage("Uploading university logo...");
        try {
          const fd = new FormData();
          fd.append("file", logoFile);
          const lr = await fetch(`/api/student/weekly-logs/${logId}/logo`, { method: "POST", body: fd });
          const lj = await lr.json();
          if (!lj.success) {
            toast.info("Logo Not Uploaded", { description: "The weekly log was submitted, but the logo upload failed. You can retry later." });
          }
        } catch {
          toast.info("Logo Not Uploaded", { description: "The weekly log was submitted, but the logo upload failed. You can retry later." });
        }
      }

      // ---- STEP 3: Upload the student signature (Word report signature section) ----
      if (logId && (signatureFile || signatureData)) {
        setUploadStage("Uploading signature...");
        let sigFile: File | null = signatureFile;
        if (!sigFile && signatureData) {
          const dataUrl = signatureData.startsWith("data:image")
            ? signatureData
            : typedNameToPngDataUrl(signatureData);
          if (dataUrl) sigFile = await dataUrlToFile(dataUrl, "student-signature.png");
        }
        if (sigFile) {
          try {
            const fd = new FormData();
            fd.append("file", sigFile);
            const sr = await fetch(`/api/student/weekly-logs/${logId}/signature`, { method: "POST", body: fd });
            const sj = await sr.json();
            if (!sj.success) {
              toast.info("Signature Not Uploaded", { description: "The weekly log was submitted, but the signature upload failed. You can retry later." });
            }
          } catch {
            toast.info("Signature Not Uploaded", { description: "The weekly log was submitted, but the signature upload failed. You can retry later." });
          }
        }
      }

      // ---- STEP 4: Upload supporting evidence files ----
      if (logId && evidenceFiles.length > 0) {
        for (let i = 0; i < evidenceFiles.length; i++) {
          setUploadStage(`Uploading evidence ${i + 1} of ${evidenceFiles.length}...`);
          try {
            const fd = new FormData();
            fd.append("file", evidenceFiles[i]);
            const er = await fetch(`/api/student/weekly-logs/${logId}/evidence`, { method: "POST", body: fd });
            const ej = await er.json();
            if (!ej.success) {
              toast.info("Evidence Not Uploaded", { description: `"${evidenceFiles[i].name}" could not be uploaded.` });
            }
          } catch {
            toast.info("Evidence Not Uploaded", { description: `"${evidenceFiles[i].name}" could not be uploaded.` });
          }
        }
      }

      toast.success("Weekly Log Submitted", { description: `Week ${weekNumber} log has been submitted.` });
      setIsDialogOpen(false);
      await fetchWeeklyLogs();
    } catch {
      toast.error("Error", { description: "Failed to submit weekly log. Please try again." });
    } finally {
      setIsSubmitting(false);
      setUploadStage("");
    }
  };

  const totalHoursWorked = useMemo(
    () => dailyEntries.filter((de) => !de.is_holiday).reduce((sum, de) => sum + (Number(de.hours_worked) || 0), 0),
    [dailyEntries]
  );

  const pendingWeeks = logs.filter((log) => log.status === "submitted" || log.status === "draft");

  const updateDayEntry = (index: number, field: keyof DailyEntry, value: string | boolean) => {
    setDailyEntries((prev) => prev.map((de, i) => (i === index ? { ...de, [field]: value } : de)));
  };

  const handleExportCsv = () => {
    if (logs.length === 0) {
      toast.info("No Data", { description: "No weekly logs to export." });
      return;
    }
    const fileName = "weekly-logs-" + new Date().toISOString().slice(0, 10) + ".csv";
    const header = "Week,From,To,Status,Hours,Daily Entries,Challenges,Learnings,Goals,Supervisor Feedback,Submitted";
    const rows: string[] = [header];
    for (const l of logs) {
      const dailyStr = (l.daily_entries || [])
        .map((d: any) => (d.day_name || "") + ": " + (d.tasks_performed || "(holiday)") + " (" + (d.hours_worked || 0) + "h)")
        .join("; ");
      rows.push(
        [l.week_number ?? "", l.week_start_date, l.week_end_date, l.status, l.hours_worked ?? "",
          '"' + dailyStr + '"',
          '"' + (l.challenges_solutions || l.challenges || "") + '"',
          '"' + (l.learning_outcomes || l.learnings || "") + '"',
          '"' + (l.next_week_goals || "") + '"',
          '"' + (l.supervisor_feedback || "") + '"',
          l.submittedAt || "",
        ].join(",")
      );
    }
    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadWord = async (log: WeeklyLog) => {
    try {
      const res = await fetch("/api/reports/weekly-logs/" + log.id + "/generate", { method: "POST" });
      const json = await res.json();
      if (json.success && json.data && json.data.downloadUrl) {
        const dlRes = await fetch(json.data.downloadUrl);
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "weekly-report-week-" + (log.week_number || log.week_start_date) + ".docx";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Downloaded", { description: "Weekly report downloaded." });
        } else {
          toast.error("Download Failed", { description: "Could not download the report." });
        }
      } else {
        toast.error("Generation Failed", { description: (json.error && typeof json.error === "object" ? json.error.message : json.error) || "Could not generate report." });
      }
    } catch {
      toast.error("Error", { description: "Failed to generate report." });
    }
  };

  // ------------------------------------------------------------------------
  // Loading skeleton
  // ------------------------------------------------------------------------
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12" /></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <PageHeader
              title="Weekly Logs"
              description="Track your weekly internship activities day by day"
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleExportCsv}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Submit Weekly Log
                      </Button>
                    </DialogTrigger>

                    {/* ============ DAY-BY-DAY FORM DIALOG ============ */}
                    <DialogContent className="sm:max-w-[880px] gap-0">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" />
                          Submit Weekly Log
                        </DialogTitle>
                        <DialogDescription>
                          Fill in your activities for the week. Every field below is carried into the generated Word report — including the university logo and your signature.
                        </DialogDescription>
                      </DialogHeader>

                      <DialogBody className="px-5 sm:px-7">
                        <div className="space-y-6 py-2">
                          {/* ============ REPORT HEADER (auto-filled) ============ */}
                          <section className="rounded-xl border bg-muted/20 p-4 space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <GraduationCap className="h-4 w-4" />
                              Report Header
                              <span className="text-xs font-normal text-muted-foreground">(auto-filled from your profile)</span>
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              <InfoField label="University" value={headerInfo?.universityName} />
                              <InfoField label="Department" value={headerInfo?.departmentName} />
                              <InfoField label="Program" value={headerInfo?.programName} />
                              <InfoField label="Student Name" value={headerInfo?.studentName} />
                              <InfoField label="Registration No." value={headerInfo?.registrationNo} />
                              <InfoField label="Host Organization" value={headerInfo?.hostOrganization} />
                              <InfoField label="Supervisor" value={headerInfo?.supervisorName} />
                            </div>

                            {/* University logo (Word report header image) */}
                            <div className="space-y-2 rounded-lg border bg-background p-3">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                <ImagePlus className="h-4 w-4" />
                                University Logo
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Printed in the Word report header next to your university&apos;s name. Defaults to your university&apos;s official logo — upload your own if it is missing or outdated.
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                {(logoPreview || headerInfo?.universityLogoUrl) && (
                                  <img
                                    src={logoPreview || headerInfo?.universityLogoUrl || ""}
                                    alt="University logo"
                                    className="h-14 w-auto rounded border bg-white p-1 object-contain"
                                  />
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                  <Label
                                    htmlFor="wl-logo"
                                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                    {logoFile ? "Replace logo" : "Upload logo"}
                                  </Label>
                                  <Input
                                    id="wl-logo"
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    className="hidden"
                                    onChange={handleLogoChange}
                                  />
                                  {logoFile && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 gap-1 text-xs"
                                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Remove
                                    </Button>
                                  )}
                                </div>
                                {logoFile && (
                                  <span className="max-w-[200px] truncate text-xs text-muted-foreground">{logoFile.name}</span>
                                )}
                              </div>
                            </div>
                          </section>

                          {/* ============ WEEK DETAILS ============ */}
                          <section className="space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <Calendar className="h-4 w-4" />
                              Week Details
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label htmlFor="wl-from" className="text-sm font-medium">From</Label>
                                <Input
                                  id="wl-from"
                                  type="date"
                                  value={weekFromDate}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setWeekFromDate(v);
                                    // Keep the range valid: if From moves past To
                                    // (or onto it), slide To to From + 5 days so the
                                    // week always spans Mon–Sat and the daily rows
                                    // never silently disappear.
                                    if (v && weekToDate && v >= weekToDate) {
                                      const end = new Date(v + "T00:00:00");
                                      end.setDate(end.getDate() + 5);
                                      setWeekToDate(end.toISOString().slice(0, 10));
                                    }
                                  }}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="wl-to" className="text-sm font-medium">To</Label>
                                <Input
                                  id="wl-to"
                                  type="date"
                                  value={weekToDate}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    // Keep the range valid: To can never precede From.
                                    if (v && weekFromDate && v < weekFromDate) {
                                      setWeekToDate(weekFromDate);
                                    } else {
                                      setWeekToDate(v);
                                    }
                                  }}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="wl-week" className="text-sm font-medium">Week Number</Label>
                                <Input
                                  id="wl-week"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={weekNumber || ""}
                                  onChange={(e) => applyWeekNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                />
                                {internshipStartDate ? (
                                  <p className="text-xs text-muted-foreground">
                                    Dates auto-calculated from your internship start ({formatDate(internshipStartDate)}) — adjust if needed.
                                  </p>
                                ) : null}
                                {logs.some((l) => l.week_number === weekNumber && l.status !== "draft") && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400">
                                    You already submitted Week {weekNumber}. Submitting again for the same start date replaces that log.
                                  </p>
                                )}
                                {logs.some((l) => l.week_number !== weekNumber && l.week_start_date === weekFromDate && l.status !== "draft") && (
                                  <p className="text-xs text-destructive">
                                    These dates are already used by Week {logs.find((l) => l.week_number !== weekNumber && l.week_start_date === weekFromDate)?.week_number}. Change the week number or dates so you don&rsquo;t overwrite it.
                                  </p>
                                )}
                              </div>
                            </div>
                          </section>

                          {/* ============ DAY-BY-DAY ENTRIES ============ */}
                          <section className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold flex items-center gap-1.5">
                                <ListChecks className="h-4 w-4" />
                                Daily Activities
                              </Label>
                              <Badge variant="outline" className="text-xs">
                                {"Total: " + totalHoursWorked.toFixed(1) + "h"}
                              </Badge>
                            </div>

                            {dailyEntries.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Select a &ldquo;From&rdquo; date to generate daily entries.
                              </p>
                            )}

                            {dailyEntries.map((de, idx) => (
                              <motion.div
                                key={de.entry_date}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className={
                                  de.is_holiday
                                    ? "rounded-lg border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-3"
                                    : "rounded-lg border bg-card p-3"
                                }
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                  <div className="sm:w-40 shrink-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold">{de.day_name}</span>
                                      {de.is_holiday && (
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0">
                                          <Sun className="h-3 w-3 mr-0.5" />
                                          Holiday
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{" " + formatDate(de.entry_date)}</span>
                                    {de.is_holiday && de.holiday_name && (
                                      <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{de.holiday_name}</span>
                                    )}
                                  </div>

                                  {de.is_holiday ? (
                                    <div className="flex-1 flex items-center">
                                      <span className="text-sm text-muted-foreground italic">Holiday — no entry required</span>
                                    </div>
                                  ) : (
                                    <div className="flex-1 space-y-2">
                                      <Textarea
                                        placeholder="Describe tasks performed..."
                                        value={de.tasks_performed}
                                        onChange={(e) => updateDayEntry(idx, "tasks_performed", e.target.value)}
                                        rows={2}
                                        className="text-sm resize-none"
                                      />
                                      <div className="flex items-center gap-2">
                                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Hours:</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="24"
                                          step="0.5"
                                          value={de.hours_worked}
                                          onChange={(e) => updateDayEntry(idx, "hours_worked", e.target.value)}
                                          className="w-20 h-8 text-sm"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                            <p className="text-xs text-muted-foreground">
                              The Word report template covers Monday–Friday. Saturday entries are saved in the system for your supervisor&apos;s review.
                            </p>
                          </section>

                          {/* ============ LEARNING OUTCOMES ============ */}
                          <section className="space-y-1.5">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <Lightbulb className="h-4 w-4" />
                              Learning Outcomes / Skills Gained
                            </Label>
                            <Textarea
                              placeholder="Key learnings, new skills acquired, knowledge gained this week..."
                              value={learningOutcomes}
                              onChange={(e) => setLearningOutcomes(e.target.value)}
                              rows={3}
                            />
                          </section>

                          {/* ============ CHALLENGES ============ */}
                          <section className="space-y-1.5">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4" />
                              Challenges Faced and Solutions
                            </Label>
                            <Textarea
                              placeholder="Obstacles encountered and how you resolved them..."
                              value={challengesSolutions}
                              onChange={(e) => setChallengesSolutions(e.target.value)}
                              rows={3}
                            />
                          </section>

                          {/* ============ GOALS FOR NEXT WEEK ============ */}
                          <section className="space-y-1.5">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <Target className="h-4 w-4" />
                              Goals for Next Week
                            </Label>
                            <Textarea
                              placeholder="What you plan to accomplish next week..."
                              value={nextWeekGoals}
                              onChange={(e) => setNextWeekGoals(e.target.value)}
                              rows={2}
                            />
                          </section>

                          {/* ============ SUPPORTING EVIDENCE ============ */}
                          <section className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <Paperclip className="h-4 w-4" />
                              Supporting Evidence
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Tick the evidence you are attaching — the generated Word report shows the same list with a checked box (☑) on your selection and empty boxes (☐) on the rest. Then attach the files/links below; images are embedded in the report and other files are attached at the end.
                            </p>

                            {/* Evidence TYPE multi-select (tick list) — mirrors the
                                Word report checklist 1:1. */}
                            <div className="grid gap-1.5 sm:grid-cols-2 p-3 rounded-lg border bg-background/50">
                              {EVIDENCE_OPTIONS.map((opt) => {
                                const checked = evidenceTicks.includes(opt);
                                return (
                                  <label
                                    key={opt}
                                    className="flex items-start gap-2.5 rounded-md px-2.5 py-2 text-xs cursor-pointer select-none hover:bg-accent/60 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setEvidenceTicks((prev) =>
                                          prev.includes(opt)
                                            ? prev.filter((t) => t !== opt)
                                            : [...prev, opt]
                                        )
                                      }
                                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                                      aria-label={opt}
                                    />
                                    <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                                      {opt}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>

                            <Label
                              htmlFor="wl-evidence"
                              className="cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-3 text-xs font-medium hover:bg-accent transition-colors"
                            >
                              <Upload className="h-4 w-4" />
                              Click to attach files (PDF, images or docs — up to 10MB each, max 10)
                            </Label>
                            <Input
                              id="wl-evidence"
                              type="file"
                              multiple
                              className="hidden"
                              onChange={handleEvidenceChange}
                            />
                            {evidenceFiles.length > 0 && (
                              <ul className="space-y-1">
                                {evidenceFiles.map((f, i) => (
                                  <li key={i} className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                                    <span className="truncate flex items-center gap-1.5 min-w-0">
                                      <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      <span className="truncate">{f.name}</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeEvidenceFile(i)}
                                      className="text-muted-foreground hover:text-destructive shrink-0"
                                      aria-label={"Remove " + f.name}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* Evidence LINKS — rendered as live hyperlinks in the
                                Word report's Attachments section. */}
                            <div className="flex items-center gap-2">
                              <Input
                                type="url"
                                inputMode="url"
                                placeholder="Or paste a link (GitHub repo, Drive folder, portfolio…)"
                                value={evidenceLinkInput}
                                onChange={(e) => setEvidenceLinkInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addEvidenceLink();
                                  }
                                }}
                                className="text-xs h-9"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 shrink-0"
                                onClick={addEvidenceLink}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Add Link
                              </Button>
                            </div>
                            {evidenceLinks.length > 0 && (
                              <ul className="space-y-1">
                                {evidenceLinks.map((url, i) => (
                                  <li key={i} className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                                    <span className="truncate flex items-center gap-1.5 min-w-0">
                                      <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      <span className="truncate text-blue-600">{url}</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeEvidenceLink(i)}
                                      className="text-muted-foreground hover:text-destructive shrink-0"
                                      aria-label={"Remove link " + url}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </section>

                          {/* ============ STUDENT SIGNATURE ============ */}
                          <section className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <PenTool className="h-4 w-4" />
                              Student Signature
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Draw or type your signature — it is embedded in the Word report&apos;s signature section. Alternatively, upload a scanned signature image.
                            </p>
                            <SignaturePad
                              label="Draw / Type Signature"
                              onSignatureChange={(v) => {
                                setSignatureData(v);
                                if (v) setSignatureFile(null);
                              }}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Label
                                htmlFor="wl-signature-file"
                                className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Or upload a signature image (PNG/JPG, max 1MB)
                              </Label>
                              <Input
                                id="wl-signature-file"
                                type="file"
                                accept="image/png,image/jpeg"
                                className="hidden"
                                onChange={handleSignatureFileChange}
                              />
                              {signatureFile && (
                                <>
                                  <span className="max-w-[180px] truncate text-xs text-muted-foreground">{signatureFile.name}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => setSignatureFile(null)}
                                  >
                                    <X className="h-3 w-3" />
                                    Remove
                                  </Button>
                                </>
                              )}
                            </div>
                          </section>
                        </div>
                      </DialogBody>

                      <DialogFooter className="px-5 sm:px-7">
                        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-xs text-muted-foreground" aria-live="polite">
                            {isSubmitting ? uploadStage || "Submitting..." : ""}
                          </span>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                              {isSubmitting ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              {isSubmitting ? "Submitting..." : "Submit Weekly Log"}
                            </Button>
                          </div>
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              }
            />
          </motion.div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="container mx-auto px-4 py-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard label="Total Submitted" value={logs.filter((l) => l.submittedAt).length} icon={FileText} variant="info" />
          <StatCard label="Approved" value={logs.filter((l) => l.status === "approved").length} icon={CheckCircle2} variant="success" />
          <StatCard label="Pending" value={pendingWeeks.length} icon={Clock} variant="warning" />
          <StatCard label="Hours Logged" value={logs.reduce((acc, l) => acc + (l.hours_worked || 0), 0).toFixed(1)} icon={Timer} variant="default" />
        </motion.div>

        {/* Weekly Logs List */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No weekly logs yet</p>
                <p className="text-sm text-muted-foreground mt-1">Click &ldquo;Submit Weekly Log&rdquo; above to record your first week.</p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log, index) => {
              const isExpanded = expandedLogId === log.id;
              const hasDailyEntries = (log.daily_entries || []).length > 0;
              return (
                <motion.div key={log.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
                  <Card className="transition-all hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <CardTitle className="text-lg break-words">
                            {log.week_number ? ("Week " + log.week_number + " \u00B7 ") : ""}
                            {formatDate(log.week_start_date)}
                            {log.week_end_date ? (" \u2013 " + formatDate(log.week_end_date)) : ""}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 min-w-0">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span className="whitespace-nowrap">{log.week_start_date} — {log.week_end_date}</span>
                            {log.hours_worked !== null && (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap"><Timer className="h-3 w-3" /> {log.hours_worked}h</span>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:shrink-0">
                          <StatusBadge status={log.status} />
                          {log.submittedAt && <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.submittedAt).toLocaleDateString()}</span>}
                          <Button variant="ghost" size="sm" className="gap-1.5 h-7" title="Download Word Document" onClick={() => handleDownloadWord(log)}>
                            <Printer className="h-3.5 w-3.5" />
                            Word
                          </Button>
                          {log.status === "approved" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-7"
                              disabled
                              title="Approved logs are part of the academic record and cannot be deleted — ask your supervisor to request a revision instead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-7 text-destructive hover:text-destructive"
                              title="Delete weekly log"
                              onClick={() => setDeleteLogTarget(log)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          )}
                          {hasDailyEntries && (
                            <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {isExpanded ? "Hide" : "Details"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Expanded daily details */}
                    <AnimatePresence>
                      {isExpanded && hasDailyEntries && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <CardContent className="pt-0 space-y-3">
                            <div className="rounded-lg border overflow-hidden">
                              <div className="grid grid-cols-[96px_1fr_56px] sm:grid-cols-[120px_1fr_80px] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                <span>Day</span><span>Tasks Performed</span><span className="text-right">Hours</span>
                              </div>
                              {(log.daily_entries || []).map((de: any, i: number) => (
                                <div key={de.id || i} className={"grid grid-cols-[96px_1fr_56px] sm:grid-cols-[120px_1fr_80px] px-3 py-2 border-t text-xs sm:text-sm " + (de.is_holiday ? "bg-amber-50/50 dark:bg-amber-950/20" : "")}>
                                  <span className="font-medium break-words">{DAY_NAMES[(de.day_of_week || 1) - 1] || "Day"}</span>
                                  <span className="text-muted-foreground break-words">
                                    {de.is_holiday ? <span className="italic text-amber-600 dark:text-amber-400">Holiday{de.notes ? (" \u2014 " + de.notes) : ""}</span> : (de.tasks_performed || "\u2014")}
                                  </span>
                                  <span className="text-right whitespace-nowrap">{de.is_holiday ? "\u2014" : ((de.hours_worked || 0) + "h")}</span>
                                </div>
                              ))}
                            </div>

                            {log.learning_outcomes && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Learning Outcomes</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learning_outcomes}</p>
                              </div>
                            )}
                            {log.challenges_solutions && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Challenges &amp; Solutions</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges_solutions}</p>
                              </div>
                            )}
                            {!log.learning_outcomes && log.learnings && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Learnings</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learnings}</p>
                              </div>
                            )}
                            {!log.challenges_solutions && log.challenges && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Challenges</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges}</p>
                              </div>
                            )}
                            {log.next_week_goals && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Target className="h-4 w-4" /> Next Week Goals</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.next_week_goals}</p>
                              </div>
                            )}
                            {log.supervisor_feedback && (
                              <div className="pt-2 border-t">
                                <h4 className="text-sm font-semibold mb-1">Supervisor Feedback:</h4>
                                <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{log.supervisor_feedback}</p>
                              </div>
                            )}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isExpanded && hasDailyEntries && (
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">{(log.daily_entries || []).length} daily entries &middot; Click &ldquo;Details&rdquo; to expand</p>
                      </CardContent>
                    )}

                    {/* Legacy logs without daily entries */}
                    {!hasDailyEntries && (
                      <CardContent className="pt-0 space-y-3">
                        {log.tasks_completed && log.tasks_completed.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> Tasks Completed</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">{log.tasks_completed.map((task, i) => <li key={i}>{task}</li>)}</ul>
                          </div>
                        )}
                        {log.challenges && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Challenges</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges}</p>
                          </div>
                        )}
                        {log.learnings && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Learnings</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learnings}</p>
                          </div>
                        )}
                        {log.next_week_goals && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Target className="h-4 w-4" /> Next Week Goals</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.next_week_goals}</p>
                          </div>
                        )}
                        {log.supervisor_feedback && (
                          <div className="pt-2 border-t">
                            <h4 className="text-sm font-semibold mb-1">Supervisor Feedback:</h4>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{log.supervisor_feedback}</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Weekly Log Confirmation */}
      <ConfirmDialog
        open={deleteLogTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteLogTarget(null);
        }}
        title={
          <>
            <Trash2 className="h-5 w-5 shrink-0" />
            Delete weekly log?
          </>
        }
        description={
          deleteLogTarget
            ? `This permanently deletes your ${
                deleteLogTarget.week_number ? `Week ${deleteLogTarget.week_number}` : ""
              } log (${formatDate(deleteLogTarget.week_start_date)} – ${formatDate(
                deleteLogTarget.week_end_date
              )}, status: ${deleteLogTarget.status}) including its daily entries, hours and attachments. Approved logs cannot be deleted — they are part of the academic record. This action cannot be undone.`
            : ""
        }
        confirmLabel={isDeletingLog ? "Deleting..." : "Delete Log"}
        variant="danger"
        loading={isDeletingLog}
        onConfirm={handleDeleteLog}
      />
    </div>
  );
}
