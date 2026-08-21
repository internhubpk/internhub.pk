"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  FileText,
  Filter,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  Search,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { createClient } from "@/utils/supabase/client";
import { toast } from "@/components/shared/toast";

// Types
interface WeeklyLogReport {
  id: string;
  student_user_id: string;
  student_name: string;
  student_email: string;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  status: "submitted" | "approved" | "rejected" | "revision_required";
  submitted_at: string | null;
  hours_worked: number | null;
  tasks_completed: string[];
}

interface EvaluationReport {
  id: string;
  student_user_id: string;
  student_name: string;
  student_email: string;
  type: "weekly_log" | "midterm" | "final" | "task";
  status: "pending" | "submitted" | "approved" | "rejected";
  rating: number | null;
  submitted_at: string | null;
  evaluator_name: string | null;
}

type ReportType = "weekly_logs" | "evaluations" | "all";
type StatusFilter = "all" | "submitted" | "approved" | "rejected" | "pending";

export default function ProgramCoordinatorReportsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklyLogReport[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchReports = useCallback(async () => {
    // PC should use program_id as primary filter, fallback to department_id
    const programId = profile?.program_id;
    const deptId = profile?.department_id;
    
    if (!programId && !deptId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = await createClient();

      // ============================================================
      // STRATEGY: Avoid complex joins that cause 400 errors
      // weekly_logs and evaluations reference profiles.user_id directly,
      // NOT students.user_id. So we:
      // 1. Fetch logs/evaluations with simple select (no joins)
      // 2. Get program's student user_ids
      // 3. Filter client-side
      // 4. Fetch profiles separately for display
      // ============================================================

      // Step 1: Get this program's student user_ids
      const { data: programStudents } = await supabase
        .from("students")
        .select("user_id")
        .eq("program_id", programId!);
      
      const programStudentUserIds = new Set(
        (programStudents || []).map((s: any) => s.user_id)
      );

      // Step 2: Fetch ALL weekly logs (simple select, no joins)
      const { data: allLogsData, error: logsError } = await supabase
        .from("weekly_logs")
        .select("*")
        .order("week_start_date", { ascending: false })
        .limit(500); // Get more to filter client-side

      if (!logsError && allLogsData) {
        // Step 3: Filter to only show logs from our program's students
        const filteredLogs = allLogsData.filter((log: any) =>
          programStudentUserIds.has(log.student_user_id)
        );

        // Step 4: Fetch profiles for these students
        const logStudentIds = [...new Set(filteredLogs.map((l: any) => l.student_user_id))];
        let profileMap: Record<string, {full_name: string | null, email: string}> = {};
        
        if (logStudentIds.length > 0) {
          const { data: logProfiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", logStudentIds);
          
          (logProfiles || []).forEach((p: any) => {
            profileMap[p.user_id] = { full_name: p.full_name, email: p.email };
          });
        }

        // Format and set weekly logs
        const formattedLogs: WeeklyLogReport[] = filteredLogs.map((row: any) => ({
          id: row.id,
          student_user_id: row.student_user_id,
          student_name: profileMap[row.student_user_id]?.full_name || "Unknown",
          student_email: profileMap[row.student_user_id]?.email || "",
          week_number: row.week_number,
          week_start_date: row.week_start_date,
          week_end_date: row.week_end_date,
          status: row.status,
          submitted_at: row.submitted_at,
          hours_worked: row.hours_worked,
          tasks_completed: row.tasks_completed || [],
        }));
        setWeeklyLogs(formattedLogs);
      } else if (logsError) {
        console.error("Error fetching weekly logs:", logsError);
      }

      // Step 5: Fetch ALL evaluations (simple select, no joins)
      const { data: allEvalsData, error: evalsError } = await supabase
        .from("evaluations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!evalsError && allEvalsData) {
        // Step 6: Filter to only show evaluations from our program's students
        const filteredEvals = allEvalsData.filter((ev: any) =>
          programStudentUserIds.has(ev.student_user_id)
        );

        // Step 7: Fetch profiles for students AND evaluators
        const evalStudentIds = [...new Set(filteredEvals.map((e: any) => e.student_user_id))];
        const evaluatorIds = [...new Set(
          filteredEvals.map((e: any) => e.evaluator_id).filter(Boolean)
        )];
        
        let profileMap: Record<string, {full_name: string | null, email: string}> = {};
        let evaluatorMap: Record<string, string> = {};

        if (evalStudentIds.length > 0) {
          const { data: evalProfiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", evalStudentIds);
          
          (evalProfiles || []).forEach((p: any) => {
            profileMap[p.user_id] = { full_name: p.full_name, email: p.email };
          });
        }

        if (evaluatorIds.length > 0) {
          const { data: evaluatorProfiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", evaluatorIds);
          
          (evaluatorProfiles || []).forEach((p: any) => {
            evaluatorMap[p.user_id] = p.full_name || "Unknown";
          });
        }

        // Format and set evaluations
        const formattedEvals: EvaluationReport[] = filteredEvals.map((row: any) => ({
          id: row.id,
          student_user_id: row.student_user_id,
          student_name: profileMap[row.student_user_id]?.full_name || "Unknown",
          student_email: profileMap[row.student_user_id]?.email || "",
          type: row.type,
          status: row.status,
          rating: row.rating,
          submitted_at: row.submitted_at,
          evaluator_name: row.evaluator_id ? evaluatorMap[row.evaluator_id] : null,
        }));
        setEvaluations(formattedEvals);
      } else if (evalsError) {
        console.error("Error fetching evaluations:", evalsError);
      }
      
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Error", { description: "Failed to load reports." });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.program_id, profile?.department_id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Filter logic
  const filteredWeeklyLogs = weeklyLogs.filter((log) => {
    const matchesSearch =
      !searchQuery.trim() ||
      log.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.student_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredEvaluations = evaluations.filter((ev) => {
    const matchesSearch =
      !searchQuery.trim() ||
      ev.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.student_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || ev.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalWeeklyLogs = weeklyLogs.length;
  const approvedLogs = weeklyLogs.filter((l) => l.status === "approved").length;
  const pendingLogs = weeklyLogs.filter((l) => l.status === "submitted").length;
  const totalEvaluations = evaluations.length;

  // Generate Word document report
  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      toast.info("Generating Report", {
        description: "Preparing your program report document...",
      });

      // Call the reports API to generate a Word document
      const response = await fetch("/api/department-coordinator/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "program_summary",
          department_id: profile?.department_id,
          include_weekly_logs: activeTab !== "evaluations",
          include_evaluations: activeTab !== "weekly_logs",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await response.json();

      if (data.success && data.data?.file_url) {
        // Download the file
        window.open(data.data.file_url, "_blank");
        toast.success("Report Generated", {
          description: "Your report is ready for download.",
        });
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Generation Failed", {
        description: "Could not generate the report. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      approved: "default",
      submitted: "secondary",
      rejected: "destructive",
      pending: "outline",
      revision_required: "outline",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getEvaluationTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      midterm: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      final: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      weekly_log: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      task: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type] || "bg-gray-100 text-gray-800"}`}
      >
        {type.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Program Reports"
        description="View and download reports for students in your program."
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Weekly Logs"
          value={totalWeeklyLogs}
          icon={FileText}
          variant="default"
        />
        <StatCard
          label="Approved"
          value={approvedLogs}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          label="Pending Review"
          value={pendingLogs}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          label="Evaluations"
          value={totalEvaluations}
          icon={Users}
          variant="info"
        />
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Tab Switcher */}
            <div className="flex rounded-lg border p-1 bg-muted">
              {[
                { key: "all", label: "All Reports" },
                { key: "weekly_logs", label: "Weekly Logs" },
                { key: "evaluations", label: "Evaluations" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as ReportType)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === tab.key
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            {/* Generate Report Button */}
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isGenerating ? "Generating..." : "Export Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : activeTab === "all" &&
        filteredWeeklyLogs.length === 0 &&
        filteredEvaluations.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground" />}
          title="No reports found"
          description={
            searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filter."
              : "No weekly logs or evaluations have been submitted yet."
          }
        />
      ) : activeTab === "weekly_logs" && filteredWeeklyLogs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground" />}
          title="No weekly logs found"
          description={
            searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filter."
              : "No weekly logs have been submitted yet."
          }
        />
      ) : activeTab === "evaluations" && filteredEvaluations.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground" />}
          title="No evaluations found"
          description={
            searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filter."
              : "No evaluations have been submitted yet."
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Weekly Logs Table */}
          {(activeTab === "all" || activeTab === "weekly_logs") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Weekly Logs
                  <Badge variant="secondary">{filteredWeeklyLogs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredWeeklyLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No weekly logs match your filters.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredWeeklyLogs.map((log, index) => (
                          <motion.tr
                            key={log.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(log.student_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {log.student_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {log.student_email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">Week {log.week_number}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{formatDate(log.week_start_date)}</p>
                                <p className="text-xs text-muted-foreground">
                                  to {formatDate(log.week_end_date)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {log.hours_worked !== null ? `${log.hours_worked}h` : "—"}
                            </TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell>
                              {log.submitted_at
                                ? formatDate(log.submitted_at)
                                : "—"}
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Evaluations Table */}
          {(activeTab === "all" || activeTab === "evaluations") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Evaluations
                  <Badge variant="secondary">{filteredEvaluations.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredEvaluations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No evaluations match your filters.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Evaluator</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredEvaluations.map((ev, index) => (
                          <motion.tr
                            key={ev.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(ev.student_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {ev.student_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {ev.student_email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getEvaluationTypeBadge(ev.type)}
                            </TableCell>
                            <TableCell>
                              {ev.evaluator_name || "—"}
                            </TableCell>
                            <TableCell>
                              {ev.rating !== null ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-500">★</span>
                                  <span>{ev.rating}/5</span>
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(ev.status)}</TableCell>
                            <TableCell>
                              {ev.submitted_at
                                ? formatDate(ev.submitted_at)
                                : "—"}
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
