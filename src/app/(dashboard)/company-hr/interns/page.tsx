"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Search,
  Plus,
  Edit,
  Eye,
  UserCheck,
  Users,
  Mail,
  Phone,
  GraduationCap,
  Building2,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  UserPlus,
  ClipboardList,
  FolderOpen,
  Star,
  Shield,
  TrendingUp,
  ArrowRightLeft,
  Filter,
  FileDown,
  Loader2,
  UserMinus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { createClient } from "@/utils/supabase/client";
import { generatePdf } from "@/lib/export-helpers";
import { toast } from "@/components/shared/toast";

// Types
interface ActiveIntern {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  phone?: string | null;
  university: string;
  department: string;
  internship_id: string;
  internship_title: string;
  supervisor_id?: string | null;
  supervisor_name?: string | null;
  start_date: string;
  end_date: string;
  status: "assigned" | "active" | "paused" | "completed" | "terminated";
  attendance_rate: number;
  overall_rating?: number | null;
  offer_letter_uploaded: boolean;
  certificate_issued: boolean;
  weekly_logs_submitted: number;
  total_weeks: number;
}

// Default empty state - interns will be fetched from database
const DEFAULT_INTERNS: ActiveIntern[] = [];

// Curated program filter list — replaced dynamically after data loads.
const DEFAULT_PROGRAMS = ["All Internships"];

