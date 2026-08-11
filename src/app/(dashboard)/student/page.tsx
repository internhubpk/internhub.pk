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
  Flame,
  User,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

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

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudentStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const supabase = createClient();
      
      // Fetch active internship
      const { data: internshipData } = await supabase
        .from("internships")
        .select("*")
        .eq("student_id", user.id)
        .in("status", ["active", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch applications count
      const { count: applicationsCount } = await supabase
        .from("applications")
        .select("id", { count: "exact" })
        .eq("student_id", user.id);

      // Fetch tasks with status
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("student_id", user.id);

      const pendingTasks = tasksData?.filter(t => t.status === "pending" || t.status === "assigned").length || 0;
      const completedTasks = tasksData?.filter(t => t.status === "completed" || t.status === "approved").length || 0;
      const totalTasks = tasksData?.length || 0;

      // Fetch documents count
      const { count: documentsSubmitted } = await supabase
        .from("documents")
        .select("id", { count: "exact" })
        .eq("uploaded_by", user.id);

      // Fetch attendance for current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", user.id)
        .gte("date", startOfMonth);

      const presentDays = attendanceData?.filter(a => a.status === "present" || a.status === "late").length || 0;
      const totalWorkingDays = attendanceData?.filter(a => a.status !== "holiday" && a.status !== "weekend").length || 1;
      const attendanceRate = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

      // Calculate streak (simplified - consecutive days)
      let streak = 0;
      const sortedAttendance = (attendanceData || [])
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      for (const record of sortedAttendance) {
        if (record.status === "present" || record.status === "late") {
          streak++;
        } else if (record.status !== "holiday" && record.status !== "weekend") {
          break;
        }
      }

      // Fetch recent submissions
      const { data: submissionsData } = await supabase
        .from("task_submissions")
        .select("*, tasks:task_id(title)")
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(5);

      const recentSubmissions: RecentSubmission[] = (submissionsData || []).map((sub: any) => ({
        id: sub.id,
        task_title: sub.tasks?.title || "Unknown Task",
        submitted_at: sub.submitted_at,
        status: sub.status,
      }));

      // Fetch upcoming deadlines
      const { data: upcomingTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("student_id", user.id)
        .in("status", ["pending", "assigned"])
        .gte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(5);

      const upcomingDeadlines: UpcomingDeadline[] = (upcomingTasks || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        course_name: task.course_name,
      }));

      setStats({
        activeInternship: !!internshipData,
        internshipData: internshipData ? {
          id: internshipData.id,
          title: internshipData.title,
          company_name: internshipData.company_name || "Company",
          start_date: internshipData.start_date,
          end_date: internshipData.end_date,
          status: internshipData.status,
          progress: internshipData.progress || 0,
        } : null,
        applicationsCount: applicationsCount || 0,
        pendingTasks,
        completedTasks,
        totalTasks,
        documentsSubmitted: documentsSubmitted || 0,
        attendanceRate,
        attendanceStreak: streak,
        recentSubmissions,
        upcomingDeadlines,
      });
    } catch (error) {
      console.error("Error fetching student stats:", error);
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

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.full_name) {
      return profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || "S";
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">
              {getGreeting()}, {profile?.first_name || profile?.full_name || "Student"}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Here&apos;s your internship progress overview
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
        </div>
      </motion.div>

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
          <Link href="/student/tasks">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-amber-50 w-fit mx-auto mb-2">
                  <Target className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.pendingTasks || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Tasks</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Link href="/student/tasks">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-blue-50 w-fit mx-auto mb-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.completedTasks || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/student/attendance">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-purple-50 w-fit mx-auto mb-2">
                  <Flame className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.attendanceStreak || 0}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Link href="/student/attendance">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-cyan-50 w-fit mx-auto mb-2">
                  <TrendingUp className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.attendanceRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Attendance</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/student/documents">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-full bg-orange-50 w-fit mx-auto mb-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.documentsSubmitted || 0}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Internship Status */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                Internship Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.activeInternship ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Briefcase className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No Active Internship</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    You don&apos;t have an active internship yet. Browse available opportunities and apply to get started!
                  </p>
                  <div className="flex gap-2">
                    <Button asChild>
                      <Link href="/marketplace">
                        <Plus className="h-4 w-4 mr-2" />
                        Find Internships
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/student/profile">Complete Profile</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-emerald-900">{stats.internshipData?.title}</h3>
                      <p className="text-sm text-emerald-700">{stats.internshipData?.company_name}</p>
                      <div className="flex items-center gap-3 text-xs text-emerald-600 mt-2">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {stats.internshipData?.start_date ? formatDate(stats.internshipData.start_date) : "TBD"}
                        </span>
                        <span>→</span>
                        <span>{stats.internshipData?.end_date ? formatDate(stats.internshipData.end_date) : "Ongoing"}</span>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">
                      {stats.internshipData?.status === "active" ? "In Progress" : stats.internshipData?.status}
                    </Badge>
                  </div>

                  {/* Task Completion Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Task Completion</span>
                      <span className="font-medium">
                        {stats.completedTasks}/{stats.totalTasks} tasks
                      </span>
                    </div>
                    <Progress 
                      value={stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0} 
                      className="h-2"
                    />
                  </div>

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold text-primary">{stats.applicationsCount}</p>
                      <p className="text-xs text-muted-foreground">Applications</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold text-emerald-600">{stats.attendanceRate}%</p>
                      <p className="text-xs text-muted-foreground">Attendance</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold text-purple-600">{stats.documentsSubmitted}</p>
                      <p className="text-xs text-muted-foreground">Documents</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Attendance */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-6"
        >
          {/* Attendance Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-orange-500" />
                Attendance Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-orange-100 to-red-100 mb-3">
                  <Flame className="h-10 w-10 text-orange-500" />
                </div>
                <p className="text-4xl font-bold">{stats?.attendanceStreak || 0}</p>
                <p className="text-sm text-muted-foreground">consecutive days</p>
                
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">This Month</span>
                    <span className="font-medium">{stats?.attendanceRate || 0}%</span>
                  </div>
                  <Progress value={stats?.attendanceRate || 0} className="h-1.5" />
                </div>
              </div>
              
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/student/attendance">
                  View Full Record
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/student/tasks" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="p-2 rounded-md bg-blue-50">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">My Tasks</p>
                  <p className="text-xs text-muted-foreground">{stats?.pendingTasks || 0} pending</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link href="/student/profile" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="p-2 rounded-md bg-purple-50">
                  <User className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Edit Profile</p>
                  <p className="text-xs text-muted-foreground">Update your info</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link href="/student/documents" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="p-2 rounded-md bg-green-50">
                  <Upload className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Documents</p>
                  <p className="text-xs text-muted-foreground">{stats?.documentsSubmitted || 0} files</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link href="/student/applications" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="p-2 rounded-md bg-amber-50">
                  <FileText className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Applications</p>
                  <p className="text-xs text-muted-foreground">{stats?.applicationsCount || 0} submitted</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Section: Deadlines & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Upcoming Deadlines
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/student/tasks">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!stats?.upcomingDeadlines || stats.upcomingDeadlines.length === 0) ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
                  <p className="text-sm text-muted-foreground">No upcoming deadlines!</p>
                  <p className="text-xs text-muted-foreground">You&apos;re all caught up 🎉</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[280px] overflow-y-auto">
                  {stats.upcomingDeadlines.map((deadline) => (
                    <Link 
                      key={deadline.id} 
                      href={`/student/tasks`}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-md bg-amber-50 shrink-0 mt-0.5">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{deadline.title}</p>
                        {deadline.course_name && (
                          <p className="text-xs text-muted-foreground">{deadline.course_name}</p>
                        )}
                        <p className={`text-xs mt-1 ${getDueDateColor(deadline.due_date)}`}>
                          Due {formatDate(deadline.due_date)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Submissions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-4 w-4 text-blue-500" />
                  Recent Submissions
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/student/tasks">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!stats?.recentSubmissions || stats.recentSubmissions.length === 0) ? (
                <div className="text-center py-8">
                  <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No submissions yet</p>
                  <p className="text-xs text-muted-foreground">Complete tasks to see them here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[280px] overflow-y-auto">
                  {stats.recentSubmissions.map((submission) => (
                    <div key={submission.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="p-2 rounded-md bg-blue-50 shrink-0 mt-0.5">
                        <Upload className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{submission.task_title}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {formatRelativeTime(submission.submitted_at)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {getTaskStatusBadge(submission.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
