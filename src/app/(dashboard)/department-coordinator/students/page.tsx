"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Download,
  Filter,
  X,
  Users,
  UserCheck,
  Mail,
  Phone,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  FileSpreadsheet,
  FileDown,
  CheckSquare,
  Square,
  Loader2,
  Eye,
  EyeOff,
  GraduationCap,
  Building2,
  Lock,
  Edit2,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";
import { toast } from "@/components/shared/toast";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { createClient } from "@/utils/supabase/client";
import { generatePdf } from "@/lib/export-helpers";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Student {
  // `students` table has no `id` column — `user_id` is the PK.
  // `id` is an alias for `user_id` populated by fetchStudents so that
  // existing UI code that references `student.id` keeps working.
  id: string;
  user_id: string;
  // `enrollment_number` / `status` / `semester` are legacy fields kept
  // for backwards-compat. The actual columns on `students` are
  // `student_id_number` and `enrollment_year` (no `status`/`semester`).
  enrollment_number?: string;
  student_id_number?: string;
  status?: string;
  semester?: number;
  enrollment_year?: number;
  cgpa?: number;
  program_id: string | null;
  university_id: string;
  department_id: string;
  faculty_supervisor_id?: string | null;
  created_at: string;
  // Joined data
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    full_name?: string | null;
    email: string | null;
    phone: string | null;
    is_active?: boolean;
  };
  programs?: {
    name: string | null;
    code: string | null;
  };
  departments?: {
    name: string | null;
    code: string | null;
  };
  faculty_supervisor?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

interface SupervisorOption {
  id: string;
  name: string;
  email: string;
  assigned_count: number;
  type: "faculty" | "external";
}

