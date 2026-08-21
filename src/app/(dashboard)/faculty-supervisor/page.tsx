"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Briefcase,
  TrendingUp,
  GraduationCap,
  Building2,
  FileText,
  Search,
  UserCheck,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  ClipboardList,
  CheckSquare,
  Send,
  ArrowRight,
  AlertTriangle,
  Star,
  Eye,
  MessageSquare,
  FileCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { EnablePushNotificationsCard } from "@/components/shared/enable-push-notifications";
import { fetchSupervisedStudents } from "@/lib/supervised-students";

// Types
interface FacultyStats {
  supervisedStudents: number;
  activeInternships: number;
  pendingReviews: number;
  evaluationsCompleted: number;
  tasksPending: number;
  tasksCompleted: number;
  tasksOverdue: number;
  avgProgress: number;
}

interface StudentOverview {
  id: string;
  name: string;
  email: string;
  program: string;
  company: string;
  progress: number;
  status: "active" | "on_leave" | "completed" | "awaiting_placement";
  lastActivity: string;
  avatarUrl?: string;
}

interface RecentSubmission {
  id: string;
  studentName: string;
  taskTitle: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  type: "task" | "weekly_log" | "document";
}

interface TaskNeedingAttention {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  status: "overdue" | "pending_review" | "not_started";
  priority: "high" | "medium" | "low";
}

// Default empty states - data will be fetched from database
const DEFAULT_STUDENTS: StudentOverview[] = [];
const DEFAULT_SUBMISSIONS: RecentSubmission[] = [];
const DEFAULT_TASKS: TaskNeedingAttention[] = [];
const DEFAULT_STATS: FacultyStats = {
  supervisedStudents: 0,
  activeInternships: 0,
  pendingReviews: 0,
  evaluationsCompleted: 0,
  tasksPending: 0,
  tasksCompleted: 0,
  tasksOverdue: 0,
  avgProgress: 0,
};

