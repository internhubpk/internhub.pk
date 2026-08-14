"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertCircle, RefreshCw, Loader2, CheckCircle2, Clock,
  ClipboardList, Star, Calendar, Award, ArrowRight, Send,
  Plus, FileText, ListTodo,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// ---------------------------------------------------------------------------
// HEC-aligned evaluation criteria (stored as keys in evaluations.scores)
// Sourced from COMSATS Lahore supervisor evaluation form + HEC PLL guidelines.
// Configurable — universities can adjust by changing scores keys.
// ---------------------------------------------------------------------------
const EVAL_CRITERIA: Array<{ key: string; label: string; description: string }> = [
  { key: "technical_knowledge", label: "Technical Knowledge", description: "Application of theory to practice" },
  { key: "quality_of_work", label: "Quality of Work", description: "Accuracy, completeness, attention to detail" },
  { key: "problem_solving", label: "Problem Solving", description: "Analytical ability and initiative" },
  { key: "task_completion", label: "Task Completion", description: "Productivity and follow-through" },
  { key: "communication", label: "Communication", description: "Verbal and written clarity" },
  { key: "teamwork", label: "Teamwork", description: "Cooperation with peers and supervisors" },
  { key: "professionalism", label: "Professionalism", description: "Ethics, responsibility, conduct" },
  { key: "time_management", label: "Time Management", description: "Efficiency and deadline adherence" },
  { key: "learning_ability", label: "Learning Ability", description: "Initiative to acquire new skills" },
  { key: "punctuality", label: "Punctuality", description: "Attendance and timeliness" },
];

const LIKERT_LABELS: Record<number, string> = {
  5: "Excellent",
  4: "Very Good",
  3: "Average",
  2: "Marginal",
  1: "Unsatisfactory",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StudentOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  internship_id: string | null;
  internship_title: string | null;
  current_week: number | null;
}

interface ApprovedTask {
  id: string;
  title: string;
  week_number: number | null;
  day_number: number | null;
  approved_at: string | null;
  has_daily_eval: boolean;
  submission: {
    id: string;
    content: string | null;
    submitted_at: string;
  } | null;
}

interface EvaluationRow {
  id: string;
  type: string;
  status: string;
  scores: Record<string, number> | null;
  comments: string | null;
  rating: number | null;
  week_number: number | null;
  submitted_at: string;
  task_id: string | null;
  task_submission_id: string | null;
  student_user_id: string;
  task?: { title: string; week_number: number | null; day_number: number | null } | null;
  student?: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface EvalFormState {
  student_user_id: string;
  type: "task" | "weekly";
  task_id: string | null;
  week_number: number | null;
  scores: Record<string, number>;
  comments: string;
  rating: number;
  evaluation_id: string | null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SiteSupervisorEvaluationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);

  // Eval dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [evalForm, setEvalForm] = useState<EvalFormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-student "view" state — when a student is selected, load their tasks
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [approvedTasks, setApprovedTasks] = useState<ApprovedTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // ---------------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // 1. Fetch assigned students
      const { data: assignRows, error: assignErr } = await supabase
        .from("student_internships")
        .select(
          `student_user_id, internship_id, start_date, end_date,
           student:profiles!student_internships_student_user_id_fkey(user_id, full_name, email, avatar_url),
           internship:internships(id, title)`
        )
        .eq("site_supervisor_id", user.id)
        .in("status", ["assigned", "active"]);
      if (assignErr) throw assignErr;

      const studentRows: StudentOption[] = (assignRows || []).map((r: any) => ({
        user_id: r.student_user_id,
        full_name: r.student?.full_name ?? null,
        email: r.student?.email ?? null,
        avatar_url: r.student?.avatar_url ?? null,
        internship_id: r.internship_id,
        internship_title: r.internship?.title ?? null,
        current_week: computeWeek(r.start_date, r.end_date),
      }));
      setStudents(studentRows);

