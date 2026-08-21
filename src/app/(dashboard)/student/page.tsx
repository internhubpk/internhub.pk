"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  Briefcase,
  Clock,
  CheckCircle2,
  Upload,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  Plus,
  RefreshCw,
  Target,
  Award,
  BookOpen,
  GraduationCap,
  Flame,
  User,
  ChevronRight,
  Lock,
  Send,
  MessageSquare,
  ListTodo,
  Youtube,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

// Types
interface StudentStats {
  activeInternship: boolean;
  internshipData: InternshipInfo | null;
  applicationsCount: number;
  pendingTasks: number;
  completedTasks: number;
  totalTasks: number;
  documentsSubmitted: number;
  attendanceRate: number;
  attendanceStreak: number;
  recentSubmissions: RecentSubmission[];
  upcomingDeadlines: UpcomingDeadline[];
  // First task marked is_current by the API (or null if none). Drives the
  // "Current Task" card on the dashboard.
  currentTask: TaskRow | null;
  // All assigned tasks — used to render the week/day task strip.
  tasks: TaskRow[];
}

interface InternshipInfo {
  id: string;
  title: string;
  company_name: string;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
  faculty_supervisor_name?: string | null;
  faculty_supervisor_email?: string | null;
  site_supervisor_name?: string | null;
  site_supervisor_email?: string | null;
}

interface RecentSubmission {
  id: string;
  task_title: string;
  submitted_at: string;
  status: string;
}

interface UpcomingDeadline {
  id: string;
  title: string;
  due_date: string;
  course_name?: string;
}

// Matches the EnrichedTaskRow shape returned by /api/student/tasks. We only
// pick the fields the dashboard actually uses — keeping the surface small so
// future API changes don't break this page.
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  expected_deliverable: string | null;
  youtube_url: string | null;
  due_date: string | null;
  week_number: number | null;
  day_number: number | null;
  sort_order: number;
  requires_previous_completion: boolean;
  assignment_id: string;
  assignment_status: string; // pending | submitted | resubmitted | approved | rejected
  submission_status: string | null;
  submission_feedback: string | null;
  submission_reviewed_at: string | null;
  is_unlocked: boolean;
  is_current: boolean;
}

