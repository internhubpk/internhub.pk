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
  DialogBody,
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
import { downloadCsv } from "@/lib/export-helpers";
import { toast } from "@/components/shared/toast";
import { SignaturePad } from "@/components/supervisors/signature-pad";
import { signatureToFile } from "@/lib/signature";

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
  status: "submitted" | "approved" | "rejected" | "revision_required" | "pending" | "late" | "site_signed" | "faculty_signed";
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
  const [signatureData, setSignatureData] = useState<string | null>(null);
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
    // Supervisor feedback is REQUIRED for every decision (the field is
    // labelled "*") — it becomes the "Supervisor Remarks" section of the
    // student's generated Word report, so approving without remarks would
    // ship an empty remarks section (bug fix 2026-08-27).
    if (!selectedLog || !reviewFeedback.trim()) {
      toast.error("Remarks Required", { description: "Please provide supervisor remarks/feedback before submitting your decision — they are included in the student's weekly report." });
      return;
    }

    setIsSubmittingReview(true);
    
    try {
      if (!selectedLog) return;

      if (action === "approve") {
        // APPROVE → sign the weekly log with the supervisor's digital
        // signature (uploaded to the signatures bucket; persisted on
        // weekly_logs.site_supervisor_signature_url) so the generated Word
        // report carries the signature image + the supervisor's name.
        // Reject / request-revision keep the plain PUT path — a signature
        // is only meaningful on approval.
        if (!signatureData) {
          toast.error("Signature Required", { description: "Please draw or type your signature before approving — it is included in the student's weekly report." });
          setIsSubmittingReview(false);
          return;
        }
        const file = await signatureToFile(signatureData, "site-supervisor-signature.png");
        if (!file) {
          toast.error("Signature Invalid", { description: "Could not read the signature image. Please redraw it and try again." });
          setIsSubmittingReview(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("remarks", reviewFeedback);
        const response = await fetch(`/api/site-supervisor/weekly-logs/${encodeURIComponent(selectedLog.id)}/sign`, {
          method: "POST",
          body: fd,
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success !== false) {
          toast.success("Log Approved & Signed", { description: "Your signature and remarks have been added to the student's weekly report." });
          setSignatureData(null);
          setSelectedLog(null);
          setReviewFeedback("");
          fetchWeeklyLogs();
        } else {
          const msg = json?.error?.message || json?.error || "Error signing the log. Please try again.";
          toast.error("Sign Failed", { description: typeof msg === "string" ? msg : "Error signing the log. Please try again." });
        }
        return;
      }

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
        // ("approve" never reaches the PUT — it returns inside the sign
        // branch above.)
        const actionText = action === "reject" ? "rejected" : "flagged for revision";
        toast.success(`Log ${actionText}`, { description: "The weekly log has been updated successfully." });
        
        // Update local state
        setLogs(prev => prev.map(log =>
          log.id === selectedLog!.id
            ? { ...log, status: action === "reject" ? "rejected" as const : "revision_required" as const, supervisorFeedback: reviewFeedback, reviewedAt: new Date().toISOString() }
            : log
        ));

        setSelectedLog(null);
        setReviewFeedback("");
        fetchWeeklyLogs();
      } else {
        toast.error("Review Failed", { description: "Error processing review. Please try again." });
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("Unexpected Error", { description: "An error occurred. Please try again." });
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

  // Download the SAME generated Word report the student downloads
  // (POST /api/reports/weekly-logs/[id]/generate → DOCX). Replaces the old
  // jsPDF one-pager (request 2026-08-27). The API authorizes the assigned
  // site supervisor.
  async function handleDownloadWord(logId: string, studentName: string, weekNumber: number) {
    try {
      const res = await fetch(`/api/reports/weekly-logs/${logId}/generate`, { method: "POST" });
      const json = await res.json();
      if (json.success && json.data?.downloadUrl) {
        const dlRes = await fetch(json.data.downloadUrl);
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `weekly-report-${studentName.replace(/\s+/g, "-").toLowerCase()}-week-${weekNumber}.docx`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Downloaded", { description: "Weekly report (Word) downloaded." });
        } else {
          toast.error("Download Failed", { description: "Could not download the report." });
        }
      } else {
        toast.error("Generation Failed", {
          description:
            (json.error && typeof json.error === "object" ? json.error.message : json.error) ||
            "Could not generate report.",
        });
      }
    } catch {
      toast.error("Error", { description: "Failed to generate report." });
    }
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
                  toast.info("No Data", { description: "No weekly logs to export." });
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
                            <Badge variant="outline" className="text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500/40">
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
                        title="Download Word Report"
                        onClick={() => handleDownloadWord(log.id, log.studentName, log.weekNumber)}
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
        <DialogContent className="sm:max-w-3xl">
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

              <DialogBody className="px-8 pb-5">
              <Tabs defaultValue="content">
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
                            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
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
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
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
                    <Card className="border-green-200 dark:border-green-500/40 bg-green-50/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-green-800 dark:text-green-300">Previous Review</CardTitle>
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

                  {(selectedLog.status === "submitted" || selectedLog.status === "faculty_signed") && (
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
                            <Label htmlFor="feedback">Supervisor Remarks *</Label>
                            <Textarea
                              id="feedback"
                              placeholder="Your remarks are included in the student's generated weekly report..."
                              value={reviewFeedback}
                              onChange={(e) => setReviewFeedback(e.target.value)}
                              rows={6}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Digital signature — REQUIRED to approve. Rendered in the
                          student's Word report under the "Industry Supervisor"
                          signature box. */}
                      <SignaturePad
                        label="Digital Signature (required to approve)"
                        onSignatureChange={setSignatureData}
                        value={signatureData}
                      />

                      <div className="flex flex-col sm:flex-row gap-3 justify-end">
                        <Button
                          variant="outline"
                          className="border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-500/15"
                          onClick={() => handleReview("approve")}
                          disabled={isSubmittingReview}
                        >
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="border-orange-300 dark:border-orange-500/40 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/15"
                          onClick={() => handleReview("request_revision")}
                          disabled={isSubmittingReview || !reviewFeedback.trim()}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Request Revision
                        </Button>
                        <Button
                          variant="outline"
                          className="border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15"
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
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
