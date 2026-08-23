"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ScrollText,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Calendar,
  Download,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { downloadCsv, generatePdf } from "@/lib/export-helpers";
import { toast } from "@/components/shared/toast";

interface WeeklyLog {
  id: string;
  student_name: string;
  student_user_id: string;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  hours_worked: number;
  status: "draft" | "submitted" | "approved" | "rejected" | "revision_required";
  submitted_at?: string;
  reviewed_at?: string;
  // Review-only fields (populated when a log is opened in the dialog)
  tasks_completed?: string[];
  challenges?: string;
  learnings?: string;
  supervisor_feedback?: string;
}

export default function FacultySupervisorWeeklyLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WeeklyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Review dialog state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WeeklyLog | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchLogs() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Get this supervisor's assigned students from BOTH sources
        // (internship-time + pre-internship). Previously only
        // student_internships.faculty_supervisor_id was checked, which missed
        // students the coordinator pre-assigned via students.faculty_supervisor_id.
        const { fetchSupervisedStudentIds } = await import("@/lib/supervised-students");
        const studentIds = await fetchSupervisedStudentIds(supabase, user.id);

        if (studentIds.length === 0) {
          setLogs([]);
          return;
        }

        const { data: weeklyLogs, error } = await supabase
          .from("weekly_logs")
          .select(`
            id,
            week_number,
            week_start_date,
            week_end_date,
            hours_worked,
            status,
            submitted_at,
            reviewed_at,
            student_user_id,
            tasks_completed,
            challenges,
            learnings,
            supervisor_feedback,
            student_profile:student_user_id(full_name, email)
          `)
          .in("student_user_id", studentIds)
          .order("week_start_date", { ascending: false });

        if (error) throw error;

        const logList: WeeklyLog[] = (weeklyLogs || []).map((log: any) => ({
          id: log.id,
          student_user_id: log.student_user_id,
          student_name:
            log.student_profile?.full_name ||
            "Unknown Student",
          week_number: log.week_number,
          week_start_date: log.week_start_date,
          week_end_date: log.week_end_date,
          hours_worked: log.hours_worked || 0,
          status: log.status,
          submitted_at: log.submitted_at,
          reviewed_at: log.reviewed_at,
          tasks_completed: Array.isArray(log.tasks_completed) ? log.tasks_completed : [],
          challenges: log.challenges,
          learnings: log.learnings,
          supervisor_feedback: log.supervisor_feedback,
        }));

        setLogs(logList);
      } catch (error) {
        console.error("Error fetching weekly logs:", error);
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLogs();
  }, [user]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      const matchesSearch = log.student_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [logs, statusFilter, searchTerm]);

  const openReviewDialog = (log: WeeklyLog) => {
    setSelectedLog(log);
    setReviewFeedback(log.supervisor_feedback || "");
    setIsReviewOpen(true);
  };

  const handleReview = async (action: "approve" | "reject" | "request_revision") => {
    if (!user || !selectedLog) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      // weekly_log_status enum: draft, submitted, approved, rejected, revision_required
      const newStatus =
        action === "approve"
          ? "approved"
          : action === "reject"
          ? "rejected"
          : "revision_required";

      const { error } = await supabase
        .from("weekly_logs")
        .update({
          status: newStatus,
          supervisor_feedback: reviewFeedback || null,
          reviewed_at: new Date().toISOString(),
          supervisor_id: user.id,
        })
        .eq("id", selectedLog.id);

      if (error) throw error;

      setLogs((prev) =>
        prev.map((l) =>
          l.id === selectedLog.id
            ? { ...l, status: newStatus, supervisor_feedback: reviewFeedback || undefined }
            : l
        )
      );
      setIsReviewOpen(false);
      setSelectedLog(null);
      setReviewFeedback("");
    } catch (error) {
      console.error("Error reviewing weekly log:", error);
      toast.error("Update Failed", { description: "Failed to update weekly log. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Weekly Logs"
        description="Review and approve student weekly logs"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (filteredLogs.length === 0) {
                  toast.info("No Data", { description: "No weekly logs to export." });
                  return;
                }
                downloadCsv(
                  `faculty-weekly-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                  [
                    "Student",
                    "Week Number",
                    "Week Start",
                    "Week End",
                    "Hours Worked",
                    "Status",
                    "Submitted At",
                    "Tasks Completed",
                    "Challenges",
                    "Learnings",
                    "Supervisor Feedback",
                  ],
                  filteredLogs.map((l) => [
                    l.student_name,
                    l.week_number,
                    l.week_start_date,
                    l.week_end_date,
                    l.hours_worked,
                    l.status,
                    l.submitted_at || "",
                    (l.tasks_completed || []).join("; "),
                    l.challenges || "",
                    l.learnings || "",
                    l.supervisor_feedback || "",
                  ])
                );
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pending Review" value={logs.filter(l => l.status === "submitted").length} icon={Clock} variant="warning" />
        <StatCard label="Approved" value={logs.filter(l => l.status === "approved").length} icon={CheckCircle} variant="success" />
        <StatCard label="Rejected" value={logs.filter(l => l.status === "rejected").length} icon={XCircle} variant="danger" />
        <StatCard label="Total Hours" value={logs.reduce((sum, l) => sum + (l.hours_worked || 0), 0)} icon={ScrollText} variant="info" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="revision_required">Revision Required</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Weekly Logs</CardTitle>
          <CardDescription>Logs submitted by your assigned students</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No weekly logs yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Students will submit their weekly logs here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.student_name}</TableCell>
                      <TableCell>Week {log.week_number}</TableCell>
                      <TableCell>{log.week_start_date} - {log.week_end_date}</TableCell>
                      <TableCell>{log.hours_worked}h</TableCell>
                      <TableCell><StatusBadge status={log.status} /></TableCell>
                      <TableCell>{log.submitted_at || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReviewDialog(log)}
                            title="Review log"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download PDF"
                            onClick={() => {
                              generatePdf(
                                {
                                  title: `Weekly Log — ${log.student_name} — Week ${log.week_number}`,
                                  subtitle: `${log.week_start_date} → ${log.week_end_date}`,
                                  metadata: [
                                    { label: "Student", value: log.student_name },
                                    { label: "Status", value: log.status },
                                    { label: "Hours Worked", value: String(log.hours_worked ?? "—") },
                                    { label: "Submitted At", value: log.submitted_at ? new Date(log.submitted_at).toLocaleString() : "—" },
                                  ],
                                  sections: [
                                    {
                                      title: "Tasks Completed",
                                      bullets: log.tasks_completed && log.tasks_completed.length > 0 ? log.tasks_completed : ["(no tasks recorded)"],
                                    },
                                    { title: "Challenges", lines: [log.challenges || "(none)"] },
                                    { title: "Learnings", lines: [log.learnings || "(none)"] },
                                    { title: "Supervisor Feedback", lines: [log.supervisor_feedback || "(none)"] },
                                  ],
                                  footer: `CareerStep — Weekly Log exported on ${new Date().toLocaleString()}`,
                                },
                                `weekly-log-${log.student_name.replace(/\s+/g, "-").toLowerCase()}-week-${log.week_number}.pdf`
                              );
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5" />
                  Weekly Log — Week {selectedLog.week_number}
                </DialogTitle>
                <DialogDescription>
                  {selectedLog.student_name} • {selectedLog.week_start_date} to {selectedLog.week_end_date}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Hours Worked</p>
                      <p className="text-2xl font-bold text-blue-600">{selectedLog.hours_worked}h</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <div className="mt-1 flex justify-center">
                        <StatusBadge status={selectedLog.status} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Tasks Completed</Label>
                    {selectedLog.tasks_completed && selectedLog.tasks_completed.length > 0 ? (
                      <ul className="mt-1 list-disc list-inside text-sm space-y-1">
                        {selectedLog.tasks_completed.map((task, idx) => (
                          <li key={idx}>{task}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">No tasks listed.</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Challenges</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {selectedLog.challenges || "None reported."}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Learnings</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {selectedLog.learnings || "None reported."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback">Supervisor Feedback</Label>
                  <Textarea
                    id="feedback"
                    placeholder="Provide feedback to the student (optional for approve, recommended for reject/revision)..."
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsReviewOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => handleReview("request_revision")}
                  disabled={isSubmitting || selectedLog.status !== "submitted"}
                >
                  <Clock className="h-4 w-4" /> Request Revision
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => handleReview("reject")}
                  disabled={isSubmitting || selectedLog.status !== "submitted"}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleReview("approve")}
                  disabled={isSubmitting || selectedLog.status !== "submitted"}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
