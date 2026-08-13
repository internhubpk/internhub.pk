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
  type: "student_registered" | "internship_started" | "application_submitted" | "evaluation_completed";
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

      // Fetch all stats in parallel
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
        
        // Active internships
        supabase
          .from("internships")
          .select("id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("status", "active"),
        
        // Pending applications. NOTE: use the base table
        // `internship_applications`, not the `applications` compatibility
        // view — the view is owned by a role that bypasses RLS, so
        // querying it returns pending applications across ALL
        // universities instead of just this one (a cross-tenant data
        // leak). RLS on the base table correctly scopes rows to
        // internships belonging to the current university admin.
        supabase
          .from("internship_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        
        // Completed internships
        supabase
          .from("internships")
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

      // Process departments and get student counts
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
            supabase
              .from("internships")
              .select("id", { count: "exact", head: true })
              .eq("department_id", dept.id)
              .eq("status", "active"),
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

      // Generate recent activity mock data based on actual data
      const activities: RecentActivity[] = [];
      if (studentsRes.count && studentsRes.count > 0) {
        activities.push({
          id: "1",
          type: "student_registered",
          message: `${studentsRes.count} students enrolled`,
          timestamp: new Date().toISOString(),
        });
      }
      if (activeInternRes.count && activeInternRes.count > 0) {
        activities.push({
          id: "2",
          type: "internship_started",
          message: `${activeInternRes.count} internships currently active`,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        });
      }
      if (pendingAppsRes.count && pendingAppsRes.count > 0) {
        activities.push({
          id: "3",
          type: "application_submitted",
          message: `${pendingAppsRes.count} applications awaiting review`,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        });
      }
      if (completedInternRes.count && completedInternRes.count > 0) {
        activities.push({
          id: "4",
          type: "evaluation_completed",
          message: `${completedInternRes.count} internships completed this term`,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        });
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
      value: stats?.totalStudents.toLocaleString() || "0",
      description: "Enrolled students",
      icon: Users,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    },
    {
      title: "Active Internships",
      value: stats?.activeInternships.toLocaleString() || "0",
      description: "Currently ongoing",
      icon: Briefcase,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
    },
    {
      title: "Pending Applications",
      value: stats?.pendingApplications.toLocaleString() || "0",
      description: "Awaiting review",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/50",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
    },
    {
      title: "Completion Rate",
      value: `${stats?.completionRate || 0}%`,
      description: `${stats?.completedInternships || 0} completed`,
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
      href: "#",
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
        return <Briefcase className="h-4 w-4" />;
      case "application_submitted":
        return <FileText className="h-4 w-4" />;
      case "evaluation_completed":
        return <UserCheck className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: RecentActivity["type"]) => {
    switch (type) {
      case "student_registered":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400";
      case "internship_started":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400";
      case "application_submitted":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400";
      case "evaluation_completed":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400";
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
                <p className="text-2xl font-bold text-primary">{stats?.totalDepartments || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Departments</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.totalCoordinators || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Coordinators</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.completedInternships || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats?.completionRate || 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">Success Rate</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
