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
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PageHeader } from "@/components/dashboard/page-header";

interface DepartmentStats {
  totalStudents: number;
  activeStudents: number;
  completedInternships: number;
  activeInternships: number;
  /** Internships in the active pipeline (assigned + active + paused) —
   *  i.e. neither completed nor terminated. */
  inProgressInternships?: number;
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

// Per-student row returned by /api/department-coordinator/reports?type=students
interface StudentRosterRow {
  user_id: string;
  student_id_number: string | null;
  enrollment_year: number | null;
  expected_graduation: string | null;
  cgpa: number | null;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  program_name: string;
  program_code: string;
  department_name: string;
  department_code: string;
  internship_status: string | null;
  internship_start_date: string | null;
  internship_end_date: string | null;
  internship_company: string | null;
  supervisor_name: string | null;
  supervisor_email: string | null;
}

// Per-internship row returned by /api/department-coordinator/reports?type=internships
interface InternshipDetailRow {
  internship_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  student_user_id: string;
  student_name: string;
  student_email: string;
  student_id_number: string | null;
  program_name: string;
  program_code: string;
  company_name: string;
  company_industry: string | null;
  supervisor_name: string;
  supervisor_email: string;
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
  const [isExporting, setIsExporting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Data states
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [programPerformance, setProgramPerformance] = useState<ProgramPerformance[]>([]);
  const [supervisorWorkload, setSupervisorWorkload] = useState<SupervisorWorkload[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [studentRoster, setStudentRoster] = useState<StudentRosterRow[]>([]);
  const [internshipDetail, setInternshipDetail] = useState<InternshipDetailRow[]>([]);

  // Fetch all report data
  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [statsRes, programsRes, supervisorsRes, trendsRes, studentsRes, internshipsRes] = await Promise.all([
        fetch(`/api/department-coordinator/reports?type=overview`),
        fetch(`/api/department-coordinator/reports?type=programs`),
        fetch(`/api/department-coordinator/reports?type=supervisors`),
        fetch(`/api/department-coordinator/reports?type=trends&year=${selectedYear}`),
        fetch(`/api/department-coordinator/reports?type=students`),
        fetch(`/api/department-coordinator/reports?type=internships`),
      ]);

      const [statsData, programsData, supervisorsData, trendsData, studentsData, internshipsData] = await Promise.all([
        statsRes.json(),
        programsRes.json(),
        supervisorsRes.json(),
        trendsRes.json(),
        studentsRes.json(),
        internshipsRes.json(),
      ]);

      if (statsData.success) setStats(statsData.data);
      if (programsData.success) setProgramPerformance(programsData.data || []);
      if (supervisorsData.success) setSupervisorWorkload(supervisorsData.data || []);
      if (trendsData.success) setMonthlyTrends(trendsData.data || []);
      if (studentsData.success) setStudentRoster(studentsData.data?.students || []);
      if (internshipsData.success) setInternshipDetail(internshipsData.data?.internships || []);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // ----------------------------------------------------------------
  // CSV helpers
  // ----------------------------------------------------------------

  // Quote a single CSV cell. Doubles any embedded double-quotes, wraps
  // the value in double-quotes. Numbers are stringified. Null/undefined
  // become empty string (so the cell shows as empty in Excel rather than
  // the literal text "null").
  const csvCell = (v: unknown): string => {
    if (v === null || v === undefined) return '""';
    const s = String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  // Convert a 2D array of cells into CSV text. Each row becomes one
  // comma-separated line.
  const rowsToCsv = (rows: unknown[][]): string =>
    rows.map((row) => row.map(csvCell).join(",")).join("\n");

  // Trigger a browser download of the given CSV text.
  const downloadCsv = (filename: string, csvContent: string) => {
    // Prepend a UTF-8 BOM so Excel opens the file with the correct
    // encoding (without this, accented characters render as garbled
    // mojibake when the CSV is opened by double-clicking).
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Export ONE section (overview / programs / supervisors) — kept for
  // the per-tab "Export CSV" buttons.
  const exportToCSV = (type: "overview" | "programs" | "supervisors" | "students" | "internships") => {
    const today = new Date().toISOString().split("T")[0];

    switch (type) {
      case "overview": {
        if (!stats) return;
        const effectiveActive = stats.inProgressInternships ?? stats.activeInternships ?? 0;
        const totalInternships = effectiveActive + (stats.completedInternships || 0);
        const participationRate =
          stats.totalStudents > 0 ? Math.round((effectiveActive / stats.totalStudents) * 100) : 0;
        const completionRate =
          totalInternships > 0 ? Math.round((stats.completedInternships / totalInternships) * 100) : 0;
        const csv = rowsToCsv([
          ["Metric", "Value"],
          ["Report Section", "Executive Summary"],
          ["Generated At", new Date().toISOString()],
          ["", ""],
          ["Total Students", stats.totalStudents],
          ["Active Students", stats.activeStudents],
          ["Total Programs", stats.totalPrograms],
          ["Active Programs", stats.activePrograms],
          ["Total Supervisors", stats.totalSupervisors],
          ["In-Progress Internships (assigned + active + paused)", effectiveActive],
          ["Completed Internships", stats.completedInternships],
          ["Total Internships (in-progress + completed)", totalInternships],
          ["Student Participation Rate (%)", participationRate],
          ["Internship Completion Rate (%)", completionRate],
          ["Pending Supervisor Assignments", stats.pendingAssignments],
        ]);
        downloadCsv(`department_overview_${today}.csv`, csv);
        break;
      }

      case "programs": {
        if (programPerformance.length === 0) return;
        const csv = rowsToCsv([
          ["Program Name", "Code", "Total Students", "Active Internships", "Completed", "Completion Rate (%)"],
          ...programPerformance.map((p) => [
            p.program_name,
            p.program_code,
            p.total_students,
            p.active_internships,
            p.completed_internships,
            p.completion_rate,
          ]),
        ]);
        downloadCsv(`program_performance_${today}.csv`, csv);
        break;
      }

      case "supervisors": {
        if (supervisorWorkload.length === 0) return;
        const csv = rowsToCsv([
          ["Supervisor Name", "Email", "Assigned Students", "Active Supervisions", "Completed Supervisions"],
          ...supervisorWorkload.map((s) => [
            s.supervisor_name,
            s.supervisor_email,
            s.assigned_students,
            s.active_supervisions,
            s.completed_supervisions,
          ]),
        ]);
        downloadCsv(`supervisor_workload_${today}.csv`, csv);
        break;
      }

      case "students": {
        if (studentRoster.length === 0) return;
        const csv = rowsToCsv([
          [
            "Student ID Number",
            "First Name",
            "Last Name",
            "Email",
            "Phone",
            "Program",
            "Program Code",
            "Enrollment Year",
            "Expected Graduation",
            "CGPA",
            "Department",
            "Internship Status",
            "Internship Company",
            "Internship Start Date",
            "Internship End Date",
            "Faculty Supervisor",
            "Supervisor Email",
          ],
          ...studentRoster.map((s) => [
            s.student_id_number ?? "",
            s.first_name,
            s.last_name,
            s.email,
            s.phone ?? "",
            s.program_name,
            s.program_code,
            s.enrollment_year ?? "",
            s.expected_graduation ?? "",
            s.cgpa ?? "",
            s.department_name,
            s.department_code,
            s.internship_status ?? "Not Started",
            s.internship_company ?? "",
            s.internship_start_date ?? "",
            s.internship_end_date ?? "",
            s.supervisor_name ?? "Unassigned",
            s.supervisor_email ?? "",
          ]),
        ]);
        downloadCsv(`student_roster_${today}.csv`, csv);
        break;
      }

      case "internships": {
        if (internshipDetail.length === 0) return;
        const csv = rowsToCsv([
          [
            "Student Name",
            "Student ID",
            "Student Email",
            "Program",
            "Company",
            "Industry",
            "Internship Status",
            "Start Date",
            "End Date",
            "Faculty Supervisor",
            "Supervisor Email",
            "Created At",
          ],
          ...internshipDetail.map((i) => [
            i.student_name,
            i.student_id_number ?? "",
            i.student_email,
            i.program_name,
            i.company_name,
            i.company_industry ?? "",
            i.status,
            i.start_date ?? "",
            i.end_date ?? "",
            i.supervisor_name ?? "Unassigned",
            i.supervisor_email ?? "",
            i.created_at,
          ]),
        ]);
        downloadCsv(`internship_detail_${today}.csv`, csv);
        break;
      }
    }
  };

  // ----------------------------------------------------------------
  // Comprehensive Full Report CSV — single download with ALL sections.
  // This is what the user asked for: "a proper csv report with real
  // info, charts etc." The CSV can't carry charts but it CAN carry
  // every section of the report (executive summary, student roster,
  // internship detail, program performance, supervisor workload,
  // monthly trends) so a coordinator can open one file and see the
  // complete picture, instead of having to download 5 separate CSVs.
  // ----------------------------------------------------------------
  const exportFullReportCSV = async () => {
    setIsExporting(true);
    try {
      // Make sure we have the latest student + internship data — the
      // page may have loaded them already, but if the user clicked
      // the button before the initial fetch completed we need to
      // fetch them now so the CSV is complete.
      let students = studentRoster;
      let internships = internshipDetail;
      if (students.length === 0 || internships.length === 0) {
        const [studentsRes, internshipsRes] = await Promise.all([
          fetch(`/api/department-coordinator/reports?type=students`),
          fetch(`/api/department-coordinator/reports?type=internships`),
        ]);
        const [studentsData, internshipsData] = await Promise.all([
          studentsRes.json(),
          internshipsRes.json(),
        ]);
        if (studentsData.success) students = studentsData.data?.students || [];
        if (internshipsData.success) internships = internshipsData.data?.internships || [];
      }

      const today = new Date().toISOString().split("T")[0];
      const now = new Date().toISOString();
      const effectiveActive = stats?.inProgressInternships ?? stats?.activeInternships ?? 0;
      const totalInternships = effectiveActive + (stats?.completedInternships || 0);
      const participationRate =
        stats && stats.totalStudents > 0
          ? Math.round((effectiveActive / stats.totalStudents) * 100)
          : 0;
      const completionRate =
        totalInternships > 0
          ? Math.round(((stats?.completedInternships || 0) / totalInternships) * 100)
          : 0;

      const sections: string[] = [];

      // -------- Section 1: Report metadata --------
      sections.push(rowsToCsv([
        ["InternHub.pk — Department Coordinator Full Report"],
        ["Generated At", now],
        ["Scope", profile?.role === "department_coordinator" ? "Department" : "University"],
        ["Report Year", selectedYear],
      ]));

      // -------- Section 2: Executive Summary --------
      sections.push("");
      sections.push("SECTION 1 — EXECUTIVE SUMMARY");
      sections.push(rowsToCsv([
        ["Metric", "Value"],
        ["Total Students", stats?.totalStudents ?? 0],
        ["Active Students", stats?.activeStudents ?? 0],
        ["Total Programs", stats?.totalPrograms ?? 0],
        ["Active Programs", stats?.activePrograms ?? 0],
        ["Total Faculty Supervisors", stats?.totalSupervisors ?? 0],
        ["In-Progress Internships (assigned + active + paused)", effectiveActive],
        ["Completed Internships", stats?.completedInternships ?? 0],
        ["Total Internships (in-progress + completed)", totalInternships],
        ["Student Participation Rate (%)", participationRate],
        ["Internship Completion Rate (%)", completionRate],
        ["Pending Supervisor Assignments", stats?.pendingAssignments ?? 0],
      ]));

      // -------- Section 3: Student Roster --------
      sections.push("");
      sections.push("SECTION 2 — STUDENT ROSTER");
      if (students.length === 0) {
        sections.push(rowsToCsv([["No students found."]]));
      } else {
        sections.push(rowsToCsv([
          [
            "Student ID Number", "First Name", "Last Name", "Email", "Phone",
            "Program", "Program Code", "Enrollment Year", "Expected Graduation",
            "CGPA", "Department", "Internship Status", "Internship Company",
            "Internship Start Date", "Internship End Date",
            "Faculty Supervisor", "Supervisor Email",
          ],
          ...students.map((s: StudentRosterRow) => [
            s.student_id_number ?? "",
            s.first_name, s.last_name, s.email, s.phone ?? "",
            s.program_name, s.program_code,
            s.enrollment_year ?? "", s.expected_graduation ?? "", s.cgpa ?? "",
            s.department_name, s.department_code,
            s.internship_status ?? "Not Started",
            s.internship_company ?? "",
            s.internship_start_date ?? "", s.internship_end_date ?? "",
            s.supervisor_name ?? "Unassigned", s.supervisor_email ?? "",
          ]),
        ]));
      }

      // -------- Section 4: Internship Detail --------
      sections.push("");
      sections.push("SECTION 3 — INTERNSHIP DETAIL");
      if (internships.length === 0) {
        sections.push(rowsToCsv([["No internships found."]]));
      } else {
        sections.push(rowsToCsv([
          [
            "Student Name", "Student ID", "Student Email", "Program",
            "Company", "Industry", "Internship Status",
            "Start Date", "End Date",
            "Faculty Supervisor", "Supervisor Email", "Created At",
          ],
          ...internships.map((i: InternshipDetailRow) => [
            i.student_name, i.student_id_number ?? "", i.student_email,
            i.program_name, i.company_name, i.company_industry ?? "",
            i.status, i.start_date ?? "", i.end_date ?? "",
            i.supervisor_name ?? "Unassigned", i.supervisor_email ?? "",
            i.created_at,
          ]),
        ]));
      }

      // -------- Section 5: Program Performance --------
      sections.push("");
      sections.push("SECTION 4 — PROGRAM PERFORMANCE");
      if (programPerformance.length === 0) {
        sections.push(rowsToCsv([["No programs found."]]));
      } else {
        sections.push(rowsToCsv([
          ["Program Name", "Code", "Total Students", "Active Internships", "Completed Internships", "Completion Rate (%)"],
          ...programPerformance.map((p) => [
            p.program_name, p.program_code,
            p.total_students, p.active_internships,
            p.completed_internships, p.completion_rate,
          ]),
        ]));
      }

      // -------- Section 6: Supervisor Workload --------
      sections.push("");
      sections.push("SECTION 5 — SUPERVISOR WORKLOAD");
      if (supervisorWorkload.length === 0) {
        sections.push(rowsToCsv([["No supervisors found."]]));
      } else {
        sections.push(rowsToCsv([
          ["Supervisor Name", "Email", "Assigned Students", "Active Supervisions", "Completed Supervisions"],
          ...supervisorWorkload.map((s) => [
            s.supervisor_name, s.supervisor_email,
            s.assigned_students, s.active_supervisions, s.completed_supervisions,
          ]),
        ]));
      }

      // -------- Section 7: Monthly Trends --------
      sections.push("");
      sections.push(`SECTION 6 — MONTHLY TRENDS (${selectedYear})`);
      if (monthlyTrends.length === 0) {
        sections.push(rowsToCsv([["No trend data."]]));
      } else {
        sections.push(rowsToCsv([
          ["Month", "Students Enrolled", "Internships Started", "Internships Completed", "Net Change"],
          ...monthlyTrends.map((t) => [
            t.month, t.students_enrolled, t.internships_started, t.internships_completed,
            t.internships_started - t.internships_completed,
          ]),
        ]));
      }

      const fullCsv = sections.join("\n");
      downloadCsv(`internhub_full_report_${today}.csv`, fullCsv);
    } catch (error) {
      console.error("Error generating full report:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate participation rate using in-progress internships
  // (assigned + active + paused) — this is the real pipeline count
  // rather than just rows that have flipped to status='active'.
  const effectiveActive = stats?.inProgressInternships ?? stats?.activeInternships ?? 0;
  const participationRate = stats && stats.totalStudents > 0 
    ? Math.round((effectiveActive / stats.totalStudents) * 100)
    : 0;

  // Calculate completion rate.
  // Use effectiveActive (in-progress) so the denominator reflects all
  // internships currently or previously in the pipeline.
  const totalInternships = effectiveActive + (stats?.completedInternships || 0);
  const completionRate = totalInternships > 0
    ? Math.round(((stats?.completedInternships || 0) / totalInternships) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Reports & Analytics"
        description="Department performance metrics and insights"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
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

            {/* PRIMARY ACTION — comprehensive multi-section CSV download.
                This is the button the user wanted when they said "it
                should create a proper csv report with real info". */}
            <Button onClick={exportFullReportCSV} disabled={isExporting || isLoading}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExporting ? "Generating..." : "Download Full Report (CSV)"}
            </Button>
          </div>
        }
      />

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
          title="In-Progress Internships"
          value={(stats?.inProgressInternships ?? stats?.activeInternships ?? 0).toString()}
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
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="internships">Internships</TabsTrigger>
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
                          In-Progress Internships
                        </span>
                        <span className="font-medium">{effectiveActive}</span>
                      </div>
                      <Progress
                        value={
                          totalInternships > 0
                            ? (effectiveActive / totalInternships) * 100
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

        {/* Students Tab — per-student roster table.
            Replaces the previous behavior where the only way to see
            student data was to download a CSV and open it in Excel.
            Coordinators can now see, inline on the page:
              - Who is enrolled (name, ID, email, program)
              - Whether they have an internship and at which company
              - Whether they have a faculty supervisor assigned
            This is the "real info" the user wanted visible without
            having to download anything. */}
        <TabsContent value="students" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Student Roster</CardTitle>
                    <CardDescription>
                      {studentRoster.length} student{studentRoster.length === 1 ? "" : "s"} enrolled · with internship status and faculty supervisor assignment
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV("students")}
                    disabled={studentRoster.length === 0}
                  >
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-6 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
                  </div>
                ) : studentRoster.length === 0 ? (
                  <EmptyState
                    icon={<Users className="h-10 w-10 text-muted-foreground" />}
                    title="No students found"
                    description="Students enrolled in your department will appear here."
                  />
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[600px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-medium">Student</th>
                            <th className="px-3 py-2.5 text-left font-medium">ID Number</th>
                            <th className="px-3 py-2.5 text-left font-medium">Program</th>
                            <th className="px-3 py-2.5 text-left font-medium">Internship</th>
                            <th className="px-3 py-2.5 text-center font-medium">Status</th>
                            <th className="px-3 py-2.5 text-left font-medium">Supervisor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {studentRoster.map((s) => {
                            const statusColors: Record<string, string> = {
                              active: "bg-emerald-100 text-emerald-700",
                              assigned: "bg-blue-100 text-blue-700",
                              completed: "bg-purple-100 text-purple-700",
                              paused: "bg-amber-100 text-amber-700",
                              terminated: "bg-red-100 text-red-700",
                              withdrawn: "bg-slate-100 text-slate-600",
                            };
                            const statusColor = s.internship_status
                              ? statusColors[s.internship_status] || "bg-slate-100 text-slate-600"
                              : "bg-slate-100 text-slate-500";
                            return (
                              <tr key={s.user_id} className="hover:bg-muted/30">
                                <td className="px-3 py-2.5">
                                  <div>
                                    <p className="font-medium">{s.first_name} {s.last_name}</p>
                                    <p className="text-xs text-muted-foreground">{s.email}</p>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground">
                                  {s.student_id_number || "—"}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div>
                                    <p className="text-sm">{s.program_name || "—"}</p>
                                    {s.program_code && (
                                      <p className="text-xs text-muted-foreground">{s.program_code}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  {s.internship_company ? (
                                    <div>
                                      <p className="text-sm font-medium">{s.internship_company}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {s.internship_start_date
                                          ? new Date(s.internship_start_date).toLocaleDateString()
                                          : ""}
                                        {s.internship_end_date
                                          ? ` → ${new Date(s.internship_end_date).toLocaleDateString()}`
                                          : ""}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Not started</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs capitalize ${statusColor}`}
                                  >
                                    {s.internship_status || "none"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2.5">
                                  {s.supervisor_name ? (
                                    <div>
                                      <p className="text-sm">{s.supervisor_name}</p>
                                      <p className="text-xs text-muted-foreground">{s.supervisor_email}</p>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                                      Unassigned
                                    </Badge>
                                  )}
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

        {/* Internships Tab — per-internship detail table.
            One row per `student_internships` row, joined with student,
            company, and supervisor info. This is the data the previous
            reports page completely lacked — coordinators could see
            "2 in-progress internships" as a count but had no way to
            see WHICH 2 students, at WHICH companies, with WHICH
            supervisors. */}
        <TabsContent value="internships" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Internship Detail</CardTitle>
                    <CardDescription>
                      {internshipDetail.length} internship record{internshipDetail.length === 1 ? "" : "s"} · student × company × supervisor
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV("internships")}
                    disabled={internshipDetail.length === 0}
                  >
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-6 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
                  </div>
                ) : internshipDetail.length === 0 ? (
                  <EmptyState
                    icon={<Briefcase className="h-10 w-10 text-muted-foreground" />}
                    title="No internship records"
                    description="Internships will appear here once students are placed."
                  />
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[600px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-medium">Student</th>
                            <th className="px-3 py-2.5 text-left font-medium">Program</th>
                            <th className="px-3 py-2.5 text-left font-medium">Company</th>
                            <th className="px-3 py-2.5 text-center font-medium">Status</th>
                            <th className="px-3 py-2.5 text-left font-medium">Duration</th>
                            <th className="px-3 py-2.5 text-left font-medium">Supervisor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {internshipDetail.map((i) => {
                            const statusColors: Record<string, string> = {
                              active: "bg-emerald-100 text-emerald-700",
                              assigned: "bg-blue-100 text-blue-700",
                              completed: "bg-purple-100 text-purple-700",
                              paused: "bg-amber-100 text-amber-700",
                              terminated: "bg-red-100 text-red-700",
                              withdrawn: "bg-slate-100 text-slate-600",
                            };
                            const statusColor = statusColors[i.status] || "bg-slate-100 text-slate-600";
                            return (
                              <tr key={i.internship_id} className="hover:bg-muted/30">
                                <td className="px-3 py-2.5">
                                  <div>
                                    <p className="font-medium">{i.student_name}</p>
                                    <p className="text-xs text-muted-foreground">{i.student_email}</p>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div>
                                    <p className="text-sm">{i.program_name || "—"}</p>
                                    {i.program_code && (
                                      <p className="text-xs text-muted-foreground">{i.program_code}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div>
                                    <p className="text-sm font-medium">{i.company_name || "—"}</p>
                                    {i.company_industry && (
                                      <p className="text-xs text-muted-foreground">{i.company_industry}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <Badge variant="secondary" className={`text-xs capitalize ${statusColor}`}>
                                    {i.status}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                  {i.start_date
                                    ? new Date(i.start_date).toLocaleDateString()
                                    : "—"}
                                  {i.end_date
                                    ? ` → ${new Date(i.end_date).toLocaleDateString()}`
                                    : ""}
                                </td>
                                <td className="px-3 py-2.5">
                                  {i.supervisor_name ? (
                                    <div>
                                      <p className="text-sm">{i.supervisor_name}</p>
                                      <p className="text-xs text-muted-foreground">{i.supervisor_email}</p>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                                      Unassigned
                                    </Badge>
                                  )}
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
                  <div className="py-6 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
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
                  <div className="py-6 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
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
                  <div className="py-6 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
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
