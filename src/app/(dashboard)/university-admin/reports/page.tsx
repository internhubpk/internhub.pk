"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileText,
  Users,
  Building2,
  Briefcase,
  Clock,
  CheckCircle2,
  GraduationCap,
  UserCog,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface ReportStats {
  totalStudents: number;
  activeStudents: number;
  totalCoordinators: number;
  totalDepartments: number;
  totalCompanies: number;
  activeInternships: number;
  pendingApplications: number;
  completedInternships: number;
  completionRate: number;
}

interface DepartmentStat {
  id: string;
  name: string;
  code: string | null;
  studentCount: number;
  activeInternshipCount: number;
}

export default function UniversityAdminReportsPage() {
  const { profile, university } = useAuth();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const universityId = profile?.university_id || university?.id;

  const fetchReportData = useCallback(async () => {
    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const supabase = createClient();

      const [
        studentsRes,
        activeStudentsRes,
        coordinatorsRes,
        departmentsRes,
        companiesRes,
        activeInternRes,
        pendingAppsRes,
        completedInternRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("university_id", universityId)
          .eq("role", "student"),
        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("university_id", universityId)
          .eq("role", "student")
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("university_id", universityId)
          .eq("role", "department_coordinator"),
        supabase
          .from("departments")
          .select("id, name, code")
          .eq("university_id", universityId)
          .order("name"),
        supabase
          .from("companies")
          .select("id", { count: "exact" })
          .eq("university_id", universityId),
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("university_id", universityId)
          .eq("status", "active"),
        supabase
          .from("applications")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("university_id", universityId)
          .eq("status", "completed"),
      ]);

      const totalActive = (activeInternRes.count || 0) + (completedInternRes.count || 0);
      const completionRate = totalActive > 0
        ? Math.round(((completedInternRes.count || 0) / totalActive) * 100)
        : 0;

      setStats({
        totalStudents: studentsRes.count || 0,
        activeStudents: activeStudentsRes.count || 0,
        totalCoordinators: coordinatorsRes.count || 0,
        totalDepartments: departmentsRes.data?.length || 0,
        totalCompanies: companiesRes.count || 0,
        activeInternships: activeInternRes.count || 0,
        pendingApplications: pendingAppsRes.count || 0,
        completedInternships: completedInternRes.count || 0,
        completionRate,
      });

      // Per-department stats — fetched in parallel
      if (departmentsRes.data && departmentsRes.data.length > 0) {
        const deptStats: DepartmentStat[] = await Promise.all(
          departmentsRes.data.map(async (dept) => {
            const [studentCount, activeCount] = await Promise.all([
              supabase
                .from("profiles")
                .select("id", { count: "exact" })
                .eq("department_id", dept.id)
                .eq("role", "student"),
              supabase
                .from("internships")
                .select("id", { count: "exact" })
                .eq("department_id", dept.id)
                .eq("status", "active"),
            ]);

            return {
              id: dept.id,
              name: dept.name,
              code: dept.code,
              studentCount: studentCount.count || 0,
              activeInternshipCount: activeCount.count || 0,
            };
          })
        );

        // Sort by student count descending
        deptStats.sort((a, b) => b.studentCount - a.studentCount);
        setDepartmentStats(deptStats);
      } else {
        setDepartmentStats([]);
      }
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError("Failed to load report data");
    } finally {
      setIsLoading(false);
    }
  }, [universityId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!universityId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View statistics and analytics</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No university assigned</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your admin account is not linked to a university yet. Please ask
                a Super Admin to assign you to a university first.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View statistics and analytics</p>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={fetchReportData}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Top-level stat cards
  const statCards = [
    {
      title: "Total Students",
      value: stats?.totalStudents ?? 0,
      subtitle: `${stats?.activeStudents ?? 0} active`,
      icon: Users,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      title: "Departments",
      value: stats?.totalDepartments ?? 0,
      subtitle: `${stats?.totalCoordinators ?? 0} coordinators`,
      icon: Building2,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
    },
    {
      title: "Host Companies",
      value: stats?.totalCompanies ?? 0,
      subtitle: "Tied to university",
      icon: Briefcase,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      title: "Active Internships",
      value: stats?.activeInternships ?? 0,
      subtitle: `${stats?.completedInternships ?? 0} completed`,
      icon: Activity,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
    },
  ];

  // Find the department with the most students (for highlight)
  const topDepartment = departmentStats[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Statistics for {university?.name || "your university"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReportData} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="text-3xl font-bold mt-1">{card.value.toLocaleString()}</p>
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

      {/* Internship Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Internship Health
            </CardTitle>
            <CardDescription>
              Overall progress of internships across your university
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="text-2xl font-bold">
                  {stats?.completionRate ?? 0}%
                </span>
              </div>
              <Progress value={stats?.completionRate ?? 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Based on {((stats?.activeInternships ?? 0) + (stats?.completedInternships ?? 0)).toLocaleString()} total internships
                ({stats?.completedInternships ?? 0} completed, {stats?.activeInternships ?? 0} active)
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.activeInternships ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.pendingApplications ?? 0}</p>
                <p className="text-xs text-muted-foreground">Pending Apps</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.completedInternships ?? 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Insights
            </CardTitle>
            <CardDescription>Key highlights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topDepartment ? (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Largest Department</p>
                <p className="font-semibold mt-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  {topDepartment.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {topDepartment.studentCount} students
                  {topDepartment.activeInternshipCount > 0 &&
                    ` • ${topDepartment.activeInternshipCount} active internships`}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">No departments yet</p>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Student Activation</p>
              <p className="font-semibold mt-1 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                {stats && stats.totalStudents > 0
                  ? Math.round((stats.activeStudents / stats.totalStudents) * 100)
                  : 0}
                %
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.activeStudents ?? 0} of {stats?.totalStudents ?? 0} students active
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Coordinator Coverage</p>
              <p className="font-semibold mt-1 flex items-center gap-2">
                <UserCog className="h-4 w-4 text-indigo-600" />
                {stats?.totalCoordinators ?? 0} / {stats?.totalDepartments ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                coordinators per department (avg)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Department Breakdown
          </CardTitle>
          <CardDescription>
            Student distribution and internship activity across departments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {departmentStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-medium text-muted-foreground mb-1">No departments yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create departments to see per-department statistics here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {departmentStats.map((dept, index) => {
                const maxStudents = departmentStats[0]?.studentCount || 1;
                const pct = maxStudents > 0 ? (dept.studentCount / maxStudents) * 100 : 0;
                return (
                  <motion.div
                    key={dept.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{dept.name}</span>
                        {dept.code && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {dept.code}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{dept.studentCount}</strong> students
                        </span>
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{dept.activeInternshipCount}</strong> active
                        </span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Types Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Available Reports
          </CardTitle>
          <CardDescription>
            Detailed exportable reports will be added in a future update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Internship Summary", description: "Overview of all internships by status and department", icon: Briefcase },
              { name: "Student Performance", description: "Academic and internship performance by student", icon: GraduationCap },
              { name: "Department Statistics", description: "Department-wise metrics and comparisons", icon: Building2 },
              { name: "Company Analytics", description: "Host company engagement and internship distribution", icon: TrendingUp },
              { name: "Application Funnel", description: "Application submission → acceptance → completion", icon: Activity },
              { name: "Coordinator Activity", description: "Coordinator workload and student assignments", icon: UserCog },
            ].map((report) => (
              <div
                key={report.name}
                className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
              >
                <report.icon className="h-5 w-5 text-primary mb-2" />
                <p className="font-medium text-sm">{report.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                <Badge variant="outline" className="mt-3 text-xs">
                  Coming soon
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
