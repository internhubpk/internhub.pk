"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Briefcase,
  Users,
  UserCheck,
  Star,
  Plus,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Eye,
  ArrowRight,
  Award,
  CheckCircle2,
  XCircle,
  UserPlus,
  ClipboardCheck,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";

interface CompanyStats {
  activeInternships: number;
  totalApplications: number;
  activeInterns: number;
  pendingReviews: number;
  completionRate: number;
  totalSupervisors: number;
  totalInterns: number;
  completedInterns: number;
  avgAttendanceRate: number;
  avgRating: number;
}

interface RecentApplication {
  id: string;
  student_name: string;
  student_email: string;
  internship_title: string;
  status: "pending" | "accepted" | "rejected" | "reviewing";
  applied_at: string;
  student_avatar?: string | null;
}

interface ActiveProgram {
  id: string;
  title: string;
  status: string;
  applicants_count: number;
  max_applicants?: number | null;
  application_deadline?: string | null;
  created_at: string;
}

interface InternPerformance {
  student_internship_id: string;
  student_user_id: string;
  student_name?: string;
  student_email?: string;
  student_avatar?: string | null;
  internship_id: string;
  internship_title?: string;
  attendance_rate: number;
  rating: number;
  status: string;
  start_date: string;
}

interface DashboardData {
  stats: CompanyStats;
  recentApplications: RecentApplication[];
  activePrograms: ActiveProgram[];
  internPerformance: InternPerformance[];
}

const DEFAULT_STATS: CompanyStats = {
  activeInternships: 0,
  totalApplications: 0,
  activeInterns: 0,
  pendingReviews: 0,
  completionRate: 0,
  totalSupervisors: 0,
  totalInterns: 0,
  completedInterns: 0,
  avgAttendanceRate: 0,
  avgRating: 0,
};

export default function CompanyHRDashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/company-hr/dashboard", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      setData(j.data);
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard");
      toast.error("Dashboard error", { description: e.message || "Failed to load dashboard" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = data?.stats || DEFAULT_STATS;
  const recentApplications = data?.recentApplications || [];
  const activePrograms = data?.activePrograms || [];
  const internPerformance = data?.internPerformance || [];

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const statusBadge = (s: string) => {
    const cls =
      s === "accepted"
        ? "bg-emerald-100 text-emerald-700"
        : s === "rejected"
        ? "bg-red-100 text-red-700"
        : s === "reviewing"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s}</span>;
  };

  const statCards = [
    {
      label: "Active Programs",
      value: stats.activeInternships,
      icon: Briefcase,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/company-hr/internships",
    },
    {
      label: "Total Applications",
      value: stats.totalApplications,
      icon: ClipboardCheck,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/company-hr/applications",
    },
    {
      label: "Pending Reviews",
      value: stats.pendingReviews,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/company-hr/applications",
    },
    {
      label: "Active Interns",
      value: stats.activeInterns,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: "/company-hr/interns",
    },
    {
      label: "Site Supervisors",
      value: stats.totalSupervisors,
      icon: UserCheck,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      href: "/company-hr/supervisors",
    },
    {
      label: "Completion Rate",
      value: `${stats.completionRate}%`,
      icon: TrendingUp,
      color: "text-rose-600",
      bg: "bg-rose-50",
      href: "/company-hr/reports",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(" ")[0] || profile?.first_name || "HR"}`}
        description="Manage your internship programs, applications, and interns in one place."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/company-hr/internships">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" /> New Internship
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Failed to load dashboard data</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5">
                  <div className={`inline-flex p-2 rounded-md ${s.bg} mb-3`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Attendance</p>
                <p className="text-2xl font-bold mt-1">{stats.avgAttendanceRate}%</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-bold mt-1">{stats.avgRating.toFixed(1)} / 5.0</p>
              </div>
              <div className="p-3 rounded-full bg-amber-50">
                <Star className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Interns</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.totalInterns}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({stats.completedInterns} completed)
                  </span>
                </p>
              </div>
              <div className="p-3 rounded-full bg-indigo-50">
                <Award className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications + Active Programs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>Latest 5 applications received</CardDescription>
            </div>
            <Link href="/company-hr/applications">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentApplications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No applications yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={app.student_avatar || undefined} />
                        <AvatarFallback>
                          {app.student_name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{app.student_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{app.internship_title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {fmtDate(app.applied_at)}
                      </span>
                      {statusBadge(app.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active Internship Programs</CardTitle>
              <CardDescription>Currently open and active programs</CardDescription>
            </div>
            <Link href="/company-hr/internships">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : activePrograms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active programs yet.</p>
                <Link href="/company-hr/internships">
                  <Button size="sm" variant="outline" className="mt-3">
                    <Plus className="h-3 w-3 mr-1" /> Create one
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activePrograms.map((p) => {
                  const pct =
                    p.max_applicants && p.max_applicants > 0
                      ? Math.min(100, Math.round((p.applicants_count / p.max_applicants) * 100))
                      : 0;
                  return (
                    <div key={p.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm truncate">{p.title}</p>
                        <Badge variant="outline" className="capitalize">
                          {p.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {p.applicants_count}
                          {p.max_applicants ? `/${p.max_applicants}` : ""} applicants
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Intern Performance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Intern Performance</CardTitle>
            <CardDescription>Attendance & rating for active interns</CardDescription>
          </div>
          <Link href="/company-hr/interns">
            <Button variant="ghost" size="sm">
              All interns <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : internPerformance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active interns yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intern</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internPerformance.map((p) => (
                  <TableRow key={p.student_internship_id}>
                    <TableCell>
                      <Link
                        href={`/company-hr/interns`}
                        className="font-medium text-sm hover:underline"
                      >
                        {p.student_name || p.student_email || `${p.student_user_id.slice(0, 8)}…`}
                      </Link>
                      {p.internship_title && (
                        <p className="text-xs text-muted-foreground">{p.internship_title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Started {fmtDate(p.start_date)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p.attendance_rate} className="h-1.5 w-16" />
                        <span className="text-xs text-muted-foreground">{p.attendance_rate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium">
                          {p.rating > 0 ? p.rating.toFixed(1) : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/company-hr/internships">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-5 flex flex-col items-center text-center">
              <div className="p-2 rounded-full bg-blue-50 mb-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-medium text-sm">Manage Internships</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/company-hr/applications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-5 flex flex-col items-center text-center">
              <div className="p-2 rounded-full bg-purple-50 mb-2">
                <ClipboardCheck className="h-5 w-5 text-purple-600" />
              </div>
              <p className="font-medium text-sm">Review Applications</p>
              {stats.pendingReviews > 0 && (
                <Badge className="mt-1 bg-amber-100 text-amber-700 hover:bg-amber-100">
                  {stats.pendingReviews} pending
                </Badge>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/company-hr/supervisors">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-5 flex flex-col items-center text-center">
              <div className="p-2 rounded-full bg-indigo-50 mb-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="font-medium text-sm">Add Supervisor</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/company-hr/reports">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-5 flex flex-col items-center text-center">
              <div className="p-2 rounded-full bg-rose-50 mb-2">
                <TrendingUp className="h-5 w-5 text-rose-600" />
              </div>
              <p className="font-medium text-sm">View Reports</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
