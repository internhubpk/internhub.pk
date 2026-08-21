"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
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
  Activity,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

interface ReportStats {
  totalStudents: number;
  activeStudents: number;
  totalCoordinators: number;
  totalDepartments: number;
  totalCompanies: number;
  activeInternships: number;
  pendingApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
  completedInternships: number;
  openInternships: number;
  completionRate: number;
}

interface DepartmentStat {
  id: string;
  name: string;
  code: string | null;
  studentCount: number;
  activeInternshipCount: number;
}

interface CompanyHostStat {
  companyId: string;
  companyName: string;
  internshipCount: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

interface MonthlyTrend {
  month: string;
  count: number;
}

export default function UniversityAdminReportsPage() {
  const { profile, university } = useAuth();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [companyStats, setCompanyStats] = useState<CompanyHostStat[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
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

      // Fetch this university's student user_ids up-front so we can
      // count their applications. `internship_applications` has no
      // `university_id` column — even with the migration 0050 RLS fix
      // (which lets university_admin see applications from their own
      // students), we still need the explicit student_user_id IN (...)
      // filter to scope the count correctly.
      const { data: studentIdRows } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("university_id", universityId)
        .eq("role", "student");
      const studentIds = (studentIdRows || []).map((r) => r.user_id);

      // Helper: build an applications count query, or return a
      // synthetic zero-count result when there are no students.
      const appsCountQuery = (status: string) =>
        studentIds.length > 0
          ? supabase
              .from("internship_applications")
              .select("id", { count: "exact", head: true })
              .in("student_user_id", studentIds)
              .eq("status", status)
          : Promise.resolve({ count: 0, data: null, error: null, status: 200, statusText: "" } as const);

      // Batch 1: top-level counts. All these queries run in parallel.
      //
      // IMPORTANT: Active/Completed internship counts come from the
      // `student_internships` junction table, NOT `internships`.
      // Company HR creates internships with `university_id = NULL`
      // (open to all universities), so filtering `internships` by
      // `university_id` always returns 0. `student_internships`
      // carries the correct `university_id` (copied from the student's
      // profile at creation), so it's the right source for "how many of
      // MY students are doing / have completed an internship?".
      //
      // `openInternships` counts internships with status='open' that
      // are available to this university's students — i.e. either
      // explicitly scoped to this university OR published globally
      // (university_id IS NULL). This matches the marketplace behaviour.
      const [
        studentsRes,
        activeStudentsRes,
        coordinatorsRes,
        departmentsRes,
        companiesRes,
        activeInternRes,
        completedInternRes,
        openInternRes,
        pendingAppsRes,
        acceptedAppsRes,
        rejectedAppsRes,
      ] = await Promise.all([
        // profiles uses user_id (no `id` column). head:true returns only
        // the count, no rows, which is all we need for stat cards.
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("role", "student"),
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("role", "student")
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("role", "department_coordinator"),
        supabase
          .from("departments")
          .select("id, name, code")
          .eq("university_id", universityId)
          .order("name"),
        // Host companies = distinct companies hosting this university's
        // student_internships. `companies.university_id` is NULL for all
        // companies (they're platform-global, not university-scoped), so
        // filtering companies by `university_id` always returned 0.
        // Instead, count distinct `company_id` values from
        // `student_internships` filtered by this university.
        supabase
          .from("student_internships")
          .select("company_id")
          .eq("university_id", universityId)
          .not("company_id", "is", null),
        // Active internships = students from this university currently
        // assigned to or active in an internship.
        supabase
          .from("student_internships")
          .select("id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .in("status", ["assigned", "active"]),
        // Completed internships = students from this university who
        // have completed an internship.
        supabase
          .from("student_internships")
          .select("id", { count: "exact", head: true })
          .eq("university_id", universityId)
          .eq("status", "completed"),
        // Open internships available to this university's students:
        // either explicitly scoped (university_id = X) OR globally
        // published (university_id IS NULL).
        supabase
          .from("internships")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .or(`university_id.is.null,university_id.eq.${universityId}`),
        // Applications submitted by THIS university's students.
        appsCountQuery("pending"),
        appsCountQuery("accepted"),
        appsCountQuery("rejected"),
      ]);

      const totalActive = (activeInternRes.count || 0) + (completedInternRes.count || 0);
      const completionRate = totalActive > 0
        ? Math.round(((completedInternRes.count || 0) / totalActive) * 100)
        : 0;

      // totalCompanies = count of DISTINCT company_id values from
      // student_internships (we changed the query above to return rows
      // instead of a count, so we dedupe client-side).
      const distinctCompanyIds = new Set(
        (companiesRes.data || []).map((r: any) => r.company_id).filter(Boolean)
      );

      setStats({
        totalStudents: studentsRes.count || 0,
        activeStudents: activeStudentsRes.count || 0,
        totalCoordinators: coordinatorsRes.count || 0,
        totalDepartments: departmentsRes.data?.length || 0,
        totalCompanies: distinctCompanyIds.size,
        activeInternships: activeInternRes.count || 0,
        pendingApplications: pendingAppsRes.count || 0,
        acceptedApplications: acceptedAppsRes.count || 0,
        rejectedApplications: rejectedAppsRes.count || 0,
        completedInternships: completedInternRes.count || 0,
        openInternships: openInternRes.count || 0,
        completionRate,
      });

      // Batch 2: per-department stats. All parallel.
      // Per-dept active internship count uses `student_internships`
      // (which carries `department_id`) instead of `internships`
      // (whose `department_id` is NULL for company-published internships).
      if (departmentsRes.data && departmentsRes.data.length > 0) {
        const deptStats: DepartmentStat[] = await Promise.all(
          departmentsRes.data.map(async (dept) => {
            const [studentCount, activeCount] = await Promise.all([
              supabase
                .from("profiles")
                .select("user_id", { count: "exact", head: true })
                .eq("department_id", dept.id)
                .eq("role", "student"),
              supabase
                .from("student_internships")
                .select("id", { count: "exact", head: true })
                .eq("department_id", dept.id)
                .in("status", ["assigned", "active"]),
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

        deptStats.sort((a, b) => b.studentCount - a.studentCount);
        setDepartmentStats(deptStats);
      } else {
        setDepartmentStats([]);
      }

      // Batch 3: top companies hosting internships at this university.
      // We join `student_internships` (which has the correct
      // `university_id`) with `internships` (which has `company_id`)
      // to find which companies this university's students are
      // interning at, then aggregate client-side.
      //
      // `student_internships` itself has `company_id` (copied at
      // creation), so we can read it directly without a join — that's
      // simpler and avoids RLS complications on `internships`.
      const { data: internshipsForCompanies, error: ifcErr } = await supabase
        .from("student_internships")
        .select("company_id")
        .eq("university_id", universityId)
        .not("company_id", "is", null);

      if (ifcErr) {
        console.warn("[reports] couldn't load internships for company aggregation:", ifcErr);
        setCompanyStats([]);
      } else {
        const counts = new Map<string, number>();
        for (const row of internshipsForCompanies || []) {
          counts.set(row.company_id, (counts.get(row.company_id) || 0) + 1);
        }
        const companyIds = Array.from(counts.keys());
        let companyNames = new Map<string, string>();
        if (companyIds.length > 0) {
          const { data: companiesData } = await supabase
            .from("companies")
            .select("id, name")
            .in("id", companyIds);
          for (const c of companiesData || []) {
            companyNames.set(c.id, c.name);
          }
        }
        const aggregated: CompanyHostStat[] = Array.from(counts.entries())
          .map(([companyId, internshipCount]) => ({
            companyId,
            companyName: companyNames.get(companyId) || "Unknown company",
            internshipCount,
          }))
          .sort((a, b) => b.internshipCount - a.internshipCount)
          .slice(0, 5);
        setCompanyStats(aggregated);
      }

      // Batch 4: internship status breakdown for this university's
      // students. Uses `student_internships` (correct `university_id`)
      // instead of `internships` (NULL `university_id` for company-
      // published internships).
      const { data: statusData, error: statusErr } = await supabase
        .from("student_internships")
        .select("status")
        .eq("university_id", universityId);

      if (statusErr) {
        console.warn("[reports] couldn't load internship status breakdown:", statusErr);
        setStatusBreakdown([]);
      } else {
        const statusCounts = new Map<string, number>();
        for (const row of statusData || []) {
          statusCounts.set(row.status, (statusCounts.get(row.status) || 0) + 1);
        }
        const breakdown: StatusBreakdown[] = Array.from(statusCounts.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count);
        setStatusBreakdown(breakdown);
      }

      // Batch 5: monthly trend — student_internhips created per month
      // for the last 6 months (i.e. how many of THIS university's
      // students started/landed an internship each month). Uses
      // `student_internships` (correct `university_id`) instead of
      // `internships` (NULL `university_id` for company-published).
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: trendData, error: trendErr } = await supabase
        .from("student_internships")
        .select("created_at")
        .eq("university_id", universityId)
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });

      if (trendErr) {
        console.warn("[reports] couldn't load monthly trend:", trendErr);
        setMonthlyTrend([]);
      } else {
        const monthCounts = new Map<string, number>();
        for (const row of trendData || []) {
          const d = new Date(row.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
        }
        // Build a 6-month bucket list (including zero months) so the
        // trend line is continuous even if no internships were created
        // in a given month.
        const buckets: MonthlyTrend[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
          buckets.push({ month: label, count: monthCounts.get(key) || 0 });
        }
        setMonthlyTrend(buckets);
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
        <PageHeader title="Reports" description="View statistics and analytics" />
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
        <PageHeader title="Reports" description="View statistics and analytics" />
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
      value: stats?.totalStudents ?? "—",
      subtitle: stats?.activeStudents != null ? `${stats.activeStudents} active` : "—",
      icon: Users,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      title: "Departments",
      value: stats?.totalDepartments ?? "—",
      subtitle: stats?.totalCoordinators != null ? `${stats.totalCoordinators} coordinators` : "—",
      icon: Building2,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
    },
    {
      title: "Host Companies",
      value: stats?.totalCompanies ?? "—",
      subtitle: "Tied to university",
      icon: Briefcase,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      title: "Active Internships",
      value: stats?.activeInternships ?? "—",
      subtitle: stats?.completedInternships != null ? `${stats.completedInternships} completed` : "—",
      icon: Activity,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
    },
  ];

  const topDepartment = departmentStats[0];
  const trendMax = Math.max(...monthlyTrend.map((m) => m.count), 1);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-gray-500" },
    open: { label: "Open", color: "bg-blue-500" },
    active: { label: "Active", color: "bg-green-500" },
    completed: { label: "Completed", color: "bg-emerald-600" },
    closed: { label: "Closed", color: "bg-amber-500" },
    cancelled: { label: "Cancelled", color: "bg-red-500" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Reports & Analytics"
        description={`Statistics for ${university?.name || "your university"}`}
        actions={
          <Button variant="outline" size="sm" onClick={fetchReportData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

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
                    <p className="text-3xl font-bold mt-1">{typeof card.value === "number" ? card.value.toLocaleString() : card.value}</p>
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

      {/* Internship Health + Quick Insights */}
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
                  {stats?.completionRate != null ? `${stats.completionRate}%` : "—"}
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
                <p className="text-2xl font-bold">{stats?.activeInternships ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.pendingApplications ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Pending Apps</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{stats?.completedInternships ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>

            {/* Application funnel */}
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-3">Application Funnel</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    {stats?.pendingApplications ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                </div>
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3">
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">
                    {stats?.acceptedApplications ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Accepted</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                  <p className="text-xl font-bold text-red-700 dark:text-red-400">
                    {stats?.rejectedApplications ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rejected</p>
                </div>
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
                {stats?.activeStudents ?? "—"} of {stats?.totalStudents ?? "—"} students active
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Coordinator Coverage</p>
              <p className="font-semibold mt-1 flex items-center gap-2">
                <UserCog className="h-4 w-4 text-indigo-600" />
                {stats?.totalCoordinators ?? "—"} / {stats?.totalDepartments ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                coordinators per department (avg)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend + Top Companies */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Internships Created (6 months)
            </CardTitle>
            <CardDescription>
              Number of new internships posted to your university per month
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrend.every((m) => m.count === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No internship creation activity in the last 6 months.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-2 h-48">
                  {monthlyTrend.map((m, i) => {
                    const height = (m.count / trendMax) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {m.count > 0 ? m.count : ""}
                        </div>
                        <div className="w-full bg-muted/40 rounded-t-md flex items-end" style={{ height: "100%" }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ delay: i * 0.05, duration: 0.4 }}
                            className="w-full bg-primary/80 hover:bg-primary rounded-t-md min-h-[2px]"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">{m.month}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Top Host Companies
            </CardTitle>
            <CardDescription>
              Companies with the most internships at your university
            </CardDescription>
          </CardHeader>
          <CardContent>
            {companyStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Briefcase className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No companies have posted internships to your university yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {companyStats.map((company, i) => {
                  const max = companyStats[0]?.internshipCount || 1;
                  const pct = (company.internshipCount / max) * 100;
                  return (
                    <motion.div
                      key={company.companyId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4">#{i + 1}</span>
                          <span className="font-medium truncate">{company.companyName}</span>
                        </div>
                        <span className="font-semibold text-xs flex-shrink-0">
                          {company.internshipCount}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Internship Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Internship Status Breakdown
          </CardTitle>
          <CardDescription>
            Distribution of all internships at your university by current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No internships to analyze yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {statusBreakdown.map((row, i) => {
                const total = statusBreakdown.reduce((sum, r) => sum + r.count, 0);
                const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                const info = STATUS_LABELS[row.status] || { label: row.status, color: "bg-gray-500" };
                return (
                  <motion.div
                    key={row.status}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${info.color}`} />
                        <span className="font-medium">{info.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{row.count}</strong> internship{row.count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground">{pct}%</span>
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
    </div>
  );
}