export default function CompanyHRInternsPage() {
  const { profile } = useAuth();
  const [interns, setInterns] = useState<ActiveIntern[]>(DEFAULT_INTERNS);
  const [supervisors, setSupervisors] = useState<Array<{ user_id: string; name: string; email: string }>>([]);
  const [externalEvaluators, setExternalEvaluators] = useState<Array<{ user_id: string; name: string; email: string }>>([]);
  const [programs, setPrograms] = useState<string[]>(DEFAULT_PROGRAMS);
  const [isLoading, setIsLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchInterns();
  }, [profile?.company_id]);

  async function fetchInterns() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/company-hr/interns", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      const list = (j.data || []).map((intern: any) => ({
        id: intern.id,
        student_id: intern.student_user_id,
        student_name: intern.student_name || "Unknown",
        student_email: intern.student_email || "",
        phone: intern.student_phone || null,
        university: intern.university || "",
        department: intern.department || "",
        internship_id: intern.internship_id,
        internship_title: intern.internship_title || "Unknown Internship",
        supervisor_id: intern.site_supervisor_id,
        supervisor_name: intern.supervisor_name || null,
        start_date: intern.start_date,
        end_date: intern.end_date,
        status: intern.status || "active",
        attendance_rate: intern.attendance_rate || 0,
        overall_rating: intern.overall_rating || 0,
        offer_letter_uploaded: intern.offer_letter_uploaded || false,
        certificate_issued: intern.certificate_issued || false,
        weekly_logs_submitted: intern.weekly_logs_submitted || 0,
        total_weeks: intern.internship_duration_weeks || 0,
      }));
      setInterns(list);
      setSupervisors(j.supervisors || []);
      setExternalEvaluators(j.external_evaluators || []);
      // Build program filter list from data
      const uniquePrograms = Array.from(new Set(list.map((i: any) => i.internship_title).filter(Boolean))) as string[];
      setPrograms(["All Internships", ...uniquePrograms]);
    } catch (error) {
      console.error("Error fetching interns:", error);
    } finally {
      setIsLoading(false);
    }
  }
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [selectedIntern, setSelectedIntern] = useState<ActiveIntern | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assigningInternId, setAssigningInternId] = useState<string | null>(null);
  const [selectedSupervisorForAssignment, setSelectedSupervisorForAssignment] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");
  // Per-intern PDF download state. Holds a string key like "weekly:<internId>"
  // or "final:<internId>" while a download is in flight so the menu item can
  // show a spinner and prevent duplicate clicks.
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null);

  // Unassign-supervisor confirmation state
  const [unassignTarget, setUnassignTarget] = useState<ActiveIntern | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const filteredInterns = interns.filter((intern) => {
    const matchesSearch = 
      intern.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intern.student_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intern.internship_title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || intern.status === statusFilter;
    const matchesProgram = programFilter === "all" || intern.internship_title === programFilter;
    
    return matchesSearch && matchesStatus && matchesProgram;
  });

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();

  const handleAssignSupervisor = async () => {
    if (!assigningInternId || !selectedSupervisorForAssignment) return;
    setAssigning(true);
    try {
      // Look up the intern to get the student_user_id needed by the API.
      const intern = interns.find((i) => i.id === assigningInternId);
      if (!intern) throw new Error("Intern not found");
      const res = await fetch("/api/company-hr/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisor_id: selectedSupervisorForAssignment,
          intern_ids: [intern.student_id],
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `Failed (${res.status})`);
      const supervisor =
        supervisors.find((s) => s.user_id === selectedSupervisorForAssignment) ||
        externalEvaluators.find((s) => s.user_id === selectedSupervisorForAssignment);
      setInterns(
        interns.map((i) =>
          i.id === assigningInternId
            ? {
                ...i,
                supervisor_id: selectedSupervisorForAssignment,
                supervisor_name: supervisor?.name || null,
              }
            : i
        )
      );
      setIsAssignOpen(false);
      setAssigningInternId(null);
      setSelectedSupervisorForAssignment("");
    } catch (e: any) {
      toast.error("Assignment Failed", { description: e.message || "Failed to assign supervisor" });
    } finally {
      setAssigning(false);
    }
  };

  const openAssignDialog = (internId: string) => {
    setAssigningInternId(internId);
    setIsAssignOpen(true);
  };

  // Unassign the current supervisor from an intern — same endpoint &
  // payload shape the Supervisors page uses (DELETE
  // /api/company-hr/assignments with { supervisor_id, intern_id }).
  const handleUnassignSupervisor = async () => {
    if (!unassignTarget?.supervisor_id) return;
    setIsUnassigning(true);
    try {
      const res = await fetch("/api/company-hr/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisor_id: unassignTarget.supervisor_id,
          intern_id: unassignTarget.student_id,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `Failed (${res.status})`);
      toast.success("Supervisor unassigned", {
        description: `${unassignTarget.supervisor_name || "Supervisor"} is no longer supervising ${unassignTarget.student_name}.`,
      });
      const unassignedId = unassignTarget.id;
      setUnassignTarget(null);
      if (selectedIntern?.id === unassignedId) {
        setSelectedIntern((prev) =>
          prev && prev.id === unassignedId
            ? { ...prev, supervisor_id: null, supervisor_name: null }
            : prev
        );
      }
      setInterns(
        interns.map((i) =>
          i.id === unassignedId
            ? { ...i, supervisor_id: null, supervisor_name: null }
            : i
        )
      );
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to unassign supervisor" });
    } finally {
      setIsUnassigning(false);
    }
  };

  // ── Remove Placement ──────────────────────────────────────
  // Deletes the student_internships row for this intern. Weekly logs,
  // evaluations and attendance history are preserved; the intern simply
  // no longer has an active placement at the company.
  const [removeTarget, setRemoveTarget] = useState<ActiveIntern | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemovePlacement = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/company-hr/interns/${encodeURIComponent(removeTarget.id)}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        throw new Error(j?.error?.message || j?.error || `Failed (${res.status})`);
      }
      toast.success("Placement removed", {
        description: `${removeTarget.student_name} is no longer placed in "${removeTarget.internship_title}".`,
      });
      const removedId = removeTarget.id;
      setRemoveTarget(null);
      if (selectedIntern?.id === removedId) {
        setSelectedIntern(null);
        setIsDetailOpen(false);
      }
      setInterns((prev) => prev.filter((i) => i.id !== removedId));
    } catch (e: any) {
      toast.error("Failed to remove placement", {
        description: e.message || "Please try again.",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Per-intern PDF downloads.
  //
  // Company HR can read weekly_logs / evaluations / attendance for any
  // internship at their company (RLS policies `wl_select`, `eval_select`,
  // `att_select` in supabase/migrations/0002_rls_policies.sql). We fetch the
  // rows directly from Supabase and render them with `generatePdf()` — same
  // pattern as the faculty-supervisor weekly-logs page.
  // ---------------------------------------------------------------------------

  // Download every weekly log for one intern as a single PDF.
  const handleDownloadWeeklyLogsPdf = async (intern: ActiveIntern) => {
    const studentUserId = intern.student_id;
    const key = `weekly:${intern.id}`;
    if (downloadingFor === key) return;
    setDownloadingFor(key);
    try {
      const supabase = createClient();
      const { data: logs, error } = await supabase
        .from("weekly_logs")
        .select(
          "id, week_number, week_start_date, week_end_date, hours_worked, status, submitted_at, tasks_completed, challenges, learnings, supervisor_feedback"
        )
        .eq("student_user_id", studentUserId)
        .order("week_start_date", { ascending: true });

      if (error) throw error;

      const logList = (logs || []) as Array<{
        week_number: number;
        week_start_date: string;
        week_end_date: string;
        hours_worked: number | null;
        status: string;
        submitted_at: string | null;
        tasks_completed: string[] | null;
        challenges: string | null;
        learnings: string | null;
        supervisor_feedback: string | null;
      }>;

      const totalHours = logList.reduce((sum, l) => sum + (Number(l.hours_worked) || 0), 0);

      const sections = logList.length === 0
        ? [{ title: "Weekly Logs", lines: ["No weekly logs have been submitted yet."] }]
        : logList.map((l) => ({
            title: `Week ${l.week_number} — ${l.week_start_date} to ${l.week_end_date}`,
            lines: [
              { label: "Status", value: l.status || "—" },
              { label: "Hours Worked", value: String(l.hours_worked ?? "—") },
              {
                label: "Submitted At",
                value: l.submitted_at ? new Date(l.submitted_at).toLocaleString() : "—",
              },
            ],
            bullets:
              Array.isArray(l.tasks_completed) && l.tasks_completed.length > 0
                ? l.tasks_completed
                : ["(no tasks recorded)"],
          }));

      generatePdf(
        {
          title: `Weekly Logs — ${intern.student_name}`,
          subtitle: `${intern.internship_title}`,
          metadata: [
            { label: "Intern", value: intern.student_name },
            { label: "Email", value: intern.student_email || "—" },
            { label: "Internship", value: intern.internship_title || "—" },
            { label: "Total Weeks", value: String(logList.length) },
            { label: "Total Hours", value: String(totalHours) },
          ],
          sections,
          footer: `CareerStep — Weekly Logs export for ${intern.student_name} on ${new Date().toLocaleString()}`,
        },
        `weekly-logs-${intern.student_name.replace(/\s+/g, "-").toLowerCase()}.pdf`
      );
    } catch (error) {
      console.error("Error generating weekly logs PDF:", error);
      toast.error("Export Failed", { description: error instanceof Error ? error.message : "Could not generate the weekly logs PDF." });
    } finally {
      setDownloadingFor(null);
    }
  };

  // Download a combined final-report PDF for one intern: weekly logs +
  // evaluations + attendance, plus a simple summary block.
  const handleDownloadFinalReportPdf = async (intern: ActiveIntern) => {
    const studentUserId = intern.student_id;
    const key = `final:${intern.id}`;
    if (downloadingFor === key) return;
    setDownloadingFor(key);
    try {
      const supabase = createClient();

      // Fetch the three data sources in parallel — RLS allows the HR to read
      // any student/internship at their company.
      const [logsRes, evalsRes, attRes] = await Promise.all([
        supabase
          .from("weekly_logs")
          .select("id, week_number, week_start_date, week_end_date, hours_worked, status, submitted_at, tasks_completed, challenges, learnings")
          .eq("student_user_id", studentUserId)
          .order("week_start_date", { ascending: true }),
        supabase
          .from("evaluations")
          .select("id, type, status, rating, comments, evaluator_role, submitted_at")
          .eq("student_user_id", studentUserId)
          .order("submitted_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("attendance")
          .select("id, date, status, check_in, check_out, notes")
          .eq("student_user_id", studentUserId)
          .order("date", { ascending: true }),
      ]);

      if (logsRes.error) throw logsRes.error;
      if (evalsRes.error) throw evalsRes.error;
      if (attRes.error) throw attRes.error;

      const logs = (logsRes.data || []) as Array<{
        week_number: number;
        week_start_date: string;
        week_end_date: string;
        hours_worked: number | null;
        status: string;
        submitted_at: string | null;
        tasks_completed: string[] | null;
        challenges: string | null;
        learnings: string | null;
      }>;
      const evals = (evalsRes.data || []) as Array<{
        type: string;
        status: string;
        rating: number | null;
        comments: string | null;
        evaluator_role: string;
        submitted_at: string | null;
      }>;
      const att = (attRes.data || []) as Array<{
        date: string;
        status: string;
        check_in: string | null;
        check_out: string | null;
        notes: string | null;
      }>;

      // --- Summary computations ---
      const totalWeeks = logs.length;
      const totalHours = logs.reduce((s, l) => s + (Number(l.hours_worked) || 0), 0);
      const ratings = evals
        .map((e) => Number(e.rating))
        .filter((r) => Number.isFinite(r));
      const averageScore =
        ratings.length > 0
          ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2)
          : "—";
      const presentCount = att.filter((a) => a.status === "present").length;
      const attendanceRate =
        att.length > 0
          ? `${Math.round((presentCount / att.length) * 100)}%`
          : "—";

      // --- Build sections ---
      const sections: Array<{
        title?: string;
        lines?: Array<string | { label: string; value: string }>;
        bullets?: string[];
      }> = [];

      if (logs.length === 0) {
        sections.push({ title: "Weekly Logs", lines: ["No weekly logs submitted."] });
      } else {
        logs.forEach((l) => {
          sections.push({
            title: `Week ${l.week_number} — ${l.week_start_date} → ${l.week_end_date}`,
            lines: [
              { label: "Status", value: l.status || "—" },
              { label: "Hours", value: String(l.hours_worked ?? "—") },
              {
                label: "Submitted",
                value: l.submitted_at ? new Date(l.submitted_at).toLocaleDateString() : "—",
              },
            ],
            bullets:
              Array.isArray(l.tasks_completed) && l.tasks_completed.length > 0
                ? l.tasks_completed
                : ["(no tasks recorded)"],
          });
        });
      }

      if (evals.length === 0) {
        sections.push({ title: "Evaluations", lines: ["No evaluations recorded."] });
      } else {
        sections.push({
          title: "Evaluations",
          lines: evals.map((e) => ({
            label: e.type || e.evaluator_role || "Evaluation",
            value: `Rating: ${e.rating ?? "—"} / 5 · Status: ${e.status}${
              e.comments ? ` · ${e.comments}` : ""
            }${e.submitted_at ? ` · ${new Date(e.submitted_at).toLocaleDateString()}` : ""}`,
          })),
        });
      }

      if (att.length === 0) {
        sections.push({ title: "Attendance", lines: ["No attendance records."] });
      } else {
        sections.push({
          title: `Attendance (${att.length} records, ${attendanceRate} present)`,
          lines: att.slice(0, 50).map((a) => ({
            label: a.date,
            value: `${a.status}${a.check_in ? ` · in ${new Date(a.check_in).toLocaleTimeString()}` : ""}${
              a.check_out ? ` · out ${new Date(a.check_out).toLocaleTimeString()}` : ""
            }${a.notes ? ` · ${a.notes}` : ""}`,
          })),
        });
        if (att.length > 50) {
          sections.push({
            lines: [`... and ${att.length - 50} more attendance records not shown.`],
          });
        }
      }

      generatePdf(
        {
          title: `Final Internship Report — ${intern.student_name}`,
          subtitle: `${intern.internship_title}`,
          metadata: [
            { label: "Intern", value: intern.student_name },
            { label: "Email", value: intern.student_email || "—" },
            { label: "Internship", value: intern.internship_title || "—" },
            { label: "University", value: intern.university || "—" },
            { label: "Department", value: intern.department || "—" },
            { label: "Total Weeks Logged", value: String(totalWeeks) },
            { label: "Total Hours Logged", value: String(totalHours) },
            { label: "Average Evaluation Score", value: `${averageScore} / 5` },
            { label: "Attendance Rate", value: attendanceRate },
            { label: "Evaluations Count", value: String(evals.length) },
          ],
          sections,
          footer: `CareerStep — Final Report export for ${intern.student_name} on ${new Date().toLocaleString()}`,
        },
        `final-report-${intern.student_name.replace(/\s+/g, "-").toLowerCase()}.pdf`
      );
    } catch (error) {
      console.error("Error generating final report PDF:", error);
      toast.error("Export Failed", { description: error instanceof Error ? error.message : "Could not generate the final report PDF." });
    } finally {
      setDownloadingFor(null);
    }
  };

  // Stats
  const stats = {
    total: interns.length,
    active: interns.filter(i => ["assigned", "active"].includes(i.status)).length,
    onLeave: interns.filter(i => i.status === "paused").length,
    completed: interns.filter(i => i.status === "completed").length,
    unassigned: interns.filter(i => !i.supervisor_id && (i.status === "active" || i.status === "assigned")).length,
    avgAttendance: interns.length > 0
      ? Math.round(interns.reduce((acc, i) => acc + i.attendance_rate, 0) / interns.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Active Interns"
        description="Manage and track your current interns' progress"
        actions={
          <Button asChild variant="outline">
            <Link href="/company-hr/documents" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Manage Documents
            </Link>
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">On Leave</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.onLeave}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-purple-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Unassigned</p>
            <p className="text-2xl font-bold text-red-600">{stats.unassigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Avg Attendance</p>
            <p className="text-2xl font-bold text-primary">{stats.avgAttendance}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
          </TabsList>

          {/* Unassigned Alert */}
          {stats.unassigned > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
            >
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800">
                <strong>{stats.unassigned}</strong> active intern(s) without assigned supervisors
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto bg-white hover:bg-amber-50"
                onClick={() => {
                  const firstUnassigned = interns.find((i) => !i.supervisor_id && (i.status === "active" || i.status === "assigned"));
                  if (firstUnassigned) openAssignDialog(firstUnassigned.id);
                }}
                disabled={stats.unassigned === 0}
              >
                Assign Now
              </Button>
            </motion.div>
          )}
        </div>

        <TabsContent value={activeTab} className="mt-6">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search interns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Internships" />
              </SelectTrigger>
              <SelectContent>
                {programs.map(program => (
                  <SelectItem key={program} value={program}>{program}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Interns Table */}
          <Card>
            <CardContent className="p-0">
              {/* Mobile View */}
              <div className="block lg:hidden divide-y">
                {filteredInterns.map((intern) => (
                  <div key={intern.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{getInitials(intern.student_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{intern.student_name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{intern.internship_title}</p>
                        </div>
                      </div>
                      <StatusBadge status={intern.status} />
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground pl-13">
                      <span>{intern.university}</span>
                      <span>•</span>
                      <span>{intern.department}</span>
                    </div>

                    <div className="space-y-2 pl-13">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Supervisor</span>
                        <span>{intern.supervisor_name || <span className="text-amber-600">Unassigned</span>}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Attendance</span>
                        <span className="font-medium">{intern.attendance_rate}%</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedIntern(intern); setIsDetailOpen(true); }}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      {!intern.supervisor_id && intern.status === "active" && (
                        <Button size="sm" onClick={() => openAssignDialog(intern.id)}>
                          <UserPlus className="h-3 w-3 mr-1" /> Assign
                        </Button>
                      )}
                      {intern.supervisor_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-600 hover:text-amber-700"
                          onClick={() => setUnassignTarget(intern)}
                          disabled={isUnassigning}
                        >
                          <UserMinus className="h-3 w-3 mr-1" /> Unassign
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Intern</TableHead>
                      <TableHead>University</TableHead>
                      <TableHead>Internship</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInterns.map((intern) => (
                      <TableRow key={intern.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs">{getInitials(intern.student_name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{intern.student_name}</p>
                              <p className="text-sm text-muted-foreground">{intern.student_email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{intern.university}</p>
                            <p className="text-xs text-muted-foreground">{intern.department}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <p className="truncate" title={intern.internship_title}>{intern.internship_title}</p>
                        </TableCell>
                        <TableCell>
                          {intern.supervisor_name ? (
                            <Badge variant="outline">{intern.supervisor_name}</Badge>
                          ) : (
                            <button
                              onClick={() => openAssignDialog(intern.id)}
                              className="text-sm text-amber-600 hover:text-amber-700 hover:underline"
                            >
                              Unassigned
                            </button>
                          )}
                        </TableCell>
                        <TableCell><StatusBadge status={intern.status} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={intern.attendance_rate} className="h-2 w-16" />
                            <span className="text-sm">{intern.attendance_rate}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {intern.weekly_logs_submitted}/{intern.total_weeks} weeks
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <span title="Offer Letter" className={`w-6 h-6 rounded-full flex items-center justify-center ${intern.offer_letter_uploaded ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                              <FileText className="h-3 w-3" />
                            </span>
                            <span title="Certificate" className={`w-6 h-6 rounded-full flex items-center justify-center ${intern.certificate_issued ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                              <Star className="h-3 w-3" />
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedIntern(intern); setIsDetailOpen(true); }}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={downloadingFor === `weekly:${intern.id}`}
                                onClick={() => handleDownloadWeeklyLogsPdf(intern)}
                              >
                                {downloadingFor === `weekly:${intern.id}` ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <FileDown className="mr-2 h-4 w-4" />
                                )}
                                Download Weekly Logs (PDF)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={downloadingFor === `final:${intern.id}`}
                                onClick={() => handleDownloadFinalReportPdf(intern)}
                              >
                                {downloadingFor === `final:${intern.id}` ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <FileDown className="mr-2 h-4 w-4" />
                                )}
                                Download Final Report (PDF)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openAssignDialog(intern.id)} disabled={!intern.status.includes('active')}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" /> Reassign Supervisor
                              </DropdownMenuItem>
                              {intern.supervisor_id && (
                                <DropdownMenuItem
                                  className="text-amber-600 focus:text-amber-700"
                                  onClick={() => setUnassignTarget(intern)}
                                >
                                  <UserMinus className="mr-2 h-4 w-4" /> Unassign Supervisor
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link href={`/company-hr/attendance?intern=${intern.id}`}>
                                  <ClipboardList className="mr-2 h-4 w-4" /> View Attendance
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/company-hr/documents?intern=${intern.id}`}>
                                  <FolderOpen className="mr-2 h-4 w-4" /> Documents
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setRemoveTarget(intern)}
                              >
                                <UserMinus className="mr-2 h-4 w-4" /> Remove Placement
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredInterns.length === 0 && (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Interns Found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          {selectedIntern && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(selectedIntern.student_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedIntern.student_name}</p>
                    <p className="font-normal text-sm text-muted-foreground">
                      {selectedIntern.internship_title}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  <StatusBadge status={selectedIntern.status} />
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-6">
                {/* Contact Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold text-sm">Contact Information</h4>
                    <InfoRow label="Email" value={selectedIntern.student_email} icon={<Mail className="h-3 w-3" />} />
                    {selectedIntern.phone && (
                      <InfoRow label="Phone" value={selectedIntern.phone} icon={<Phone className="h-3 w-3" />} />
                    )}
                  </div>

                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold text-sm">Academic Information</h4>
                    <InfoRow label="University" value={selectedIntern.university} icon={<GraduationCap className="h-3 w-3" />} />
                    <InfoRow label="Department" value={selectedIntern.department} icon={<Building2 className="h-3 w-3" />} />
                  </div>
                </div>

                {/* Assignment Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold text-sm">Internship Details</h4>
                    <InfoRow label="Start Date" value={new Date(selectedIntern.start_date).toLocaleDateString()} icon={<Calendar className="h-3 w-3" />} />
                    <InfoRow label="End Date" value={new Date(selectedIntern.end_date).toLocaleDateString()} icon={<Calendar className="h-3 w-3" />} />
                    <InfoRow label="Duration" value={`${Math.ceil((new Date(selectedIntern.end_date).getTime() - new Date(selectedIntern.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000))} weeks`} />
                  </div>

                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold text-sm">Supervisor Assignment</h4>
                    {selectedIntern.supervisor_name ? (
                      <>
                        <InfoRow label="Assigned To" value={selectedIntern.supervisor_name} icon={<Shield className="h-3 w-3" />} highlight />
                        <div className="flex flex-col gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => openAssignDialog(selectedIntern.id)}
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" /> Reassign
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-amber-600 hover:text-amber-700"
                            onClick={() => setUnassignTarget(selectedIntern)}
                            disabled={isUnassigning}
                          >
                            <UserMinus className="h-3 w-3 mr-1" /> Unassign Supervisor
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">No supervisor assigned</p>
                        <Button size="sm" onClick={() => openAssignDialog(selectedIntern.id)}>
                          <UserPlus className="h-3 w-3 mr-1" /> Assign Now
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance Summary */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold text-sm">Performance Summary</h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{selectedIntern.attendance_rate}%</p>
                      <p className="text-xs text-muted-foreground">Attendance Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{selectedIntern.weekly_logs_submitted}/{selectedIntern.total_weeks}</p>
                      <p className="text-xs text-muted-foreground">Weekly Logs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {selectedIntern.overall_rating ? `${selectedIntern.overall_rating}/5` : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">Overall Rating</p>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Weekly Progress</span>
                      <span>{selectedIntern.total_weeks > 0 ? Math.round((selectedIntern.weekly_logs_submitted / selectedIntern.total_weeks) * 100) : 0}%</span>
                    </div>
                    <Progress value={selectedIntern.total_weeks > 0 ? (selectedIntern.weekly_logs_submitted / selectedIntern.total_weeks) * 100 : 0} className="h-2" />
                  </div>
                </div>

                {/* Document Status */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold text-sm">Document Status</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`flex items-center gap-3 p-3 rounded-lg ${selectedIntern.offer_letter_uploaded ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <FileText className={`h-5 w-5 ${selectedIntern.offer_letter_uploaded ? 'text-emerald-600' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">Offer Letter</p>
                        <p className={`text-xs ${selectedIntern.offer_letter_uploaded ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {selectedIntern.offer_letter_uploaded ? 'Uploaded' : 'Not Uploaded'}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded-lg ${selectedIntern.certificate_issued ? 'bg-purple-50' : 'bg-gray-50'}`}>
                      <Star className={`h-5 w-5 ${selectedIntern.certificate_issued ? 'text-purple-600' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">Certificate</p>
                        <p className={`text-xs ${selectedIntern.certificate_issued ? 'text-purple-600' : 'text-gray-500'}`}>
                          {selectedIntern.certificate_issued ? 'Issued' : 'Not Issued'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogBody>

              <DialogFooter className="flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingFor === `weekly:${selectedIntern.id}`}
                  onClick={() => handleDownloadWeeklyLogsPdf(selectedIntern)}
                >
                  {downloadingFor === `weekly:${selectedIntern.id}` ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Weekly Logs (PDF)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingFor === `final:${selectedIntern.id}`}
                  onClick={() => handleDownloadFinalReportPdf(selectedIntern)}
                >
                  {downloadingFor === `final:${selectedIntern.id}` ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Final Report (PDF)
                </Button>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
                <Button asChild>
                  <Link href={`/company-hr/attendance?intern=${selectedIntern.id}`}>
                    <ClipboardList className="h-4 w-4 mr-2" /> View Full Record
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Supervisor / Evaluator Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Supervisor / Evaluator</DialogTitle>
            <DialogDescription>
              Select a site supervisor or external evaluator for this intern.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Select Supervisor / Evaluator</Label>
              <Select value={selectedSupervisorForAssignment} onValueChange={setSelectedSupervisorForAssignment}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supervisor or evaluator..." />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.length === 0 && externalEvaluators.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No active supervisors or evaluators — add one first
                    </SelectItem>
                  ) : (
                    <>
                      {supervisors.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Site Supervisors</SelectLabel>
                          {supervisors.map((supervisor) => (
                            <SelectItem key={supervisor.user_id} value={supervisor.user_id}>
                              <div className="flex items-center gap-2">
                                <span>{supervisor.name}</span>
                                <span className="text-muted-foreground text-xs">({supervisor.email})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {externalEvaluators.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>External Evaluators</SelectLabel>
                          {externalEvaluators.map((evaluator) => (
                            <SelectItem key={evaluator.user_id} value={evaluator.user_id}>
                              <div className="flex items-center gap-2">
                                <span>{evaluator.name}</span>
                                <span className="text-muted-foreground text-xs">({evaluator.email})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedSupervisorForAssignment && (() => {
              const supervisor =
                supervisors.find(s => s.user_id === selectedSupervisorForAssignment) ||
                externalEvaluators.find(s => s.user_id === selectedSupervisorForAssignment);
              return (
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <p><strong>{supervisor?.name}</strong></p>
                  <p className="text-muted-foreground">{supervisor?.email}</p>
                </div>
              );
            })()}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAssignOpen(false); setSelectedSupervisorForAssignment(""); }} disabled={assigning}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignSupervisor}
              disabled={!selectedSupervisorForAssignment || assigning}
            >
              {assigning ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Supervisor Confirmation */}
      <ConfirmDialog
        open={!!unassignTarget}
        onOpenChange={(open) => !open && setUnassignTarget(null)}
        title={
          <>
            <UserMinus className="h-5 w-5 shrink-0" />
            Unassign supervisor?
          </>
        }
        description={
          <span className="block">
            <strong>{unassignTarget?.supervisor_name}</strong> will no longer supervise{" "}
            {unassignTarget?.student_name}. The intern will have no supervisor until you assign
            a new one — you can assign one anytime from this page.
          </span>
        }
        confirmLabel="Unassign Supervisor"
        variant="warning"
        loading={isUnassigning}
        onConfirm={handleUnassignSupervisor}
      />

      {/* Remove Placement Confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove this intern placement?"
        description={
          <span className="block">
            <strong>{removeTarget?.student_name}</strong> will no longer be placed in{" "}
            &ldquo;{removeTarget?.internship_title}&rdquo;. Their weekly logs, evaluations and
            attendance history are kept, but they will no longer appear as an active intern. The
            student will be notified.
          </span>
        }
        confirmLabel="Remove Placement"
        loading={isRemoving}
        onConfirm={handleRemovePlacement}
      />
    </div>
  );
}

// Helper component
function InfoRow({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground flex items-center gap-2 text-sm">
        {icon}
        {label}
      </span>
      <span className={`font-medium text-sm ${highlight ? 'text-primary' : ''}`}>{value}</span>
    </div>
  );
}
