"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Users,
  ClipboardCheck,
  Star,
  Calendar,
  Download,
  Loader2,
  RefreshCw,
  BarChart3,
  Award,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/dashboard/page-header";

interface ReportData {
  company_id: string;
  generated_at: string;
  summary: {
    total_internships: number;
    total_applications: number;
    total_interns: number;
    total_supervisors: number;
    total_weekly_logs: number;
  };
  funnel: {
    total_openings: number;
    total_applications: number;
    accepted: number;
    rejected: number;
    reviewing: number;
    pending: number;
    withdrawn: number;
    conversion_rate: number;
  };
  per_internship: Array<{
    id: string;
    title: string;
    status: string;
    total_applicants: number;
    accepted: number;
    rejected: number;
    pending: number;
    active_interns: number;
    completed_interns: number;
  }>;
  attendance: {
    total_records: number;
    present: number;
    absent: number;
    late: number;
    half_day: number;
    leave: number;
    holiday: number;
    attendance_rate: number;
  };
  evaluations: {
    total_evaluations: number;
    submitted: number;
    pending: number;
    approved: number;
    average_rating: number;
    rating_distribution: Array<{ star: number; count: number }>;
  };
  supervisors: Array<{
    user_id: string;
    name: string;
    is_active: boolean;
    assigned_interns: number;
  }>;
  documents: {
    total: number;
    offer_letters: number;
    certificates: number;
    verified: number;
    pending: number;
  };
  weekly_applications: Array<{ week: string; count: number }>;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CompanyHRReportsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company-hr/reports", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      setData(j.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportInternships = () => {
    if (!data) return;
    const rows: string[][] = [
      [
        "Title",
        "Status",
        "Total Applicants",
        "Accepted",
        "Rejected",
        "Pending",
        "Active Interns",
        "Completed Interns",
      ],
      ...data.per_internship.map((p) => [
        p.title,
        p.status,
        String(p.total_applicants),
        String(p.accepted),
        String(p.rejected),
        String(p.pending),
        String(p.active_interns),
        String(p.completed_interns),
      ]),
    ];
    downloadCsv(`internhub-internships-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handleExportSupervisors = () => {
    if (!data) return;
    const rows: string[][] = [
      ["Name", "Active", "Assigned Interns"],
      ...data.supervisors.map((s) => [s.name, s.is_active ? "Yes" : "No", String(s.assigned_interns)]),
    ];
    downloadCsv(`internhub-supervisors-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handleExportFunnel = () => {
    if (!data) return;
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Total openings", String(data.funnel.total_openings)],
      ["Total applications", String(data.funnel.total_applications)],
      ["Accepted", String(data.funnel.accepted)],
      ["Rejected", String(data.funnel.rejected)],
      ["Reviewing", String(data.funnel.reviewing)],
      ["Pending", String(data.funnel.pending)],
      ["Withdrawn", String(data.funnel.withdrawn)],
      ["Conversion rate (%)", String(data.funnel.conversion_rate)],
      ["", ""],
      ["Attendance records", String(data.attendance.total_records)],
      ["Attendance rate (%)", String(data.attendance.attendance_rate)],
      ["", ""],
      ["Total evaluations", String(data.evaluations.total_evaluations)],
      ["Average rating", String(data.evaluations.average_rating)],
    ];
    downloadCsv(`internhub-summary-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Failed to load reports.</p>
        <Button onClick={load} variant="outline" className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Total Internships",
      value: data.summary.total_internships,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Applications",
      value: data.summary.total_applications,
      icon: ClipboardCheck,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Active Interns",
      value: data.summary.total_interns,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Supervisors",
      value: data.summary.total_supervisors,
      icon: UserCheck,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Weekly Logs",
      value: data.summary.total_weekly_logs,
      icon: Calendar,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "Avg Rating",
      value: `${data.evaluations.average_rating.toFixed(2)} / 5`,
      icon: Star,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  // Compute weekly applications bar chart heights
  const maxWeekly = Math.max(1, ...data.weekly_applications.map((w) => w.count));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`Generated ${new Date(data.generated_at).toLocaleString()}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportFunnel}>
              <Download className="h-4 w-4 mr-2" />
              Summary CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportInternships}>
              <Download className="h-4 w-4 mr-2" />
              Internships CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSupervisors}>
              <Download className="h-4 w-4 mr-2" />
              Supervisors CSV
            </Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className={`inline-flex p-2 rounded-md ${s.bg} mb-3`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Hiring Funnel + Applications over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Hiring Funnel</CardTitle>
            <CardDescription>Application pipeline across all internships</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Total Applications", value: data.funnel.total_applications, color: "bg-slate-500", icon: ClipboardCheck },
              { label: "Pending", value: data.funnel.pending, color: "bg-slate-400", icon: Clock },
              { label: "Reviewing", value: data.funnel.reviewing, color: "bg-amber-500", icon: Clock },
              { label: "Accepted", value: data.funnel.accepted, color: "bg-emerald-500", icon: CheckCircle2 },
              { label: "Rejected", value: data.funnel.rejected, color: "bg-red-500", icon: XCircle },
              { label: "Withdrawn", value: data.funnel.withdrawn, color: "bg-slate-300", icon: XCircle },
            ].map((s) => {
              const pct =
                data.funnel.total_applications > 0
                  ? Math.round((s.value / data.funnel.total_applications) * 100)
                  : 0;
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.value} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t flex items-center justify-between">
              <span className="text-sm font-medium">Conversion Rate</span>
              <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                {data.funnel.conversion_rate}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Applications Over Time</CardTitle>
            <CardDescription>Last 12 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-1 h-48">
              {data.weekly_applications.map((w) => {
                const heightPct = (w.count / maxWeekly) * 100;
                return (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {w.count}
                    </span>
                    <div
                      className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t hover:from-purple-600 hover:to-purple-500 transition-colors"
                      style={{ height: `${Math.max(4, heightPct)}%` }}
                      title={`${w.week}: ${w.count}`}
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(w.week).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance + Evaluations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Breakdown</CardTitle>
            <CardDescription>
              Overall attendance rate: {data.attendance.attendance_rate}% across {data.attendance.total_records} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Present", value: data.attendance.present, color: "text-emerald-600" },
                { label: "Late", value: data.attendance.late, color: "text-amber-600" },
                { label: "Half Day", value: data.attendance.half_day, color: "text-yellow-600" },
                { label: "Absent", value: data.attendance.absent, color: "text-red-600" },
                { label: "Leave", value: data.attendance.leave, color: "text-blue-600" },
                { label: "Holiday", value: data.attendance.holiday, color: "text-slate-600" },
              ].map((a) => (
                <div key={a.label} className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground">{a.label}</p>
                  <p className={`text-xl font-bold ${a.color}`}>{a.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluation Summary</CardTitle>
            <CardDescription>
              Average rating: {data.evaluations.average_rating.toFixed(2)} / 5 ·{" "}
              {data.evaluations.total_evaluations} total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-xl font-bold text-emerald-600">{data.evaluations.submitted}</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-amber-600">{data.evaluations.pending}</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-xl font-bold text-blue-600">{data.evaluations.approved}</p>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Rating Distribution</p>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data.evaluations.rating_distribution.find((r) => r.star === star)?.count || 0;
                const pct =
                  data.evaluations.total_evaluations > 0
                    ? (count / data.evaluations.total_evaluations) * 100
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs w-8 flex items-center gap-0.5">
                      {star} <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    </span>
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Internship Table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Internship Breakdown</CardTitle>
          <CardDescription>Hiring and intern status for each program</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.per_internship.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No internships yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Internship</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Applicants</TableHead>
                  <TableHead className="text-center">Accepted</TableHead>
                  <TableHead className="text-center">Rejected</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.per_internship.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{p.total_applicants}</TableCell>
                    <TableCell className="text-center text-emerald-600 font-medium">{p.accepted}</TableCell>
                    <TableCell className="text-center text-red-600">{p.rejected}</TableCell>
                    <TableCell className="text-center text-amber-600">{p.pending}</TableCell>
                    <TableCell className="text-center">{p.active_interns}</TableCell>
                    <TableCell className="text-center">{p.completed_interns}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Supervisors + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Supervisor Workload</CardTitle>
            <CardDescription>Interns assigned to each site supervisor</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.supervisors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No supervisors yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supervisor</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-center">Assigned Interns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.supervisors.map((s) => (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-center">
                        {s.is_active ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-400 inline" />
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">{s.assigned_interns}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents Overview</CardTitle>
            <CardDescription>Offer letters & certificates issued</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 border rounded-lg">
                <FileText className="h-5 w-5 text-blue-500 mb-2" />
                <p className="text-xs text-muted-foreground">Offer Letters</p>
                <p className="text-2xl font-bold">{data.documents.offer_letters}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Award className="h-5 w-5 text-emerald-500 mb-2" />
                <p className="text-xs text-muted-foreground">Certificates</p>
                <p className="text-2xl font-bold">{data.documents.certificates}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-2" />
                <p className="text-xs text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold">{data.documents.verified}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Clock className="h-5 w-5 text-amber-500 mb-2" />
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{data.documents.pending}</p>
              </div>
            </div>
            <div className="pt-2 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Documents</span>
              <span className="font-bold">{data.documents.total}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
