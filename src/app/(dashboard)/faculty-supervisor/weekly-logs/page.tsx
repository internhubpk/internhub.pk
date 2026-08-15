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
  PenTool,
  AlertCircle,
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SignaturePad } from "@/components/supervisors/signature-pad";

interface WeeklyLog {
  id: string;
  student_name: string;
  student_user_id: string;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  hours_worked: number;
  status: "draft" | "submitted" | "approved" | "rejected" | "revision_required" | "site_signed" | "faculty_signed";
  submitted_at?: string;
  // Review-only fields (populated when a log is opened in the dialog)
  tasks_completed?: string[];
  challenges?: string;
  learnings?: string;
  supervisor_feedback?: string;
  // New signature / evidence / program fields (migration 0058)
  program_name?: string | null;
  department_name?: string | null;
  university_logo_url?: string | null;
  weekly_activities?: any[] | null;
  learning_outcomes?: string | null;
  challenges_solutions?: string | null;
  supporting_evidence?: any[] | null;
  student_signature_url?: string | null;
  student_signed_at?: string | null;
  site_supervisor_signature_url?: string | null;
  site_supervisor_remarks?: string | null;
  site_supervisor_signed_at?: string | null;
  faculty_supervisor_signature_url?: string | null;
  faculty_supervisor_remarks?: string | null;
  faculty_supervisor_signed_at?: string | null;
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