export default function FacultySupervisorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<FacultyStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<StudentOverview[]>(DEFAULT_STUDENTS);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>(DEFAULT_SUBMISSIONS);
  const [tasksNeedingAttention, setTasksNeedingAttention] = useState<TaskNeedingAttention[]>(DEFAULT_TASKS);

  useEffect(() => {
    fetchFacultyData();
  }, [user]);

  async function fetchFacultyData() {
    if (!user) return;

    try {
      const supabase = createClient();

      // Fetch supervised students from BOTH sources (student_internships
      // for internship-time assignments + students.faculty_supervisor_id
      // for pre-internship assignments made by the coordinator). Without
      // both, the dashboard shows 0 students whenever a coordinator assigns
      // a supervisor to a student who hasn't started an internship yet.
      const supervisedStudents = await fetchSupervisedStudents(supabase, user.id);
      const supervisedStudentIds = supervisedStudents.map((s) => s.user_id);

      // Fetch internship-shaped rows for the students we found above.
      // This is what powers the StudentOverview list and activeInternships count.
      let assignedInternships: any[] = [];
      if (supervisedStudentIds.length > 0) {
        const { data: internshipRows } = await supabase
          .from("student_internships")
          .select(`
            id,
            student_user_id,
            status,
            start_date,
            end_date,
            student_profile:student_user_id(full_name, email, avatar_url),
            internship:internships(id, title, location, remote, company_id),
            company:company_id(name)
          `)
          .eq("faculty_supervisor_id", user.id)
          .in("status", ["assigned", "active", "paused", "completed"])
          .order("created_at", { ascending: false });
        assignedInternships = internshipRows || [];
      }

      // For students that don't yet have an internship row (pre-internship
      // assignment via students.faculty_supervisor_id), synthesize a minimal
      // student-internship-shaped object so they still appear in the list.
      const seenIds = new Set(assignedInternships.map((a) => a.student_user_id));
      const missingIds = supervisedStudentIds.filter((id) => !seenIds.has(id));
      if (missingIds.length > 0) {
        const { data: missingProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, avatar_url")
          .in("user_id", missingIds);
        for (const p of missingProfiles || []) {
          assignedInternships.push({
            id: `pre-${p.user_id}`,
            student_user_id: p.user_id,
            status: "assigned",
            start_date: null,
            end_date: null,
            student_profile: {
              full_name: p.full_name,
              email: p.email,
              avatar_url: p.avatar_url,
            },
            internship: null,
            company: null,
          });
        }
      }

      // 'assigned' = matched to an internship but not yet started;
      // 'active' = currently ongoing. Both should count as "active
      // supervisions" for the dashboard stat card — but ONLY for real
      // student_internships rows. Synthesized `pre-` rows (students
      // linked via students.faculty_supervisor_id who haven't been
      // placed in an internship yet) must NOT inflate this count,
      // otherwise the dashboard shows "1 Active Internship" when zero
      // internships exist in the DB.
      const activeInternshipsCount = assignedInternships.filter(
        (a) =>
          (a.status === "active" || a.status === "assigned") &&
          a.internship !== null &&
          a.id !== null &&
          !String(a.id).startsWith("pre-")
      ).length;

      // Run all the remaining stats + section queries in parallel.
      // `pendingRes` counts BOTH pending weekly_logs AND pending
      // evaluations assigned to this faculty supervisor. The previous
      // version only counted weekly_logs in 'submitted' status, missing
      // pending evaluations entirely. For supervisor.cs_myu, the DB has
      // 1 pending task evaluation (status='pending', rating=NULL) — the
      // old query returned 0.
      const pendingEvaluationsQuery = supabase
        .from("evaluations")
        .select("id", { count: "exact", head: true })
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "faculty_supervisor")
        .eq("status", "pending");
      const pendingWeeklyLogsQuery = supervisedStudentIds.length > 0
        ? supabase
            .from("weekly_logs")
            .select("id", { count: "exact", head: true })
            .eq("status", "submitted")
            .in("student_user_id", supervisedStudentIds)
        : Promise.resolve({ count: 0, data: null, error: null, status: 200, statusText: "" } as const);
      const [pendingEvalsRes, pendingWeeklyRes, completedRes, recentSubsRes, tasksRes, weeklyLogsRes, taskSubsForSupervisorRes] =
        await Promise.all([
          pendingEvaluationsQuery,
          pendingWeeklyLogsQuery,
          // evaluation_status enum has no "completed" value; use
          // "submitted" / "approved" / "rejected" as the "done" set.
          supabase
            .from("evaluations")
            .select("id", { count: "exact" })
            .eq("evaluator_id", user.id)
            .in("status", ["submitted", "approved", "rejected"]),
          // Recent submissions: latest task_submissions by assigned students.
          supervisedStudentIds.length > 0
            ? supabase
                .from("task_submissions")
                .select(`
                  id,
                  status,
                  submitted_at,
                  student_user_id,
                  task_id,
                  student_profile:student_user_id(full_name),
                  task:tasks(title)
                `)
                .in("student_user_id", supervisedStudentIds)
                .order("submitted_at", { ascending: false })
                .limit(5)
            : Promise.resolve({ data: [] }),
          // Tasks created by this supervisor (for "Tasks Needing Attention").
          supabase
            .from("tasks")
            .select(`
              id,
              title,
              due_date,
              status,
              created_at
            `)
            .eq("created_by", user.id)
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(10),
          // All weekly_logs for supervised students (used to compute progress).
          supervisedStudentIds.length > 0
            ? supabase
                .from("weekly_logs")
                .select("student_user_id, status, week_start_date")
                .in("student_user_id", supervisedStudentIds)
            : Promise.resolve({ data: [] }),
          // All task_submissions by this supervisor's students —
          // used to compute the real pending/completed task-submission
          // counts (replacing the previously hardcoded 0/0 values that
          // made the "Tasks Completed" stat card always show 0).
          // We filter by student_user_id (NOT task_id) because the
          // supervisor cares about their students' submissions,
          // regardless of which supervisor created the task.
          supervisedStudentIds.length > 0
            ? supabase
                .from("task_submissions")
                .select("id, status")
                .in("student_user_id", supervisedStudentIds)
            : Promise.resolve({ data: [] }),
        ]);

      // Compute real pending/completed task-submission counts.
      // `pending` = submissions waiting for review (status "submitted" or "pending").
      // `completed` = submissions that have been reviewed (status "approved" or "rejected").
      const taskSubsRows: any[] = (taskSubsForSupervisorRes as any)?.data || [];
      let tasksPendingCount = 0;
      let tasksCompletedCount = 0;
      taskSubsRows.forEach((s) => {
        const st = (s.status || "").toLowerCase();
        if (st === "approved" || st === "rejected") {
          tasksCompletedCount += 1;
        } else if (st === "submitted" || st === "pending" || st === "in_review") {
          tasksPendingCount += 1;
        }
      });

      // Map assigned internships to the StudentOverview shape, computing a
      // simple progress proxy from weekly_logs (approved / total).
      const logsByStudent = new Map<string, { approved: number; total: number; latest?: string }>();
      (weeklyLogsRes.data || []).forEach((log: any) => {
        const cur = logsByStudent.get(log.student_user_id) || { approved: 0, total: 0 };
        cur.total += 1;
        if (log.status === "approved") cur.approved += 1;
        const ws = log.week_start_date;
        if (ws && (!cur.latest || ws > cur.latest)) cur.latest = ws;
        logsByStudent.set(log.student_user_id, cur);
      });

      const studentList: StudentOverview[] = (assignedInternships || []).map((s: any) => {
        const meta = logsByStudent.get(s.student_user_id) || { approved: 0, total: 0 };
        const progress = meta.total > 0 ? Math.round((meta.approved / meta.total) * 100) : 0;
        const name =
          s.student_profile?.full_name ||
          `Student ${s.student_user_id?.slice(0, 6)}`;
        // Pre-internship (synthesized) rows have no internship/company.
        // Show a meaningful label instead of "N/A" so coordinators can
        // tell at a glance that this student hasn't been placed yet.
        const isPreInternship =
          s.internship === null || (s.id && String(s.id).startsWith("pre-"));
        const company = isPreInternship
          ? "Awaiting internship"
          : s.company?.name || s.internship?.title || "N/A";
        // Pre-internship students get their own status so the badge and
        // progress buckets can distinguish them from active interns.
        const status: StudentOverview["status"] = isPreInternship
          ? "awaiting_placement"
          : s.status === "active"
          ? "active"
          : s.status === "completed"
          ? "completed"
          : "active";
        return {
          id: s.student_user_id || s.id,
          name,
          email: s.student_profile?.email || "",
          program: "", // not in profile; left blank
          company,
          progress: isPreInternship ? 0 : progress,
          status,
          lastActivity: meta.latest || s.start_date || "",
          avatarUrl: s.student_profile?.avatar_url,
        };
      });
      setStudents(studentList);

      // Map recent task_submissions → RecentSubmission
      const recentSubs: RecentSubmission[] = (recentSubsRes.data || []).map((sub: any) => ({
        id: sub.id,
        studentName: sub.student_profile?.full_name || "Unknown Student",
        taskTitle: sub.task?.title || "Untitled Task",
        submittedAt: sub.submitted_at || "",
        status:
          sub.status === "approved"
            ? "approved"
            : sub.status === "rejected"
            ? "rejected"
            : "pending",
        type: "task",
      }));
      setRecentSubmissions(recentSubs);

      // Map tasks → TaskNeedingAttention
      const now = new Date();
      const taskItems: TaskNeedingAttention[] = (tasksRes.data || [])
        .map((t: any) => {
          const due = t.due_date ? new Date(t.due_date) : null;
          const isOverdue = due ? due.getTime() < now.getTime() && t.status !== "closed" : false;
          return {
            id: t.id,
            title: t.title,
            assignedTo: "Assigned students",
            dueDate: t.due_date || new Date().toISOString(),
            status: isOverdue ? "overdue" : "pending_review",
            priority: isOverdue ? "high" : "medium",
          } as TaskNeedingAttention;
        })
        .filter((t) => t.status === "overdue")
        .slice(0, 5);
      setTasksNeedingAttention(taskItems);

      // Set stats from actual database counts
      const avgProgress =
        studentList.length > 0
          ? Math.round(
              studentList
                .filter((s) => s.status !== "awaiting_placement")
                .reduce((acc, s) => acc + s.progress, 0) /
                Math.max(1, studentList.filter((s) => s.status !== "awaiting_placement").length)
            )
          : 0;
      setStats({
        supervisedStudents: supervisedStudentIds.length,
        activeInternships: activeInternshipsCount,
        // pendingReviews = pending evaluations + pending weekly logs.
        // The previous version only counted weekly_logs in 'submitted'
        // status, which missed pending evaluations entirely.
        pendingReviews: (pendingEvalsRes.count || 0) + (pendingWeeklyRes.count || 0),
        evaluationsCompleted: completedRes.count || 0,
        tasksPending: tasksPendingCount,
        tasksCompleted: tasksCompletedCount,
        tasksOverdue: taskItems.length,
        avgProgress,
      });
    } catch (error) {
      console.error("Error fetching faculty stats:", error);
      // Keep default empty state on error
      setStats(DEFAULT_STATS);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Supervised Students",
      value: stats?.supervisedStudents != null ? stats.supervisedStudents.toString() : "—",
      icon: GraduationCap,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      description: "Across your programs",
    },
    {
      title: "Active Internships",
      value: stats?.activeInternships != null ? stats.activeInternships.toString() : "—",
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      description: "Currently ongoing",
    },
    {
      title: "Pending Reviews",
      value: stats?.pendingReviews != null ? stats.pendingReviews.toString() : "—",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      description: "Awaiting your action",
    },
    {
      title: "Tasks Completed",
      value: stats?.tasksCompleted != null ? stats.tasksCompleted.toString() : "—",
      icon: CheckCircle2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      description: "By your students",
    },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Medium</Badge>;
      case "low":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case "overdue":
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Overdue</Badge>;
      case "pending_review":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="mr-1 h-3 w-3" />Pending Review</Badge>;
      case "not_started":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Not Started</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubmissionStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubmissionTypeIcon = (type: string) => {
    switch (type) {
      case "weekly_log":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "task":
        return <CheckSquare className="h-4 w-4 text-green-500" />;
      case "document":
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStudentInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 70) return "bg-emerald-500";
    if (progress >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Program Supervisor Dashboard"
        description={`Welcome back, ${profile?.full_name || user?.email || "Supervisor"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchFacultyData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link href="/faculty-supervisor/notifications">
                <Send className="h-4 w-4 mr-2" />
                Notify
              </Link>
            </Button>
          </div>
        }
      />

      {/* Push notifications enable prompt (silent if not supported/configured) */}
      <EnablePushNotificationsCard />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`border-${card.borderColor.split('-').slice(1).join('-')} hover:shadow-md transition-shadow`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Alert for pending reviews / overdue tasks */}
      {(stats?.pendingReviews || 0) > 0 || (stats?.tasksOverdue || 0) > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <span className="font-medium text-amber-800">
                  You have {stats?.pendingReviews || 0} submission(s) pending review
                  {(stats?.tasksOverdue || 0) > 0 && ` and ${stats.tasksOverdue} overdue task(s)`}.
                </span>
              </div>
              <div className="flex gap-2">
                <Badge variant="destructive">Action Required</Badge>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/faculty-supervisor/evaluations">Review Now</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Overview Cards - Takes 2 columns on large screens */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">My Students</CardTitle>
                  <CardDescription>Students in your supervised programs</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/faculty-supervisor/students" className="gap-1">
                    View All <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {students.map((student, index) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={`/faculty-supervisor/students?id=${student.id}`}>
                      <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.avatarUrl} alt={student.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getStudentInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{student.name}</p>
                            <Badge
                              variant={
                                student.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                              className="shrink-0 text-xs"
                            >
                              {student.status === "active"
                                ? "Active"
                                : student.status === "awaiting_placement"
                                ? "Awaiting Placement"
                                : student.status === "completed"
                                ? "Completed"
                                : "On Leave"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{student.company}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Progress 
                              value={student.progress} 
                              className="h-1.5 flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {student.progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tasks Needing Attention */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Tasks Needing Attention
                  </CardTitle>
                  <CardDescription>Overdue or requiring review</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/faculty-supervisor/tasks" className="gap-1">
                    View All <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasksNeedingAttention.map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="mt-0.5">
                      {task.status === "overdue" ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs text-muted-foreground">
                          Assigned to: {task.assignedTo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                        {getTaskStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      asChild
                    >
                      <Link href="/faculty-supervisor/tasks">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
                {tasksNeedingAttention.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                    <p>All tasks are up to date!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Recent Submissions & Quick Actions */}
        <div className="space-y-4">
          {/* Recent Submissions Feed */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Submissions</CardTitle>
                  <CardDescription>Latest from your students</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/faculty-supervisor/evaluations" className="gap-1">
                    All <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {recentSubmissions.slice(0, 5).map((submission) => (
                  <div 
                    key={submission.id}
                    className="p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {getSubmissionTypeIcon(submission.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{submission.studentName}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {submission.taskTitle}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(submission.submittedAt)}
                          </span>
                          {getSubmissionStatusBadge(submission.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/faculty-supervisor/tasks">
                  <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1">
                    <Plus className="h-5 w-5" />
                    <span className="text-xs">Create Task</span>
                  </Button>
                </Link>
                <Link href="/faculty-supervisor/evaluations">
                  <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1">
                    <ClipboardList className="h-5 w-5" />
                    <span className="text-xs">Evaluate</span>
                  </Button>
                </Link>
                <Link href="/faculty-supervisor/notifications">
                  <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1">
                    <Send className="h-5 w-5" />
                    <span className="text-xs">Notify</span>
                  </Button>
                </Link>
                <Link href="/faculty-supervisor/reports">
                  <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1">
                    <BarChart3 className="h-5 w-5" />
                    <span className="text-xs">Reports</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Progress Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Program Progress</CardTitle>
              <CardDescription>Average completion across students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                  </div>
                  <div className="relative">
                    <Progress value={stats?.avgProgress || 0} className="h-3" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white drop-shadow-sm">
                        {stats?.avgProgress || 0}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-emerald-50">
                    <p className="text-lg font-bold text-emerald-600">
                      {students.filter(s => s.status !== "awaiting_placement" && s.progress >= 70).length}
                    </p>
                    <p className="text-xs text-muted-foreground">On Track</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50">
                    <p className="text-lg font-bold text-amber-600">
                      {students.filter(s => s.status !== "awaiting_placement" && s.progress >= 40 && s.progress < 70).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Needs Focus</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <p className="text-lg font-bold text-red-600">
                      {students.filter(s => s.status !== "awaiting_placement" && s.progress < 40).length}
                    </p>
                    <p className="text-xs text-muted-foreground">At Risk</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
