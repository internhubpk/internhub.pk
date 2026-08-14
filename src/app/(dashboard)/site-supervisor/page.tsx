"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  CheckSquare,
  Clock,
  Inbox,
  ClipboardList,
  CalendarClock,
  ArrowRight,
  RefreshCw,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// ---------------------------------------------------------------------------
// Types — match the response shape of /api/site-supervisor/tasks and
// /api/site-supervisor/students. Keeping these in sync prevents UI regressions
// if the API adds fields later.
// ---------------------------------------------------------------------------
interface AssignedStudent {
  student_user_id: string;
  student_internship_id: string;
  internship_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  internship_title: string | null;
  company_name: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  // Aggregated progress (computed client-side from the tasks API response)
  tasks_assigned: number;
  tasks_approved: number;
  tasks_pending_review: number;
  tasks_in_progress: number;
  current_week: number | null;
  last_submission_at: string | null;
}

interface DashboardStats {
  assignedStudents: number;
  activeInternships: number;
  tasksDueToday: number;
  pendingSubmissions: number;
  tasksAwaitingReview: number;
  weeklyEvaluationsDue: number;
}

interface TaskWithAssignment {
  id: string;
  title: string;
  due_date: string | null;
  week_number: number | null;
  day_number: number | null;
  status: string;
  assignments: Array<{
    id: string;
    status: string;
    student_user_id: string;
    student: { full_name: string | null; email: string | null } | null;
  }>;
  submissions: Array<{
    id: string;
    status: string;
    submitted_at: string;
    student_user_id: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isSameDay(a: string | Date, b: string | Date): boolean {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function computeWeek(start: string, end: string | null): number | null {
  const startD = new Date(start);
  const today = new Date();
  const weeks =
    Math.floor((today.getTime() - startD.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  if (weeks < 1) return 1;
  if (end) {
    const endD = new Date(end);
    const totalWeeks = Math.ceil(
      (endD.getTime() - startD.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (totalWeeks > 0 && weeks > totalWeeks) return totalWeeks;
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SiteSupervisorDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [tasks, setTasks] = useState<TaskWithAssignment[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    assignedStudents: 0,
    activeInternships: 0,
    tasksDueToday: 0,
    pendingSubmissions: 0,
    tasksAwaitingReview: 0,
    weeklyEvaluationsDue: 0,
  });

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  async function fetchDashboardData() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // ---------------------------------------------------------------------
      // Fetch tasks + assigned students IN PARALLEL via the dedicated API
      // routes. These routes do separate Supabase queries and join the rows
      // in JS — which avoids the PostgREST 500 we hit when nesting
      // task_assignments + profiles + task_submissions inside one query.
      // ---------------------------------------------------------------------
      const [tasksRes, studentsRes] = await Promise.all([
        fetch("/api/site-supervisor/tasks", { cache: "no-store" }),
        fetch("/api/site-supervisor/students?pageSize=100", { cache: "no-store" }),
      ]);

      if (!tasksRes.ok) {
        const err = await tasksRes.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to load tasks (${tasksRes.status})`);
      }
      if (!studentsRes.ok) {
        const err = await studentsRes.json().catch(() => ({}));
        throw new Error(
          (err?.error && (err.error.message || err.error)) ||
            `Failed to load students (${studentsRes.status})`
        );
      }

      const tasksJson = await tasksRes.json();
      const studentsJson = await studentsRes.json();

      // ----- Tasks -----
      // The API returns EnrichedTask[] — pick only the fields we use here so
      // accidental shape drift elsewhere can't break the dashboard.
      const taskList: TaskWithAssignment[] = (tasksJson.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        week_number: t.week_number,
        day_number: t.day_number,
        status: t.status,
        assignments: (t.assignments || []).map((a: any) => ({
          id: a.id,
          status: a.status,
          student_user_id: a.student_user_id,
          student: a.student
            ? { full_name: a.student.full_name, email: a.student.email }
            : null,
        })),
        submissions: (t.submissions || []).map((s: any) => ({
          id: s.id,
          status: s.status,
          submitted_at: s.submitted_at,
          student_user_id: s.student_user_id,
        })),
      }));
      setTasks(taskList);

      // ----- Students -----
      // /api/site-supervisor/students returns PaginatedResponse — `items`
      // is the array we care about. Map each row into the AssignedStudent
      // shape the UI expects, then zero-out the progress counters (filled
      // in the next pass by walking the task list).
      const studentItems: any[] = studentsJson.data?.items || [];
      const studentRows: AssignedStudent[] = studentItems.map((s) => ({
        student_user_id: s.studentId,
        student_internship_id: s.id,
        internship_id: s.internshipId,
        full_name: s.studentName,
        email: s.studentEmail,
        avatar_url: s.avatarUrl,
        internship_title: s.internshipTitle,
        company_name: null, // not returned by the API; can be added later
        start_date: s.startDate,
        end_date: s.endDate,
        status: s.status,
        tasks_assigned: 0,
        tasks_approved: 0,
        tasks_pending_review: 0,
        tasks_in_progress: 0,
        current_week: computeWeek(s.startDate, s.endDate),
        last_submission_at: null,
      }));

      const studentUserIds = studentRows.map((s) => s.student_user_id);

      // Aggregate per-student progress by walking the tasks list once.
      // `assignments` on each task carries the student_user_id + status.
      for (const student of studentRows) {
        let assigned = 0,
          approved = 0,
          pendingReview = 0,
          inProgress = 0;

        for (const task of taskList) {
          const assignment = task.assignments?.find(
            (a) => a.student_user_id === student.student_user_id
          );
          if (!assignment) continue;
          assigned++;

          if (assignment.status === "approved") approved++;
          else if (assignment.status === "submitted") pendingReview++;
          else if (assignment.status === "pending" || assignment.status === "resubmitted")
            inProgress++;
        }

        student.tasks_assigned = assigned;
        student.tasks_approved = approved;
        student.tasks_pending_review = pendingReview;
        student.tasks_in_progress = inProgress;
      }

      // Last submission timestamp per student — derived from the submissions
      // already joined into each task row.
      const latestByStudent = new Map<string, string>();
      for (const task of taskList) {
        for (const sub of task.submissions || []) {
          const existing = latestByStudent.get(sub.student_user_id);
          if (!existing || new Date(sub.submitted_at) > new Date(existing)) {
            latestByStudent.set(sub.student_user_id, sub.submitted_at);
          }
        }
      }
      for (const student of studentRows) {
        student.last_submission_at = latestByStudent.get(student.student_user_id) ?? null;
      }

      setStudents(studentRows);

      // ----- Overview stats -----
      const today = new Date();
      const tasksDueToday = taskList.filter(
        (t) => t.due_date && isSameDay(t.due_date, today)
      ).length;

      const pendingSubmissions = taskList.reduce((acc, t) => {
        return (
          acc +
          (t.submissions?.filter(
            (s) => s.status === "submitted" || s.status === "resubmitted"
          ).length || 0)
        );
      }, 0);

      const tasksAwaitingReview = taskList.filter((t) =>
        t.assignments?.some((a) => a.status === "submitted")
      ).length;

      // Weekly evaluations due — count students who don't yet have a weekly
      // evaluation for the current week. This is a simple SELECT (no joins),
      // so a direct Supabase query is safe here.
      let weeklyEvalsDue = 0;
      const currentWeek = studentRows[0]?.current_week ?? null;
      if (currentWeek && studentUserIds.length > 0) {
        const supabase = createClient();
        const { data: existingEvals } = await supabase
          .from("evaluations")
          .select("student_user_id")
          .eq("evaluator_id", user.id)
          .eq("evaluator_role", "site_supervisor")
          .eq("type", "weekly")
          .eq("week_number", currentWeek)
          .in("student_user_id", studentUserIds);
        const evaldStudents = new Set(
          (existingEvals || []).map((e: any) => e.student_user_id)
        );
        weeklyEvalsDue = studentUserIds.filter((id) => !evaldStudents.has(id)).length;
      }

      setStats({
        assignedStudents: studentRows.length,
        activeInternships: new Set(studentRows.map((s) => s.internship_id)).size,
        tasksDueToday,
        pendingSubmissions,
        tasksAwaitingReview,
        weeklyEvaluationsDue: weeklyEvalsDue,
      });
    } catch (err: any) {
      console.error("[site-supervisor/dashboard] fetch error:", err);
      setError(err?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  // -------- Render --------
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" description="Site supervisor overview" />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Failed to load dashboard</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button onClick={fetchDashboardData} variant="outline" size="sm" className="mt-3">
                  <RefreshCw className="h-4 w-4 mr-2" /> Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Internship supervision overview — tasks, submissions, and evaluations."
        actions={
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Assigned Students"
          value={stats.assignedStudents}
          icon={GraduationCap}
          variant="info"
        />
        <StatCard
          label="Active Internships"
          value={stats.activeInternships}
          icon={CheckSquare}
          variant="success"
        />
        <StatCard
          label="Tasks Due Today"
          value={stats.tasksDueToday}
          icon={Clock}
          variant={stats.tasksDueToday > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Pending Submissions"
          value={stats.pendingSubmissions}
          icon={Inbox}
          variant={stats.pendingSubmissions > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Tasks Awaiting Review"
          value={stats.tasksAwaitingReview}
          icon={ClipboardList}
          variant={stats.tasksAwaitingReview > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Weekly Evals Due"
          value={stats.weeklyEvaluationsDue}
          icon={CalendarClock}
          variant={stats.weeklyEvaluationsDue > 0 ? "warning" : "default"}
        />
      </div>

      {/* Students grid */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Assigned Students</CardTitle>
            <CardDescription>
              {students.length === 0
                ? "No students are currently assigned to you."
                : `${students.length} student${students.length === 1 ? "" : "s"} under your supervision`}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/site-supervisor/tasks">
              <CheckSquare className="h-4 w-4 mr-2" /> Manage Tasks
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No students assigned yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Students will appear here once a coordinator assigns them to you.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => {
                const completionPct =
                  s.tasks_assigned === 0
                    ? 0
                    : Math.round((s.tasks_approved / s.tasks_assigned) * 100);
                return (
                  <motion.div
                    key={s.student_user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-5">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={s.avatar_url || undefined} />
                            <AvatarFallback>
                              {(s.full_name || s.email || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/site-supervisor/students/${s.student_user_id}`}
                              className="font-medium hover:underline truncate block"
                            >
                              {s.full_name || "Unnamed student"}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-medium truncate">
                            {s.internship_title || "Internship"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.company_name || "—"}
                            {s.current_week ? ` · Week ${s.current_week}` : ""}
                          </p>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">
                              {s.tasks_approved}/{s.tasks_assigned} tasks · {completionPct}%
                            </span>
                          </div>
                          <Progress value={completionPct} className="h-2" />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {s.tasks_pending_review > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {s.tasks_pending_review} to review
                            </Badge>
                          )}
                          {s.tasks_in_progress > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {s.tasks_in_progress} in progress
                            </Badge>
                          )}
                          {s.tasks_pending_review === 0 && s.tasks_in_progress === 0 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              No active tasks
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Last submission: {formatRelative(s.last_submission_at)}
                          </span>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/site-supervisor/students/${s.student_user_id}`}>
                              View <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks needing review (quick view) */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks Awaiting Review</CardTitle>
          <CardDescription>
            Submitted work waiting for your review and approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.filter((t) => t.assignments?.some((a) => a.status === "submitted")).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">All caught up.</p>
              <p className="text-xs text-muted-foreground mt-1">
                No submissions are awaiting your review right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {tasks
                .filter((t) => t.assignments?.some((a) => a.status === "submitted"))
                .slice(0, 5)
                .map((task) => {
                  const submitted =
                    task.assignments?.filter((a) => a.status === "submitted") || [];
                  return (
                    <li key={task.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {task.title}
                          {task.week_number && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              W{task.week_number}
                              {task.day_number ? `·D${task.day_number}` : ""}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {submitted.length} submission{submitted.length === 1 ? "" : "s"}:{" "}
                          {submitted
                            .map((a) => a.student?.full_name || a.student?.email || "—")
                            .join(", ")}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/site-supervisor/tasks">Review</Link>
                      </Button>
                    </li>
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
