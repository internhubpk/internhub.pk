"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Users,
  Search,
  Eye,
  Star,
  MessageSquare,
  CheckCircle2,
  Clock,
  UserCheck,
  GraduationCap,
  Filter,
  Building2,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  Phone,
  MapPin,
  Award,
  ClipboardCheck,
  BarChart3,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// Types
interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  university: string;
  program: string;
  major: string;
  semester: number;
  internshipTitle: string;
  company: string;
  companyLocation: string;
  status: "active" | "on_leave" | "completed" | "withdrawn";
  weeklyLogStatus: "submitted" | "pending" | "not_submitted" | "approved";
  overallProgress: number;
  lastActivity: string;
  startDate: string;
  endDate: string;
  avatarUrl?: string;
  supervisorNotes?: string;
}

interface TaskItem {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending" | "overdue";
  dueDate: string;
  completedAt?: string;
  grade?: string;
}

interface Submission {
  id: string;
  type: "weekly_log" | "task" | "document";
  title: string;
  submittedAt: string;
  status: "approved" | "pending" | "rejected" | "revision_required";
  feedback?: string;
  grade?: number;
}

interface EvaluationRecord {
  id: string;
  type: "weekly" | "midterm" | "final";
  date: string;
  score: number;
  maxScore: number;
  status: "completed" | "pending";
  comments?: string;
}

interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  attendanceRate: number;
}

// Default empty data - will be populated from database
const DEFAULT_STUDENTS: Student[] = [];
const DEFAULT_TASKS: Record<string, TaskItem[]> = {};
const DEFAULT_SUBMISSIONS: Record<string, Submission[]> = {};
const DEFAULT_EVALUATIONS: Record<string, EvaluationRecord[]> = {};
const DEFAULT_ATTENDANCE: Record<string, AttendanceSummary> = {};

