"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  FileText,
  MessageSquare,
  Star,
  Upload,
  Plus,
  RefreshCw,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  UserCheck,
  BarChart3,
  Eye,
  Send,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface SupervisorStats {
  assignedStudents: number;
  activeStudents: number;
  pendingEvaluations: number;
  completedEvaluations: number;
  weeklyLogsPending: number;
  weeklyLogsApproved: number;
  evaluationsDueThisWeek: number;
}

interface StudentSummary {
  id: string;
  studentId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  progress: number;
  lastActivity: string;
  lastEvaluationDate?: string | null;
  daysSinceEvaluation: number | null;
  performanceRating: "excellent" | "good" | "satisfactory" | "needs_attention" | null;
  status: "active" | "completed" | "on_leave";
}

interface RecentActivity {
  id: string;
  type: "evaluation" | "log_review" | "notification";
  studentName: string;
  description: string;
  timestamp: string;
}

// Default empty states - data will be fetched from database
const DEFAULT_STATS: SupervisorStats = {
  assignedStudents: 0,
  activeStudents: 0,
  pendingEvaluations: 0,
  completedEvaluations: 0,
  weeklyLogsPending: 0,
  weeklyLogsApproved: 0,
  evaluationsDueThisWeek: 0,
};

const DEFAULT_STUDENTS: StudentSummary[] = [];
const DEFAULT_ACTIVITY: RecentActivity[] = [];

