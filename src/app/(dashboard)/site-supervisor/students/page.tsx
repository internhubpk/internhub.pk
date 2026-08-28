"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  Download,
  Eye,
  Mail,
  Phone,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  BarChart3,
  UserCheck,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// Types
interface StudentDetail {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  enrollmentNumber?: string | null;
  university?: string;
  department?: string;
  program?: string;
  internshipTitle?: string;
  company?: string;
  status: "active" | "assigned" | "completed" | "on_leave" | "suspended" | "paused" | "terminated";
  startDate?: string;
  endDate?: string;
  progress: number;
  lastEvaluationDate?: string | null;
  daysSinceEvaluation: number | null;
  performanceRating: "excellent" | "good" | "satisfactory" | "needs_attention" | null;
  overallRating?: number | null;
}

interface WeeklyLogSummary {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  status: "submitted" | "approved" | "rejected" | "pending" | "late";
  hoursLogged: number;
}

interface EvaluationRecord {
  id: string;
  period: string;
  overallRating: number;
  decision: "satisfactory" | "needs_improvement" | "unsatisfactory";
  date: string;
  technicalScore: number;
  professionalScore: number;
  workQualityScore: number;
}

export default function SiteSupervisorStudentsPage() {
  const { user, profile } = useAuth();
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [evaluationFilter, setEvaluationFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Detail view data
  const [studentLogs, setStudentLogs] = useState<WeeklyLogSummary[]>([]);
  const [studentEvaluations, setStudentEvaluations] = useState<EvaluationRecord[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<{
    date: string;
    checkIn?: string | null;
    checkOut?: string | null;
    status: string;
    verified: boolean;
    notes?: string | null;
  }[]>([]);

  function exportStudentsCsv(rows: StudentDetail[]) {
    if (!rows.length) return;
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Enrollment Number",
      "Internship Title",
      "Company",
      "Status",
      "Start Date",
      "End Date",
      "Days Since Evaluation",
      "Performance Rating",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    rows.forEach((s) => {
      lines.push(
        [
          s.name,
          s.email,
          s.phone ?? "",
          s.enrollmentNumber ?? "",
          s.internshipTitle ?? "",
          s.company ?? "",
          s.status,
          s.startDate ?? "",
          s.endDate ?? "",
          s.daysSinceEvaluation ?? "",
          s.performanceRating ?? "",
        ]
          .map(escape)
          .join(",")
      );
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assigned-students-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    fetchAssignedStudents();
  }, []);

  async function fetchAssignedStudents() {
    if (!user) return;

    setIsLoading(true);
    try {
      const supabase = createClient();

      // student_internships.site_supervisor_id is FK to profiles.user_id,
      // so filter by the auth user's id (the supervisor's user_id) — NOT
      // the supervisors table PK. RLS uses auth.uid() the same way.
      const supervisorUserId = user.id;

      // Fetch assigned students (real columns only — student_internships has
      // no `student_id`, `progress`, or `last_evaluation_at` columns).
      const { data: assignments } = await supabase
        .from("student_internships")
        .select(`
          id,
          student_user_id,
          internship_id,
          status,
          start_date,
          end_date,
          updated_at,
          student_profile:student_user_id(
            full_name,
            first_name,
            last_name,
            email,
            phone,
            avatar_url,
            student_id_number
          ),
          internship:internships(
            id,
            title,
            company:companies(name)
          )
        `)
        .eq("site_supervisor_id", supervisorUserId)
        .order("updated_at", { ascending: false });

      // DEFENSE-IN-DEPTH (2026-08-25): Also fetch SIs that have an
      // active intern_supervisor_assignment for this supervisor but
      // where the mirror column is NULL. The HR assignment flow
      // sometimes loses the mirror write (silently failed trigger or
      // RLS check), and a supervisor would see 0 students even though
      // an active assignment row existed. Merge by SI id, skipping
      // any SI already in the primary result set.
      const primaryIds = new Set((assignments || []).map((r: any) => r.id));
      const { data: fallbackAssignments } = await supabase
        .from("intern_supervisor_assignments")
        .select("student_internship_id")
        .eq("supervisor_id", supervisorUserId)
        .eq("type", "site")
        .eq("is_active", true)
        .is("ended_at", null);
      const fallbackSiIds = (fallbackAssignments || [])
        .map((a: any) => a.student_internship_id)
        .filter((id: string) => Boolean(id) && !primaryIds.has(id));
      let fallbackRows: any[] = [];
      if (fallbackSiIds.length > 0) {
        const { data: fb } = await supabase
          .from("student_internships")
          .select(`
            id,
            student_user_id,
            internship_id,
            status,
            start_date,
            end_date,
            updated_at,
            student_profile:student_user_id(
              full_name,
              first_name,
              last_name,
              email,
              phone,
              avatar_url,
              student_id_number
            ),
            internship:internships(
              id,
              title,
              company:companies(name)
            )
          `)
          .in("id", fallbackSiIds)
          .order("updated_at", { ascending: false });
        fallbackRows = (fb as any[]) || [];
      }
      const mergedAssignments = [...(assignments || []), ...fallbackRows];

      const internRows = mergedAssignments as any[];
      const studentUserIds = internRows
        .map((r) => r.student_user_id)
        .filter((id): id is string => Boolean(id));

      // Pull most-recent site_supervisor evaluation per student so we can
      // compute "days since evaluation" without the (non-existent)
      // `student_internships.last_evaluation_at` column.
      const evalsRes = studentUserIds.length
        ? await supabase
            .from("evaluations")
            .select("id, student_user_id, created_at, rating")
            .eq("evaluator_id", supervisorUserId)
            .eq("evaluator_role", "site_supervisor")
            .in("student_user_id", studentUserIds)
            .order("created_at", { ascending: false })
        : { data: [] as any[], error: null };

      const lastEvalByStudent = new Map<string, { date: string; rating: number | null }>();
      (evalsRes.data || []).forEach((ev: any) => {
        if (ev.student_user_id && !lastEvalByStudent.has(ev.student_user_id)) {
          lastEvalByStudent.set(ev.student_user_id, {
            date: ev.created_at,
            rating: typeof ev.rating === "number" ? ev.rating : null,
          });
        }
      });

      const studentData: StudentDetail[] = internRows.map((assign: any) => {
        const profile = assign.student_profile || {};
        const internship = assign.internship || {};
        const company = internship.company || {};
        const studentUser = assign.student_user_id as string | undefined;
        const lastEvalInfo = studentUser ? lastEvalByStudent.get(studentUser) ?? null : null;
        const lastEval = lastEvalInfo ? new Date(lastEvalInfo.date) : null;
        const daysSinceEvaluation = lastEval
          ? Math.floor((Date.now() - lastEval.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let rating: StudentDetail["performanceRating"] = null;
        if (daysSinceEvaluation !== null) {
          if (daysSinceEvaluation <= 21) rating = "excellent";
          else if (daysSinceEvaluation <= 28) rating = "good";
          else if (daysSinceEvaluation <= 42) rating = "satisfactory";
          else rating = "needs_attention";
        }

        const fullName =
          profile.full_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          (profile.email ? profile.email.split("@")[0] : "Unknown Student");

        return {
          id: assign.id,
          studentId: studentUser || assign.id,
          name: fullName,
          email: profile.email || "",
          phone: profile.phone ?? null,
          avatarUrl: profile.avatar_url ?? null,
          enrollmentNumber: profile.student_id_number ?? null,
          internshipTitle: internship.title,
          company: company.name,
          status: assign.status || "active",
          startDate: assign.start_date,
          endDate: assign.end_date,
          progress: 0, // student_internships has no progress column
          lastEvaluationDate: lastEvalInfo?.date ?? null,
          daysSinceEvaluation,
          performanceRating: rating,
          overallRating: lastEvalInfo?.rating ?? null,
        };
      });

      setStudents(studentData);
    } catch (error) {
      console.error("Error fetching students:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  async function openStudentDetail(student: StudentDetail) {
    setSelectedStudent(student);
    setShowDetailModal(true);
    setStudentLogs([]);
    setStudentEvaluations([]);

    if (!user) return;
    const supabase = createClient();
    const supervisorUserId = user.id;
    const studentUserId = student.studentId;

    try {
      const [logsRes, evalsRes, attendanceRes] = await Promise.all([
        supabase
          .from("weekly_logs")
          .select("id, week_start_date, week_end_date, status, submitted_at, supervisor_feedback")
          .eq("supervisor_id", supervisorUserId)
          .eq("student_user_id", studentUserId)
          .order("week_start_date", { ascending: false }),
        supabase
          .from("evaluations")
          .select("id, type, scores, rating, comments, submitted_at, created_at")
          .eq("evaluator_id", supervisorUserId)
          .eq("evaluator_role", "site_supervisor")
          .eq("student_user_id", studentUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("attendance")
          .select("id, date, check_in, check_out, status, notes, verified")
          .eq("student_user_id", studentUserId)
          .order("date", { ascending: false })
          .limit(50),
      ]);

      // Build weekly log summaries. weekly_logs has no hours_worked column;
      // we compute hours from check_in/check_out on the matching attendance
      // record when available, otherwise default to 0.
      const attendanceByDate = new Map<string, { check_in?: string; check_out?: string }>();
      (attendanceRes.data || []).forEach((a: any) => {
        if (a.date) attendanceByDate.set(a.date, { check_in: a.check_in, check_out: a.check_out });
      });

      const hourDiff = (start?: string, end?: string): number => {
        if (!start || !end) return 0;
        const ms = new Date(end).getTime() - new Date(start).getTime();
        return ms > 0 ? Math.round((ms / (1000 * 60 * 60)) * 10) / 10 : 0;
      };

      const logs: WeeklyLogSummary[] = ((logsRes.data || []) as any[]).map((l: any, idx: number) => {
        const start = l.week_start_date;
        const end = l.week_end_date;
        const att = start ? attendanceByDate.get(start) : undefined;
        const hours = att ? hourDiff(att.check_in, att.check_out) : 0;
        return {
          weekNumber: (logsRes.data || []).length - idx,
          weekStart: start,
          weekEnd: end,
          status: (l.status as WeeklyLogSummary["status"]) || "submitted",
          hoursLogged: hours,
        };
      });
      setStudentLogs(logs);

      // Build evaluation records. `evaluations` has `scores` (jsonb) and
      // `rating` (0-5); derive the legacy UI shape from those.
      const evals: EvaluationRecord[] = ((evalsRes.data || []) as any[]).map((ev: any) => {
        const scores = (ev.scores && typeof ev.scores === "object") ? ev.scores as Record<string, any> : {};
        const overall = typeof ev.rating === "number" ? ev.rating : 0;
        const decision: EvaluationRecord["decision"] =
          overall >= 4 ? "satisfactory" : overall >= 3 ? "needs_improvement" : "unsatisfactory";
        const num = (v: any) => (typeof v === "number" ? v : 0);
        return {
          id: ev.id,
          period: ev.type ? String(ev.type).replace(/_/g, " ") : "Evaluation",
          overallRating: overall,
          decision,
          date: ev.submitted_at || ev.created_at,
          technicalScore: num(scores.technical_knowledge ?? scores.technical ?? 0),
          professionalScore: num(scores.communication ?? scores.professional ?? 0),
          workQualityScore: num(scores.deliverable_quality ?? scores.work_quality ?? 0),
        };
      });
      setStudentEvaluations(evals);

      setStudentAttendance(
        ((attendanceRes.data || []) as any[]).map((a: any) => ({
          date: a.date,
          checkIn: a.check_in ?? null,
          checkOut: a.check_out ?? null,
          status: String(a.status ?? "present"),
          verified: Boolean(a.verified),
          notes: a.notes ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching student detail:", error);
    }
  }

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.enrollmentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      // Status filter
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;

      // Evaluation due filter
      // `daysSinceEvaluation === null` means the student has NEVER been
      // evaluated — that's the most overdue case possible, so it should
      // match both 'due' and 'overdue'. The previous `?? 0` silently
      // treated never-evaluated students as just-evaluated (0 days),
      // hiding them from the 'due' and 'overdue' filters entirely.
      let matchesEvaluation = true;
      if (evaluationFilter === "due") {
        matchesEvaluation = student.daysSinceEvaluation === null || student.daysSinceEvaluation > 18;
      } else if (evaluationFilter === "overdue") {
        matchesEvaluation = student.daysSinceEvaluation === null || student.daysSinceEvaluation > 21;
      } else if (evaluationFilter === "current") {
        matchesEvaluation = student.daysSinceEvaluation !== null && student.daysSinceEvaluation <= 18;
      }

      return matchesSearch && matchesStatus && matchesEvaluation;
    });
  }, [students, searchQuery, statusFilter, evaluationFilter]);

  function getPerformanceColor(rating: StudentDetail["performanceRating"]) {
    switch (rating) {
      case "excellent": return "text-green-600 bg-green-50 border-green-200";
      case "good": return "text-blue-600 bg-blue-50 border-blue-200";
      case "satisfactory": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "needs_attention": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  }

  function getPerformanceBadge(rating: StudentDetail["performanceRating"]) {
    switch (rating) {
      case "excellent": return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Excellent</Badge>;
      case "good": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Good</Badge>;
      case "satisfactory": return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Satisfactory</Badge>;
      case "needs_attention": return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Needs Attention</Badge>;
      default: return null;
    }
  }

  function getDecisionBadge(decision: EvaluationRecord["decision"]) {
    switch (decision) {
      case "satisfactory":
        return <Badge className="bg-green-100 text-green-800">Satisfactory</Badge>;
      case "needs_improvement":
        return <Badge className="bg-yellow-100 text-yellow-800">Needs Improvement</Badge>;
      case "unsatisfactory":
        return <Badge className="bg-red-100 text-red-800">Unsatisfactory</Badge>;
      default:
        return <Badge variant="secondary">{decision}</Badge>;
    }
  }

  function getTrendIcon(current: number, previous: number) {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Assigned Students"
        description="View and manage interns assigned to your supervision"
        actions={
          <Button variant="outline" onClick={() => exportStudentsCsv(filteredStudents)}>
            <Download className="h-4 w-4 mr-2" />
            Export List
          </Button>
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Assigned" value={students.length} icon={Users} variant="success" />
        <StatCard
          label="Active"
          // 'assigned' = matched to an internship but not yet started;
          // 'active' = currently ongoing. Both should count as "Active".
          value={students.filter(s => s.status === "active" || s.status === "assigned").length}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          label="Eval Due Soon"
          // `daysSinceEvaluation === null` means the student has NEVER been
          // evaluated — they're the most overdue. The previous `?? 0` hid
          // them from this count entirely.
          value={students.filter(s => s.daysSinceEvaluation === null || (s.daysSinceEvaluation ?? 0) > 18).length}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          label="Overdue"
          value={students.filter(s => s.daysSinceEvaluation === null || (s.daysSinceEvaluation ?? 0) > 21).length}
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or enrollment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>

            <Select value={evaluationFilter} onValueChange={setEvaluationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <ClipboardList className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Evaluation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="current">Current Eval</SelectItem>
                <SelectItem value="due">Due Soon</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Grid/List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== "all" || evaluationFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "No students have been assigned to you yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredStudents.map((student, index) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${
                  student.performanceRating === "needs_attention" ? 'border-l-4 border-l-red-500' : ''
                }`}
                onClick={() => openStudentDetail(student)}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Student Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="h-14 w-14 shrink-0">
                        <AvatarImage src={student.avatarUrl || undefined} alt={student.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                          {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg truncate">{student.name}</h3>
                          <StatusBadge status={student.status} />
                          {getPerformanceBadge(student.performanceRating)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {student.enrollmentNumber && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {student.enrollmentNumber}
                            </span>
                          )}
                          {student.internshipTitle && (
                            <span className="hidden sm:inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {student.internshipTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress & Metrics */}
                    <div className="flex items-center gap-6 lg:gap-8">
                      <div className="text-center min-w-[80px]">
                        {/* Progress % was previously hardcoded to 0 with a
                            comment "student_internships has no progress
                            column" — showing "0% Complete" with an empty
                            bar misled users into thinking nothing had been
                            done. Replaced with days-since-evaluation, which
                            is a real signal of how engaged the student is. */}
                        <p className="text-2xl font-bold">
                          {student.daysSinceEvaluation !== null
                            ? `${student.daysSinceEvaluation}d`
                            : "Never"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">Since last eval</p>
                      </div>

                      <div className={`text-center px-3 py-2 rounded-lg border ${getPerformanceColor(student.performanceRating)} min-w-[120px]`}>
                        <p className="text-xs uppercase tracking-wide opacity-70">Last Eval</p>
                        <p className="font-semibold">
                          {student.daysSinceEvaluation !== null ? `${student.daysSinceEvaluation}d` : "Never"}
                        </p>
                      </div>

                      <div className="text-right hidden md:block">
                        {student.overallRating && (
                          <>
                            <p className="text-xl font-bold text-primary">{student.overallRating.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">Avg Rating</p>
                          </>
                        )}
                      </div>

                      <Button variant="ghost" size="sm" className="shrink-0">
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Student Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="sm:max-w-4xl">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedStudent.avatarUrl || undefined} alt={selectedStudent.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {selectedStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {selectedStudent.name}
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {selectedStudent.enrollmentNumber}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Complete intern details and activity history
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="p-0">
              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="logs">Weekly Logs</TabsTrigger>
                  <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contact Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${selectedStudent.email}`} className="text-sm hover:text-primary">
                            {selectedStudent.email}
                          </a>
                        </div>
                        {selectedStudent.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <a href={`tel:${selectedStudent.phone}`} className="text-sm hover:text-primary">
                              {selectedStudent.phone}
                            </a>
                          </div>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">University</p>
                            <p className="font-medium">{selectedStudent.university || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Department</p>
                            <p className="font-medium">{selectedStudent.department || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Program</p>
                            <p className="font-medium">{selectedStudent.program || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <div><StatusBadge status={selectedStudent.status} /></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Internship Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Internship Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Position</p>
                          <p className="font-medium">{selectedStudent.internshipTitle || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Company</p>
                          <p className="font-medium">{selectedStudent.company || "N/A"}</p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Start Date</p>
                            <p className="font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {selectedStudent.startDate ? new Date(selectedStudent.startDate).toLocaleDateString() : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">End Date</p>
                            <p className="font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {selectedStudent.endDate ? new Date(selectedStudent.endDate).toLocaleDateString() : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="pt-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Days since last evaluation</span>
                            <span className="font-semibold">
                              {selectedStudent.daysSinceEvaluation !== null
                                ? `${selectedStudent.daysSinceEvaluation} days`
                                : "Never evaluated"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Performance Summary */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Performance Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-3xl font-bold text-primary">
                            {selectedStudent.overallRating?.toFixed(1) || "N/A"}
                          </p>
                          <p className="text-sm text-muted-foreground">Average Rating</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-3xl font-bold text-emerald-600">
                            {studentEvaluations.length}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Evaluations</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-3xl font-bold text-amber-600">
                            {selectedStudent.daysSinceEvaluation ?? "N/A"}
                          </p>
                          <p className="text-sm text-muted-foreground">Days Since Eval</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <div className="mt-1">
                            {getPerformanceBadge(selectedStudent.performanceRating)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">Current Status</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Weekly Logs Tab */}
                <TabsContent value="logs" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Weekly Log History
                      </CardTitle>
                      <CardDescription>
                        Submission and approval status for each week
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {studentLogs.map((log) => (
                          <div
                            key={log.weekNumber}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm">
                                W{log.weekNumber}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  Week of {new Date(log.weekStart).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(log.weekStart).toLocaleDateString()} -{" "}
                                  {new Date(log.weekEnd).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium">{log.hoursLogged} hrs</p>
                                <p className="text-xs text-muted-foreground">Logged</p>
                              </div>
                              <StatusBadge status={log.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Summary stats */}
                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {studentLogs.filter(l => l.status === "approved").length}
                          </p>
                          <p className="text-xs text-muted-foreground">Approved</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {studentLogs.reduce((sum, l) => sum + l.hoursLogged, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Hours</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-amber-600">
                            {studentLogs.length > 0 ? Math.round(studentLogs.reduce((sum, l) => sum + l.hoursLogged, 0) / studentLogs.length) : 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Avg Hours/Week</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Evaluations Tab */}
                <TabsContent value="evaluations" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Evaluation History
                      </CardTitle>
                      <CardDescription>
                        Performance ratings over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {studentEvaluations.map((eval_, index) => {
                          const prevEval = index < studentEvaluations.length - 1 
                            ? studentEvaluations[index + 1] 
                            : null;
                          
                          return (
                            <div key={eval_.id} className="p-4 rounded-lg border">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold">{eval_.period}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Evaluated on {new Date(eval_.date).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {prevEval && getTrendIcon(eval_.overallRating, prevEval.overallRating)}
                                  <span className="text-2xl font-bold text-primary">
                                    {eval_.overallRating.toFixed(1)}
                                  </span>
                                  {getDecisionBadge(eval_.decision)}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-2 rounded bg-blue-50">
                                  <p className="text-sm text-muted-foreground">Technical</p>
                                  <p className="font-semibold text-blue-700">{eval_.technicalScore.toFixed(1)}</p>
                                </div>
                                <div className="text-center p-2 rounded bg-purple-50">
                                  <p className="text-sm text-muted-foreground">Professional</p>
                                  <p className="font-semibold text-purple-700">{eval_.professionalScore.toFixed(1)}</p>
                                </div>
                                <div className="text-center p-2 rounded bg-green-50">
                                  <p className="text-sm text-muted-foreground">Work Quality</p>
                                  <p className="font-semibold text-green-700">{eval_.workQualityScore.toFixed(1)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {studentEvaluations.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No evaluations recorded yet
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Attendance Record
                      </CardTitle>
                      <CardDescription>Recent attendance entries for this intern</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {studentAttendance.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No attendance records found</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {studentAttendance.map((a) => (
                            <div
                              key={`${a.date}-${a.checkIn ?? ""}`}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                                  <span className="text-[10px] uppercase text-muted-foreground">
                                    {a.date ? new Date(a.date).toLocaleString("en-US", { month: "short" }) : ""}
                                  </span>
                                  <span className="text-sm font-semibold leading-none">
                                    {a.date ? new Date(a.date).getDate() : "—"}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {a.date ? new Date(a.date).toLocaleDateString() : "N/A"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {a.checkIn ? `In: ${new Date(a.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—"}
                                    {a.checkOut ? ` · Out: ${new Date(a.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                                  </p>
                                  {a.notes && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {a.verified && (
                                  <Badge className="bg-blue-100 text-blue-800">Verified</Badge>
                                )}
                                <Badge className={
                                  a.status === "present" ? "bg-green-100 text-green-800" :
                                  a.status === "absent" ? "bg-red-100 text-red-800" :
                                  a.status === "leave" ? "bg-orange-100 text-orange-800" :
                                  "bg-yellow-100 text-yellow-800"
                                }>
                                  {a.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
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

// Import ClipboardList icon used in JSX
function ClipboardList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M12 11h4"/>
      <path d="M12 16h4"/>
      <path d="M8 11h.01"/>
      <path d="M8 16h.01"/>
    </svg>
  );
}