export default function FacultySupervisorStudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>(DEFAULT_STUDENTS);
  const [tasks, setTasks] = useState<Record<string, TaskItem[]>>(DEFAULT_TASKS);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>(DEFAULT_SUBMISSIONS);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationRecord[]>>(DEFAULT_EVALUATIONS);
  const [attendance, setAttendance] = useState<Record<string, AttendanceSummary>>(DEFAULT_ATTENDANCE);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [progressFilter, setProgressFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // CSV export of the currently-loaded students list. Real download —
  // builds the CSV in-memory and triggers a browser download. Mirrors
  // the pattern at external-evaluator/evaluations/page.tsx and
  // company-hr/attendance/page.tsx.
  const handleExport = useCallback(() => {
    if (!students || students.length === 0) {
      toast.success("Notice", { description: "No students to export." });
      return;
    }
    const headers = [
      "Name",
      "Email",
      "Program",
      "Company",
      "Progress (%)",
      "Status",
      "Last Activity",
    ];
    const escape = (v: string) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
    const rows = students.map((s) =>
      [
        escape(s.name),
        escape(s.email),
        escape(s.program),
        escape(s.company),
        escape(String(s.overallProgress ?? 0)),
        escape(s.status),
        escape(s.lastActivity || ""),
      ].join(",")
    );
    const csv = [headers.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faculty-supervisor-students-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [students]);

  // Open the student detail dialog. Used by both the desktop table row
  // and the mobile/grid "Details" button — previously the grid Details
  // button had no onClick and was non-functional.
  const openStudentDetail = useCallback((student: Student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
  }, []);


  // Fetch data from database
  useEffect(() => {
    async function fetchData() {
      if (!user) { setIsLoading(false); return; }

      try {
        const supabase = createClient();

        // Fetch supervised students with their internship details.
        // THREE-PATH UNION — see faculty-supervisor/page.tsx for full rationale.
        //   Path 1: student_internships.faculty_supervisor_id
        //   Path 2: students.faculty_supervisor_id             (migration 0041)
        //   Path 3: programs.default_faculty_supervisor_id     (migration 0015)
        const { data: directData } = await supabase
          .from("student_internships")
          .select(`
            id,
            status,
            start_date,
            end_date,
            student_user_id,
            internship_id,
            company_id,
            student_profile:student_user_id(full_name, first_name, last_name, email, phone, avatar_url),
            internship:internships(id, title, location, remote),
            company:company_id(name)
          `)
          .eq("faculty_supervisor_id", user.id);

        const { data: preInternshipStudents } = await supabase
          .from("students")
          .select("user_id, program_id")
          .eq("faculty_supervisor_id", user.id);

        const { data: defaultPrograms } = await supabase
          .from("programs")
          .select("id, name")
          .eq("default_faculty_supervisor_id", user.id);
        const defaultProgramIds = (defaultPrograms || []).map((p) => p.id);
        let programStudentIds: string[] = [];
        if (defaultProgramIds.length > 0) {
          const { data: programStudents } = await supabase
            .from("students")
            .select("user_id")
            .in("program_id", defaultProgramIds);
          programStudentIds = (programStudents || []).map((s) => s.user_id);
        }

        const directStudentIds = new Set((directData || []).map((s: any) => s.student_user_id));
        const preInternshipOnlyIds = (preInternshipStudents || [])
          .map((s) => s.user_id)
          .filter((id) => !directStudentIds.has(id));
        const programOnlyIds = programStudentIds.filter(
          (id) => !directStudentIds.has(id) && !preInternshipOnlyIds.includes(id)
        );
        const additionalStudentIds = Array.from(new Set([...preInternshipOnlyIds, ...programOnlyIds]));

        let additionalRows: any[] = [];
        if (additionalStudentIds.length > 0) {
          const { data: extraInternships } = await supabase
            .from("student_internships")
            .select(`
              id,
              status,
              start_date,
              end_date,
              student_user_id,
              internship_id,
              company_id,
              student_profile:student_user_id(full_name, first_name, last_name, email, phone, avatar_url),
              internship:internships(id, title, location, remote),
              company:company_id(name)
            `)
            .in("student_user_id", additionalStudentIds);
          const seenIds = new Set((extraInternships || []).map((r: any) => r.student_user_id));
          const missingIds = additionalStudentIds.filter((id) => !seenIds.has(id));
          let missingProfiles: any[] = [];
          if (missingIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, full_name, first_name, last_name, email, phone, avatar_url")
              .in("user_id", missingIds);
            missingProfiles = (profiles || []).map((p) => ({
              id: null,
              status: "no_internship",
              start_date: null,
              end_date: null,
              student_user_id: p.user_id,
              internship_id: null,
              company_id: null,
              student_profile: p,
              internship: null,
              company: null,
            }));
          }
          additionalRows = [...(extraInternships || []), ...missingProfiles];
        }

        const studentData: any[] = [...(directData || []), ...additionalRows];

        const studentUserIds = Array.from(
          new Set((studentData || []).map((s: any) => s.student_user_id))
        );

        // Fetch the `students` rows (program_id, cgpa, student_id_number) for
        // these users in a separate query — PostgREST can't traverse
        // student_internships → students directly (no FK).
        let studentRecords: any[] = [];
        let programMap: Record<string, string> = {};
        if (studentUserIds.length > 0) {
          const { data: records } = await supabase
            .from("students")
            .select("user_id, cgpa, student_id_number, program_id")
            .in("user_id", studentUserIds);
          studentRecords = records || [];
          const programIds = Array.from(
            new Set(studentRecords.map((r) => r.program_id).filter(Boolean))
          );
          if (programIds.length > 0) {
            const { data: programs } = await supabase
              .from("programs")
              .select("id, name")
              .in("id", programIds);
            (programs || []).forEach((p: any) => {
              programMap[p.id] = p.name;
            });
          }
        }
        const recordByUser = new Map<string, any>();
        studentRecords.forEach((r) => recordByUser.set(r.user_id, r));

        // Fetch weekly_logs for these students (to compute progress + last activity).
        let logsByStudent = new Map<string, { approved: number; total: number; latest?: string; latestStatus?: string }>();
        if (studentUserIds.length > 0) {
          const { data: logs } = await supabase
            .from("weekly_logs")
            .select("student_user_id, status, week_start_date")
            .in("student_user_id", studentUserIds);
          (logs || []).forEach((log: any) => {
            const cur = logsByStudent.get(log.student_user_id) || { approved: 0, total: 0 };
            cur.total += 1;
            if (log.status === "approved") cur.approved += 1;
            const ws = log.week_start_date;
            if (ws && (!cur.latest || ws > cur.latest)) {
              cur.latest = ws;
              cur.latestStatus = log.status;
            }
            logsByStudent.set(log.student_user_id, cur);
          });
        }

        const studentList: Student[] = (studentData || []).map((s: any) => {
          const meta = logsByStudent.get(s.student_user_id) || { approved: 0, total: 0 };
          const progress = meta.total > 0 ? Math.round((meta.approved / meta.total) * 100) : 0;
          const record = recordByUser.get(s.student_user_id);
          const programName = record?.program_id ? programMap[record.program_id] || "Unknown Program" : "Unknown Program";
          const weeklyStatus =
            meta.latestStatus === "submitted"
              ? "submitted"
              : meta.latestStatus === "approved"
              ? "approved"
              : meta.latestStatus === "revision_required"
              ? "pending"
              : "not_submitted";
          return {
            id: s.student_user_id || s.id,
            name:
              s.student_profile?.full_name ||
              `${s.student_profile?.first_name || ""} ${s.student_profile?.last_name || ""}`.trim() ||
              `Student ${s.student_user_id?.slice(0, 6)}`,
            email: s.student_profile?.email || "",
            phone: s.student_profile?.phone,
            university: "", // not on profile; could fetch via students.university_id
            program: programName,
            major: "", // not a column on students
            semester: 0, // not a column on students
            internshipTitle: s.internship?.title || "N/A",
            company: s.company?.name || "N/A",
            companyLocation: s.internship?.location || (s.internship?.remote ? "Remote" : "N/A"),
            status: s.status === "active"
              ? "active"
              : s.status === "completed"
              ? "completed"
              : s.status === "paused"
              ? "on_leave"
              : s.status === "terminated"
              ? "withdrawn"
              : "active",
            weeklyLogStatus: weeklyStatus as Student["weeklyLogStatus"],
            overallProgress: progress,
            lastActivity: meta.latest || s.start_date || "",
            startDate: s.start_date || "",
            endDate: s.end_date || "",
            avatarUrl: s.student_profile?.avatar_url,
          };
        });

        setStudents(studentList);
      } catch (error) {
        console.error("Error fetching student data:", error);
        // Keep empty state on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Fetch detail-tab data for the selected student.
  useEffect(() => {
    if (!user || !selectedStudent) return;
    const studentUserId = selectedStudent.id;
    const supervisorUserId = user.id;

    async function fetchDetail() {
      try {
        const supabase = createClient();

        // Tasks: assignments for this student created by this supervisor.
        const [tasksRes, subsRes, evalsRes, attRes] = await Promise.all([
          supabase
            .from("task_assignments")
            .select(`
              id,
              status,
              due_date,
              task_id,
              task:tasks(id, title, due_date)
            `)
            .eq("student_user_id", studentUserId)
            .eq("assigned_by", supervisorUserId),
          supabase
            .from("task_submissions")
            .select(`
              id,
              status,
              submitted_at,
              feedback,
              score,
              task_id,
              task:tasks(id, title)
            `)
            .eq("student_user_id", studentUserId)
            .order("submitted_at", { ascending: false })
            .limit(20),
          supabase
            .from("evaluations")
            .select(`
              id,
              type,
              status,
              rating,
              comments,
              scores,
              created_at,
              submitted_at
            `)
            .eq("student_user_id", studentUserId)
            .eq("evaluator_id", supervisorUserId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("attendance")
            .select("id, date, status")
            .eq("student_user_id", studentUserId),
        ]);

        // Map tasks
        const taskItems: TaskItem[] = (tasksRes.data || []).map((ta: any) => {
          const due = ta.due_date || ta.task?.due_date;
          const isOverdue = due ? new Date(due).getTime() < Date.now() && ta.status !== "approved" : false;
          return {
            id: ta.id,
            title: ta.task?.title || "Untitled Task",
            status: isOverdue
              ? "overdue"
              : ta.status === "approved"
              ? "completed"
              : ta.status === "submitted" || ta.status === "resubmitted"
              ? "in_progress"
              : "pending",
            dueDate: due || new Date().toISOString(),
          };
        });

        // Map submissions
        const subItems: Submission[] = (subsRes.data || []).map((sub: any) => ({
          id: sub.id,
          type: "task",
          title: sub.task?.title || "Untitled Task",
          submittedAt: sub.submitted_at || "",
          status:
            sub.status === "approved"
              ? "approved"
              : sub.status === "rejected"
              ? "rejected"
              : sub.status === "resubmitted"
              ? "revision_required"
              : "pending",
          feedback: sub.feedback,
          grade: sub.score ? Number(sub.score) : undefined,
        }));

        // Map evaluations
        const evalItems: EvaluationRecord[] = (evalsRes.data || []).map((e: any) => {
          const scoresObj = (e.scores && typeof e.scores === "object") ? e.scores : {};
          const scoreValues = Object.values(scoresObj).filter((v): v is number => typeof v === "number");
          const total = scoreValues.reduce((acc, v) => acc + v, 0);
          const max = scoreValues.length * 10 || 100;
          return {
            id: e.id,
            type: e.type === "weekly_log" ? "weekly" : e.type === "midterm" ? "midterm" : "final",
            date: e.submitted_at || e.created_at || "",
            score: total,
            maxScore: max,
            status: e.status === "approved" || e.status === "submitted" ? "completed" : "pending",
            comments: e.comments,
          };
        });

        // Map attendance
        const attList = attRes.data || [];
        const present = attList.filter((a: any) => a.status === "present").length;
        const absent = attList.filter((a: any) => a.status === "absent").length;
        const late = attList.filter((a: any) => a.status === "late" || a.status === "half_day").length;
        const leave = attList.filter((a: any) => a.status === "leave").length;
        const totalDays = attList.length;
        const attendanceRate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;
        const attSummary: AttendanceSummary = {
          totalDays,
          present,
          absent,
          late,
          leave,
          attendanceRate,
        };

        setTasks((prev) => ({ ...prev, [studentUserId]: taskItems }));
        setSubmissions((prev) => ({ ...prev, [studentUserId]: subItems }));
        setEvaluations((prev) => ({ ...prev, [studentUserId]: evalItems }));
        setAttendance((prev) => ({ ...prev, [studentUserId]: attSummary }));
      } catch (error) {
        console.error("Error fetching student detail:", error);
      }
    }

    fetchDetail();
  }, [user, selectedStudent]);

  // Get unique programs for filter
  const programs = useMemo(() => {
    return [...new Set(students.map((s) => s.program))];
  }, [students]);

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.major.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || student.status === statusFilter;
      const matchesProgram = programFilter === "all" || student.program === programFilter;

      let matchesProgress = true;
      if (progressFilter === "on_track") matchesProgress = student.overallProgress >= 70;
      else if (progressFilter === "needs_focus") matchesProgress = student.overallProgress >= 40 && student.overallProgress < 70;
      else if (progressFilter === "at_risk") matchesProgress = student.overallProgress < 40;

      return matchesSearch && matchesStatus && matchesProgram && matchesProgress;
    });
  }, [students, searchTerm, statusFilter, programFilter, progressFilter]);

  // Check if a specific student should be opened (from URL param)
  React.useEffect(() => {
    const studentId = searchParams.get("id");
    if (studentId) {
      const student = students.find((s) => s.id === studentId);
      if (student) {
        setSelectedStudent(student);
        setIsDetailOpen(true);
      }
    }
  }, [searchParams, students]);

  const getStudentInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 70) return "bg-emerald-500";
    if (progress >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-600";
    if (rate >= 75) return "text-amber-600";
    return "text-red-600";
  };

  // Calculate summary stats
  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === "active").length,
    onLeave: students.filter((s) => s.status === "on_leave").length,
    logsPending: students.filter((s) => s.weeklyLogStatus === "pending" || s.weeklyLogStatus === "not_submitted").length,
    avgProgress: students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + s.overallProgress, 0) / students.length)
      : 0,
    onTrack: students.filter((s) => s.overallProgress >= 70).length,
    atRisk: students.filter((s) => s.overallProgress < 40).length,
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Students</h1>
          <p className="text-muted-foreground mt-1">Loading students...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Skeleton className="h-5 w-5 mb-2" />
                <Skeleton className="h-7 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="My Students"
        description="Monitor and support your assigned interns across programs"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExport}
              disabled={students.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total" value={stats.total} icon={Users} variant="default" />
        <StatCard label="Active" value={stats.active} icon={UserCheck} variant="success" />
        <StatCard label="Logs Pending" value={stats.logsPending} icon={Clock} variant="warning" />
        <StatCard label="Avg Progress" value={`${stats.avgProgress}%`} icon={TrendingUp} variant="info" />
        <StatCard label="On Track" value={stats.onTrack} icon={CheckCircle2} variant="success" />
        <StatCard label="At Risk" value={stats.atRisk} icon={AlertCircle} variant="danger" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-[200px]">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program} value={program}>
                      {program}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={progressFilter} onValueChange={setProgressFilter}>
                <SelectTrigger className="w-[140px]">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Progress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Progress</SelectItem>
                  <SelectItem value="on_track">On Track (≥70%)</SelectItem>
                  <SelectItem value="needs_focus">Needs Focus (40-69%)</SelectItem>
                  <SelectItem value="at_risk">At Risk (&lt;40%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student List - Mobile Cards / Desktop Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-4">
          {filteredStudents.map((student) => (
            <Card
              key={student.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedStudent(student);
                setIsDetailOpen(true);
              }}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={student.avatarUrl} alt={student.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getStudentInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{student.name}</h3>
                      <p className="text-sm text-muted-foreground">{student.internshipTitle}</p>
                    </div>
                  </div>
                  <StatusBadge status={student.status} />
                </div>

                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {student.company}
                  </span>
                  <span>•</span>
                  <span>{student.major}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">{student.overallProgress}%</span>
                  </div>
                  <Progress value={student.overallProgress} className="h-2" />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <StatusBadge status={student.weeklyLogStatus} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => openStudentDetail(student)}
                  >
                    <Eye className="h-3 w-3" /> Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Internship</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Weekly Log</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => { setSelectedStudent(student); setIsDetailOpen(true); }}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.avatarUrl} alt={student.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getStudentInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{student.major}</p>
                        <p className="text-xs text-muted-foreground">Semester {student.semester}</p>
                      </div>
                    </TableCell>
                    <TableCell>{student.internshipTitle}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{student.company}</p>
                        <p className="text-xs text-muted-foreground">{student.companyLocation}</p>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={student.status} /></TableCell>
                    <TableCell><StatusBadge status={student.weeklyLogStatus} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={student.overallProgress} className="h-2 flex-1" />
                        <span className="text-sm text-muted-foreground w-10 text-right">
                          {student.overallProgress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(student.lastActivity).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedStudent(student);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {filteredStudents.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No students found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Student Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedStudent.avatarUrl} alt={selectedStudent.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getStudentInitials(selectedStudent.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {selectedStudent.name}
                    <p className="text-sm font-normal text-muted-foreground">
                      {selectedStudent.internshipTitle} at {selectedStudent.company}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Program: {selectedStudent.program} • Semester {selectedStudent.semester}
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="p-0">
              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="submissions">Submissions</TabsTrigger>
                  <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{selectedStudent.overallProgress}%</p>
                      <p className="text-xs text-muted-foreground">Overall Progress</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-emerald-600">{selectedStudent.status}</p>
                      <p className="text-xs text-muted-foreground">Status</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-bold text-blue-600">{selectedStudent.university.split(" ")[0]}</p>
                      <p className="text-xs text-muted-foreground">University</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-bold text-purple-600">{selectedStudent.company}</p>
                      <p className="text-xs text-muted-foreground">Company</p>
                    </div>
                  </div>

                  {/* Contact & Internship Info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedStudent.email}</span>
                        </div>
                        {selectedStudent.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedStudent.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedStudent.companyLocation}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Internship Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Position:</span>
                          <span className="font-medium">{selectedStudent.internshipTitle}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Company:</span>
                          <span className="font-medium">{selectedStudent.company}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Start Date:</span>
                          <span className="font-medium">{new Date(selectedStudent.startDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">End Date:</span>
                          <span className="font-medium">{new Date(selectedStudent.endDate).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Progress Bar */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Internship Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Completion</span>
                          <span>{selectedStudent.overallProgress}% Complete</span>
                        </div>
                        <Progress value={selectedStudent.overallProgress} className="h-3" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Started: {new Date(selectedStudent.startDate).toLocaleDateString()}</span>
                          <span>Ends: {new Date(selectedStudent.endDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Supervisor Notes */}
                  {selectedStudent.supervisorNotes && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Supervisor Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm bg-muted/30 p-3 rounded-lg italic">
                          &ldquo;{selectedStudent.supervisorNotes}&rdquo;
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="gap-2"
                      asChild
                    >
                      <Link href="/faculty-supervisor/notifications">
                        <MessageSquare className="h-4 w-4" /> Send Message
                      </Link>
                    </Button>
                    <Button
                      variant="secondary"
                      className="gap-2"
                      asChild
                    >
                      <Link
                        href={`/faculty-supervisor/evaluations?student=${selectedStudent?.id || ""}`}
                      >
                        <Star className="h-4 w-4" /> Evaluate
                      </Link>
                    </Button>
                    <Button className="gap-2" asChild>
                      <Link
                        href={`/faculty-supervisor/weekly-logs?student=${selectedStudent?.id || ""}`}
                      >
                        <Eye className="h-4 w-4" /> Weekly Logs
                      </Link>
                    </Button>
                  </div>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Current Tasks</CardTitle>
                      <CardDescription>Tasks assigned to this student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(tasks[selectedStudent.id] || []).map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{task.title}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                                {task.completedAt && (
                                  <span className="text-xs text-emerald-600">
                                    Completed: {new Date(task.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                                {task.grade && (
                                  <Badge variant="secondary" className="text-xs">Grade: {task.grade}</Badge>
                                )}
                              </div>
                            </div>
                            <StatusBadge status={task.status} />
                          </div>
                        ))}
                        {(!tasks[selectedStudent.id] || tasks[selectedStudent.id].length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No tasks assigned yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Submissions Tab */}
                <TabsContent value="submissions" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Submission History</CardTitle>
                      <CardDescription>All submissions from this student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(submissions[selectedStudent.id] || []).map((submission) => (
                          <div key={submission.id} className="flex items-start justify-between p-3 rounded-lg border">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{submission.title}</p>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {submission.type.replace("_", " ")}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                                </span>
                                {submission.grade !== undefined && (
                                  <span className="text-xs font-medium text-emerald-600">
                                    Score: {submission.grade}%
                                  </span>
                                )}
                              </div>
                              {submission.feedback && (
                                <p className="text-xs text-muted-foreground mt-2 italic bg-muted/30 p-2 rounded">
                                  &ldquo;{submission.feedback}&rdquo;
                                </p>
                              )}
                            </div>
                            <StatusBadge status={submission.status} />
                          </div>
                        ))}
                        {(!submissions[selectedStudent.id] || submissions[selectedStudent.id].length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No submissions yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Evaluations Tab */}
                <TabsContent value="evaluations" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Evaluation History</CardTitle>
                      <CardDescription>Past evaluations for this student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(evaluations[selectedStudent.id] || []).map((evaluation) => (
                          <div key={evaluation.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm capitalize">
                                  {evaluation.type.replace("_", " ")} Evaluation
                                </p>
                                <Badge variant={evaluation.status === "completed" ? "default" : "secondary"} className="text-xs">
                                  {evaluation.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Date: {new Date(evaluation.date).toLocaleDateString()}
                                </span>
                                <span className={`text-xs font-medium ${evaluation.score >= evaluation.maxScore * 0.8 ? 'text-emerald-600' : evaluation.score >= evaluation.maxScore * 0.6 ? 'text-amber-600' : 'text-red-600'}`}>
                                  Score: {evaluation.score}/{evaluation.maxScore}
                                </span>
                              </div>
                              {evaluation.comments && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  &ldquo;{evaluation.comments}&rdquo;
                                </p>
                              )}
                            </div>
                            <div className="ml-4 text-right">
                              <p className="text-2xl font-bold text-primary">
                                {Math.round((evaluation.score / evaluation.maxScore) * 100)}%
                              </p>
                            </div>
                          </div>
                        ))}
                        {(!evaluations[selectedStudent.id] || evaluations[selectedStudent.id].length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No evaluations yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Attendance Summary</CardTitle>
                      <CardDescription>Attendance record during internship</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {attendance[selectedStudent.id] ? (
                        <div className="space-y-4">
                          {/* Overall Attendance Rate */}
                          <div className="text-center p-6 bg-muted/50 rounded-lg">
                            <p className={`text-4xl font-bold ${getAttendanceColor(attendance[selectedStudent.id].attendanceRate)}`}>
                              {attendance[selectedStudent.id].attendanceRate}%
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">Overall Attendance Rate</p>
                          </div>

                          {/* Breakdown */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-emerald-50 rounded-lg">
                              <p className="text-xl font-bold text-emerald-600">
                                {attendance[selectedStudent.id].present}
                              </p>
                              <p className="text-xs text-muted-foreground">Present</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                              <p className="text-xl font-bold text-red-600">
                                {attendance[selectedStudent.id].absent}
                              </p>
                              <p className="text-xs text-muted-foreground">Absent</p>
                            </div>
                            <div className="text-center p-4 bg-amber-50 rounded-lg">
                              <p className="text-xl font-bold text-amber-600">
                                {attendance[selectedStudent.id].late}
                              </p>
                              <p className="text-xs text-muted-foreground">Late</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-xl font-bold text-gray-600">
                                {attendance[selectedStudent.id].leave}
                              </p>
                              <p className="text-xs text-muted-foreground">On Leave</p>
                            </div>
                          </div>

                          {/* Total Days */}
                          <div className="text-center text-sm text-muted-foreground">
                            Total Working Days: {attendance[selectedStudent.id].totalDays}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No attendance data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