      // 2. Fetch this supervisor's evaluations
      const { data: evalRows, error: evalErr } = await supabase
        .from("evaluations")
        .select(
          `id, type, status, scores, comments, rating, week_number, submitted_at,
           task_id, task_submission_id, student_user_id,
           task:tasks(id, title, week_number, day_number),
           student:profiles!evaluations_student_user_id_fkey(full_name, email, avatar_url)`
        )
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "site_supervisor")
        .in("type", ["task", "weekly"])
        .order("submitted_at", { ascending: false });
      if (evalErr) throw evalErr;
      setEvaluations((evalRows || []) as unknown as EvaluationRow[]);
    } catch (err: any) {
      console.error("[evaluations] fetch error:", err);
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // When a student is selected, load their approved tasks (for daily eval)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user || !selectedStudent) {
      setApprovedTasks([]);
      return;
    }
    setLoadingTasks(true);
    (async () => {
      try {
        const supabase = createClient();
        // Fetch this student's approved task assignments for tasks created by this supervisor
        const { data: assignRows } = await supabase
          .from("task_assignments")
          .select(
            `id, task_id, status,
             task:tasks(id, title, week_number, day_number, created_by)`
          )
          .eq("student_user_id", selectedStudent.user_id)
          .eq("status", "approved");

        // Filter to tasks created by this supervisor
        const filtered = ((assignRows || []) as any[]).filter(
          (a) => a.task?.created_by === user.id
        );

        // Fetch submissions for these tasks
        const taskIds = filtered.map((a) => a.task_id);
        let subsByTask = new Map<string, any>();
        if (taskIds.length > 0) {
          const { data: subs } = await supabase
            .from("task_submissions")
            .select("id, task_id, content, submitted_at, status, reviewed_at")
            .eq("student_user_id", selectedStudent.user_id)
            .in("task_id", taskIds);
          for (const s of (subs || []) as any[]) {
            subsByTask.set(s.task_id, s);
          }
        }

        // Check which already have daily evaluations
        const { data: existingEvals } = await supabase
          .from("evaluations")
          .select("task_id")
          .eq("student_user_id", selectedStudent.user_id)
          .eq("evaluator_id", user.id)
          .eq("evaluator_role", "site_supervisor")
          .eq("type", "task");
        const evaldTaskIds = new Set((existingEvals || []).map((e: any) => e.task_id));

        const rows: ApprovedTask[] = filtered.map((a) => {
          const sub = subsByTask.get(a.task_id);
          return {
            id: a.task_id,
            title: a.task?.title || "Untitled",
            week_number: a.task?.week_number ?? null,
            day_number: a.task?.day_number ?? null,
            approved_at: sub?.reviewed_at ?? null,
            has_daily_eval: evaldTaskIds.has(a.task_id),
            submission: sub
              ? { id: sub.id, content: sub.content, submitted_at: sub.submitted_at }
              : null,
          };
        });
        // Sort by week/day
        rows.sort((a, b) => (a.week_number ?? 99) - (b.week_number ?? 99)
          || (a.day_number ?? 99) - (b.day_number ?? 99));
        setApprovedTasks(rows);
      } catch (err) {
        console.error("[evaluations] load tasks error:", err);
        setApprovedTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    })();
  }, [user, selectedStudent]);

  // ---------------------------------------------------------------------------
  // Eval form handlers
  // ---------------------------------------------------------------------------
  function openDailyEval(student: StudentOption, task: ApprovedTask) {
    // Find existing eval for this task
    const existing = evaluations.find(
      (e) => e.task_id === task.id && e.type === "task"
    );
    setEvalForm({
      student_user_id: student.user_id,
      type: "task",
      task_id: task.id,
      week_number: task.week_number ?? null,
      scores: existing?.scores || {},
      comments: existing?.comments || "",
      rating: existing?.rating ?? 0,
      evaluation_id: existing?.id || null,
    });
    setShowDialog(true);
  }

  function openWeeklyEval(student: StudentOption) {
    const week = student.current_week ?? 1;
    // Find existing weekly eval for this student+week
    const existing = evaluations.find(
      (e) =>
        e.type === "weekly" &&
        e.week_number === week &&
        e.student_user_id === student.user_id
    );
    setEvalForm({
      student_user_id: student.user_id,
      type: "weekly",
      task_id: null,
      week_number: week,
      scores: existing?.scores || {},
      comments: existing?.comments || "",
      rating: existing?.rating ?? 0,
      evaluation_id: existing?.id || null,
    });
    setShowDialog(true);
  }

  async function handleSaveEval() {
    if (!evalForm) return;
    setSaving(true);
    try {
      const res = await fetch("/api/site-supervisor/evaluations/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: evalForm.type,
          student_user_id: evalForm.student_user_id,
          scores: evalForm.scores,
          comments: evalForm.comments,
          rating: evalForm.rating,
          task_id: evalForm.task_id,
          week_number: evalForm.week_number,
          evaluation_id: evalForm.evaluation_id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Save failed (${res.status})`);
      }
      toast({
        title: evalForm.type === "weekly" ? "Weekly evaluation saved" : "Daily evaluation saved",
        description: "The student will be able to see your feedback.",
      });
      setShowDialog(false);
      setEvalForm(null);
      await fetchAll();
      // Refresh tasks if a student is selected
      if (selectedStudent) {
        const s = selectedStudent;
        setSelectedStudent(null);
        setTimeout(() => setSelectedStudent(s), 50);
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Evaluations" description="Daily and weekly performance evaluations" />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Failed to load</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button onClick={fetchAll} variant="outline" size="sm" className="mt-3">
                  <RefreshCw className="h-4 w-4 mr-2" /> Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Evaluations"
        description="Daily evaluations tied to tasks, and weekly evaluations aggregating the week's work. HEC-aligned criteria."
        actions={
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Assigned Students" value={students.length} icon={ListTodo} variant="info" />
        <StatCard
          label="Daily Evaluations"
          value={evaluations.filter((e) => e.type === "task").length}
          icon={FileText}
          variant="default"
        />
        <StatCard
          label="Weekly Evaluations"
          value={evaluations.filter((e) => e.type === "weekly").length}
          icon={Award}
          variant="success"
        />
        <StatCard
          label="Pending Daily Evals"
          value={Math.max(0, approvedTasks.filter((t) => !t.has_daily_eval).length)}
          icon={Clock}
          variant="warning"
        />
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">By Student</TabsTrigger>
          <TabsTrigger value="history">All Evaluations</TabsTrigger>
        </TabsList>

        {/* BY STUDENT TAB */}
        <TabsContent value="students" className="space-y-4">
          {students.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ListTodo className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground">No students assigned to you.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Student selector */}
              <div className="flex flex-wrap items-center gap-3">
                <Label>Select a student:</Label>
                <Select
                  value={selectedStudent?.user_id || ""}
                  onValueChange={(v) => {
                    const s = students.find((s) => s.user_id === v) || null;
                    setSelectedStudent(s);
                  }}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Choose a student..." />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>
                        {s.full_name || s.email}
                        {s.current_week ? ` · Week ${s.current_week}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedStudent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openWeeklyEval(selectedStudent)}
                  >
                    <Award className="h-4 w-4 mr-1.5" /> Submit Weekly Eval
                  </Button>
                )}
              </div>

              {/* Selected student view */}
              {selectedStudent && (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={selectedStudent.avatar_url || undefined} />
                          <AvatarFallback>
                            {(selectedStudent.full_name || selectedStudent.email || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{selectedStudent.full_name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedStudent.internship_title}
                            {selectedStudent.current_week ? ` · Current Week ${selectedStudent.current_week}` : ""}
                          </p>
                        </div>
                        <Button asChild variant="ghost" size="sm" className="ml-auto">
                          <Link href={`/site-supervisor/students/${selectedStudent.user_id}`}>
                            Full profile <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Approved tasks → daily evals */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Daily Evaluations</CardTitle>
                      <CardDescription>
                        Evaluate the student's work on each approved task. Daily evaluations roll up into the weekly view.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingTasks ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks...
                        </div>
                      ) : approvedTasks.length === 0 ? (
                        <div className="py-8 text-center">
                          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No approved tasks yet. Once a student's task submission is approved,
                            you'll be able to add a daily evaluation for it here.
                          </p>
                        </div>
                      ) : (
                        <ul className="divide-y">
                          {approvedTasks.map((task) => (
                            <li
                              key={task.id}
                              className="py-3 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium truncate">{task.title}</p>
                                  {task.week_number && (
                                    <Badge variant="outline" className="text-xs">
                                      W{task.week_number}
                                      {task.day_number ? `·D${task.day_number}` : ""}
                                    </Badge>
                                  )}
                                  {task.has_daily_eval ? (
                                    <Badge variant="outline" className="border-green-500 text-green-700 text-xs">
                                      <CheckCircle2 className="h-3 w-3 mr-1" /> Evaluated
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                                      <Clock className="h-3 w-3 mr-1" /> Pending
                                    </Badge>
                                  )}
                                </div>
                                {task.approved_at && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Approved {new Date(task.approved_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant={task.has_daily_eval ? "outline" : "default"}
                                onClick={() => openDailyEval(selectedStudent, task)}
                              >
                                {task.has_daily_eval ? "Edit" : "Evaluate"}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>

                  {/* Existing weekly evals for this student */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Weekly Evaluations</CardTitle>
                      <CardDescription>
                        Submit one weekly evaluation per week. The system auto-aggregates daily task data.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {evaluations.filter(
                        (e) =>
                          e.type === "weekly" &&
                          e.student_user_id === selectedStudent.user_id
                      ).length === 0 ? (
                        <div className="py-6 text-center">
                          <Award className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No weekly evaluations submitted for this student yet.
                          </p>
                          <Button className="mt-3" onClick={() => openWeeklyEval(selectedStudent)}>
                            <Plus className="h-4 w-4 mr-1.5" /> Submit Weekly Evaluation
                          </Button>
                        </div>
                      ) : (
                        <ul className="divide-y">
                          {evaluations
                            .filter(
                              (e) =>
                                e.type === "weekly" &&
                                e.student_user_id === selectedStudent.user_id
                            )
                            .map((ev) => (
                              <li key={ev.id} className="py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">Week {ev.week_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Submitted {new Date(ev.submitted_at).toLocaleDateString()}
                                    {ev.rating != null && ` · Rating ${ev.rating}/5`}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEvalForm({
                                      student_user_id: selectedStudent.user_id,
                                      type: "weekly",
                                      task_id: null,
                                      week_number: ev.week_number,
                                      scores: ev.scores || {},
                                      comments: ev.comments || "",
                                      rating: ev.rating ?? 0,
                                      evaluation_id: ev.id,
                                    });
                                    setShowDialog(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-3">
          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground">No evaluations submitted yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a student above to add your first evaluation.
                </p>
              </CardContent>
            </Card>
          ) : (
            evaluations.map((ev: any) => (
              <Card key={ev.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium capitalize">
                          {ev.type === "task" ? "Daily" : "Weekly"}
                        </p>
                        {ev.task?.title && <span className="text-sm text-muted-foreground">— {ev.task.title}</span>}
                        {ev.week_number && (
                          <Badge variant="outline" className="text-xs">Week {ev.week_number}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ev.student?.full_name || ev.student?.email || "Student"}
                        {" · "}
                        {new Date(ev.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    {ev.rating != null && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="font-medium">{ev.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {ev.scores && Object.keys(ev.scores).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {Object.entries(ev.scores).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-medium">{value}/5 · {LIKERT_LABELS[value] || ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ev.comments && (
                    <p className="text-sm mt-2 italic text-muted-foreground">"{ev.comments}"</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Evaluation dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {evalForm?.type === "weekly" ? "Weekly Evaluation" : "Daily Evaluation"}
            </DialogTitle>
            <DialogDescription>
              {evalForm?.type === "weekly"
                ? `Week ${evalForm.week_number} — rate the student's overall weekly performance.`
                : "Rate the student's performance on this task. HEC-aligned criteria."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            {evalForm && (
              <div className="space-y-3 pb-2">
                {EVAL_CRITERIA.map((c) => {
                  const value = evalForm.scores[c.key] ?? 0;
                  return (
                    <div key={c.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">{c.label}</Label>
                          <p className="text-xs text-muted-foreground">{c.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {value > 0 ? `${value}/5 · ${LIKERT_LABELS[value] || ""}` : "Not rated"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              const newScores = { ...evalForm.scores, [c.key]: n };
                              // Auto-compute overall rating as average
                              const vals = Object.values(newScores).filter((v) => v > 0) as number[];
                              const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                              setEvalForm({
                                ...evalForm,
                                scores: newScores,
                                rating: Math.round(avg * 10) / 10,
                              });
                            }}
                            className={
                              "flex-1 py-2 rounded text-sm border transition-colors " +
                              (value >= n
                                ? "bg-amber-400 hover:bg-amber-500 border-amber-500 text-white"
                                : "bg-background hover:bg-accent border-border")
                            }
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <Separator />

                {/* Overall rating */}
                <div className="flex items-center justify-between">
                  <Label>Overall Rating</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={
                          "h-5 w-5 cursor-pointer " +
                          (evalForm.rating >= n
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground/40")
                        }
                        onClick={() => setEvalForm({ ...evalForm, rating: n })}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium">{evalForm.rating.toFixed(1)}/5</span>
                  </div>
                </div>

                {/* Comments */}
                <div className="space-y-1.5">
                  <Label htmlFor="comments">
                    Feedback / Comments{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      (strengths, areas for improvement)
                    </span>
                  </Label>
                  <Textarea
                    id="comments"
                    placeholder="The student showed strong initiative in..."
                    rows={4}
                    value={evalForm.comments}
                    onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })}
                  />
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEval} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Save Evaluation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function computeWeek(start: string, end: string | null): number | null {
  const startD = new Date(start);
  const today = new Date();
  const weeks = Math.floor((today.getTime() - startD.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  if (weeks < 1) return 1;
  if (end) {
    const endD = new Date(end);
    const totalWeeks = Math.ceil((endD.getTime() - startD.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (totalWeeks > 0 && weeks > totalWeeks) return totalWeeks;
  }
  return weeks;
}
