"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ScrollText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Calendar,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Printer,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Hourglass,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { downloadCsv, generatePdf } from "@/lib/export-helpers";

// Types
interface WeeklyLogEntry {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatarUrl?: string | null;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  status: "submitted" | "approved" | "rejected" | "revision_required" | "pending" | "late";
  tasksCompleted: string[];
  challenges: string | null;
  learnings: string | null;
  nextWeekGoals: string | null;
  hoursWorked: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  supervisorFeedback: string | null;
  isLate: boolean;
  daysLate: number;
}

interface LogStats {
  totalLogs: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  lateSubmissions: number;
  averageHours: number;
}

export default function SiteSupervisorWeeklyLogsPage() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<WeeklyLogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showLateOnly, setShowLateOnly] = useState(false);
  
  // Review dialog state
  const [selectedLog, setSelectedLog] = useState<WeeklyLogEntry | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    fetchWeeklyLogs();
  }, []);

  async function fetchWeeklyLogs() {
    if (!user) return;

    setIsLoading(true);
    try {
      const supabase = createClient();

      // student_internships.site_supervisor_id and weekly_logs.supervisor_id
      // both reference profiles.user_id — so we filter by the auth user's id
      // (the supervisor's user_id), NOT the supervisors table PK. RLS uses
      // auth.uid() the same way.
      const supervisorUserId = user.id;

      // Get assigned students (real column: student_user_id, not student_id)
      const { data: assignments } = await supabase
        .from("student_internships")
        .select("student_user_id")
        .eq("site_supervisor_id", supervisorUserId);

      const studentUserIds = (assignments || [])
        .map((a: any) => a.student_user_id)
        .filter((id: any): id is string => Boolean(id));

      if (studentUserIds.length === 0) {
        setLogs([]);
        setStats({
          totalLogs: 0,
          pendingReview: 0,
          approved: 0,
          rejected: 0,
          lateSubmissions: 0,
          averageHours: 0,
        });
        setIsLoading(false);
        return;
      }

      // Fetch weekly logs for assigned students. 
      //
      // weekly_logs has TWO supervisor FK columns:
      //   - supervisor_id         → the FACULTY supervisor who originally
      //                              created/reviewed the log (the old single-
      //                              supervisor schema). For site supervisors,
      //                              this column points to the faculty supervisor,
      //                              NOT the site supervisor.
      //   - site_supervisor_id    → the SITE supervisor assigned to this
      //                              internship (added in migration 0058 when
      //                              dual-signature weekly logs were introduced).
      //
      // A SITE supervisor must filter by `site_supervisor_id = auth.uid()`,
      // NOT by `supervisor_id` — otherwise they see zero logs (the
      // supervisor_id column doesn't point to them).
      //
      // Real columns: tasks_completed text[], challenges, learnings,
      // next_week_goals, hours_worked, week_number.
      const { data: weeklyLogs } = await supabase
        .from("weekly_logs")
        .select(`
          id,
          student_user_id,
          supervisor_id,
          site_supervisor_id,
          week_number,
          week_start_date,
          week_end_date,
          tasks_completed,
          challenges,
          learnings,
          next_week_goals,
          hours_worked,
          status,
          supervisor_feedback,
          site_supervisor_remarks,
          site_supervisor_signed_at,
          reviewed_at,
          submitted_at,
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
        .in("student_user_id", studentUserIds)
        .order("week_start_date", { ascending: false })
        .limit(100);

      const processedLogs: WeeklyLogEntry[] = (weeklyLogs || []).map((log: any, idx: number) => {
        const profile = log.student_profile || {};
        const weekEnd = new Date(log.week_end_date);
        const submittedAt = log.submitted_at ? new Date(log.submitted_at) : null;
        const gracePeriodEnd = new Date(weekEnd.getTime() + 3 * 24 * 60 * 60 * 1000);

        const fullName =
          profile.full_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          (profile.email ? profile.email.split("@")[0] : "Unknown Student");

        return {
          id: log.id,
          studentId: log.student_user_id,
          studentName: fullName,
          studentEmail: profile.email || "",
          avatarUrl: profile.avatar_url ?? null,
          // week_number is a real column (migration 0042 made it nullable w/ default).
          weekNumber: log.week_number ?? idx + 1,
          weekStart: log.week_start_date,
          weekEnd: log.week_end_date,
          status: log.status as WeeklyLogEntry["status"],
          tasksCompleted: Array.isArray(log.tasks_completed) ? log.tasks_completed : [],
          challenges: log.challenges ?? null,
          learnings: log.learnings ?? null,
          nextWeekGoals: log.next_week_goals ?? null,
          hoursWorked: log.hours_worked !== null && log.hours_worked !== undefined
            ? Number(log.hours_worked)
            : null,
          submittedAt: log.submitted_at ?? null,
          reviewedAt: log.reviewed_at ?? null,
          supervisorFeedback: log.supervisor_feedback ?? null,
          isLate: submittedAt ? submittedAt > gracePeriodEnd : false,
          daysLate:
            submittedAt && submittedAt > gracePeriodEnd
              ? Math.floor((submittedAt.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24))
              : 0,
        };
      });

      setLogs(processedLogs);

      // Calculate stats using real hours_worked from weekly_logs.
      const totalHours = processedLogs.reduce((acc, l) => acc + (l.hoursWorked || 0), 0);
      const logsWithHours = processedLogs.filter((l) => l.hoursWorked !== null).length;
      setStats({
        totalLogs: processedLogs.length,
        pendingReview: processedLogs.filter((l) => l.status === "submitted").length,
        approved: processedLogs.filter((l) => l.status === "approved").length,
        rejected: processedLogs.filter((l) => l.status === "rejected").length,
        lateSubmissions: processedLogs.filter((l) => l.isLate).length,
        averageHours: logsWithHours > 0 ? Math.round((totalHours / logsWithHours) * 10) / 10 : 0,
      });

    } catch (error) {
      console.error("Error fetching weekly logs:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  // Note: Mock data removed - page shows empty state until real data is available
  // function setMockData() has been removed to prevent showing fake data

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        searchQuery === "" ||
        log.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.studentEmail.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      const matchesLate = !showLateOnly || log.isLate;

      return matchesSearch && matchesStatus && matchesLate;
    });
  }, [logs, searchQuery, statusFilter, showLateOnly]);

  async function handleReview(action: "approve" | "reject" | "request_revision") {
    if (!selectedLog || !reviewFeedback.trim()) {
      if (action !== "approve") {
        alert("Please provide feedback before rejecting or requesting revision.");
        return;
      }
    }

    setIsSubmittingReview(true);
    
    try {
      if (!selectedLog) return;
      const response = await fetch("/api/site-supervisor/weekly-logs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: selectedLog.id,
          action,
          feedback: reviewFeedback,
        }),
      });

      if (response.ok) {
        alert(`Log ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "flagged for revision"} successfully!`);
        
        // Update local state
        setLogs(prev => prev.map(log =>
          log.id === selectedLog!.id
            ? { ...log, status: action === "approve" ? "approved" as const : action === "reject" ? "rejected" as const : "revision_required" as const, supervisorFeedback: reviewFeedback, reviewedAt: new Date().toISOString() }
            : log
        ));

        setSelectedLog(null);
        setReviewFeedback("");
        fetchWeeklyLogs();
      } else {
        alert("Error processing review. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Weekly Logs Review"
        description="Review and approve weekly logs from your assigned interns"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (!filteredLogs || filteredLogs.length === 0) {
                  alert("No weekly logs to export.");
                  return;
                }
                downloadCsv(
                  `site-supervisor-weekly-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                  [
                    "Student",
                    "Email",
                    "Week #",
                    "Week Start",
                    "Week End",
                    "Status",
                    "Hours",
                    "Submitted At",
                    "Reviewed At",
                    "Late",
                    "Days Late",
                    "Tasks Completed",
                    "Challenges",
                    "Learnings",
                    "Next Week Goals",
                    "Supervisor Feedback",
                  ],
                  filteredLogs.map((l) => [
                    l.studentName,
                    l.studentEmail,
                    String(l.weekNumber),
                    l.weekStart || "",
                    l.weekEnd || "",
                    l.status,
                    l.hoursWorked != null ? String(l.hoursWorked) : "",
                    l.submittedAt || "",
                    l.reviewedAt || "",
                    l.isLate ? "Yes" : "No",
                    String(l.daysLate || 0),
                    (l.tasksCompleted || []).join("; "),
                    l.challenges || "",
                    l.learnings || "",
                    l.nextWeekGoals || "",
                    l.supervisorFeedback || "",
                  ])
                );
              }}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={fetchWeeklyLogs}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Logs" value={stats?.totalLogs || 0} icon={FileText} variant="default" />
        <StatCard label="Pending Review" value={stats?.pendingReview || 0} icon={Clock} variant="info" />
        <StatCard label="Approved" value={stats?.approved || 0} icon={CheckCircle2} variant="success" />
        <StatCard label="Rejected" value={stats?.rejected || 0} icon={XCircle} variant="danger" />
        <StatCard label="Late Submissions" value={stats?.lateSubmissions || 0} icon={AlertTriangle} variant="warning" />
        <StatCard label="Avg Hours/Week" value={`${stats?.averageHours || 0}h`} icon={BarChart3} variant="default" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="revision_required">Revision Required</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showLateOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowLateOnly(!showLateOnly)}
              className={showLateOnly ? "" : ""}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Late Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {isLoading ? (
        <div className="py-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Logs Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== "all" || showLateOnly
                ? "Try adjusting your search or filters."
                : "No weekly logs have been submitted by your assigned interns yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`hover:shadow-md transition-all ${
                log.status === "submitted" ? "border-blue-200 bg-blue-50/20 ring-1 ring-blue-100" :
                log.isLate ? "border-yellow-200 bg-yellow-50/20" :
                ""
              }`}>
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Student Info */}
                    <div className="flex items-center gap-4 lg:min-w-[280px]">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={log.avatarUrl || undefined} alt={log.studentName} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {log.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{log.studentName}</h3>
                        <p className="text-sm text-muted-foreground truncate">{log.studentEmail}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={log.status} />
                          {log.isLate && (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                              {log.daysLate}d late
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Week & Content Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Week {log.weekNumber}</span>
                        <span className="text-muted-foreground text-sm">
                          ({formatDate(log.weekStart)} - {formatDate(log.weekEnd)})
                        </span>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          <strong>Tasks:</strong>{" "}
                          {log.tasksCompleted.slice(0, 2).join(", ")}
                          {log.tasksCompleted.length > 2 && ` +${log.tasksCompleted.length - 2} more`}
                        </p>
                      </div>

                      {log.supervisorFeedback && (
                        <div className="p-2 rounded bg-muted/50 mt-2">
                          <p className="text-sm">
                            <MessageSquare className="h-3 w-3 inline mr-1" />
                            <span className="font-medium">Your Feedback:</span>{" "}
                            {log.supervisorFeedback}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Hours & Actions */}
                    <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                      <div className="text-center px-4 py-2 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{log.hoursWorked || "-"}</p>
                        <p className="text-xs text-muted-foreground">hours</p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setReviewFeedback(log.supervisorFeedback || "");
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {log.status === "submitted" ? "Review" : "View"}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Download PDF"
                        onClick={() => {
                          generatePdf(
                            {
                              title: `Weekly Log — ${log.studentName}`,
                              subtitle: `Week ${log.weekNumber} · ${log.weekStart} to ${log.weekEnd} · ${log.status}`,
                              metadata: [
                                { label: "Student", value: log.studentName },
                                { label: "Email", value: log.studentEmail },
                                { label: "Week #", value: String(log.weekNumber) },
                                { label: "Period", value: `${log.weekStart} to ${log.weekEnd}` },
                                { label: "Status", value: log.status },
                                { label: "Hours Worked", value: String(log.hoursWorked ?? "—") },
                                { label: "Submitted", value: log.submittedAt || "—" },
                                { label: "Reviewed", value: log.reviewedAt || "—" },
                                { label: "Late", value: log.isLate ? `Yes (${log.daysLate} day${log.daysLate === 1 ? "" : "s"})` : "No" },
                              ],
                              sections: [
                                {
                                  title: "Tasks Completed",
                                  bullets: log.tasksCompleted?.length ? log.tasksCompleted : ["(no tasks recorded)"],
                                },
                                {
                                  title: "Challenges",
                                  lines: [log.challenges || "(none reported)"],
                                },
                                {
                                  title: "Learnings",
                                  lines: [log.learnings || "(none reported)"],
                                },
                                {
                                  title: "Next Week Goals",
                                  lines: [log.nextWeekGoals || "(none reported)"],
                                },
                                {
                                  title: "Supervisor Feedback",
                                  lines: [log.supervisorFeedback || "(no feedback yet)"],
                                },
                              ],
                              footer: `InternHub.pk — Site Supervisor Weekly Log exported on ${new Date().toLocaleString()}`,
                            },
                            `weekly-log-${log.studentName.replace(/\s+/g, "-").toLowerCase()}-week-${log.weekNumber}.pdf`
                          );
                        }}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <ScrollText className="h-5 w-5" />
                  Week {selectedLog.weekNumber} Log Review
                </DialogTitle>
                <DialogDescription>
                  Reviewing submission from {selectedLog.studentName}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="content" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="content">Log Content</TabsTrigger>
                  <TabsTrigger value="review">Your Review</TabsTrigger>
                </TabsList>

                {/* Log Content Tab */}
                <TabsContent value="content" className="space-y-4 mt-4">
                  {/* Student Header */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={selectedLog.avatarUrl || undefined} alt={selectedLog.studentName} />
                            <AvatarFallback className="bg-primary/10 text-primary text-lg">
                              {selectedLog.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-xl font-semibold">{selectedLog.studentName}</h3>
                            <p className="text-muted-foreground">{selectedLog.studentEmail}</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <StatusBadge status={selectedLog.status} />
                          {selectedLog.isLate && (
                            <p className="text-sm text-yellow-600 mt-1">
                              Submitted {selectedLog.daysLate} days late
                            </p>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Week Number</p>
                          <p className="font-semibold text-lg">Week {selectedLog.weekNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Period</p>
                          <p className="font-semibold">{formatDate(selectedLog.weekStart)} - {formatDate(selectedLog.weekEnd)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Submitted On</p>
                          <p className="font-semibold">
                            {selectedLog.submittedAt 
                              ? new Date(selectedLog.submittedAt).toLocaleDateString()
                              : "Not submitted"
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Hours Worked</p>
                          <p className="font-semibold text-lg">{selectedLog.hoursWorked || 0} hrs</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tasks Completed */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Tasks Completed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedLog.tasksCompleted.map((task, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Challenges, Learnings, Goals */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          Challenges
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {selectedLog.challenges || "No challenges reported"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-500" />
                          Learnings
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {selectedLog.learnings || "No learnings reported"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="h-4 w-4 text-purple-500" />
                          Next Week Goals
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {selectedLog.nextWeekGoals || "No goals specified"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Review Tab */}
                <TabsContent value="review" className="space-y-4 mt-4">
                  {selectedLog.status !== "submitted" && selectedLog.supervisorFeedback && (
                    <Card className="border-green-200 bg-green-50/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-green-800">Previous Review</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-2">
                          <StatusBadge status={selectedLog.status} />
                          <span className="text-sm text-muted-foreground">
                            Reviewed on {selectedLog.reviewedAt 
                              ? new Date(selectedLog.reviewedAt).toLocaleDateString()
                              : "N/A"
                            }
                          </span>
                        </div>
                        <p className="text-sm bg-white p-3 rounded-lg border">
                          {selectedLog.supervisorFeedback}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedLog.status === "submitted" && (
                    <>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Provide Your Feedback</CardTitle>
                          <CardDescription>
                            Your feedback will be visible to the student
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="feedback">Supervisor Feedback *</Label>
                            <Textarea
                              id="feedback"
                              placeholder="Provide detailed feedback on the student's weekly performance..."
                              value={reviewFeedback}
                              onChange={(e) => setReviewFeedback(e.target.value)}
                              rows={6}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex flex-col sm:flex-row gap-3 justify-end">
                        <Button
                          variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => handleReview("approve")}
                          disabled={isSubmittingReview}
                        >
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => handleReview("request_revision")}
                          disabled={isSubmittingReview || !reviewFeedback.trim()}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Request Revision
                        </Button>
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => handleReview("reject")}
                          disabled={isSubmittingReview || !reviewFeedback.trim()}
                        >
                          <ThumbsDown className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