export default function SiteSupervisorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<SupervisorStats>(DEFAULT_STATS);
  const [students, setStudents] = useState<StudentSummary[]>(DEFAULT_STUDENTS);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>(DEFAULT_ACTIVITY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSupervisorData();
  }, []);

  async function fetchSupervisorData() {
    if (!user) return;

    setIsLoading(true);
    try {
      const supabase = createClient();

      // student_internships.site_supervisor_id is FK to profiles.user_id,
      // so we filter by the auth user's id (the supervisor's user_id) — NOT
      // the supervisors table PK. RLS uses auth.uid() the same way.
      const supervisorUserId = user.id;

      // Fetch assigned students with their profile data (real columns only)
      const { data: assignments } = await supabase
        .from("student_internships")
        .select(`
          id,
          student_user_id,
          internship_id,
          status,
          start_date,
          end_date,
          is_active,
          created_at,
          updated_at,
          student_profile:student_user_id(
            full_name,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq("site_supervisor_id", supervisorUserId)
        .order("updated_at", { ascending: false });

      const internRows = (assignments || []) as any[];

      const studentUserIds = internRows
        .map((r) => r.student_user_id)
        .filter((id): id is string => Boolean(id));

      // Fetch most-recent evaluation per student (for the supervisor)
      // and weekly log counts in parallel
      const [evaluationsRes, weeklyLogsRes] = await Promise.all([
        studentUserIds.length
          ? supabase
              .from("evaluations")
              .select("id, student_user_id, created_at, evaluator_role")
              .eq("evaluator_id", supervisorUserId)
              .eq("evaluator_role", "site_supervisor")
              .in("student_user_id", studentUserIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        studentUserIds.length
          ? supabase
              .from("weekly_logs")
              .select("id, student_user_id, status, week_start_date, reviewed_at, supervisor_feedback")
              .eq("supervisor_id", supervisorUserId)
              .in("student_user_id", studentUserIds)
              .order("week_start_date", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      // Build a map of student_user_id -> most-recent evaluation date
      const lastEvalByStudent = new Map<string, string>();
      (evaluationsRes.data || []).forEach((ev: any) => {
        if (ev.student_user_id && !lastEvalByStudent.has(ev.student_user_id)) {
          lastEvalByStudent.set(ev.student_user_id, ev.created_at);
        }
      });

      const weeklyLogs = (weeklyLogsRes.data || []) as any[];
      const weeklyLogsPending = weeklyLogs.filter(
        (l) => l.status === "submitted" || l.status === "revision_required"
      ).length;
      const weeklyLogsApproved = weeklyLogs.filter((l) => l.status === "approved").length;

      // Transform student data
      const studentData: StudentSummary[] = internRows.map((intern: any) => {
        const profile = intern.student_profile || {};
        const studentUser = intern.student_user_id as string | undefined;
        const lastEvalIso = studentUser ? lastEvalByStudent.get(studentUser) ?? null : null;
        const lastEval = lastEvalIso ? new Date(lastEvalIso) : null;
        const daysSinceEvaluation = lastEval
          ? Math.floor((Date.now() - lastEval.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        // Determine performance rating based on time since last evaluation
        let performanceRating: StudentSummary["performanceRating"] = null;
        if (daysSinceEvaluation !== null) {
          if (daysSinceEvaluation <= 21) performanceRating = "excellent";
          else if (daysSinceEvaluation <= 28) performanceRating = "good";
          else if (daysSinceEvaluation <= 42) performanceRating = "satisfactory";
          else performanceRating = "needs_attention";
        }

        const fullName =
          profile.full_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          (profile.email ? profile.email.split("@")[0] : "Unknown Student");

        const status: StudentSummary["status"] =
          intern.status === "active" ? "active" :
          intern.status === "completed" ? "completed" : "on_leave";

        return {
          id: intern.id,
          studentId: studentUser || intern.id,
          name: fullName,
          email: profile.email || "",
          avatarUrl: profile.avatar_url ?? null,
          progress: 0, // student_internships has no progress column; left as 0
          lastActivity: intern.updated_at
            ? new Date(intern.updated_at).toLocaleDateString()
            : "N/A",
          lastEvaluationDate: lastEvalIso,
          daysSinceEvaluation,
          performanceRating,
          status,
        };
      });

      // Calculate stats
      const activeStudents = studentData.filter((s) => s.status === "active").length;
      const pendingEvals = studentData.filter(
        (s) => s.daysSinceEvaluation === null || s.daysSinceEvaluation > 18
      ).length;

      setStats({
        assignedStudents: studentData.length,
        activeStudents,
        pendingEvaluations: pendingEvals,
        completedEvaluations: studentData.filter((s) => s.status === "completed").length,
        weeklyLogsPending,
        weeklyLogsApproved,
        evaluationsDueThisWeek: pendingEvals,
      });

      setStudents(studentData.slice(0, 5)); // Show only first 5 on dashboard

      // Build a recent activity feed from weekly_logs (reviewed) and evaluations.
      const profileByEmail = new Map<string, string>();
      internRows.forEach((intern: any) => {
        const p = intern.student_profile || {};
        if (p.email && p.full_name) profileByEmail.set(p.email, p.full_name);
      });
      const studentIdToName = new Map<string, string>();
      internRows.forEach((intern: any) => {
        const p = intern.student_profile || {};
        const name =
          p.full_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          p.email ||
          "Student";
        if (intern.student_user_id) studentIdToName.set(intern.student_user_id, name);
      });

      const activities: RecentActivity[] = [];

      weeklyLogs
        .filter((l) => l.status === "approved" || l.status === "rejected" || l.status === "revision_required")
        .slice(0, 10)
        .forEach((l: any) => {
          const ts = l.reviewed_at || l.week_start_date;
          if (!ts) return;
          const verb =
            l.status === "approved"
              ? "Weekly log approved"
              : l.status === "rejected"
              ? "Weekly log rejected"
              : "Weekly log returned for revision";
          activities.push({
            id: `log-${l.id}`,
            type: "log_review",
            studentName: studentIdToName.get(l.student_user_id) || "Student",
            description: verb,
            timestamp: ts,
          });
        });

      (evaluationsRes.data || []).slice(0, 10).forEach((ev: any) => {
        if (!ev.created_at) return;
        activities.push({
          id: `eval-${ev.id}`,
          type: "evaluation",
          studentName: studentIdToName.get(ev.student_user_id) || "Student",
          description: "Site evaluation submitted",
          timestamp: ev.created_at,
        });
      });

      activities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setRecentActivity(activities.slice(0, 8));

    } catch (error) {
      console.error("Error fetching supervisor data:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  // Note: Mock data removed - dashboard shows empty state until real data is available
  // function setMockData() has been removed to prevent showing fake data

  const statCards = [
    {
      title: "Assigned Interns",
      value: stats?.assignedStudents.toString() || "0",
      subtitle: `${stats?.activeStudents || 0} active`,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    },
    {
      title: "Evaluations Due",
      value: stats?.evaluationsDueThisWeek.toString() || "0",
      subtitle: "This week",
      icon: ClipboardList,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      isAlert: (stats?.evaluationsDueThisWeek ?? 0) > 0,
    },
    {
      title: "Pending Logs",
      value: stats?.weeklyLogsPending.toString() || "0",
      subtitle: "Awaiting review",
      icon: FileText,
      color: "text-violet-600",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
    },
    {
      title: "Completed Reviews",
      value: stats?.completedEvaluations.toString() || "0",
      subtitle: "Total evaluations",
      icon: CheckCircle2,
      color: "text-sky-600",
      bgColor: "bg-sky-50",
      borderColor: "border-sky-200",
    },
  ];

  function getPerformanceColor(rating: StudentSummary["performanceRating"]) {
    switch (rating) {
      case "excellent": return "bg-green-500";
      case "good": return "bg-blue-500";
      case "satisfactory": return "bg-yellow-500";
      case "needs_attention": return "bg-red-500";
      default: return "bg-gray-300";
    }
  }

  function getPerformanceBadge(rating: StudentSummary["performanceRating"]) {
    switch (rating) {
      case "excellent": return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
      case "good": return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
      case "satisfactory": return <Badge className="bg-yellow-100 text-yellow-800">Satisfactory</Badge>;
      case "needs_attention": return <Badge className="bg-red-100 text-red-800">Needs Attention</Badge>;
      default: return null;
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Supervisor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "Supervisor"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSupervisorData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/site-supervisor/evaluations">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Evaluation
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`border-2 ${card.isAlert ? 'border-amber-300 bg-amber-50/50' : card.borderColor || ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
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

      {/* Alerts Section */}
      {(stats?.evaluationsDueThisWeek ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">
                    {stats.evaluationsDueThisWeek} Evaluation{stats.evaluationsDueThisWeek > 1 ? 's' : ''} Due This Week
                  </p>
                  <p className="text-sm text-amber-700">
                    Some interns are approaching or past their 3-week evaluation window.
                  </p>
                </div>
                <Link href="/site-supervisor/evaluations">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    Review Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Students Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Assigned Interns
              </CardTitle>
              <CardDescription>Students under your supervision</CardDescription>
            </div>
            <Link href="/site-supervisor/students">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <div className="flex items-center justify-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
                <p className="text-muted-foreground ml-4">Loading data...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Students Assigned</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  You haven&apos;t been assigned any students yet. Once students are assigned to your supervision, they will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((student) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={student.avatarUrl || undefined} alt={student.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{student.name}</p>
                          {getPerformanceBadge(student.performanceRating)}
                          {student.status === "active" && (
                            <span className="h-2 w-2 rounded-full bg-green-500" title="Active" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                        <p className="text-sm font-medium">{student.progress}% Complete</p>
                        <Progress value={student.progress} className="h-1.5 w-24 mt-1" />
                      </div>
                      
                      <div className="hidden md:block text-right">
                        <p className={`text-sm font-medium ${
                          (student.daysSinceEvaluation ?? 0) > 21 ? 'text-red-600' :
                          (student.daysSinceEvaluation ?? 0) > 14 ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          {student.daysSinceEvaluation !== null 
                            ? `${student.daysSinceEvaluation}d since eval`
                            : 'Not evaluated'
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">Last activity: {student.lastActivity}</p>
                      </div>

                      <Link href={`/site-supervisor/students?id=${student.studentId}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/site-supervisor/evaluations" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50">
                      <ClipboardList className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Start Evaluation</p>
                      <p className="text-xs text-muted-foreground">{stats?.pendingEvaluations || 0} pending</p>
                    </div>
                  </div>
                </Button>
              </Link>
              
              <Link href="/site-supervisor/weekly-logs" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-50">
                      <FileText className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Review Weekly Logs</p>
                      <p className="text-xs text-muted-foreground">{stats?.weeklyLogsPending || 0} to review</p>
                    </div>
                  </div>
                </Button>
              </Link>
              
              <Link href="/site-supervisor/notifications" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50">
                      <Send className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Send Notification</p>
                      <p className="text-xs text-muted-foreground">Message students</p>
                    </div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        activity.type === "evaluation" ? "bg-blue-100" :
                        activity.type === "log_review" ? "bg-green-100" :
                        "bg-purple-100"
                      }`}>
                        {activity.type === "evaluation" ? (
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                        ) : activity.type === "log_review" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Send className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.studentName} · {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Students Needing Attention */}
          {students.some(s => s.performanceRating === "needs_attention") && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {students
                    .filter(s => s.performanceRating === "needs_attention")
                    .map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-2 rounded-lg bg-white/70">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-red-100 text-red-700">
                              {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{student.name}</span>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {student.daysSinceEvaluation}d overdue
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Evaluation Schedule Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              HEC Evaluation Schedule
            </CardTitle>
            <CardDescription>3-week evaluation cycles (HEC compliant)</CardDescription>
          </div>
          <Link href="/site-supervisor/evaluations">
            <Button variant="ghost" size="sm">
              Full Calendar
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((week) => {
              const isPast = week <= 2;
              const isCurrent = week === 3;
              const isFuture = week > 3;
              
              return (
                <div
                  key={week}
                  className={`p-3 rounded-lg border text-center ${
                    isPast ? 'bg-green-50 border-green-200' :
                    isCurrent ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p className="text-xs font-medium text-muted-foreground">Week {week * 3 - 2}-{week * 3}</p>
                  <p className={`text-sm font-semibold mt-1 ${
                    isPast ? 'text-green-700' :
                    isCurrent ? 'text-amber-700' :
                    'text-gray-500'
                  }`}>
                    {isPast ? '✓ Completed' : isCurrent ? 'In Progress' : 'Upcoming'}
                  </p>
                </div>
              );
            })}
          </div>
          
          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-green-200" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-200" />
              <span className="text-xs text-muted-foreground">Current Period</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-gray-200" />
              <span className="text-xs text-muted-foreground">Upcoming</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
