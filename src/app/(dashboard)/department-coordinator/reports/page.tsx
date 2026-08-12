"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  Users,
  BookOpen,
  UserCheck,
  Calendar,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { StatsCard, StatsGrid } from "@/components/dashboard/stats-card";
import { EmptyState } from "@/components/layout/empty-state";

interface DepartmentStats {
  totalStudents: number;
  activeStudents: number;
  completedInternships: number;
  activeInternships: number;
  pendingAssignments: number;
  totalSupervisors: number;
  totalPrograms: number;
  activePrograms: number;
}

interface ProgramPerformance {
  program_id: string;
  program_name: string;
  program_code: string;
  total_students: number;
  active_internships: number;
  completed_internships: number;
  completion_rate: number;
}

interface SupervisorWorkload {
  supervisor_id: string;
  supervisor_name: string;
  supervisor_email: string;
  assigned_students: number;
  active_supervisions: number;
  completed_supervisions: number;
}

interface MonthlyTrend {
  month: string;
  internships_started: number;
  internships_completed: number;
  students_enrolled: number;
}

// Simple bar chart component (no external chart library needed)
function SimpleBarChart({
  data,
  dataKey,
  labelKey,
  title,
  color = "bg-primary",
}: {
  data: any[];
  dataKey: string;
  labelKey: string;
  title?: string;
  color?: string;
}) {
  const maxValue = Math.max(...data.map((d) => d[dataKey] || 0), 1);

  return (
    <div className="space-y-3">
      {title && <h4 className="font-medium text-sm">{title}</h4>}
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-[80px] truncate flex-shrink-0">
              {item[labelKey]}
            </span>
            <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((item[dataKey] || 0) / maxValue) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className={`h-full ${color} rounded`}
              />
            </div>
            <span className="text-sm font-medium w-[40px] text-right">
              {item[dataKey] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple line chart visualization using bars
function TrendChart({ data }: { data: MonthlyTrend[] }) {
  const maxVal = Math.max(
    ...data.flatMap((d) => [d.internships_started, d.internships_completed, d.students_enrolled]),
    1
  );

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary" />
          <span>Started</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-violet-500" />
          <span>Enrolled</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1 h-48 px-2">
        {data.map((item, index) => {
          const startedHeight = (item.internships_started / maxVal) * 100;
          const completedHeight = (item.internships_completed / maxVal) * 100;
          const enrolledHeight = (item.students_enrolled / maxVal) * 100;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex-1 flex flex-col items-center gap-0.5 group"
            >
              <div className="relative w-full flex gap-0.5 h-40 items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${startedHeight}%` }}
                  transition={{ duration: 0.5, delay: index * 0.03 + 0.2 }}
                  className="flex-1 bg-primary rounded-t min-h-[2px]"
                  title={`Started: ${item.internships_started}`}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${completedHeight}%` }}
                  transition={{ duration: 0.5, delay: index * 0.03 + 0.3 }}
                  className="flex-1 bg-emerald-500 rounded-t min-h-[2px]"
                  title={`Completed: ${item.internships_completed}`}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${enrolledHeight}%` }}
                  transition={{ duration: 0.5, delay: index * 0.03 + 0.4 }}
                  className="flex-1 bg-violet-500 rounded-t min-h-[2px]"
                  title={`Enrolled: ${item.students_enrolled}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.month.split(" ")[0]}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Data states
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [programPerformance, setProgramPerformance] = useState<ProgramPerformance[]>([]);
  const [supervisorWorkload, setSupervisorWorkload] = useState<SupervisorWorkload[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);

  // Fetch all report data
  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [statsRes, programsRes, supervisorsRes, trendsRes] = await Promise.all([
        fetch(`/api/department-coordinator/reports?type=overview`),
        fetch(`/api/department-coordinator/reports?type=programs`),
        fetch(`/api/department-coordinator/reports?type=supervisors`),
        fetch(`/api/department-coordinator/reports?type=trends&year=${selectedYear}`),
      ]);

      const [statsData, programsData, supervisorsData, trendsData] = await Promise.all([
        statsRes.json(),
        programsRes.json(),
        supervisorsRes.json(),
        trendsRes.json(),
      ]);

      if (statsData.success) setStats(statsData.data);
      if (programsData.success) setProgramPerformance(programsData.data || []);
      if (supervisorsData.success) setSupervisorWorkload(supervisorsData.data || []);
      if (trendsData.success) setMonthlyTrends(trendsData.data || []);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export report to CSV
  const exportToCSV = (type: "overview" | "programs" | "supervisors") => {
    let csvContent = "";
    let filename = "";

    switch (type) {
      case "overview":
        if (!stats) return;
        csvContent = [
          ["Metric", "Value"],
          ["Total Students", stats.totalStudents],
          ["Active Students", stats.activeStudents],
          ["Total Programs", stats.totalPrograms],
          ["Active Programs", stats.activePrograms],
          ["Total Supervisors", stats.totalSupervisors],
          ["Active Internships", stats.activeInternships],
          ["Completed Internships", stats.completedInternships],
          ["Pending Assignments", stats.pendingAssignments],
        ].map(row => row.join(",")).join("\n");
        filename = `department_overview_${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "programs":
        if (programPerformance.length === 0) return;
        csvContent = [
          ["Program Name", "Code", "Total Students", "Active Internships", "Completed", "Completion Rate (%)"],
          ...programPerformance.map(p => [
            p.program_name,
            p.program_code,
            p.total_students,
            p.active_internships,
            p.completed_internships,
            p.completion_rate,
          ]),
        ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
        filename = `program_performance_${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "supervisors":
        if (supervisorWorkload.length === 0) return;
        csvContent = [
          ["Supervisor Name", "Email", "Assigned Students", "Active Supervisions", "Completed"],
          ...supervisorWorkload.map(s => [
            s.supervisor_name,
            s.supervisor_email,
            s.assigned_students,
            s.active_supervisions,
            s.completed_supervisions,
          ]),
        ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
        filename = `supervisor_workload_${new Date().toISOString().split("T")[0]}.csv`;
        break;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Calculate participation rate
  const participationRate = stats && stats.totalStudents > 0 
    ? Math.round(((stats.activeInternships || 0) / stats.totalStudents) * 100)
    : 0;

  // Calculate completion rate
  const totalInternships = (stats?.activeInternships || 0) + (stats?.completedInternships || 0);
  const completionRate = totalInternships > 0
    ? Math.round(((stats?.completedInternships || 0) / totalInternships) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Department performance metrics and insights
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={fetchReportData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <StatsGrid columns={4}>
        <StatsCard
          title="Total Students"
          value={stats?.totalStudents.toString() || "0"}
          icon={Users}
          description={`${stats?.activeStudents || 0} active`}
          trend={
            stats?.activeStudents && stats.totalStudents > 0
              ? { value: Math.round((stats.activeStudents / stats.totalStudents) * 100), isPositive: true }
              : undefined
          }
          index={0}
        />
        <StatsCard
          title="Active Internships"
          value={stats?.activeInternships.toString() || "0"}
          icon={BookOpen}
          description={`${participationRate}% participation`}
          index={1}
        />
        <StatsCard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon={CheckCircle2}
          description={`${stats?.completedInternships || 0} completed`}
          trend={{
            value: completionRate,
            isPositive: completionRate >= 50,
          }}
          index={2}
        />
        <StatsCard
          title="Pending Actions"
          value={stats?.pendingAssignments.toString() || "0"}
          icon={AlertCircle}
          description="Need attention"
          index={3}
        />
      </StatsGrid>

      {/* Report Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="supervisors">Supervisors</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Summary Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Department Health</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => exportToCSV("overview")}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Student Participation</span>
                      <span className="font-medium">{participationRate}%</span>
                    </div>
                    <Progress value={participationRate} />

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Internship Completion</span>
                      <span className="font-medium">{completionRate}%</span>
                    </div>
                    <Progress value={completionRate} />

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Program Coverage</span>
                      <span className="font-medium">
                        {stats?.totalStudents && stats.totalStudents > 0
                          ? Math.round(
                              (programPerformance.reduce((acc, p) => acc + p.total_students, 0) /
                                stats.totalStudents) *
                                100
                            )
                          : 0}%
                      </span>
                    </div>
                    <Progress
                      value={
                        stats?.totalStudents && stats.totalStudents > 0
                          ? Math.round(
                              (programPerformance.reduce((acc, p) => acc + p.total_students, 0) /
                                stats.totalStudents) *
                                100
                            )
                          : 0
                      }
                    />
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                      <p className="text-lg font-bold">{stats?.totalStudents || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Students</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <UserCheck className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                      <p className="text-lg font-bold">{stats?.totalSupervisors || 0}</p>
                      <p className="text-xs text-muted-foreground">Supervisors</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <BookOpen className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                      <p className="text-lg font-bold">{stats?.activePrograms || 0}</p>
                      <p className="text-xs text-muted-foreground">Active Programs</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <Clock className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                      <p className="text-lg font-bold">{stats?.pendingAssignments || 0}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Status Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status Distribution</CardTitle>
                  <CardDescription>Current state of department activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Students by status */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                          Active Students
                        </span>
                        <span className="font-medium">{stats?.activeStudents || 0}</span>
                      </div>
                      <Progress
                        value={
                          stats?.totalStudents ? ((stats.activeStudents || 0) / stats.totalStudents) * 100 : 0
                        }
                      />
                    </div>

                    {/* Internship status */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          Active Internships
                        </span>
                        <span className="font-medium">{stats?.activeInternships || 0}</span>
                      </div>
                      <Progress
                        value={
                          totalInternships > 0
                            ? ((stats?.activeInternships || 0) / totalInternships) * 100
                            : 0
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500" />
                          Completed
                        </span>
                        <span className="font-medium">{stats?.completedInternships || 0}</span>
                      </div>
                      <Progress
                        value={
                          totalInternships > 0
                            ? ((stats?.completedInternships || 0) / totalInternships) * 100
                            : 0
                        }
                      />
                    </div>

                    {/* Pending alerts */}
                    {(stats?.pendingAssignments || 0) > 0 && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              Action Required
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              {stats?.pendingAssignments} item(s) need your attention
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* Programs Tab */}
        <TabsContent value="programs" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Program Performance</CardTitle>
                    <CardDescription>Student enrollment and completion rates by program</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToCSV("programs")} disabled={programPerformance.length === 0}>
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : programPerformance.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen className="h-10 w-10 text-muted-foreground" />}
                    title="No program data"
                    description="Program performance data will appear here once students are enrolled."
                  />
                ) : (
                  <div className="space-y-8">
                    {/* Completion Rate Chart */}
                    <SimpleBarChart
                      data={programPerformance}
                      dataKey="completion_rate"
                      labelKey="program_code"
                      title="Completion Rate (%)"
                      color="bg-emerald-500"
                    />

                    {/* Detailed Table */}
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Program</th>
                            <th className="px-4 py-3 text-center font-medium">Students</th>
                            <th className="px-4 py-3 text-center font-medium">Active</th>
                            <th className="px-4 py-3 text-center font-medium">Completed</th>
                            <th className="px-4 py-3 text-left font-medium">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {programPerformance.map((program) => (
                            <tr key={program.program_id} className="hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium">{program.program_name}</p>
                                  <p className="text-xs text-muted-foreground">{program.program_code}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">{program.total_students}</td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant="secondary">{program.active_internships}</Badge>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">
                                  {program.completed_internships}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Progress value={program.completion_rate} className="flex-1 h-2" />
                                  <span className="text-xs font-medium w-10 text-right">
                                    {program.completion_rate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Supervisors Tab */}
        <TabsContent value="supervisors" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Supervisor Workload</CardTitle>
                    <CardDescription>Distribution of student assignments across supervisors</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToCSV("supervisors")} disabled={supervisorWorkload.length === 0}>
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : supervisorWorkload.length === 0 ? (
                  <EmptyState
                    icon={<UserCheck className="h-10 w-10 text-muted-foreground" />}
                    title="No supervisor data"
                    description="Supervisor workload data will appear here once supervisors are added and assigned students."
                  />
                ) : (
                  <div className="space-y-8">
                    {/* Workload Distribution Chart */}
                    <SimpleBarChart
                      data={supervisorWorkload.slice(0, 10)}
                      dataKey="assigned_students"
                      labelKey="supervisor_name"
                      title="Assigned Students per Supervisor"
                      color="bg-blue-500"
                    />

                    {/* Detailed Table */}
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Supervisor</th>
                            <th className="px-4 py-3 text-center font-medium">Assigned</th>
                            <th className="px-4 py-3 text-center font-medium">Active</th>
                            <th className="px-4 py-3 text-center font-medium">Completed</th>
                            <th className="px-4 py-3 text-left font-medium">Load Level</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {supervisorWorkload.map((supervisor) => {
                            const loadLevel =
                              supervisor.assigned_students >= 10
                                ? "high"
                                : supervisor.assigned_students >= 5
                                ? "medium"
                                : "low";

                            return (
                              <tr key={supervisor.supervisor_id} className="hover:bg-muted/30">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium">{supervisor.supervisor_name}</p>
                                    <p className="text-xs text-muted-foreground">{supervisor.supervisor_email}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center font-medium">
                                  {supervisor.assigned_students}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Badge variant="secondary">{supervisor.active_supervisions}</Badge>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">
                                    {supervisor.completed_supervisions}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={
                                      loadLevel === "high"
                                        ? "destructive"
                                        : loadLevel === "medium"
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {loadLevel.charAt(0).toUpperCase() + loadLevel.slice(1)}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Trends</CardTitle>
                <CardDescription>
                  Internship activity throughout {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : monthlyTrends.length === 0 ? (
                  <EmptyState
                    icon={<BarChart3 className="h-10 w-10 text-muted-foreground" />}
                    title="No trend data"
                    description={`No activity recorded for ${selectedYear} yet.`}
                  />
                ) : (
                  <TrendChart data={monthlyTrends} />
                )}
              </CardContent>
            </Card>

            {/* Monthly Summary Table */}
            {monthlyTrends.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Month</th>
                            <th className="px-4 py-3 text-center font-medium">Enrolled</th>
                            <th className="px-4 py-3 text-center font-medium">Started</th>
                            <th className="px-4 py-3 text-center font-medium">Completed</th>
                            <th className="px-4 py-3 text-left font-medium">Net Change</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {monthlyTrends.map((trend, index) => {
                            const netChange = trend.internships_started - trend.internships_completed;
                            return (
                              <tr key={index} className="hover:bg-muted/30">
                                <td className="px-4 py-3 font-medium">{trend.month}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center gap-1 text-violet-600">
                                    <ArrowUpRight className="h-3 w-3" />
                                    {trend.students_enrolled}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center gap-1 text-primary">
                                    <ArrowUpRight className="h-3 w-3" />
                                    {trend.internships_started}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center gap-1 text-emerald-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {trend.internships_completed}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 ${
                                      netChange >= 0 ? "text-emerald-600" : "text-red-600"
                                    }`}
                                  >
                                    {netChange >= 0 ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3" />
                                    )}
                                    {netChange >= 0 ? "+" : ""}
                                    {netChange}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
