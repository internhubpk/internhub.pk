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

      // Use Promise.allSettled to handle partial failures gracefully
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
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Fetch applications count
        supabase
          .from("applications")
          .select("id", { count: "exact" })
          .eq("student_user_id", user.id),

        // Fetch task assignments with embedded task — tasks has NO `student_id`,
        // the link is via `task_assignments.student_user_id`.
        supabase
          .from("task_assignments")
          .select("id, status, due_date, tasks:task_id(id, title, due_date, status)")
          .eq("student_user_id", user.id),

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

        // Upcoming deadlines are derived from the task_assignments fetch above
        // (results[2]). This placeholder keeps the array shape stable.
        Promise.resolve({ data: null, error: null }),
      ]);

      // If we have an active student_internship, hydrate the internship row
      // (title, company_name, etc.) from the `internships` table.
      const studentInternship =
        results[0].status === "fulfilled" ? (results[0].value as any).data : null;
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
      // upcoming-deadlines placeholder — deadlines are derived from results[2].)
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
        internshipData = {
          id: internshipRow?.id || studentInternship.internship_id,
          title: internshipRow?.title || "Active Internship",
          company_name:
            (internshipRow?.company && (internshipRow.company as any).name) || "Company",
          start_date: start,
          end_date: end,
          status: studentInternship.status || internshipRow?.status || "active",
          progress,
          faculty_supervisor_name: fsObj?.full_name || null,
          faculty_supervisor_email: fsObj?.email || null,
          site_supervisor_name: ssObj?.full_name || null,
          site_supervisor_email: ssObj?.email || null,
        };
      }

      // Process applications count
      let applicationsCount = 0;
      if (applicationsResult.status === 'fulfilled') {
        applicationsCount = applicationsResult.value.count || 0;
      }

      // Process task assignments — each row has an embedded `tasks` object
      // (singular because of the FK relationship).
      let pendingTasks = 0, completedTasks = 0, totalTasks = 0;
      let assignmentRows: any[] = [];
      if (tasksResult.status === 'fulfilled' && tasksResult.value.data) {
        assignmentRows = tasksResult.value.data as any[];
        totalTasks = assignmentRows.length;
        pendingTasks = assignmentRows.filter((row) => {
          const taskStatus = row.tasks?.status;
          return (
            row.status === "pending" ||
            taskStatus === "assigned" ||
            taskStatus === "in_progress" ||
            taskStatus === "published"
          );
        }).length;
        // `completed` IS a valid task_status enum value (migration 0023), so
        // count rows where the embedded task is completed. `approved` is the
        // matching task_submission_status on the assignment itself.
        completedTasks = assignmentRows.filter((row) =>
          row.tasks?.status === "completed" || row.status === "approved"
        ).length;
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

      // Process deadlines — derive from the task_assignments fetch above.
      // Filter rows with a future due_date and sort ascending.
      let upcomingDeadlines: UpcomingDeadline[] = [];
      const nowIso = new Date().toISOString();
      upcomingDeadlines = assignmentRows
        .filter((row) => {
          const due = row.due_date || row.tasks?.due_date;
          return due && new Date(due).getTime() >= new Date(nowIso).getTime();
        })
        .sort((a, b) => {
          const aDue = new Date(a.due_date || a.tasks?.due_date).getTime();
          const bDue = new Date(b.due_date || b.tasks?.due_date).getTime();
          return aDue - bDue;
        })
        .slice(0, 5)
        .map((row) => ({
          id: row.tasks?.id || row.id,
          title: row.tasks?.title || "Untitled task",
          due_date: row.due_date || row.tasks?.due_date,
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
                <p className="text-2xl font-bold">{stats?.applicationsCount || 0}</p>
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
              <p className="text-2xl font-bold">{stats?.pendingTasks || 0}</p>
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
              <p className="text-2xl font-bold">{stats?.completedTasks || 0}</p>
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
                <p className="text-2xl font-bold">{stats?.documentsSubmitted || 0}</p>
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
                <p className="text-2xl font-bold">{stats?.attendanceRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Attendance</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>

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
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - ((stats?.attendanceRate || 0) / 100))}`}
                    />
                  </svg>
                  <span className="absolute text-xl font-bold">{stats?.attendanceRate || 0}%</span>
                </div>
                <p className="mt-2 text-sm font-medium">Attendance</p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{stats?.completedTasks || 0}</div>
                <p className="mt-1 text-sm font-medium">Tasks Done</p>
                <p className="text-xs text-muted-foreground">of {stats?.totalTasks || 0} total</p>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">{stats?.documentsSubmitted || 0}</div>
                <p className="mt-1 text-sm font-medium">Documents</p>
                <p className="text-xs text-muted-foreground">Uploaded</p>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">{stats?.attendanceStreak || 0}</div>
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