export default function StudentsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [assignedSupervisorByStudent, setAssignedSupervisorByStudent] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterSupervisor, setFilterSupervisor] = useState<string>(
    searchParams.get("filter") === "no_supervisor" ? "unassigned" : "all"
  );
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  // Selection state
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);

  // Assignment dialog
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [selectedExternalEvaluatorId, setSelectedExternalEvaluatorId] = useState<string>("");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Student detail view
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // ── Edit Student dialog state ──────────────────────────────
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    student_id_number: "",
    cgpa: "",
    program_id: "",
  });

  // ── Delete Student state ───────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Per-student PDF download state. Holds a string key like "weekly:<userId>"
  // or "final:<userId>" while a download is in flight so the menu item can
  // show a spinner and prevent duplicate clicks.
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null);

  // NOTE (2026-08-24): student creation was removed for Department
  // Coordinators — the Program Coordinator owns student onboarding (single
  // add + CSV bulk import). DCs retain viewing, filtering, export, and
  // supervisor assignment.
  const [programs, setPrograms] = useState<{ id: string; name: string; code: string }[]>([]);

  // Fetch programs for the dropdown
  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch("/api/programs?pageSize=100");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.data)) {
          setPrograms(data.data.data.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
        } else if (Array.isArray(data.data)) {
          setPrograms(data.data.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
        }
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
    }
  }, []);

  // Fetch departments for the filter dropdown. The /api/departments endpoint
  // is university-scoped for university_admin/super_admin and department-scoped
  // for department_coordinator (returns just their own department).
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/departments?pageSize=100");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.data)) {
          setDepartments(data.data.data.map((d: any) => ({ id: d.id, name: d.name, code: d.code })));
        } else if (Array.isArray(data.data)) {
          setDepartments(data.data.map((d: any) => ({ id: d.id, name: d.name, code: d.code })));
        }
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
    fetchDepartments();
  }, [fetchPrograms, fetchDepartments]);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterProgram !== "all") params.set("program_id", filterProgram);
      if (filterDepartment !== "all") params.set("department_id", filterDepartment);
      params.set("pageSize", "100");

      const res = await fetch(`/api/students?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Normalize: alias `id` from `user_id` so existing UI code that
          // references `student.id` keeps working. (The students table has
          // no `id` column — `user_id` IS the PK.)
          const rows: Student[] = (data.data.data || []).map((s: Student) => ({
            ...s,
            id: s.id ?? s.user_id,
          }));
          setStudents(rows);
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus, filterProgram, filterDepartment]);

  // Fetch supervisors (faculty) AND external evaluators for assignment dropdowns.
  // Both arrays are merged into a single `supervisors` state, tagged with a
  // `type` field so the UI can render them as separate groups.
  const fetchSupervisors = useCallback(async () => {
    try {
      const [facultyRes, extRes] = await Promise.all([
        fetch("/api/supervisors?type=faculty&pageSize=100"),
        fetch("/api/supervisors?type=external&pageSize=100"),
      ]);

      const options: SupervisorOption[] = [];

      if (facultyRes.ok) {
        const data = await facultyRes.json();
        if (data.success && Array.isArray(data.data?.data)) {
          // NOTE: faculty_supervisor_id on student_internships references
          // profiles.user_id, not the supervisors.id surrogate key, so we
          // must use the supervisor's user_id here.
          data.data.data.forEach((s: any) => {
            options.push({
              id: s.user_id,
              name: `${s.profiles?.first_name || ""} ${s.profiles?.last_name || ""}`.trim() || s.title || "Unknown",
              email: s.profiles?.email || "",
              assigned_count: 0,
              type: "faculty",
            });
          });
        }
      }

      if (extRes.ok) {
        const data = await extRes.json();
        if (data.success && Array.isArray(data.data?.data)) {
          data.data.data.forEach((s: any) => {
            options.push({
              id: s.user_id,
              name: `${s.profiles?.first_name || ""} ${s.profiles?.last_name || ""}`.trim() || s.title || "Unknown",
              email: s.profiles?.email || "",
              assigned_count: 0,
              type: "external",
            });
          });
        }
      }

      setSupervisors(options);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    }
  }, []);

  // Fetch which students already have a faculty supervisor assigned,
  // so we can support filtering by supervisor assignment status/identity.
  //
  // /api/department-coordinator/assignments returns rows from
  // `student_internships`, whose PK to the student is `student_user_id`
  // (referencing profiles.user_id, which is also students.user_id).
  // The students list from /api/students uses `user_id` as the student's
  // identifier (students has no `id` column — user_id IS the PK).
  // So we key the map by `student_user_id` and look it up with
  // `student.user_id` in the page below.
  const fetchAssignedSupervisors = useCallback(async () => {
    try {
      const res = await fetch("/api/department-coordinator/assignments?pageSize=500");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.data)) {
          const map = new Map<string, string>();
          data.data.data.forEach((a: any) => {
            const studentKey: string | undefined = a.student_user_id || a.student_id;
            // Prefer faculty_supervisor_id; fall back to external_evaluator_id
            // so the assigned-column check still works for students who have
            // only an external evaluator (no faculty supervisor yet).
            const supervisorId: string | undefined =
              a.faculty_supervisor_id || a.external_evaluator_id;
            if (supervisorId && studentKey) {
              map.set(studentKey, supervisorId);
            }
          });
          setAssignedSupervisorByStudent(map);
        }
      }
    } catch (error) {
      console.error("Error fetching assignment status:", error);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  useEffect(() => {
    fetchAssignedSupervisors();
  }, [fetchAssignedSupervisors]);

  // Support linking directly to a specific supervisor's students, e.g.
  // /department-coordinator/students?supervisor=<id> from the Supervisors page.
  const supervisorIdParam = searchParams.get("supervisor");

  // Students to display, honoring the supervisor-assignment filter.
  // NOTE: `students` rows use `user_id` as their identifier — there is no
  // `id` column on the students table. The assignedSupervisorByStudent
  // map is keyed by student_user_id (which equals students.user_id).
  const displayedStudents = students.filter((s) => {
    const sid = s.user_id || s.id;
    if (supervisorIdParam) return assignedSupervisorByStudent.get(sid) === supervisorIdParam;
    if (filterSupervisor === "unassigned") return !assignedSupervisorByStudent.has(sid);
    if (filterSupervisor === "assigned") return assignedSupervisorByStudent.has(sid);
    return true;
  });

  // Handle select all
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedStudents(new Set());
      setIsSelectAll(false);
    } else {
      setSelectedStudents(new Set(displayedStudents.map(s => s.id)));
      setIsSelectAll(true);
    }
  };

  // Handle individual selection
  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
    setIsSelectAll(newSelected.size === displayedStudents.length);
  };

  // Handle bulk assignment — uses the new /api/department-coordinator/students/bulk-assign
  // endpoint so all selected students are updated in a single call (no N
  // round-trips). Program, faculty supervisor, and external evaluator can all
  // be set in one shot.
  const handleBulkAssign = async () => {
    if (selectedStudents.size === 0) return;
    if (!selectedSupervisorId && !selectedExternalEvaluatorId && !selectedProgramId) {
      toast.error("Nothing to assign", { description: "Pick a supervisor, an evaluator, a program, or any combination." });
      return;
    }

    setIsAssigning(true);
    try {
      const res = await fetch("/api/department-coordinator/students/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_user_ids: Array.from(selectedStudents),
          program_id: selectedProgramId || null,
          faculty_supervisor_id: selectedSupervisorId || null,
          external_evaluator_id: selectedExternalEvaluatorId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.success) {
        const { updated, skipped } = data.data || {};
        toast.success("Assignment Complete", { description: `Updated ${updated} student(s)${skipped ? `, ${skipped} skipped` : ""}.` });
        await fetchStudents();
        await fetchAssignedSupervisors();
        setIsAssignDialogOpen(false);
        setSelectedSupervisorId("");
        setSelectedExternalEvaluatorId("");
        setSelectedProgramId("");
        setSelectedStudents(new Set());
        setIsSelectAll(false);
      } else {
        toast.error("Assignment failed", { description: data.error || `HTTP ${res.status}` });
      }
    } catch (error) {
      console.error("Error assigning students:", error);
      toast.error("Assignment failed", { description: error instanceof Error ? error.message : "Failed to assign some students" });
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle single student assignment. The supervisor list contains both
  // faculty supervisors and external evaluators, tagged with `type`. We
  // branch on the type to decide which column to send to the API.
  const handleSingleAssign = async (studentId: string, supervisorId: string) => {
    try {
      const supervisor = supervisors.find((s) => s.id === supervisorId);
      const body: Record<string, string> = { student_id: studentId };
      if (supervisor?.type === "external") {
        body.external_evaluator_id = supervisorId;
      } else {
        body.faculty_supervisor_id = supervisorId;
      }

      const res = await fetch("/api/department-coordinator/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchStudents();
        await fetchAssignedSupervisors();
        toast.success("Assigned", {
          description:
            supervisor?.type === "external"
              ? "External evaluator has been assigned to the student."
              : "Student has been assigned to the selected supervisor.",
        });
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error("Assignment failed", { description: data.error || `HTTP ${res.status}` });
      }
    } catch (error) {
      console.error("Error assigning student:", error);
      toast.error("Assignment failed", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  // ---------------------------------------------------------------------------
  // Per-student PDF downloads.
  //
  // Coordinators can read weekly_logs / evaluations / attendance for any
  // student in their department (RLS policies `wl_select`, `eval_select`,
  // `att_select` in supabase/migrations/0002_rls_policies.sql). We fetch the
  // rows directly from Supabase and render them with `generatePdf()` — same
  // pattern as the faculty-supervisor weekly-logs page.
  // ---------------------------------------------------------------------------

  // Download every weekly log for one student as a single PDF.
  const handleDownloadWeeklyLogsPdf = async (student: Student) => {
    const studentUserId = student.user_id || student.id;
    const studentName = getFullName(student);
    const key = `weekly:${studentUserId}`;
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
          title: `Weekly Logs — ${studentName}`,
          subtitle: `Student ID: ${student.student_id_number || student.enrollment_number || "—"}`,
          metadata: [
            { label: "Student", value: studentName },
            { label: "Program", value: student.programs?.name || "—" },
            { label: "Total Weeks", value: String(logList.length) },
            { label: "Total Hours", value: String(totalHours) },
          ],
          sections,
          footer: `CareerStep — Weekly Logs export for ${studentName} on ${new Date().toLocaleString()}`,
        },
        `weekly-logs-${studentName.replace(/\s+/g, "-").toLowerCase()}.pdf`
      );
    } catch (error) {
      console.error("Error generating weekly logs PDF:", error);
      toast.error("Download failed", { description: error instanceof Error ? error.message : "Could not generate the weekly logs PDF." });
    } finally {
      setDownloadingFor(null);
    }
  };

  // Download a combined final-report PDF for one student: weekly logs +
  // evaluations + attendance, plus a simple summary block.
  const handleDownloadFinalReportPdf = async (student: Student) => {
    const studentUserId = student.user_id || student.id;
    const studentName = getFullName(student);
    const key = `final:${studentUserId}`;
    if (downloadingFor === key) return;
    setDownloadingFor(key);
    try {
      const supabase = createClient();

      // Fetch the three data sources in parallel — RLS allows the coordinator
      // to read any student in their department.
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

      // Weekly logs section
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

      // Evaluations section
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

      // Attendance section
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
          title: `Final Internship Report — ${studentName}`,
          subtitle: `Student ID: ${student.student_id_number || student.enrollment_number || "—"}`,
          metadata: [
            { label: "Student", value: studentName },
            { label: "Program", value: student.programs?.name || "—" },
            { label: "Department", value: student.departments?.name || "—" },
            { label: "Total Weeks Logged", value: String(totalWeeks) },
            { label: "Total Hours Logged", value: String(totalHours) },
            { label: "Average Evaluation Score", value: `${averageScore} / 5` },
            { label: "Attendance Rate", value: attendanceRate },
            { label: "Evaluations Count", value: String(evals.length) },
          ],
          sections,
          footer: `CareerStep — Final Report export for ${studentName} on ${new Date().toLocaleString()}`,
        },
        `final-report-${studentName.replace(/\s+/g, "-").toLowerCase()}.pdf`
      );
    } catch (error) {
      console.error("Error generating final report PDF:", error);
      toast.error("Download failed", { description: error instanceof Error ? error.message : "Could not generate the final report PDF." });
    } finally {
      setDownloadingFor(null);
    }
  };

  // ── Edit Student ────────────────────────────────────────────
  // Department Coordinators can edit the students of their own
  // department (PUT /api/students/[id] authorizes department_coordinator).
  const getStudentFullName = (student: Student) =>
    `${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() ||
    student.profiles?.full_name ||
    "";

  const openEditDialog = (student: Student) => {
    setEditTarget(student);
    setEditForm({
      full_name: getStudentFullName(student),
      student_id_number: student.student_id_number || student.enrollment_number || "",
      cgpa: student.cgpa != null ? String(student.cgpa) : "",
      program_id: student.program_id || "",
    });
    setIsEditOpen(true);
  };

  const handleSaveStudent = async () => {
    if (!editTarget) return;

    const name = editForm.full_name.trim();
    if (name.length < 2) {
      toast.error("Validation Error", { description: "Full name must be at least 2 characters" });
      return;
    }
    const rollNo = editForm.student_id_number.trim();
    if (rollNo && rollNo.length < 3) {
      toast.error("Validation Error", { description: "Roll number must be at least 3 characters (or leave it empty)" });
      return;
    }
    let cgpa: number | null = null;
    if (editForm.cgpa.trim() !== "") {
      cgpa = parseFloat(editForm.cgpa);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 4) {
        toast.error("Validation Error", { description: "CGPA must be a number between 0.00 and 4.00" });
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      // 1. Name lives on the profile row.
      if (name !== getStudentFullName(editTarget)) {
        const supabase = createClient();
        const nameParts = name.split(/\s+/);
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: name,
            first_name: nameParts[0] || null,
            last_name: nameParts.slice(1).join(" ") || null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", editTarget.user_id);
        if (profileError) throw new Error(profileError.message);
      }

      // 2. Enrollment fields via the API (DC-authorized for own dept).
      const res = await fetch(`/api/students/${editTarget.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id_number: rollNo,
          cgpa,
          program_id: editForm.program_id || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const message =
          json?.error === "Validation failed" && json?.message
            ? json.message
            : json?.error || `Request failed (${res.status})`;
        throw new Error(message);
      }

      toast.success("Student Updated", {
        description: `${name}'s details were saved successfully.`,
      });
      setIsEditOpen(false);
      setEditTarget(null);
      if (viewingStudent?.user_id === editTarget.user_id) {
        setViewingStudent(null);
      }
      fetchStudents();
    } catch (error) {
      console.error("Error updating student:", error);
      toast.error("Failed to update student", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Delete Student ──────────────────────────────────────────
  // DELETE /api/students/[id] authorizes department_coordinator for
  // students of their own department (hard_delete_user).
  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/students/${deleteTarget.user_id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      toast.success("Student Deleted", {
        description: `${getStudentFullName(deleteTarget) || deleteTarget.profiles?.email || "Student"} and all their data were permanently removed.`,
      });

      if (viewingStudent?.user_id === deleteTarget.user_id) {
        setViewingStudent(null);
      }
      setDeleteTarget(null);
      fetchStudents();
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("Failed to delete student", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to CSV.
  // NOTE: the `students` table has `student_id_number` (not `enrollment_number`),
  // no `status` column, and no `semester` column. We export the real fields.
  const exportToCSV = () => {
    const headers = [
      "Student ID Number",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Program",
      "Department",
      "CGPA",
      "Enrollment Year",
      "Enrolled Date",
    ];

    const csvData = displayedStudents.map((student) => [
      student.student_id_number || student.enrollment_number || "",
      student.profiles?.first_name || "",
      student.profiles?.last_name || "",
      student.profiles?.email || "",
      student.profiles?.phone || "",
      student.programs?.name || "Not Assigned",
      student.departments?.name || "",
      student.cgpa?.toString() || "",
      student.enrollment_year?.toString() || "",
      new Date(student.created_at).toLocaleDateString(),
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...csvData.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `department_students_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Get initials for avatar
  const getInitials = (student: Student) => {
    const firstName = student.profiles?.first_name || "";
    const lastName = student.profiles?.last_name || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "ST";
  };

  // Get full name
  const getFullName = (student: Student) => {
    const firstName = student.profiles?.first_name || "";
    const lastName = student.profiles?.last_name || "";
    return `${firstName} ${lastName}`.trim()
      || student.profiles?.full_name
      || student.student_id_number
      || student.enrollment_number
      || "Unknown";
  };

  // Status badge variant.
  // The `students` table has no `status` column — this is kept for
  // backwards-compat with UI that may still pass a status string.
  const getStatusVariant = (status: string) => {
    if (!status) return "outline" as const;
    switch (status.toLowerCase()) {
      case "active":
        return "default" as const;
      case "graduated":
        return "secondary" as const;
      case "suspended":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Students"
        description="Manage and assign students in your department"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportToCSV} disabled={isLoading || displayedStudents.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <Button
              onClick={() => setIsAssignDialogOpen(true)}
              disabled={selectedStudents.size === 0}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Assign ({selectedStudents.size})
            </Button>
          </div>
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={students.length} icon={GraduationCap} variant="default" />
        <StatCard
          label="Active"
          // The `students` table has no `status` column — the student's
          // active flag lives on `profiles.is_active`. The previous filter
          // `s.status === "active"` always returned 0 because `s.status`
          // is always undefined.
          value={students.filter(s => s.profiles?.is_active !== false).length}
          icon={Users}
          variant="success"
        />
        <StatCard
          label="In Programs"
          value={students.filter(s => s.program_id).length}
          icon={BookOpen}
          variant="default"
        />
        <StatCard label="Selected" value={selectedStudents.size} icon={UserCheck} variant="warning" />
      </div>

      {/* Active supervisor link filter banner */}
      {supervisorIdParam && (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
          <span>
            Showing students assigned to{" "}
            <span className="font-medium">
              {supervisors.find((s) => s.id === supervisorIdParam)?.name || "this supervisor"}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/department-coordinator/students")}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by enrollment number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[170px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
                <SelectTrigger className="w-[150px]">
                  <UserCheck className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Supervisors</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="unassigned">Not Assigned</SelectItem>
                </SelectContent>
              </Select>

              {(searchQuery || filterStatus !== "all" || filterSupervisor !== "all" || filterDepartment !== "all") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setFilterSupervisor("all");
                    setFilterDepartment("all");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : displayedStudents.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-10 w-10 text-muted-foreground" />}
          title="No students found"
          description={
            searchQuery || filterStatus !== "all" || filterSupervisor !== "all" || filterDepartment !== "all"
              ? "Try adjusting your search or filters"
              : "No students are enrolled in this department yet"
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Cards View for Mobile */}
          <div className="md:hidden space-y-3">
            <AnimatePresence mode="popLayout">
              {displayedStudents.map((student) => (
                <motion.div
                  key={student.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className={`overflow-hidden transition-colors ${
                    selectedStudents.has(student.id) ? "border-primary bg-primary/5" : ""
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Checkbox
                          checked={selectedStudents.has(student.id)}
                          onCheckedChange={() => handleSelectStudent(student.id)}
                          className="mt-1"
                        />
                        <Avatar className="h-11 w-11 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(student)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{getFullName(student)}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {student.student_id_number || student.enrollment_number || "No ID"}
                              </p>
                            </div>
                            {student.status && (
                              <Badge variant={getStatusVariant(student.status)}>
                                {student.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3 ml-8">
                        {student.programs?.name && (
                          <Badge variant="outline">{student.programs.name}</Badge>
                        )}
                        {student.cgpa && (
                          <Badge variant="outline">CGPA: {student.cgpa}</Badge>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t ml-8">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setViewingStudent(student)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                        
                        <Select onValueChange={(val) => handleSingleAssign(student.id, val)}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assign...
                          </SelectTrigger>
                          <SelectContent>
                            {supervisors.length === 0 ? (
                              <SelectItem value="__none" disabled>
                                No supervisors or evaluators available
                              </SelectItem>
                            ) : (
                              <>
                                {supervisors.some((s) => s.type === "faculty") && (
                                  <SelectGroup>
                                    <SelectLabel>Faculty Supervisors</SelectLabel>
                                    {supervisors
                                      .filter((s) => s.type === "faculty")
                                      .map((sup) => (
                                        <SelectItem key={sup.id} value={sup.id}>
                                          {sup.name}
                                        </SelectItem>
                                      ))}
                                  </SelectGroup>
                                )}
                                {supervisors.some((s) => s.type === "external") && (
                                  <SelectGroup>
                                    <SelectLabel>External Evaluators</SelectLabel>
                                    {supervisors
                                      .filter((s) => s.type === "external")
                                      .map((sup) => (
                                        <SelectItem key={sup.id} value={sup.id}>
                                          {sup.name}
                                        </SelectItem>
                                      ))}
                                  </SelectGroup>
                                )}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Table View for Desktop */}
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isSelectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Enrollment #</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Faculty Supervisor</TableHead>
                  <TableHead>CGPA</TableHead>
                  <TableHead>Enrollment Year</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {displayedStudents.map((student) => {
                    // Resolve the assigned supervisor: prefer the explicit
                    // `faculty_supervisor` join (set on students.faculty_supervisor_id
                    // via migration 0041). Fall back to the assignedSupervisorByStudent
                    // map (built from /api/department-coordinator/assignments which
                    // includes student_internships rows).
                    const assignedSupId = student.faculty_supervisor_id
                      || assignedSupervisorByStudent.get(student.user_id || student.id)
                      || null;
                    const assignedSupervisorName = student.faculty_supervisor
                      ? `${student.faculty_supervisor.first_name || ""} ${student.faculty_supervisor.last_name || ""}`.trim()
                      : (assignedSupId
                          ? (supervisors.find(s => s.id === assignedSupId)?.name || "Assigned")
                          : null);
                    return (
                    <motion.tr
                      key={student.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`group hover:bg-muted/50 transition-colors ${
                        selectedStudents.has(student.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.has(student.id)}
                          onCheckedChange={() => handleSelectStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(student)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{getFullName(student)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {student.profiles?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {student.student_id_number || student.enrollment_number || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm max-w-[120px] block truncate">
                          {student.programs?.name || (
                            <span className="text-muted-foreground">Not assigned</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {assignedSupervisorName ? (
                          <Badge variant="secondary" className="font-normal">
                            <UserCheck className="h-3 w-3 mr-1" />
                            {assignedSupervisorName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{student.cgpa?.toFixed(2) || "-"}</TableCell>
                      <TableCell>
                        {student.semester
                          ? `Sem ${student.semester}`
                          : student.enrollment_year
                          ? `${student.enrollment_year}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingStudent(student)}>
                              <Eye className="h-4 w-4 mr-2" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(student)}>
                              <Edit2 className="h-4 w-4 mr-2" /> Edit Student
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={downloadingFor === `weekly:${student.user_id || student.id}`}
                              onClick={() => handleDownloadWeeklyLogsPdf(student)}
                            >
                              {downloadingFor === `weekly:${student.user_id || student.id}` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4 mr-2" />
                              )}
                              Download Weekly Logs (PDF)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={downloadingFor === `final:${student.user_id || student.id}`}
                              onClick={() => handleDownloadFinalReportPdf(student)}
                            >
                              {downloadingFor === `final:${student.user_id || student.id}` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4 mr-2" />
                              )}
                              Download Final Report (PDF)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStudents(new Set([student.id]));
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <UserCheck className="h-4 w-4 mr-2" /> Assign Supervisor
                            </DropdownMenuItem>
                            {assignedSupId && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/department-coordinator/assignments?student_id=${student.user_id || student.id}&supervisor_id=${assignedSupId}`, {
                                      method: "DELETE",
                                    });
                                    if (res.ok) {
                                      await fetchStudents();
                                      await fetchAssignedSupervisors();
                                      toast.success("Unassigned", { description: "Supervisor was removed from this student." });
                                    } else {
                                      const data = await res.json().catch(() => ({}));
                                      toast.error("Failed to unassign", { description: data.error || `HTTP ${res.status}` });
                                    }
                                  } catch (e) {
                                    toast.error("Failed to unassign", { description: e instanceof Error ? e.message : "Unknown error" });
                                  }
                                }}
                              >
                                <X className="h-4 w-4 mr-2" /> Remove Supervisor
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(student)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </Card>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>
              Showing {displayedStudents.length} student{displayedStudents.length !== 1 ? "s" : ""}
            </span>
            {selectedStudents.size > 0 && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSelectedStudents(new Set());
                  setIsSelectAll(false);
                }}
              >
                Clear selection ({selectedStudents.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Assignment Dialog — assign Program AND/OR Supervisor in one go */}
      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
        setIsAssignDialogOpen(open);
        if (!open) {
          setSelectedSupervisorId("");
          setSelectedExternalEvaluatorId("");
          setSelectedProgramId("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Program / Supervisor / Evaluator</DialogTitle>
            <DialogDescription>
              Update {selectedStudents.size} selected student{selectedStudents.size > 1 ? "s" : ""} in one shot.
              Leave any field as &quot;No change&quot; to keep the current value.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={selectedProgramId || "__none__"}
                onValueChange={(val) => setSelectedProgramId(val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No change</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pick a program to assign to all selected students, or leave as &quot;No change&quot;.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Faculty Supervisor</Label>
              <Select
                value={selectedSupervisorId || "__none__"}
                onValueChange={(val) => setSelectedSupervisorId(val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No change</SelectItem>
                  {supervisors
                    .filter((s) => s.type === "faculty")
                    .map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        <div className="flex flex-col">
                          <span>{sup.name}</span>
                          <span className="text-xs text-muted-foreground">{sup.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pick a faculty supervisor, or leave as &quot;No change&quot;.
              </p>
            </div>

            <div className="space-y-2">
              <Label>External Evaluator</Label>
              <Select
                value={selectedExternalEvaluatorId || "__none__"}
                onValueChange={(val) => setSelectedExternalEvaluatorId(val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No change</SelectItem>
                  {supervisors
                    .filter((s) => s.type === "external")
                    .map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        <div className="flex flex-col">
                          <span>{sup.name}</span>
                          <span className="text-xs text-muted-foreground">{sup.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pick an external evaluator, or leave as &quot;No change&quot;.
              </p>
            </div>

            {selectedStudents.size <= 5 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Selected Students:</Label>
                <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                  {students
                    .filter(s => s.id && selectedStudents.has(s.id))
                    .map(student => (
                      <div key={student.id} className="text-sm py-1 px-2 rounded hover:bg-muted">
                        {getFullName(student)} - {student.student_id_number || student.enrollment_number || "No ID"}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={(!selectedSupervisorId && !selectedExternalEvaluatorId && !selectedProgramId) || isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Confirm Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Detail View Dialog */}
      <Dialog open={!!viewingStudent} onOpenChange={() => setViewingStudent(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription>Student information</DialogDescription>
          </DialogHeader>

          {viewingStudent && (
            <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(viewingStudent)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{getFullName(viewingStudent)}</h3>
                  <p className="text-muted-foreground">{viewingStudent.student_id_number || viewingStudent.enrollment_number || "No ID"}</p>
                  {viewingStudent.status && (
                    <Badge variant={getStatusVariant(viewingStudent.status)} className="mt-1">
                      {viewingStudent.status}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {viewingStudent.profiles?.email || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {viewingStudent.profiles?.phone || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Program</Label>
                  <p className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {viewingStudent.programs?.name || "Not assigned"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="text-sm">
                    {viewingStudent.departments?.name || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">CGPA</Label>
                  <p className="text-sm font-medium">{viewingStudent.cgpa?.toFixed(2) || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Semester</Label>
                  <p className="text-sm">{viewingStudent.semester || "-"}</p>
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <p className="text-xs text-muted-foreground">
                  Enrolled: {new Date(viewingStudent.created_at).toLocaleDateString()}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingFor === `weekly:${viewingStudent.user_id || viewingStudent.id}`}
                    onClick={() => handleDownloadWeeklyLogsPdf(viewingStudent)}
                  >
                    {downloadingFor === `weekly:${viewingStudent.user_id || viewingStudent.id}` ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    Weekly Logs (PDF)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingFor === `final:${viewingStudent.user_id || viewingStudent.id}`}
                    onClick={() => handleDownloadFinalReportPdf(viewingStudent)}
                  >
                    {downloadingFor === `final:${viewingStudent.user_id || viewingStudent.id}` ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    Final Report (PDF)
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingStudent(null)}>
              Close
            </Button>
            {viewingStudent && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    const target = viewingStudent;
                    setViewingStudent(null);
                    openEditDialog(target);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const target = viewingStudent;
                    setViewingStudent(null);
                    setDeleteTarget(target);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setSelectedStudents(new Set([viewingStudent.id]));
                    setViewingStudent(null);
                    setIsAssignDialogOpen(true);
                  }}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Supervisor
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update {editTarget ? getFullName(editTarget) : "student"}&apos;s details.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full Name</Label>
              <Input
                id="edit-full-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Ali Raza"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-roll-no">Student ID Number</Label>
              <Input
                id="edit-roll-no"
                value={editForm.student_id_number}
                onChange={(e) => setEditForm((f) => ({ ...f, student_id_number: e.target.value }))}
                placeholder="e.g. FA21-BCS-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cgpa">CGPA (0.00 – 4.00)</Label>
              <Input
                id="edit-cgpa"
                type="number"
                step="0.01"
                min="0"
                max="4"
                value={editForm.cgpa}
                onChange={(e) => setEditForm((f) => ({ ...f, cgpa: e.target.value }))}
                placeholder="e.g. 3.45"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-program">Program</Label>
              <Select
                value={editForm.program_id || "__none__"}
                onValueChange={(value) =>
                  setEditForm((f) => ({ ...f, program_id: value === "__none__" ? "" : value }))
                }
              >
                <SelectTrigger id="edit-program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveStudent} disabled={isSavingEdit}>
              {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Student?"
        description={
          <>
            This permanently deletes{" "}
            <strong>{deleteTarget ? getFullName(deleteTarget) : "this student"}</strong>&apos;s
            account and all their personal data (applications, weekly logs, documents,
            evaluations, attendance and certificates). This action cannot be undone.
          </>
        }
        confirmLabel="Delete Student"
        loading={isDeleting}
        onConfirm={handleDeleteStudent}
      />

    </div>
  );
}