// Default stats to show when DB is not available
const DEFAULT_STATS: StudentStats = {
  activeInternship: false,
  internshipData: null,
  applicationsCount: 0,
  pendingTasks: 0,
  completedTasks: 0,
  totalTasks: 0,
  documentsSubmitted: 0,
  attendanceRate: 0,
  attendanceStreak: 0,
  recentSubmissions: [],
  upcomingDeadlines: [],
  currentTask: null,
  tasks: [],
};

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<StudentStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDbError, setHasDbError] = useState(false);

  const fetchStudentStats = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const supabase = createClient();
      
      if (!supabase) {
        console.log("Supabase client not available");
        setStats(DEFAULT_STATS);
        setHasDbError(true);
        setIsLoading(false);
        return;
      }

      // Use Promise.allSettled to handle partial failures gracefully.
      //
      // NOTE: tasks are fetched via /api/student/tasks (NOT direct Supabase)
      // because that route computes the is_unlocked / is_current flags the
      // dashboard's "Current Task" card depends on. Direct Supabase queries
      // can't compute those flags server-side without an RPC.
      const results = await Promise.allSettled([
        // Fetch active student_internship (link table), then we'll hydrate the
        // internship row separately. `internships` has NO `student_id` column —
        // the link is via `student_internships.student_user_id`.
        // NOTE: `student_internships` has no `is_active` column — use `status`.
        // Valid statuses: assigned, active, paused, completed, terminated.
        // We also join faculty + site supervisor profiles so we can display
        // "Assigned Supervisor" in the Active Internship card.
        supabase
          .from("student_internships")
          .select(`
            id, internship_id, start_date, end_date, status,
            faculty_supervisor_id, site_supervisor_id,
            faculty_supervisor:faculty_supervisor_id(full_name, email),
            site_supervisor:site_supervisor_id(full_name, email)
          `)
          .eq("student_user_id", user.id)
          .in("status", ["active", "assigned"])
          .order("created_at", { ascending: false }),

        // Fetch applications count — use the real table name
        // `internship_applications` (NOT the `applications` view, which
        // has different RLS behaviour and was causing silent fetch
        // failures on some joins per the applications page's own comment).
        supabase
          .from("internship_applications")
          .select("id", { count: "exact", head: true })
          .eq("student_user_id", user.id),

        // Fetch tasks via the dedicated API route. The route returns
        // EnrichedTaskRow[] with is_unlocked / is_current flags already
        // computed (it walks the sorted task list to determine unlock state
        // based on requires_previous_completion).
        fetch("/api/student/tasks", { cache: "no-store" }).then(
          async (r) => {
            if (!r.ok) return { data: [], error: new Error(`HTTP ${r.status}`) };
            const json = await r.json();
            return { data: json.data || [], error: null };
          },
          (err) => ({ data: [], error: err })
        ),

        // Fetch documents count
        supabase
          .from("documents")
          .select("id", { count: "exact" })
          .eq("uploaded_by", user.id),

        // Fetch attendance for current month
        (() => {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          return supabase
            .from("attendance")
            .select("*")
            .eq("student_user_id", user.id)
            .gte("date", startOfMonth);
        })(),

        // Fetch recent submissions
        supabase
          .from("task_submissions")
          .select("*, tasks:task_id(title)")
          .eq("student_user_id", user.id)
          .order("submitted_at", { ascending: false })
          .limit(5),

        // Upcoming deadlines are derived from the tasks fetch above
        // (results[2]). This placeholder keeps the array shape stable.
        Promise.resolve({ data: null, error: null }),
      ]);

      // Fetch ALL active student_internships for this student (no longer
      // limited to 1). Danyal has 2 active internships (Zora + Techify) —
      // the previous `.limit(1).maybeSingle()` showed only the most recent
      // one, hiding the other from the dashboard's "Active Internship"
      // card and supervisor display.
      const studentInternships =
        results[0].status === "fulfilled" ? (results[0].value as any).data : null;
      // Pick the most recent one for the "Active Internship" card (the
      // array is already ordered by created_at desc).
      const studentInternship = Array.isArray(studentInternships) && studentInternships.length > 0
        ? studentInternships[0]
        : null;
      let internshipRow: any = null;
      if (studentInternship?.internship_id) {
        const { data: internship } = await supabase
          .from("internships")
          .select("id, title, company:company_id(name), start_date, end_date, status")
          .eq("id", studentInternship.internship_id)
          .maybeSingle();
        internshipRow = internship;
      }

      // Extract results safely - each may have failed.
      // (results[0] is consumed as `studentInternship` above; results[6] is the
      // upcoming-deadlines placeholder — deadlines are derived from results[2],
      // which is now the /api/student/tasks fetch.)
      const applicationsResult = results[1];
      const tasksResult = results[2];
      const documentsResult = results[3];
      const attendanceResult = results[4];
      const submissionsResult = results[5];

      // Process internship data — combined from student_internships (link) +
      // internships (display row).
      let internshipData: InternshipInfo | null = null;
      let activeInternship = false;

      if (studentInternship) {
        activeInternship = true;
        const start = studentInternship.start_date || internshipRow?.start_date;
        const end = studentInternship.end_date || internshipRow?.end_date;
        let progress = 0;
        if (start && end) {
          const startMs = new Date(start).getTime();
          const endMs = new Date(end).getTime();
          const nowMs = Date.now();
          if (endMs > startMs) {
            progress = Math.max(0, Math.min(100, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)));
          }
        }
        // Extract supervisor info from the joined data. PostgREST may
        // return a single object (for FK relationship) or an array.
        const fs = (studentInternship as any).faculty_supervisor;
        const ss = (studentInternship as any).site_supervisor;
        const fsObj = Array.isArray(fs) ? fs[0] : fs;
        const ssObj = Array.isArray(ss) ? ss[0] : ss;
        // If the same user is assigned as BOTH faculty and site supervisor,
        // suppress the duplicate faculty card — render them only as the
        // site supervisor (since that's the on-site role). This fixes the
        // "two site supervisors" UX confusion where both cards showed the
        // same person.
        const facultyId = (studentInternship as any).faculty_supervisor_id;
        const siteId = (studentInternship as any).site_supervisor_id;
        const sameSupervisor =
          facultyId && siteId && facultyId === siteId;
        internshipData = {
          id: internshipRow?.id || studentInternship.internship_id,
          title: internshipRow?.title || "Active Internship",
          company_name:
            (internshipRow?.company && (internshipRow.company as any).name) || "Company",
          start_date: start,
          end_date: end,
          status: studentInternship.status || internshipRow?.status || "active",
          progress,
          faculty_supervisor_name: sameSupervisor ? null : (fsObj?.full_name || null),
          faculty_supervisor_email: sameSupervisor ? null : (fsObj?.email || null),
          site_supervisor_name: ssObj?.full_name || (sameSupervisor ? fsObj?.full_name : null),
          site_supervisor_email: ssObj?.email || (sameSupervisor ? fsObj?.email : null),
        };
      }

      // Process applications count
      let applicationsCount = 0;
      if (applicationsResult.status === 'fulfilled') {
        applicationsCount = applicationsResult.value.count || 0;
      }

      // Process tasks returned by /api/student/tasks. Each row already has
      // is_unlocked / is_current computed by the API.
      let pendingTasks = 0, completedTasks = 0, totalTasks = 0;
      let taskRows: TaskRow[] = [];
      let currentTask: TaskRow | null = null;
      if (tasksResult.status === 'fulfilled' && tasksResult.value.data) {
        taskRows = tasksResult.value.data as TaskRow[];
        totalTasks = taskRows.length;
        // "Pending" = unlocked but not yet submitted/approved
        pendingTasks = taskRows.filter((t) =>
          t.assignment_status === "pending" ||
          t.assignment_status === "resubmitted"
        ).length;
        // "Completed" = approved by supervisor
        completedTasks = taskRows.filter((t) => t.assignment_status === "approved").length;
        // The API marks exactly one task as is_current (first unlocked,
        // non-approved task in sort order). If there's no current task (e.g.,
        // all tasks approved or no tasks assigned), this is null.
        currentTask = taskRows.find((t) => t.is_current) || null;
      }

      // Process documents count
      let documentsSubmitted = 0;
      if (documentsResult.status === 'fulfilled') {
        documentsSubmitted = documentsResult.value.count || 0;
      }

      // Process attendance. Valid `attendance_status` values:
      //   present, absent, late, half_day, leave, holiday.
      // (There is no `weekend` or `remote` status in the enum.)
      let attendanceRate = 0, streak = 0;
      if (attendanceResult.status === 'fulfilled' && attendanceResult.value.data) {
        const attendanceData = attendanceResult.value.data as any[];
        const presentDays = attendanceData.filter(a => a.status === "present" || a.status === "late" || a.status === "half_day").length;
        const totalWorkingDays = Math.max(attendanceData.filter(a => a.status !== "holiday" && a.status !== "leave").length, 1);
        attendanceRate = Math.round((presentDays / totalWorkingDays) * 100);

        // Calculate streak
        const sortedAttendance = [...attendanceData]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const record of sortedAttendance) {
          if (record.status === "present" || record.status === "late" || record.status === "half_day") {
            streak++;
          } else if (record.status !== "holiday" && record.status !== "leave") {
            break;
          }
        }
      }

      // Process submissions
      let recentSubmissions: RecentSubmission[] = [];
      if (submissionsResult.status === 'fulfilled' && submissionsResult.value.data) {
        recentSubmissions = (submissionsResult.value.data as any[]).map((sub: any) => ({
          id: sub.id,
          task_title: sub.tasks?.title || "Unknown Task",
          submitted_at: sub.submitted_at,
          status: sub.status,
        }));
      }

      // Process deadlines — derive from the tasks fetch above. Filter rows
      // with a future due_date and sort ascending.
      let upcomingDeadlines: UpcomingDeadline[] = [];
      const nowIso = new Date().toISOString();
      upcomingDeadlines = taskRows
        .filter((t) =>
          t.due_date && new Date(t.due_date).getTime() >= new Date(nowIso).getTime()
        )
        .sort((a, b) =>
          new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
        )
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date!,
        }));

      setStats({
        activeInternship,
        internshipData,
        applicationsCount,
        pendingTasks,
        completedTasks,
        totalTasks,
        documentsSubmitted,
        attendanceRate,
        attendanceStreak: streak,
        recentSubmissions,
        upcomingDeadlines,
        currentTask,
        tasks: taskRows,
      });
      
      // Clear error state if we got here successfully
      setHasDbError(false);
      
    } catch (error) {
      console.error("Error fetching student stats:", error);
      // Keep default stats on error - don't crash
      setStats(DEFAULT_STATS);
      setHasDbError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStudentStats();
  }, [fetchStudentStats]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>;
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Submitted</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDueDateColor = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return "text-red-600 font-medium";
    if (diffDays <= 3) return "text-amber-600 font-medium";
    return "text-muted-foreground";
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Database Error Warning */}
      {hasDbError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Limited Data Available</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Some dashboard features are unavailable. This might be due to database setup. 
                Basic navigation still works.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header with Welcome */}
      <PageHeader
        title={`${getGreeting()}, ${profile?.first_name || profile?.full_name || "Student"}!`}
        description="Here's your internship progress overview"
        actions={
          <>
            <Button variant="outline" onClick={fetchStudentStats} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/marketplace">
                <Plus className="h-4 w-4 mr-2" />
                Browse Internships
              </Link>
            </Button>
          </>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Link href="/student/internships">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-emerald-50 w-fit mx-auto mb-2">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.activeInternship ? "Active" : "None"}</p>
                <p className="text-xs text-muted-foreground">Internship</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/student/applications">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-blue-50 w-fit mx-auto mb-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.applicationsCount ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Applications</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="p-4 text-center">
              <div className="p-2 rounded-full bg-amber-50 w-fit mx-auto mb-2">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-2xl font-bold">{stats?.pendingTasks ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Pending Tasks</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="p-4 text-center">
              <div className="p-2 rounded-full bg-green-50 w-fit mx-auto mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold">{stats?.completedTasks ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Link href="/student/documents">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-purple-50 w-fit mx-auto mb-2">
                  <Upload className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.documentsSubmitted ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/student/attendance">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-cyan-50 w-fit mx-auto mb-2">
                  <Clock className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.attendanceRate != null ? `${stats.attendanceRate}%` : "—"}</p>
                <p className="text-xs text-muted-foreground">Attendance</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>

      {/* Current Task — full-width card. Shows the task the student should
          be working on right now, with a clear CTA. If no tasks are assigned,
          the empty state nudges them to wait for their supervisor. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
      >
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-primary" />
                Current Task
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/student/tasks">
                  View All Tasks <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.currentTask ? (
              <CurrentTaskCard task={stats.currentTask} />
            ) : stats.tasks.length === 0 ? (
              <div className="text-center py-6">
                <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No tasks assigned yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your supervisor will assign tasks as your internship progresses.
                </p>
              </div>
            ) : (
              // All tasks completed — show a celebratory state
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
                <p className="text-sm font-medium">All tasks complete!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You've completed all {stats.tasks.length} assigned task{stats.tasks.length === 1 ? "" : "s"}. Great work!
                </p>
              </div>
            )}

            {/* Week / Day task strip — quick visual scan of all tasks */}
            {stats.tasks.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Task Progress
                </p>
                <TaskStrip tasks={stats.tasks} />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Internship Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Active Internship
                </CardTitle>
                {stats?.internshipData && (
                  <Badge 
                    className={
                      stats.internshipData.status === "active" 
                        ? "bg-emerald-100 text-emerald-700" 
                        : "bg-blue-100 text-blue-700"
                    }
                  >
                    {stats.internshipData.status === "active" ? "In Progress" : stats.internshipData.status}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {stats?.internshipData ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{stats.internshipData.title}</h3>
                    <p className="text-muted-foreground">{stats.internshipData.company_name}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Start Date</p>
                      <p className="font-medium">{formatDate(stats.internshipData.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">End Date</p>
                      <p className="font-medium">{formatDate(stats.internshipData.end_date)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span>{stats.internshipData.progress}%</span>
                    </div>
                    <Progress value={stats.internshipData.progress} className="h-2" />
                  </div>

                  {/* Assigned Supervisors */}
                  {(stats.internshipData.faculty_supervisor_name || stats.internshipData.site_supervisor_name) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                      {stats.internshipData.faculty_supervisor_name && (
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 shrink-0">
                            <GraduationCap className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Faculty Supervisor</p>
                            <p className="text-sm font-medium truncate">{stats.internshipData.faculty_supervisor_name}</p>
                            {stats.internshipData.faculty_supervisor_email && (
                              <p className="text-xs text-muted-foreground truncate">{stats.internshipData.faculty_supervisor_email}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {stats.internshipData.site_supervisor_name && (
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 shrink-0">
                            <Briefcase className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Site Supervisor</p>
                            <p className="text-sm font-medium truncate">{stats.internshipData.site_supervisor_name}</p>
                            {stats.internshipData.site_supervisor_email && (
                              <p className="text-xs text-muted-foreground truncate">{stats.internshipData.site_supervisor_email}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/student/internships">
                      View Details
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Active Internship</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by browsing and applying to internships
                  </p>
                  <Button asChild>
                    <Link href="/marketplace">
                      Browse Internships
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/student/weekly-logs">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Submit Weekly Log
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/student/documents">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/student/profile">
                  <User className="h-4 w-4 mr-2" />
                  Update Profile
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/student/certificates">
                  <Award className="h-4 w-4 mr-2" />
                  View Certificates
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Submissions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Submissions
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/student/tasks">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.recentSubmissions && stats.recentSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentSubmissions.map((submission) => (
                    <div key={submission.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{submission.task_title}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(submission.submitted_at)}</p>
                      </div>
                      {getTaskStatusBadge(submission.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">No recent submissions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Deadlines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-destructive" />
                  Upcoming Deadlines
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/student/tasks">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.upcomingDeadlines && stats.upcomingDeadlines.length > 0 ? (
                <div className="space-y-3">
                  {stats.upcomingDeadlines.map((deadline) => (
                    <div key={deadline.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{deadline.title}</p>
                        {deadline.course_name && (
                          <p className="text-xs text-muted-foreground">{deadline.course_name}</p>
                        )}
                      </div>
                      <span className={`text-sm ${getDueDateColor(deadline.due_date)}`}>
                        {formatDate(deadline.due_date)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">No upcoming deadlines</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/20" />
                    <circle 
                      cx="40" cy="40" r="36" 
                      stroke="currentColor" strokeWidth="8" fill="none" 
                      strokeLinecap="round"
                      className="text-primary"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - ((stats?.attendanceRate ?? 0) / 100))}`}
                    />
                  </svg>
                  <span className="absolute text-xl font-bold">{stats?.attendanceRate != null ? `${stats.attendanceRate}%` : "—"}</span>
                </div>
                <p className="mt-2 text-sm font-medium">Attendance</p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{stats?.completedTasks ?? "—"}</div>
                <p className="mt-1 text-sm font-medium">Tasks Done</p>
                <p className="text-xs text-muted-foreground">of {stats?.totalTasks ?? "—"} total</p>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">{stats?.documentsSubmitted ?? "—"}</div>
                <p className="mt-1 text-sm font-medium">Documents</p>
                <p className="text-xs text-muted-foreground">Uploaded</p>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">{stats?.attendanceStreak ?? "—"}</div>
                <p className="mt-1 text-sm font-medium">Day Streak</p>
                <p className="text-xs text-muted-foreground">Keep it up!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CurrentTaskCard — the main "what should I work on now?" card on the
// student dashboard. Renders different CTAs depending on the task's state:
//   - locked           → disabled "Locked" badge + tooltip-style hint
//   - pending          → "Submit Work" button (links to /student/tasks)
//   - submitted        → "View Feedback" button (waiting for supervisor)
//   - resubmitted      → "Re-submit Work" button (supervisor requested changes)
//   - approved         → "Go to Next Task" button or "All done!" badge
// ---------------------------------------------------------------------------
function CurrentTaskCard({ task }: { task: TaskRow }) {
  const isLocked = !task.is_unlocked;
  const isApproved = task.assignment_status === "approved";
  const isSubmitted = task.assignment_status === "submitted";
  const isResubmitted = task.assignment_status === "resubmitted";

  // Status pill config
  let statusPill: React.ReactNode;
  if (isLocked) {
    statusPill = (
      <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
        <Lock className="h-3 w-3 mr-1" /> Locked
      </Badge>
    );
  } else if (isApproved) {
    statusPill = (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
      </Badge>
    );
  } else if (isSubmitted) {
    statusPill = (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
        <Clock className="h-3 w-3 mr-1" /> Awaiting Review
      </Badge>
    );
  } else if (isResubmitted) {
    statusPill = (
      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
        <AlertTriangle className="h-3 w-3 mr-1" /> Changes Requested
      </Badge>
    );
  } else {
    statusPill = (
      <Badge className="bg-primary/10 text-primary border-primary/20">
        <Send className="h-3 w-3 mr-1" /> In Progress
      </Badge>
    );
  }

  // CTA button config
  let cta: React.ReactNode;
  if (isLocked) {
    cta = (
      <Button variant="outline" disabled size="sm">
        <Lock className="h-4 w-4 mr-2" /> Complete previous task first
      </Button>
    );
  } else if (isApproved) {
    cta = (
      <Button asChild size="sm">
        <Link href="/student/tasks">
          Go to Next Task <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    );
  } else if (isSubmitted) {
    cta = (
      <Button asChild variant="outline" size="sm">
        <Link href="/student/tasks">
          <MessageSquare className="h-4 w-4 mr-2" /> View Feedback
        </Link>
      </Button>
    );
  } else if (isResubmitted) {
    cta = (
      <Button asChild size="sm">
        <Link href="/student/tasks">
          <Send className="h-4 w-4 mr-2" /> Re-submit Work
        </Link>
      </Button>
    );
  } else {
    cta = (
      <Button asChild size="sm">
        <Link href="/student/tasks">
          <Send className="h-4 w-4 mr-2" /> Submit Work
        </Link>
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {statusPill}
            {task.week_number && (
              <span className="text-xs text-muted-foreground">
                Week {task.week_number}
                {task.day_number ? ` · Day ${task.day_number}` : ""}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-base">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
        <div className="shrink-0">{cta}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {task.due_date && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Due {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
        {task.expected_deliverable && (
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            <span className="truncate max-w-[280px]">
              Deliverable: {task.expected_deliverable}
            </span>
          </span>
        )}
        {task.youtube_url && (
          <span className="flex items-center gap-1 text-red-600">
            <Youtube className="h-3 w-3" />
            <a
              href={task.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Watch video
            </a>
          </span>
        )}
      </div>

      {/* If supervisor has reviewed and left feedback, show a small preview */}
      {task.submission_feedback && (isApproved || isResubmitted) && (
        <div className="rounded-md bg-muted/40 p-3 text-xs">
          <p className="font-medium text-muted-foreground flex items-center gap-1 mb-1">
            <MessageSquare className="h-3 w-3" /> Supervisor feedback
          </p>
          <p className="text-foreground line-clamp-2">{task.submission_feedback}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskStrip — a compact horizontal list of all tasks, each shown as a small
// badge with a status icon. Used under the Current Task card so the student
// can see their overall progress at a glance.
//
// Visual states:
//   ✅ Approved        — green
//   🟢 Current         — primary blue (pulse)
//   ⏳ Awaiting Review — amber
//   🔁 Resubmit        — orange
//   🔒 Locked          — muted gray
//   ⚪ Pending         — outlined
// ---------------------------------------------------------------------------
function TaskStrip({ tasks }: { tasks: TaskRow[] }) {
  // Sort by week → day → sort_order so the strip reads left-to-right
  // in the order the student should work through them.
  const sorted = [...tasks].sort(
    (a, b) =>
      (a.week_number ?? 99) - (b.week_number ?? 99) ||
      (a.day_number ?? 99) - (b.day_number ?? 99) ||
      a.sort_order - b.sort_order
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.map((t) => {
        const isApproved = t.assignment_status === "approved";
        const isSubmitted = t.assignment_status === "submitted";
        const isResubmitted = t.assignment_status === "resubmitted";
        const isLocked = !t.is_unlocked;
        const isCurrent = t.is_current;

        let icon: React.ReactNode;
        let cls: string;
        if (isApproved) {
          icon = <CheckCircle2 className="h-3 w-3" />;
          cls = "bg-emerald-100 text-emerald-700 border-emerald-200";
        } else if (isCurrent) {
          icon = <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />;
          cls = "bg-primary/10 text-primary border-primary/30";
        } else if (isSubmitted) {
          icon = <Clock className="h-3 w-3" />;
          cls = "bg-amber-100 text-amber-800 border-amber-200";
        } else if (isResubmitted) {
          icon = <AlertTriangle className="h-3 w-3" />;
          cls = "bg-orange-100 text-orange-800 border-orange-200";
        } else if (isLocked) {
          icon = <Lock className="h-3 w-3" />;
          cls = "bg-muted/40 text-muted-foreground border-muted";
        } else {
          icon = <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />;
          cls = "bg-background text-muted-foreground border-border";
        }

        const label = `W${t.week_number ?? "-"}D${t.day_number ?? "-"}`;

        return (
          <Link
            key={t.id}
            href="/student/tasks"
            title={`${t.title} — ${label}`}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border hover:scale-105 transition-transform ${cls}`}
          >
            {icon}
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
