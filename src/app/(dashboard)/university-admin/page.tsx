"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  UserCheck,
  Clock,
  Briefcase,
  TrendingUp,
  Plus,
  RefreshCw,
  GraduationCap,
  AlertCircle,
  ArrowRight,
  Activity,
  BarChart3,
  FileText,
  Settings,
  UserCog,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import Link from "next/link";

interface UniversityStats {
  totalStudents: number;
  activeInternships: number;
  pendingApplications: number;
  completedInternships: number;
  totalDepartments: number;
  totalCoordinators: number;
  completionRate: number;
}

interface DepartmentSummary {
  id: string;
  name: string;
  code: string | null;
  studentCount: number;
  activeInternshipCount: number;
}

interface RecentActivity {
  id: string;
  type: "student_registered" | "internship_started" | "application_submitted" | "evaluation_completed" | "auth" | "internship" | "application" | "evaluation" | "document" | "company" | "settings" | "other";
  message: string;
  timestamp: string;
  userName?: string;
}

const statCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut" as const,
    },
  }),
};

export default function UniversityAdminDashboard() {
  const { user, profile, university } = useAuth();
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    const universityId = profile?.university_id || university?.id;

    // If we don't yet know which university this admin belongs to, don't
    // fetch — but DO clear the loading state so the page renders with
    // an empty-state instead of a perpetual spinner.
    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const supabase = createClient();

      // We need the list of this university's student user_ids so we can
      // count their internship_applications (the `internship_applications`
      // table has no `university_id` column — RLS scopes it via
      // `internships.university_id`, which is NULL for company-published
      // internships, so RLS returns 0 rows for university_admin). Fetching
      // the IDs first and filtering by `student_user_id IN (...)` is the
      // only way to get an accurate count without changing RLS.
      const { data: studentIdRows } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("university_id", universityId)
        .eq("role", "student");
      const studentIds = (studentIdRows || []).map((r) => r.user_id);

      // Fetch all stats in parallel.
      //
      // IMPORTANT: Active/Completed internship counts come from the
      // `student_internships` junction table (which has a correct
      // `university_id` column copied from the student's profile when
      // the row is created), NOT from the `internships` table. Company
      // HR creates internships with `university_id = NULL` (the
      // internship is open to all universities), so filtering
      // `internships` by `university_id` always returns 0. The correct
      // question for a university admin dashboard is "how many of MY
      // students are currently doing / have completed an internship?" —
      // and that lives in `student_internships`.
      const [
        studentsRes,
        activeInternRes,
        pendingAppsRes,
        completedInternRes,
        departmentsRes,
        coordinatorsRes,
      ] = await Promise.all([
        // Total students in this university.
        // NOTE: `profiles` uses `user_id` (uuid PK mirroring auth.users.id)
        // — there is no `id` column. Selecting `id` makes PostgREST return
        // HTTP 400 (schema validation fails). Use `user_id` instead.
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("role", "student"),

        // Active internships = students from this university currently
        // assigned to or active in an internship. `student_internships`
        // carries the correct `university_id` (copied from the student's
        // profile at creation), unlike `internships.university_id` which
        // is NULL for company-published internships.
        supabase
          .from("student_internships")
          .select("id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .in("status", ["assigned", "active"]),

        // Pending applications submitted by THIS university's students.
        // `internship_applications` has no `university_id` column, and
        // RLS scopes via `internships.university_id` (NULL for company-
        // published internships), so RLS returns 0. Filter by the
        // student_user_id list we fetched above instead.
        studentIds.length > 0
          ? supabase
              .from("internship_applications")
              .select("id", { count: "exact", head: true })
              .in("student_user_id", studentIds)
              .eq("status", "pending")
          : Promise.resolve({ count: 0, data: null, error: null, status: 200, statusText: "" } as const),

        // Completed internships = students from this university who have
        // completed an internship.
        supabase
          .from("student_internships")
          .select("id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("status", "completed"),

        // Departments with counts
        supabase
          .from("departments")
          .select("id, name, code")
          .eq("university_id", universityId)
          .eq("is_active", true)
          .order("name"),

        // Total coordinators (same note as above — profiles has user_id, not id)
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("role", "department_coordinator"),
      ]);

      // Calculate completion rate
      const totalActive = (activeInternRes.count || 0) + (completedInternRes.count || 0);
      const completionRate = totalActive > 0 
        ? Math.round(((completedInternRes.count || 0) / totalActive) * 100) 
        : 0;

      setStats({
        totalStudents: studentsRes.count || 0,
        activeInternships: activeInternRes.count || 0,
        pendingApplications: pendingAppsRes.count || 0,
        completedInternships: completedInternRes.count || 0,
        totalDepartments: departmentsRes.data?.length || 0,
        totalCoordinators: coordinatorsRes.count || 0,
        completionRate,
      });

      // Process departments and get student counts.
      //
      // Per-department active internship count uses `student_internships`
      // (which carries `department_id`) instead of `internships`
      // (whose `department_id` is NULL for company-published internships).
      if (departmentsRes.data) {
        const deptSummaries: DepartmentSummary[] = [];
        
        for (const dept of departmentsRes.data) {
          const [studentCount, activeCount] = await Promise.all([
            // profiles has user_id, not id — use head:true so we only fetch the count
            supabase
              .from("profiles")
              .select("user_id", { count: "exact", head: true })
              .eq("department_id", dept.id)
              .eq("role", "student"),
            // Active internships for this department's students.
            supabase
              .from("student_internships")
              .select("id", { count: "exact", head: true })
              .eq("department_id", dept.id)
              .in("status", ["assigned", "active"]),
          ]);
          
          deptSummaries.push({
            id: dept.id,
            name: dept.name,
            code: dept.code,
            studentCount: studentCount.count || 0,
            activeInternshipCount: activeCount.count || 0,
          });
        }
        
        setDepartments(deptSummaries);
      }

      // Fetch recent activity from audit_logs (real events, scoped to this
      // university). Previously this section fabricated timestamps like
      // "Just now" / "1h ago" / "2h ago" / "1d ago" based on counts — that
      // was mock data, not real activity. Now we fetch the 8 most recent
      // audit log entries for this university and render those.
      const auditRes = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, university_id, details, created_at, user_id")
        .eq("university_id", universityId)
        .order("created_at", { ascending: false })
        .limit(8);

      const activities: RecentActivity[] = [];
      if (auditRes.data && auditRes.data.length > 0) {
        // Resolve actor display names in one batched query (skip if no user_ids).
        const actorIds = Array.from(
          new Set(
            auditRes.data
              .map((log: any) => log.user_id)
              .filter((id: any) => typeof id === "string" && id.length > 0)
          )
        );
        let actorMap: Record<string, string> = {};
        if (actorIds.length > 0) {
          const { data: actorProfiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", actorIds);
          if (actorProfiles) {
            for (const p of actorProfiles) {
              actorMap[p.user_id] = p.full_name || p.email || "Unknown";
            }
          }
        }

        for (const log of auditRes.data) {
          activities.push({
            id: log.id,
            type: auditActionToActivityType(log.action),
            message: formatAuditMessage(log, actorMap[log.user_id as string]),
            timestamp: log.created_at,
            userName: log.user_id ? actorMap[log.user_id as string] : undefined,
          });
        }
      }
      setRecentActivity(activities);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id, university?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: "Total Students",
      value: stats?.totalStudents != null ? stats.totalStudents.toLocaleString() : "—",
      description: "Enrolled students",
      icon: Users,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    },
    {
      title: "Active Internships",
      value: stats?.activeInternships != null ? stats.activeInternships.toLocaleString() : "—",
      description: "Currently ongoing",
      icon: Briefcase,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
    },
    {
      title: "Pending Applications",
      value: stats?.pendingApplications != null ? stats.pendingApplications.toLocaleString() : "—",
      description: "Awaiting review",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/50",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
    },
    {
      title: "Completion Rate",
      value: stats?.completionRate != null ? `${stats.completionRate}%` : "—",
      description: stats?.completedInternships != null ? `${stats.completedInternships} completed` : "—",
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
      iconBg: "bg-purple-100 dark:bg-purple-900/50",
    },
  ];

  const quickActions = [
    {
      title: "Manage Students",
      description: "View all enrolled students",
      href: "/university-admin/students",
      icon: GraduationCap,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      title: "Departments",
      description: "Manage departments & programs",
      href: "/university-admin/departments",
      icon: Building2,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
    },
    {
      title: "Coordinators",
      description: "Manage department coordinators",
      href: "/university-admin/coordinators",
      icon: UserCog,
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950/50",
    },
    {
      title: "Reports & Analytics",
      description: "View detailed reports",
      href: "/university-admin/reports",
      icon: BarChart3,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/50",
    },
  ];

  const getActivityIcon = (type: RecentActivity["type"]) => {
    switch (type) {
      case "student_registered":
        return <Users className="h-4 w-4" />;
      case "internship_started":
      case "internship":
        return <Briefcase className="h-4 w-4" />;
      case "application_submitted":
      case "application":
        return <FileText className="h-4 w-4" />;
      case "evaluation_completed":
      case "evaluation":
        return <UserCheck className="h-4 w-4" />;
      case "document":
        return <FileText className="h-4 w-4" />;
      case "company":
        return <Building2 className="h-4 w-4" />;
      case "auth":
        return <Activity className="h-4 w-4" />;
      case "settings":
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: RecentActivity["type"]) => {
    switch (type) {
      case "student_registered":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400";
      case "internship_started":
      case "internship":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400";
      case "application_submitted":
      case "application":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400";
      case "evaluation_completed":
      case "evaluation":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400";
      case "document":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400";
      case "company":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400";
      case "auth":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      case "settings":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Map audit_logs.action (which can be dotted like "auth.login" or
  // snake_case like "create_supervisor") to a RecentActivity["type"]
  // bucket so we can pick the right icon/color in the UI.
  function auditActionToActivityType(action: string): RecentActivity["type"] {
    if (!action) return "other";
    const a = action.toLowerCase();
    if (a.startsWith("auth.")) return "auth";
    if (a.startsWith("student.")) return "student_registered";
    if (a.startsWith("internship.")) return "internship";
    if (a.startsWith("application.")) return "application";
    if (a.startsWith("evaluation.") || a.includes("evaluation")) return "evaluation";
    if (a.startsWith("document.") || a.includes("document")) return "document";
    if (a.startsWith("company.")) return "company";
    if (a.startsWith("settings.")) return "settings";
    if (a.includes("certificate")) return "evaluation_completed";
    if (a.includes("weekly_log")) return "evaluation";
    return "other";
  }

  // Format an audit log row into a human-readable message.
  // `actorName` is optional — if present, prefixed to the message.
  function formatAuditMessage(log: any, actorName?: string): string {
    const action: string = log.action || "";
    const details = log.details || {};
    const entityLabel = details.name || details.email || details.title || "";
    const prefix = actorName ? `${actorName} — ` : "";

    // Known audit_logs.action values come in two styles: dotted
    // ("auth.login") and snake_case ("create_supervisor"). Map the
    // common ones to friendly messages.
    const actionMap: Record<string, string> = {
      "auth.login": "Signed in",
      "auth.logout": "Signed out",
      "auth.register": "Registered",
      "student.create": "Created student",
      "student.update": "Updated student",
      "university.create": "Created university",
      "university.update": "Updated university",
      "university.suspend": "Suspended university",
      "internship.create": "Created internship",
      "internship.approve": "Approved internship",
      "internship.reject": "Rejected internship",
      "application.submit": "Submitted application",
      "application.approve": "Approved application",
      "application.reject": "Rejected application",
      "evaluation.submit": "Submitted evaluation",
      "certificate.issue": "Issued certificate",
      "certificate.revoke": "Revoked certificate",
      "document.upload": "Uploaded document",
      "company.create": "Created company",
      "company.verify": "Verified company",
      "settings.change": "Changed settings",
      "user.role_change": "Changed user role",
      "create_supervisor": "Created supervisor",
      "weekly_log_approve": "Approved weekly log",
      "weekly_log_reject": "Rejected weekly log",
    };

    const friendly = actionMap[action] || action.replace(/[._]/g, " ");
    const suffix = entityLabel ? `: ${entityLabel}` : "";
    return `${prefix}${friendly}${suffix}`;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="University Admin Dashboard"
        description={`${university?.name || "University"} Management Portal`}
        actions={
          <Button
            variant="outline"
            onClick={fetchDashboardData}
            disabled={isLoading}
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={fetchDashboardData}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !profile?.university_id && !university?.id ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No university assigned</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your admin account is not linked to a university yet. Please ask
                a Super Admin to assign you to a university before you can manage
                students, departments, or coordinators.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, index) => (
              <motion.div
                key={card.title}
                custom={index}
                variants={statCardVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {card.title}
                        </p>
                        <p className="text-3xl font-bold">{card.value}</p>
                        <p className="text-xs text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                      <div className={`p-3 rounded-xl ${card.iconBg}`}>
                        <card.icon className={`h-6 w-6 ${card.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Link key={action.title} href={action.href}>
                  <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-lg ${action.bgColor}`}>
                          <action.icon className={`h-5 w-5 ${action.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm">{action.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {action.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Departments Overview */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg">Departments Overview</CardTitle>
                  <CardDescription>Student distribution across departments</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/university-admin/departments">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {departments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Building2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <h3 className="font-medium text-muted-foreground mb-1">No departments yet</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Create your first department to organize students
                    </p>
                    <Button asChild size="sm">
                      <Link href="/university-admin/departments">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Department
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {departments.map((dept) => (
                      <div
                        key={dept.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{dept.name}</p>
                            {dept.code && (
                              <p className="text-xs text-muted-foreground">{dept.code}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">{dept.studentCount}</p>
                            <p className="text-xs text-muted-foreground">students</p>
                          </div>
                          <div className="text-right">
                            <Badge variant={dept.activeInternshipCount > 0 ? "default" : "secondary"} className="text-xs">
                              {dept.activeInternshipCount} active
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest updates in your university</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Activity className="h-10 w-10 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {activity.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.totalDepartments ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Departments</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.totalCoordinators ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Coordinators</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.completedInternships ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.completionRate != null ? `${stats.completionRate}%` : "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Success Rate</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
