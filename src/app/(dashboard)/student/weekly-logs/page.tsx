"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Printer,
  Sun,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DailyEntry {
  day_of_week: number;
  day_name: string;
  entry_date: string;
  tasks_performed: string;
  hours_worked: string;
  is_holiday: boolean;
  holiday_name?: string;
  notes?: string;
}

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  end_date: string | null;
  is_active: boolean;
  restrict_submissions: boolean;
}

interface WeeklyLog {
  id: string;
  week_number: number | null;
  week_start_date: string;
  week_end_date: string;
  status: string;
  tasks_completed: string[];
  challenges: string | null;
  learnings: string | null;
  next_week_goals: string | null;
  hours_worked: number | null;
  supervisor_feedback: string | null;
  learning_outcomes: string | null;
  challenges_solutions: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  daily_entries?: any[];
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function StudentWeeklyLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WeeklyLog[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [weekFromDate, setWeekFromDate] = useState("");
  const [weekToDate, setWeekToDate] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState("");
  const [challengesSolutions, setChallengesSolutions] = useState("");
  const [nextWeekGoals, setNextWeekGoals] = useState("");

  const isHolidayDate = useCallback(
    (dateStr: string): { isHoliday: boolean; name?: string } => {
      if (!dateStr) return { isHoliday: false };
      const d = new Date(dateStr + "T00:00:00");
      for (const h of holidays) {
        const hStart = new Date(h.holiday_date + "T00:00:00");
        const hEnd = h.end_date ? new Date(h.end_date + "T00:00:00") : hStart;
        if (d >= hStart && d <= hEnd) return { isHoliday: true, name: h.name };
      }
      return { isHoliday: false };
    },
    [holidays]
  );

  const generateDayRows = useCallback(
    (fromDate: string, toDate: string): DailyEntry[] => {
      if (!fromDate) return [];
      const start = new Date(fromDate + "T00:00:00");
      const end = toDate ? new Date(toDate + "T00:00:00") : new Date(start);
      if (!toDate) end.setDate(end.getDate() + 5);

      const rows: DailyEntry[] = [];
      const current = new Date(start);
      while (current <= end) {
        const dow = current.getDay();
        if (dow !== 0) {
          const dateStr = current.toISOString().slice(0, 10);
          const { isHoliday, name: holidayName } = isHolidayDate(dateStr);
          rows.push({
            day_of_week: dow,
            day_name: DAY_NAMES[dow - 1] || ("Day " + dow),
            entry_date: dateStr,
            tasks_performed: "",
            hours_worked: "",
            is_holiday: isHoliday,
            holiday_name: holidayName,
          });
        }
        current.setDate(current.getDate() + 1);
      }
      return rows;
    },
    [isHolidayDate]
  );

  useEffect(() => {
    if (weekFromDate) {
      setDailyEntries(generateDayRows(weekFromDate, weekToDate));
    }
  }, [weekFromDate, weekToDate, generateDayRows]);

  useEffect(() => {
    if (isDialogOpen) {
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      setWeekFromDate(fmt(monday));
      setWeekToDate(fmt(saturday));
      setLearningOutcomes("");
      setChallengesSolutions("");
      setNextWeekGoals("");
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (weekFromDate) {
      const start = new Date(weekFromDate + "T00:00:00");
      const yearStart = new Date(start.getFullYear(), 0, 1);
      const wkNum = Math.ceil(
        ((start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1) / 7
      );
      setWeekNumber(wkNum);
    }
  }, [weekFromDate]);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    fetchWeeklyLogs();
  }, [user]);

  async function fetchWeeklyLogs() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/student/weekly-logs");
      const json = await res.json();
      if (json.success && json.data) {
        setLogs(
          (json.data.logs || []).map((log: any) => ({
            id: log.id,
            week_number: log.week_number ?? null,
            week_start_date: log.week_start_date || "",
            week_end_date: log.week_end_date || "",
            status: log.status || "draft",
            tasks_completed: Array.isArray(log.tasks_completed) ? log.tasks_completed : [],
            challenges: log.challenges,
            learnings: log.learnings,
            next_week_goals: log.next_week_goals,
            hours_worked: log.hours_worked != null ? Number(log.hours_worked) : null,
            supervisor_feedback: log.supervisor_feedback,
            learning_outcomes: log.learning_outcomes,
            challenges_solutions: log.challenges_solutions,
            submittedAt: log.submitted_at,
            reviewedAt: log.reviewed_at,
            daily_entries: log.daily_entries || [],
          }))
        );
        setHolidays(json.data.holidays || []);
      }
    } catch (err) {
      console.error("Error fetching weekly logs:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const workingDays = dailyEntries.filter((de) => !de.is_holiday);
      const hasAnyWork = workingDays.some((de) => de.tasks_performed.trim());
      if (!hasAnyWork && !learningOutcomes.trim() && !challengesSolutions.trim()) {
        toast.error("Validation Error", { description: "Please describe your work for at least one day." });
        setIsSubmitting(false);
        return;
      }
      const res = await fetch("/api/student/weekly-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start_date: weekFromDate,
          week_end_date: weekToDate || weekFromDate,
          week_number: weekNumber,
          daily_entries: dailyEntries.map((de) => ({
            day_of_week: de.day_of_week,
            entry_date: de.entry_date,
            tasks_performed: de.is_holiday ? "" : de.tasks_performed,
            hours_worked: de.is_holiday ? 0 : Number(de.hours_worked) || 0,
            is_holiday: de.is_holiday,
            notes: de.notes || null,
          })),
          learning_outcomes: learningOutcomes.trim() || null,
          challenges_solutions: challengesSolutions.trim() || null,
          next_week_goals: nextWeekGoals.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Weekly Log Submitted", { description: json.message || ("Week " + weekNumber + " log has been submitted.") });
        setIsDialogOpen(false);
        await fetchWeeklyLogs();
      } else {
        toast.error("Submit Failed", { description: (json.error && typeof json.error === "object" ? json.error.message : json.error) || "Failed to submit weekly log." });
      }
    } catch {
      toast.error("Error", { description: "Failed to submit weekly log. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalHoursWorked = useMemo(
    () => dailyEntries.filter((de) => !de.is_holiday).reduce((sum, de) => sum + (Number(de.hours_worked) || 0), 0),
    [dailyEntries]
  );

  const pendingWeeks = logs.filter((log) => log.status === "submitted" || log.status === "draft");

  const updateDayEntry = (index: number, field: keyof DailyEntry, value: string | boolean) => {
    setDailyEntries((prev) => prev.map((de, i) => (i === index ? { ...de, [field]: value } : de)));
  };

  const handleExportCsv = () => {
    if (logs.length === 0) {
      toast.info("No Data", { description: "No weekly logs to export." });
      return;
    }
    const fileName = "weekly-logs-" + new Date().toISOString().slice(0, 10) + ".csv";
    const header = "Week,From,To,Status,Hours,Daily Entries,Challenges,Learnings,Goals,Supervisor Feedback,Submitted";
    const rows: string[] = [header];
    for (const l of logs) {
      const dailyStr = (l.daily_entries || [])
        .map((d: any) => (d.day_name || "") + ": " + (d.tasks_performed || "(holiday)") + " (" + (d.hours_worked || 0) + "h)")
        .join("; ");
      rows.push(
        [l.week_number ?? "", l.week_start_date, l.week_end_date, l.status, l.hours_worked ?? "",
          '"' + dailyStr + '"',
          '"' + (l.challenges_solutions || l.challenges || "") + '"',
          '"' + (l.learning_outcomes || l.learnings || "") + '"',
          '"' + (l.next_week_goals || "") + '"',
          '"' + (l.supervisor_feedback || "") + '"',
          l.submittedAt || "",
        ].join(",")
      );
    }
    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadWord = async (log: WeeklyLog) => {
    try {
      const res = await fetch("/api/reports/weekly-logs/" + log.id + "/generate", { method: "POST" });
      const json = await res.json();
      if (json.success && json.data && json.data.downloadUrl) {
        const dlRes = await fetch(json.data.downloadUrl);
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "weekly-report-week-" + (log.week_number || log.week_start_date) + ".docx";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Downloaded", { description: "Weekly report downloaded." });
        } else {
          toast.error("Download Failed", { description: "Could not download the report." });
        }
      } else {
        toast.error("Generation Failed", { description: (json.error && typeof json.error === "object" ? json.error.message : json.error) || "Could not generate report." });
      }
    } catch {
      toast.error("Error", { description: "Failed to generate report." });
    }
  };

  // ------------------------------------------------------------------------
  // Loading skeleton
  // ------------------------------------------------------------------------
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
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12" /></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <PageHeader
              title="Weekly Logs"
              description="Track your weekly internship activities day by day"
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleExportCsv}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Submit Weekly Log
                      </Button>
                    </DialogTrigger>

                    {/* ============ DAY-BY-DAY FORM DIALOG ============ */}
                    <DialogContent className="sm:max-w-[800px] max-h-[92vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" />
                          Submit Weekly Log
                        </DialogTitle>
                        <DialogDescription>
                          Fill in your daily activities for the week. Holiday days are auto-detected and disabled.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-5 py-2">
                        {/* From / To Date Range */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="wl-from" className="text-sm font-medium">From</Label>
                            <Input id="wl-from" type="date" value={weekFromDate} onChange={(e) => setWeekFromDate(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="wl-to" className="text-sm font-medium">To</Label>
                            <Input id="wl-to" type="date" value={weekToDate} onChange={(e) => setWeekToDate(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Week Number</Label>
                            <Input type="number" min="1" value={weekNumber} disabled className="bg-muted" />
                          </div>
                        </div>

                        {/* Day-by-Day Entries */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <ListChecks className="h-4 w-4" />
                              Daily Activities
                            </Label>
                            <Badge variant="outline" className="text-xs">
                              {"Total: " + totalHoursWorked.toFixed(1) + "h"}
                            </Badge>
                          </div>

                          {dailyEntries.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Select a &ldquo;From&rdquo; date to generate daily entries.
                            </p>
                          )}

                          {dailyEntries.map((de, idx) => (
                            <motion.div
                              key={de.entry_date}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className={
                                de.is_holiday
                                  ? "rounded-lg border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-3"
                                  : "rounded-lg border bg-card p-3"
                              }
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                <div className="sm:w-40 shrink-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{de.day_name}</span>
                                    {de.is_holiday && (
                                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0">
                                        <Sun className="h-3 w-3 mr-0.5" />
                                        Holiday
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{" " + formatDate(de.entry_date)}</span>
                                  {de.is_holiday && de.holiday_name && (
                                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{de.holiday_name}</span>
                                  )}
                                </div>

                                {de.is_holiday ? (
                                  <div className="flex-1 flex items-center">
                                    <span className="text-sm text-muted-foreground italic">Holiday — no entry required</span>
                                  </div>
                                ) : (
                                  <div className="flex-1 space-y-2">
                                    <Textarea
                                      placeholder="Describe tasks performed..."
                                      value={de.tasks_performed}
                                      onChange={(e) => updateDayEntry(idx, "tasks_performed", e.target.value)}
                                      rows={2}
                                      className="text-sm resize-none"
                                    />
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Hours:</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max="24"
                                        step="0.5"
                                        value={de.hours_worked}
                                        onChange={(e) => updateDayEntry(idx, "hours_worked", e.target.value)}
                                        className="w-20 h-8 text-sm"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Learning Outcomes */}
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            <Lightbulb className="h-4 w-4" />
                            Learning Outcomes / Skills Gained
                          </Label>
                          <Textarea
                            placeholder="Key learnings, new skills acquired, knowledge gained this week..."
                            value={learningOutcomes}
                            onChange={(e) => setLearningOutcomes(e.target.value)}
                            rows={3}
                          />
                        </div>

                        {/* Challenges Faced and Solutions */}
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4" />
                            Challenges Faced and Solutions
                          </Label>
                          <Textarea
                            placeholder="Obstacles encountered and how you resolved them..."
                            value={challengesSolutions}
                            onChange={(e) => setChallengesSolutions(e.target.value)}
                            rows={3}
                          />
                        </div>

                        {/* Goals for Next Week */}
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            <Target className="h-4 w-4" />
                            Goals for Next Week
                          </Label>
                          <Textarea
                            placeholder="What you plan to accomplish next week..."
                            value={nextWeekGoals}
                            onChange={(e) => setNextWeekGoals(e.target.value)}
                            rows={2}
                          />
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                            {isSubmitting ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {isSubmitting ? "Submitting..." : "Submit Weekly Log"}
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

      {/* Stats Cards */}
      <div className="container mx-auto px-4 py-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard label="Total Submitted" value={logs.filter((l) => l.submittedAt).length} icon={FileText} variant="info" />
          <StatCard label="Approved" value={logs.filter((l) => l.status === "approved").length} icon={CheckCircle2} variant="success" />
          <StatCard label="Pending" value={pendingWeeks.length} icon={Clock} variant="warning" />
          <StatCard label="Hours Logged" value={logs.reduce((acc, l) => acc + (l.hours_worked || 0), 0).toFixed(1)} icon={Timer} variant="default" />
        </motion.div>

        {/* Weekly Logs List */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No weekly logs yet</p>
                <p className="text-sm text-muted-foreground mt-1">Click &ldquo;Submit Weekly Log&rdquo; above to record your first week.</p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log, index) => {
              const isExpanded = expandedLogId === log.id;
              const hasDailyEntries = (log.daily_entries || []).length > 0;
              return (
                <motion.div key={log.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
                  <Card className="transition-all hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {log.week_number ? ("Week " + log.week_number + " \u00B7 ") : ""}
                            {formatDate(log.week_start_date)}
                            {log.week_end_date ? (" \u2013 " + formatDate(log.week_end_date)) : ""}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            {log.week_start_date} — {log.week_end_date}
                            {log.hours_worked !== null && (
                              <span className="ml-2 inline-flex items-center gap-1"><Timer className="h-3 w-3" /> {log.hours_worked}h</span>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={log.status} />
                          {log.submittedAt && <span className="text-xs text-muted-foreground">{new Date(log.submittedAt).toLocaleDateString()}</span>}
                          <Button variant="ghost" size="sm" className="gap-1.5 h-7" title="Download Word Document" onClick={() => handleDownloadWord(log)}>
                            <Printer className="h-3.5 w-3.5" />
                            Word
                          </Button>
                          {hasDailyEntries && (
                            <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {isExpanded ? "Hide" : "Details"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Expanded daily details */}
                    <AnimatePresence>
                      {isExpanded && hasDailyEntries && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <CardContent className="pt-0 space-y-3">
                            <div className="rounded-lg border overflow-hidden">
                              <div className="grid grid-cols-[120px_1fr_80px] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                <span>Day</span><span>Tasks Performed</span><span className="text-right">Hours</span>
                              </div>
                              {(log.daily_entries || []).map((de: any, i: number) => (
                                <div key={de.id || i} className={"grid grid-cols-[120px_1fr_80px] px-3 py-2 border-t " + (de.is_holiday ? "bg-amber-50/50 dark:bg-amber-950/20" : "")}>
                                  <span className="text-sm font-medium">{DAY_NAMES[(de.day_of_week || 1) - 1] || "Day"}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {de.is_holiday ? <span className="italic text-amber-600 dark:text-amber-400">Holiday{de.notes ? (" \u2014 " + de.notes) : ""}</span> : (de.tasks_performed || "\u2014")}
                                  </span>
                                  <span className="text-sm text-right">{de.is_holiday ? "\u2014" : ((de.hours_worked || 0) + "h")}</span>
                                </div>
                              ))}
                            </div>

                            {log.learning_outcomes && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Learning Outcomes</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learning_outcomes}</p>
                              </div>
                            )}
                            {log.challenges_solutions && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Challenges &amp; Solutions</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges_solutions}</p>
                              </div>
                            )}
                            {!log.learning_outcomes && log.learnings && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Learnings</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learnings}</p>
                              </div>
                            )}
                            {!log.challenges_solutions && log.challenges && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Challenges</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges}</p>
                              </div>
                            )}
                            {log.next_week_goals && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Target className="h-4 w-4" /> Next Week Goals</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.next_week_goals}</p>
                              </div>
                            )}
                            {log.supervisor_feedback && (
                              <div className="pt-2 border-t">
                                <h4 className="text-sm font-semibold mb-1">Supervisor Feedback:</h4>
                                <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{log.supervisor_feedback}</p>
                              </div>
                            )}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isExpanded && hasDailyEntries && (
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">{(log.daily_entries || []).length} daily entries &middot; Click &ldquo;Details&rdquo; to expand</p>
                      </CardContent>
                    )}

                    {/* Legacy logs without daily entries */}
                    {!hasDailyEntries && (
                      <CardContent className="pt-0 space-y-3">
                        {log.tasks_completed && log.tasks_completed.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> Tasks Completed</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">{log.tasks_completed.map((task, i) => <li key={i}>{task}</li>)}</ul>
                          </div>
                        )}
                        {log.challenges && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Challenges</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.challenges}</p>
                          </div>
                        )}
                        {log.learnings && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Learnings</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.learnings}</p>
                          </div>
                        )}
                        {log.next_week_goals && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Target className="h-4 w-4" /> Next Week Goals</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.next_week_goals}</p>
                          </div>
                        )}
                        {log.supervisor_feedback && (
                          <div className="pt-2 border-t">
                            <h4 className="text-sm font-semibold mb-1">Supervisor Feedback:</h4>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{log.supervisor_feedback}</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
