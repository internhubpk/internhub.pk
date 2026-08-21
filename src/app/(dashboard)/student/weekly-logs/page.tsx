"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  Send,
  Calendar,
  ListChecks,
  Lightbulb,
  Target,
  Timer,
  AlertCircle,
  Download,
  FileDown,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { downloadCsv, generatePdf } from "@/lib/export-helpers";
import { toast } from "@/components/shared/toast";

// Real schema columns on `weekly_logs`:
//   id, student_user_id, internship_id, student_internship_id,
//   week_number (nullable w/ default 1 after migration 0042),
//   week_start_date, week_end_date,
//   tasks_completed text[] NOT NULL DEFAULT '{}',
//   challenges text, learnings text, next_week_goals text,
//   hours_worked numeric(5,2), status weekly_log_status,
//   supervisor_feedback text, supervisor_id uuid,
//   reviewed_at timestamptz, submitted_at timestamptz,
//   created_at timestamptz, updated_at timestamptz
interface WeeklyLog {
  id: string;
  week_number: number | null;
  week_start_date: string;
  week_end_date: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "revision_required";
  tasks_completed: string[];
  challenges: string | null;
  learnings: string | null;
  next_week_goals: string | null;
  hours_worked: number | null;
  supervisor_feedback: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export default function StudentWeeklyLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WeeklyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state — mirrors the REAL `weekly_logs` columns.
  const emptyForm = {
    week_start_date: "",
    week_end_date: "",
    tasks_completed: "", // textarea; converted to text[] on submit (one per line)
    challenges: "",
    learnings: "",
    next_week_goals: "",
    hours_worked: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  // Helper: compute the current week's Monday → Sunday (YYYY-MM-DD).
  const getCurrentWeekRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    return { start: toIso(monday), end: toIso(sunday) };
  };

  useEffect(() => {
    fetchWeeklyLogs();
  }, [user]);