  // Sign dialog state (new signature-based approval flow)
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signLog, setSignLog] = useState<WeeklyLog | null>(null);
  const [signRemarks, setSignRemarks] = useState("");
  const [signSignatureData, setSignSignatureData] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    async function fetchLogs() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Get this supervisor's assigned students via THREE-PATH UNION (see
        // faculty-supervisor/page.tsx for full rationale).
        const { data: directSIs } = await supabase
          .from("student_internships")
          .select("student_user_id")
          .eq("faculty_supervisor_id", user.id);

        const { data: preInternshipStudents } = await supabase
          .from("students")
          .select("user_id")
          .eq("faculty_supervisor_id", user.id);

        const { data: defaultPrograms } = await supabase
          .from("programs")
          .select("id")
          .eq("default_faculty_supervisor_id", user.id);
        const defaultProgramIds = (defaultPrograms || []).map((p) => p.id);
        let programStudentIds: string[] = [];
        if (defaultProgramIds.length > 0) {
          const { data: programStudents } = await supabase
            .from("students")
            .select("user_id")
            .in("program_id", defaultProgramIds);
          programStudentIds = (programStudents || []).map((s) => s.user_id);
        }

        const studentIds = Array.from(
          new Set([
            ...((directSIs || []).map((a: any) => a.student_user_id)),
            ...((preInternshipStudents || []).map((s: any) => s.user_id)),
            ...programStudentIds,
          ].filter(Boolean))
        );

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
            student_user_id,
            tasks_completed,
            challenges,
            challenges_solutions,
            learnings,
            learning_outcomes,
            next_week_goals,
            supervisor_feedback,
            program_name,
            department_name,
            university_logo_url,
            weekly_activities,
            supporting_evidence,
            student_signature_url,
            student_signed_at,
            site_supervisor_signature_url,
            site_supervisor_remarks,
            site_supervisor_signed_at,
            faculty_supervisor_signature_url,
            faculty_supervisor_remarks,
            faculty_supervisor_signed_at,
            profiles:student_user_id(first_name, last_name, email, student_id_number)
          `)
          .in("student_user_id", studentIds)
          .order("week_start_date", { ascending: false });

        if (error) throw error;

        const logList: WeeklyLog[] = (weeklyLogs || []).map((log: any) => ({
          id: log.id,
          student_user_id: log.student_user_id,
          student_name:
            `${log.profiles?.first_name || ""} ${log.profiles?.last_name || ""}`.trim() ||
            "Unknown Student",
          week_number: log.week_number,
          week_start_date: log.week_start_date,
          week_end_date: log.week_end_date,
          hours_worked: log.hours_worked || 0,
          status: log.status,
          submitted_at: log.submitted_at,
          tasks_completed: Array.isArray(log.tasks_completed) ? log.tasks_completed : [],
          challenges: log.challenges,
          learnings: log.learnings,
          supervisor_feedback: log.supervisor_feedback,
          program_name: log.program_name ?? null,
          department_name: log.department_name ?? null,
          university_logo_url: log.university_logo_url ?? null,
          weekly_activities: log.weekly_activities ?? null,
          learning_outcomes: log.learning_outcomes ?? null,
          challenges_solutions: log.challenges_solutions ?? null,
          supporting_evidence: log.supporting_evidence ?? null,
          student_signature_url: log.student_signature_url ?? null,
          student_signed_at: log.student_signed_at ?? null,
          site_supervisor_signature_url: log.site_supervisor_signature_url ?? null,
          site_supervisor_remarks: log.site_supervisor_remarks ?? null,
          site_supervisor_signed_at: log.site_supervisor_signed_at ?? null,
          faculty_supervisor_signature_url: log.faculty_supervisor_signature_url ?? null,
          faculty_supervisor_remarks: log.faculty_supervisor_remarks ?? null,
          faculty_supervisor_signed_at: log.faculty_supervisor_signed_at ?? null,
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
    setReviewFeedback(log.supervisor_feedback || log.faculty_supervisor_remarks || "");
    setIsReviewOpen(true);
  };

  // ----- Sign & Approve flow (new) -----
  function openSignDialog(log: WeeklyLog) {
    setSignLog(log);
    setSignRemarks(log.faculty_supervisor_remarks || log.supervisor_feedback || reviewFeedback || "");
    setSignSignatureData(null);
    setSignDialogOpen(true);
  }

  function closeSignDialog() {
    setSignDialogOpen(false);
    setSignLog(null);
    setSignRemarks("");
    setSignSignatureData(null);
  }

  function dataUrlToFile(dataUrl: string, filename: string): File {
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] || "image/png";
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }

  async function handleSign() {
    if (!signLog) return;
    if (!signSignatureData) {
      toast.error("Signature required", { description: "Please draw or type your signature before signing." });
      return;
    }
    setIsSigning(true);
    try {
      const sigFile = dataUrlToFile(signSignatureData, `faculty_signature_${signLog.id}.png`);
      const fd = new FormData();
      fd.append("file", sigFile);
      fd.append("remarks", signRemarks);
      const res = await fetch(`/api/faculty-supervisor/weekly-logs/${signLog.id}/sign`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const updated = json.data;
      toast.success(json.message?.includes("fully") ? "Fully Approved" : "Signed", { description: json.message || "Weekly log signed successfully." });
      setLogs((prev) =>
        prev.map((l) =>
          l.id === signLog.id
            ? {
                ...l,
                status: updated.status,
                faculty_supervisor_signature_url: updated.faculty_supervisor_signature_url,
                faculty_supervisor_remarks: updated.faculty_supervisor_remarks,
                faculty_supervisor_signed_at: updated.faculty_supervisor_signed_at,
                supervisor_feedback: updated.faculty_supervisor_remarks || l.supervisor_feedback,
              }
            : l
        )
      );
      closeSignDialog();
      setIsReviewOpen(false);
    } catch (err: any) {
      toast.error("Failed to sign", { description: err.message || "Please try again." });
    } finally {
      setIsSigning(false);
    }
  }

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

      const actionLabel =
        action === "approve" ? "Log approved"
        : action === "reject" ? "Log rejected"
        : "Log flagged for revision";
      const actionDesc =
        action === "approve" ? "The student has been notified."
        : action === "reject" ? "The student has been notified."
        : "The student has been asked to revise and resubmit.";
      toast.success(actionLabel, { description: actionDesc });

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
      toast.error("Failed to review weekly log", { description: error instanceof Error ? error.message : "Please try again." });
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
          <Button variant="outline" onClick={() => window.print()}>
            <Calendar className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pending Review" value={logs.filter(l => l.status === "submitted" || l.status === "site_signed").length} icon={Clock} variant="warning" />
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
                <SelectItem value="site_signed">Site Signed</SelectItem>
                <SelectItem value="faculty_signed">Faculty Signed</SelectItem>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openReviewDialog(log)}
                          title="Review log"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
        <DialogContent className="max-w-2xl">
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

              <DialogBody className="space-y-4">
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

                {/* Already-signed status banners */}
                {selectedLog.site_supervisor_signature_url && (
                  <div className="mt-2 p-3 rounded-md border bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center gap-3">
                    <img
                      src={selectedLog.site_supervisor_signature_url}
                      alt="Site supervisor signature"
                      className="h-12 w-auto object-contain bg-white rounded p-1 border"
                    />
                    <div className="text-xs">
                      <p className="font-medium text-emerald-800 dark:text-emerald-300">
                        Site supervisor signed on {selectedLog.site_supervisor_signed_at
                          ? new Date(selectedLog.site_supervisor_signed_at).toLocaleDateString()
                          : "—"}
                      </p>
                      {selectedLog.site_supervisor_remarks && (
                        <p className="text-muted-foreground mt-0.5">Remarks: {selectedLog.site_supervisor_remarks}</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedLog.faculty_supervisor_signature_url && (
                  <div className="mt-2 p-3 rounded-md border bg-purple-50/40 dark:bg-purple-950/20 flex items-center gap-3">
                    <img
                      src={selectedLog.faculty_supervisor_signature_url}
                      alt="Faculty signature"
                      className="h-12 w-auto object-contain bg-white rounded p-1 border"
                    />
                    <div className="text-xs">
                      <p className="font-medium text-purple-800 dark:text-purple-300">
                        You signed this report on {selectedLog.faculty_supervisor_signed_at
                          ? new Date(selectedLog.faculty_supervisor_signed_at).toLocaleDateString()
                          : "—"}
                      </p>
                      {selectedLog.faculty_supervisor_remarks && (
                        <p className="text-muted-foreground mt-0.5">Remarks: {selectedLog.faculty_supervisor_remarks}</p>
                      )}
                    </div>
                  </div>
                )}
              </DialogBody>

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
                  disabled={isSubmitting || (selectedLog.status !== "submitted" && selectedLog.status !== "site_signed")}
                >
                  <Clock className="h-4 w-4" /> Request Revision
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => handleReview("reject")}
                  disabled={isSubmitting || (selectedLog.status !== "submitted" && selectedLog.status !== "site_signed")}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => openSignDialog(selectedLog)}
                  disabled={isSubmitting || isSigning}
                >
                  <PenTool className="h-4 w-4" />
                  Sign & Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* SIGN DIALOG (new)                                            */}
      {/* ============================================================ */}
      <Dialog open={signDialogOpen} onOpenChange={(o) => !o && closeSignDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sign & Approve Weekly Report</DialogTitle>
            <DialogDescription>
              {signLog && (
                <>
                  Week {signLog.week_number} for {signLog.student_name}
                  {" — "}
                  {new Date(signLog.week_start_date).toLocaleDateString()} → {new Date(signLog.week_end_date).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {signLog && (
              <div className="p-3 rounded-md border bg-muted/30 text-xs space-y-1">
                <p><span className="font-medium">Student:</span> {signLog.student_name}</p>
                <p><span className="font-medium">Program:</span> {signLog.program_name || "—"}</p>
                <p><span className="font-medium">Department:</span> {signLog.department_name || "—"}</p>
                <p><span className="font-medium">Hours:</span> {signLog.hours_worked ?? "—"}</p>
                {signLog.student_signature_url && (
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Student signed:</span>
                    <img src={signLog.student_signature_url} alt="Student signature" className="h-8 w-auto bg-white border rounded p-0.5" />
                  </p>
                )}
                {signLog.site_supervisor_signature_url && (
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Site supervisor signed:</span>
                    <img src={signLog.site_supervisor_signature_url} alt="Site supervisor signature" className="h-8 w-auto bg-white border rounded p-0.5" />
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="sign-remarks">Faculty Supervisor Remarks (optional)</Label>
              <Textarea
                id="sign-remarks"
                rows={4}
                value={signRemarks}
                onChange={(e) => setSignRemarks(e.target.value)}
                placeholder="Add remarks about the student's performance this week..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Signature</Label>
              <SignaturePad
                onSignatureChange={setSignSignatureData}
                value={signSignatureData}
                label=""
                showDownload={false}
              />
              {!signSignatureData && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Please draw or type your signature to sign off.
                </p>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={closeSignDialog} disabled={isSigning}>
              Cancel
            </Button>
            <Button onClick={handleSign} disabled={isSigning || !signSignatureData}>
              {isSigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4 mr-2" />
                  Sign & Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
