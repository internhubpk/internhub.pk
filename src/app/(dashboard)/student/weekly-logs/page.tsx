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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// Types
// `weekly_logs.status` uses the `weekly_log_status` enum
// (draft, submitted, approved, revision_required).
// Schema: id, student_user_id, supervisor_id, week_start_date, week_end_date,
// work_description, tasks_completed, challenges_faced, learnings, status,
// supervisor_feedback, reviewed_at, submitted_at, created_at, updated_at.
interface WeeklyLog {
  id: string;
  week_start_date: string;
  week_end_date: string;
  status: "draft" | "submitted" | "approved" | "revision_required";
  work_description: string | null;
  tasks_completed: string | string[] | null;
  challenges_faced: string | null;
  learnings: string | null;
  supervisor_feedback: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

// Default empty state - logs will be fetched from database
const DEFAULT_LOGS: WeeklyLog[] = [];

export default function StudentWeeklyLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WeeklyLog[]>(DEFAULT_LOGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  
  // Form state — mirrors the real `weekly_logs` columns.
  const [formData, setFormData] = useState({
    week_start_date: "",
    week_end_date: "",
    work_description: "",
    tasks_completed: "",
    challenges_faced: "",
    learnings: "",
  });

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
      
      // Fetch weekly logs for current student. Use only real columns.
      const { data, error } = await supabase
        .from('weekly_logs')
        .select('id, week_start_date, week_end_date, work_description, tasks_completed, challenges_faced, learnings, status, supervisor_feedback, submitted_at, reviewed_at, created_at')
        .eq('student_user_id', user.id)
        .order('week_start_date', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        const logList: WeeklyLog[] = data.map((log: any) => ({
          id: log.id,
          week_start_date: log.week_start_date || '',
          week_end_date: log.week_end_date || '',
          status: log.status || 'draft',
          work_description: log.work_description,
          tasks_completed: log.tasks_completed,
          challenges_faced: log.challenges_faced,
          learnings: log.learnings,
          supervisor_feedback: log.supervisor_feedback,
          submittedAt: log.submitted_at,
          reviewedAt: log.reviewed_at,
        }));
        setLogs(logList);
      }
    } catch (error) {
      console.error("Error fetching weekly logs:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmitLog = async () => {
    if (!user) return;
    // Require at least a work description or some tasks completed to submit.
    if (!formData.work_description.trim() && !formData.tasks_completed.trim()) {
      alert("Please describe your work or list the tasks you completed this week.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Derive supervisor_id from the student's active student_internship.
      // Prefer site_supervisor_id; fall back to faculty_supervisor_id.
      const { data: si, error: siError } = await supabase
        .from("student_internships")
        .select("site_supervisor_id, faculty_supervisor_id")
        .eq("student_user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (siError) {
        console.error("Error fetching student_internship for supervisor:", siError);
      }
      const supervisorId = si?.site_supervisor_id || si?.faculty_supervisor_id || null;

      // Default the week range to the current week if the user didn't pick.
      const defaultRange = getCurrentWeekRange();
      const weekStart = formData.week_start_date || defaultRange.start;
      const weekEnd = formData.week_end_date || defaultRange.end;

      const payload = {
        student_user_id: user.id,
        supervisor_id: supervisorId,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        work_description: formData.work_description.trim() || null,
        tasks_completed: formData.tasks_completed.trim() || null,
        challenges_faced: formData.challenges_faced.trim() || null,
        learnings: formData.learnings.trim() || null,
        status: "submitted" as const,
        submitted_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("weekly_logs")
        .insert(payload);

      if (insertError) throw insertError;

      // Reset form, close dialog, refresh list.
      setFormData({
        week_start_date: "",
        week_end_date: "",
        work_description: "",
        tasks_completed: "",
        challenges_faced: "",
        learnings: "",
      });
      setIsDialogOpen(false);
      await fetchWeeklyLogs();
    } catch (error) {
      console.error("Error submitting log:", error);
      alert("Failed to submit log. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingWeeks = logs.filter(log => log.status === "submitted" || log.status === "draft");

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
                      <label className="text-sm font-medium mb-2 block">Work Description</label>
                      <Textarea
                        placeholder="Summary of what you worked on this week..."
                        value={formData.work_description}
                        onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Tasks Completed</label>
                      <Textarea
                        placeholder="List the tasks you completed this week..."
                        value={formData.tasks_completed}
                        onChange={(e) => setFormData({ ...formData, tasks_completed: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Challenges Faced</label>
                      <Textarea
                        placeholder="Any obstacles or challenges you encountered..."
                        value={formData.challenges_faced}
                        onChange={(e) => setFormData({ ...formData, challenges_faced: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Learnings</label>
                      <Textarea
                        placeholder="Key takeaways and what you learned this week..."
                        value={formData.learnings}
                        onChange={(e) => setFormData({ ...formData, learnings: e.target.value })}
                        rows={3}
                      />
                    </div>

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
          <StatCard label="Total Submitted" value={logs.filter(l => l.submittedAt).length} icon={FileText} variant="info" />
          <StatCard label="Approved" value={logs.filter(l => l.status === "approved").length} icon={CheckCircle2} variant="success" />
          <StatCard label="Pending" value={pendingWeeks.length} icon={Clock} variant="warning" />
          <StatCard label="Weeks Logged" value={logs.length} icon={Calendar} variant="default" />
        </motion.div>

        {/* Weekly Logs List */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No weekly logs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your weekly logs will appear here once you start your internship
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
                          {log.week_start_date ? new Date(log.week_start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Week"}{log.week_end_date ? ` – ${new Date(log.week_end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {log.week_start_date} - {log.week_end_date}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={log.status} />
                        {log.submittedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.submittedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    {log.work_description && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Work Description:</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.work_description}</p>
                      </div>
                    )}

                    {log.tasks_completed && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Tasks Completed:</h4>
                        {Array.isArray(log.tasks_completed) ? (
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {log.tasks_completed.map((task, i) => (
                              <li key={i}>{task}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.tasks_completed}</p>
                        )}
                      </div>
                    )}

                    {log.challenges_faced && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Challenges:</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges_faced}</p>
                      </div>
                    )}

                    {log.learnings && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Learnings:</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learnings}</p>
                      </div>
                    )}

                    {log.supervisor_feedback && (
                      <div className="pt-2 border-t">
                        <h4 className="text-sm font-semibold mb-1">Supervisor Feedback:</h4>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{log.supervisor_feedback}</p>
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