  async function fetchWeeklyLogs() {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();

      // Fetch weekly logs for current student using REAL columns only.
      const { data, error } = await supabase
        .from('weekly_logs')
        .select(`
          id,
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
          submitted_at,
          reviewed_at,
          created_at
        `)
        .eq('student_user_id', user.id)
        .order('week_start_date', { ascending: false });

      if (error) throw error;

      if (data) {
        const logList: WeeklyLog[] = data.map((log: any) => ({
          id: log.id,
          week_number: log.week_number ?? null,
          week_start_date: log.week_start_date || '',
          week_end_date: log.week_end_date || '',
          status: log.status || 'draft',
          tasks_completed: Array.isArray(log.tasks_completed)
            ? log.tasks_completed
            : (log.tasks_completed ? [String(log.tasks_completed)] : []),
          challenges: log.challenges,
          learnings: log.learnings,
          next_week_goals: log.next_week_goals,
          hours_worked: log.hours_worked !== null && log.hours_worked !== undefined
            ? Number(log.hours_worked) : null,
          supervisor_feedback: log.supervisor_feedback,
          submittedAt: log.submitted_at,
          reviewedAt: log.reviewed_at,
        }));
        setLogs(logList);
      }
    } catch (error) {
      console.error("Error fetching weekly logs:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmitLog = async () => {
    if (!user) return;
    setSubmitError(null);

    // Require at least tasks_completed or challenges/learnings.
    const tasksArr = formData.tasks_completed
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    if (
      tasksArr.length === 0 &&
      !formData.challenges.trim() &&
      !formData.learnings.trim()
    ) {
      setSubmitError(
        "Please describe your work — list tasks completed, challenges, or learnings."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Derive supervisor_id + internship_id from the student's active student_internship.
      // Prefer site_supervisor_id; fall back to faculty_supervisor_id.
      const { data: si, error: siError } = await supabase
        .from("student_internships")
        .select("id, internship_id, site_supervisor_id, faculty_supervisor_id, program_id, company_id, university_id, department_id")
        .eq("student_user_id", user.id)
        .in("status", ["active", "assigned"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // It's OK to not have an internship yet — weekly logs can still be created
      // (week_number has a default now; internship_id is nullable).
      const supervisorId = si?.site_supervisor_id || si?.faculty_supervisor_id || null;

      const defaultRange = getCurrentWeekRange();
      const weekStart = formData.week_start_date || defaultRange.start;
      const weekEnd = formData.week_end_date || defaultRange.end;

      // Compute week_number from week_start_date: weeks since the student's first log
      // (or just 1 for the first log). Simpler: use 1-based index for the year.
      const start = new Date(weekStart);
      const yearStart = new Date(start.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(
        ((start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1) / 7
      );

      const payload: any = {
        student_user_id: user.id,
        supervisor_id: supervisorId,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        week_number: weekNumber,
        tasks_completed: tasksArr,
        challenges: formData.challenges.trim() || null,
        learnings: formData.learnings.trim() || null,
        next_week_goals: formData.next_week_goals.trim() || null,
        hours_worked: formData.hours_worked
          ? Number(formData.hours_worked)
          : null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      };

      // Link to internship if available (optional, internship_id is nullable).
      if (si?.internship_id) {
        payload.internship_id = si.internship_id;
      }
      if (si?.id) {
        payload.student_internship_id = si.id;
      }

      const { error: insertError } = await supabase
        .from("weekly_logs")
        .insert(payload);

      if (insertError) {
        // If duplicate (student_user_id + week_start_date), update instead.
        if (insertError.code === "23505") {
          const { error: updateError } = await supabase
            .from("weekly_logs")
            .update({
              tasks_completed: tasksArr,
              challenges: payload.challenges,
              learnings: payload.learnings,
              next_week_goals: payload.next_week_goals,
              hours_worked: payload.hours_worked,
              status: "submitted",
              submitted_at: new Date().toISOString(),
              ...(supervisorId ? { supervisor_id: supervisorId } : {}),
            })
            .eq("student_user_id", user.id)
            .eq("week_start_date", weekStart);
          if (updateError) throw updateError;
        } else {
          throw insertError;
        }
      }

      // Send a notification to the supervisor (if any) so they know a log
      // is awaiting review.
      if (supervisorId) {
        try {
          await supabase.from("notifications").insert({
            user_id: supervisorId,
            sender_id: user.id,
            title: "New weekly log submitted",
            message: `Week of ${weekStart} → ${weekEnd} is awaiting your review.`,
            category: "task",
            priority: "medium",
            is_read: false,
            metadata: { week_start: weekStart, week_end: weekEnd, kind: "weekly_log" },
          });
        } catch (notifErr) {
          // Non-fatal — don't fail the submit if the notification can't be sent.
          console.warn("Could not send supervisor notification:", notifErr);
        }
      }

      setFormData(emptyForm);
      setIsDialogOpen(false);
      await fetchWeeklyLogs();
    } catch (error: any) {
      console.error("Error submitting log:", error);
      setSubmitError(error?.message || "Failed to submit log. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingWeeks = logs.filter(
    (log) => log.status === "submitted" || log.status === "draft"
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6 lg:px-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-12" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PageHeader
              title="Weekly Logs"
              description="Track your weekly internship activities and progress"
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      if (logs.length === 0) {
                        toast.info("No Data", { description: "No weekly logs to export." });
                        return;
                      }
                      downloadCsv(
                        `weekly-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                        [
                          "Week Number",
                          "Week Start",
                          "Week End",
                          "Status",
                          "Hours Worked",
                          "Tasks Completed",
                          "Challenges",
                          "Learnings",
                          "Next Week Goals",
                          "Supervisor Feedback",
                          "Submitted At",
                        ],
                        logs.map((l) => [
                          l.week_number ?? "",
                          l.week_start_date,
                          l.week_end_date,
                          l.status,
                          l.hours_worked ?? "",
                          (l.tasks_completed || []).join("; "),
                          l.challenges || "",
                          l.learnings || "",
                          l.next_week_goals || "",
                          l.supervisor_feedback || "",
                          l.submittedAt || "",
                        ])
                      );
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Submit Log
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Submit Weekly Log</DialogTitle>
                      <DialogDescription>
                        Defaults to the current week (Mon–Sun). Adjust the dates if needed.
                        One task per line.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Week Start Date</label>
                          <Input
                            type="date"
                            value={formData.week_start_date || getCurrentWeekRange().start}
                            onChange={(e) => setFormData({ ...formData, week_start_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Week End Date</label>
                          <Input
                            type="date"
                            value={formData.week_end_date || getCurrentWeekRange().end}
                            onChange={(e) => setFormData({ ...formData, week_end_date: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                          <ListChecks className="h-4 w-4" /> Tasks Completed (one per line)
                        </label>
                        <Textarea
                          placeholder={"Built login page\nFixed bug in dashboard\nWrote unit tests"}
                          value={formData.tasks_completed}
                          onChange={(e) => setFormData({ ...formData, tasks_completed: e.target.value })}
                          rows={4}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" /> Challenges Faced
                        </label>
                        <Textarea
                          placeholder="Any obstacles or challenges you encountered..."
                          value={formData.challenges}
                          onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                          <Lightbulb className="h-4 w-4" /> Learnings
                        </label>
                        <Textarea
                          placeholder="Key takeaways and what you learned this week..."
                          value={formData.learnings}
                          onChange={(e) => setFormData({ ...formData, learnings: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                          <Target className="h-4 w-4" /> Goals for Next Week
                        </label>
                        <Textarea
                          placeholder="What you plan to work on next week..."
                          value={formData.next_week_goals}
                          onChange={(e) => setFormData({ ...formData, next_week_goals: e.target.value })}
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                          <Timer className="h-4 w-4" /> Hours Worked
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="40"
                          value={formData.hours_worked}
                          onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
                        />
                      </div>

                      {submitError && (
                        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
                          {submitError}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                          Cancel
                        </Button>
                        <Button onClick={handleSubmitLog} className="gap-2" disabled={isSubmitting}>
                          {isSubmitting ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {isSubmitting ? "Submitting..." : "Submit Log"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              }
            />
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6"
        >
          <StatCard label="Total Submitted" value={logs.filter((l) => l.submittedAt).length} icon={FileText} variant="info" />
          <StatCard label="Approved" value={logs.filter((l) => l.status === "approved").length} icon={CheckCircle2} variant="success" />
          <StatCard label="Pending" value={pendingWeeks.length} icon={Clock} variant="warning" />
          <StatCard
            label="Hours Logged"
            value={logs.reduce((acc, l) => acc + (l.hours_worked || 0), 0).toFixed(1)}
            icon={Timer}
            variant="default"
          />
        </motion.div>

        {/* Weekly Logs List */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No weekly logs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Submit Log" above to record your first weekly entry.
                </p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card className="transition-all hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {log.week_number ? `Week ${log.week_number} · ` : ""}
                          {log.week_start_date
                            ? new Date(log.week_start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                            : "Week"}
                          {log.week_end_date
                            ? ` – ${new Date(log.week_end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                            : ""}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {log.week_start_date} - {log.week_end_date}
                          {log.hours_worked !== null && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Timer className="h-3 w-3" /> {log.hours_worked}h
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={log.status} />
                        {log.submittedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.submittedAt).toLocaleDateString()}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-7"
                          title="Download PDF"
                          onClick={() => {
                            generatePdf(
                              {
                                title: `Weekly Log — Week ${log.week_number ?? ""}`,
                                subtitle: `${log.week_start_date} → ${log.week_end_date}`,
                                metadata: [
                                  { label: "Status", value: log.status },
                                  { label: "Hours Worked", value: String(log.hours_worked ?? "—") },
                                  { label: "Submitted At", value: log.submittedAt ? new Date(log.submittedAt).toLocaleString() : "—" },
                                  { label: "Reviewed At", value: log.reviewedAt ? new Date(log.reviewedAt).toLocaleString() : "—" },
                                ],
                                sections: [
                                  {
                                    title: "Tasks Completed",
                                    bullets: log.tasks_completed && log.tasks_completed.length > 0 ? log.tasks_completed : ["(no tasks recorded)"],
                                  },
                                  {
                                    title: "Challenges Faced",
                                    lines: [log.challenges || "(none recorded)"],
                                  },
                                  {
                                    title: "Learnings",
                                    lines: [log.learnings || "(none recorded)"],
                                  },
                                  {
                                    title: "Goals for Next Week",
                                    lines: [log.next_week_goals || "(none recorded)"],
                                  },
                                  {
                                    title: "Supervisor Feedback",
                                    lines: [log.supervisor_feedback || "(no feedback yet)"],
                                  },
                                ],
                                footer: `InternHub.pk — Weekly Log exported on ${new Date().toLocaleString()}`,
                              },
                              `weekly-log-week-${log.week_number ?? log.week_start_date}.pdf`
                            );
                          }}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    {log.tasks_completed && log.tasks_completed.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                          <ListChecks className="h-4 w-4" /> Tasks Completed
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {log.tasks_completed.map((task, i) => (
                            <li key={i}>{task}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {log.challenges && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" /> Challenges
                        </h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges}</p>
                      </div>
                    )}

                    {log.learnings && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                          <Lightbulb className="h-4 w-4" /> Learnings
                        </h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learnings}</p>
                      </div>
                    )}

                    {log.next_week_goals && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                          <Target className="h-4 w-4" /> Next Week Goals
                        </h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.next_week_goals}</p>
                      </div>
                    )}

                    {log.supervisor_feedback && (
                      <div className="pt-2 border-t">
                        <h4 className="text-sm font-semibold mb-1">Supervisor Feedback:</h4>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                          {log.supervisor_feedback}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
