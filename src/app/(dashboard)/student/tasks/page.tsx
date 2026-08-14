"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle, RefreshCw, CheckCircle2, Clock, Lock,
  Calendar, Youtube, ArrowRight, Send, FileText, Link as LinkIcon,
  Plus, X, ExternalLink, MessageSquare, AlertTriangle, ListTodo,
  Wrench, BookOpen, Lightbulb,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ScrollableDialog } from "@/components/shared/scrollable-dialog";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { toast } from "@/components/shared/toast";

// ---------------------------------------------------------------------------
// Types — matches the EnrichedTaskRow from /api/student/tasks
// ---------------------------------------------------------------------------
interface Task {
  id: string;
  title: string;
  description: string | null;
  expected_deliverable: string | null;
  resources: string | null;
  youtube_url: string | null;
  due_date: string | null;
  priority: string | null;
  week_number: number | null;
  day_number: number | null;
  sort_order: number;
  requires_previous_completion: boolean;
  // Assignment state
  assignment_id: string;
  assignment_status: string;
  // Submission
  submission_id: string | null;
  submission_status: string | null;
  submission_content: string | null;
  submission_links: Array<{ label: string; url: string; type?: string }> | null;
  submission_tools_used: string | null;
  submission_skills_learned: string | null;
  submission_problems_solved: string | null;
  submission_submitted_at: string | null;
  submission_reviewed_at: string | null;
  submission_feedback: string | null;
  submission_score: number | null;
  // Unlock state
  is_unlocked: boolean;
  is_current: boolean;
}

interface SubmissionForm {
  content: string;
  links: Array<{ label: string; url: string }>;
  tools_used: string;
  skills_learned: string;
  problems_solved: string;
}

const EMPTY_FORM: SubmissionForm = {
  content: "",
  links: [{ label: "", url: "" }],
  tools_used: "",
  skills_learned: "",
  problems_solved: "",
};

// ---------------------------------------------------------------------------
export default function StudentTasksPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Submission dialog
  const [submitTask, setSubmitTask] = useState<Task | null>(null);
  const [submitForm, setSubmitForm] = useState<SubmissionForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // View feedback dialog
  const [viewTask, setViewTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/tasks", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to fetch tasks (${res.status})`);
      }
      const json = await res.json();
      setTasks(json.data || []);
    } catch (err: any) {
      console.error("[student/tasks] fetch error:", err);
      setError(err?.message || "Failed to load tasks");
      toast.fromError(err, "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ---------------------------------------------------------------------------
  // Compute progress + grouping
  // ---------------------------------------------------------------------------
  const stats = (() => {
    const total = tasks.length;
    const approved = tasks.filter((t) => t.assignment_status === "approved").length;
    const inProgress = tasks.filter(
      (t) => t.assignment_status === "pending" || t.assignment_status === "resubmitted"
    ).length;
    const pendingReview = tasks.filter((t) => t.assignment_status === "submitted").length;
    return { total, approved, inProgress, pendingReview };
  })();
  const completionPct = stats.total === 0 ? 0 : Math.round((stats.approved / stats.total) * 100);

  const tasksByWeek = (() => {
    const groups = new Map<number | string, Task[]>();
    for (const t of tasks) {
      const key = t.week_number ?? "unsorted";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    for (const [, list] of groups) {
      list.sort((a, b) => (a.day_number ?? 99) - (b.day_number ?? 99) || a.sort_order - b.sort_order);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "unsorted") return 1;
      if (b[0] === "unsorted") return -1;
      return (a[0] as number) - (b[0] as number);
    });
  })();

  // Find current and next task for "Go to Next Task" CTA
  const currentTask = tasks.find((t) => t.is_current);
  const nextTask = (() => {
    if (!currentTask) return null;
    const sorted = [...tasks].sort(
      (a, b) => (a.week_number ?? 99) - (b.week_number ?? 99)
        || (a.day_number ?? 99) - (b.day_number ?? 99)
        || a.sort_order - b.sort_order
    );
    const idx = sorted.findIndex((t) => t.id === currentTask.id);
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  })();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function openSubmit(task: Task) {
    if (!task.is_unlocked) {
      toast.warning("Task locked", {
        description: "Complete and get approval on the previous task first.",
      });
      return;
    }
    setSubmitTask(task);
    // Pre-fill from existing submission (for resubmissions)
    setSubmitForm({
      content: task.submission_content || "",
      links: task.submission_links && task.submission_links.length > 0
        ? task.submission_links.map((l) => ({ label: l.label || "", url: l.url }))
        : [{ label: "", url: "" }],
      tools_used: task.submission_tools_used || "",
      skills_learned: task.submission_skills_learned || "",
      problems_solved: task.submission_problems_solved || "",
    });
  }

  async function handleSubmit() {
    if (!submitTask) return;
    if (!submitForm.content.trim()) {
      toast.warning("Please describe what you completed");
      return;
    }
    setSubmitting(true);
    try {
      const links = submitForm.links
        .filter((l) => l.url.trim())
        .map((l) => ({
          label: l.label.trim() || l.url.trim(),
          url: l.url.trim(),
          type: "other" as const,
        }));
      // toast.fetch handles the loading → success/error pattern and
      // prevents duplicate toasts if the user double-clicks (the button
      // is also disabled while submitting).
      await toast.fetch(
        async () => {
          const res = await fetch("/api/student/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: submitTask.id,
              content: submitForm.content.trim(),
              links,
              tools_used: submitForm.tools_used.trim(),
              skills_learned: submitForm.skills_learned.trim(),
              problems_solved: submitForm.problems_solved.trim(),
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error || `Submit failed (${res.status})`);
          }
          return res.json();
        },
        {
          loading: "Submitting task...",
          success: "Task submitted! Your supervisor has been notified.",
          error: "Failed to submit task",
        }
      );
      setSubmitTask(null);
      await fetchTasks();
    } catch {
      // toast.fetch already showed the error toast; just bail out
    } finally {
      setSubmitting(false);
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
        <PageHeader title="My Tasks" description="Your internship tasks and submissions" />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Failed to load</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button onClick={fetchTasks} variant="outline" size="sm" className="mt-3">
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
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="My Tasks"
        description="Complete tasks in order. Each task unlocks after your supervisor approves the previous one."
        actions={
          <Button variant="outline" size="sm" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {/* Empty state */}
      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <ListTodo className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No tasks assigned to you yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your supervisor will assign tasks as your internship progresses. Check back soon!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Progress overview */}
      {tasks.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Tasks" value={stats.total} icon={ListTodo} variant="info" />
            <StatCard label="Completed" value={stats.approved} icon={CheckCircle2} variant="success" />
            <StatCard label="In Progress" value={stats.inProgress} icon={Clock} variant="warning" />
            <StatCard label="Awaiting Review" value={stats.pendingReview} icon={MessageSquare} variant="default" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall Progress</CardTitle>
              <CardDescription>
                {stats.approved} of {stats.total} tasks completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Progress value={completionPct} className="h-3 flex-1" />
                <span className="font-medium text-lg">{completionPct}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Current task callout */}
          {currentTask && (
            <Card className="border-primary bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="default" className="bg-primary text-primary-foreground">
                        Current Task
                      </Badge>
                      {currentTask.week_number && (
                        <span className="text-xs text-muted-foreground">
                          Week {currentTask.week_number}
                          {currentTask.day_number ? ` · Day ${currentTask.day_number}` : ""}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg break-words">{currentTask.title}</h3>
                    {currentTask.description && (
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        <MarkdownRenderer content={currentTask.description} compact />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {currentTask.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due {new Date(currentTask.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {currentTask.submission_status === "submitted" && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          <Clock className="h-3 w-3 mr-1" /> Awaiting review
                        </Badge>
                      )}
                      {currentTask.submission_status === "resubmitted" && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Changes requested
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    {currentTask.assignment_status === "approved" ? (
                      nextTask ? (
                        <Button onClick={() => openSubmit(nextTask)}>
                          Go to Next Task <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      ) : (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> All tasks complete!
                        </Badge>
                      )
                    ) : currentTask.submission_status === "submitted" ||
                      currentTask.submission_status === "resubmitted" ? (
                      <Button variant="outline" onClick={() => setViewTask(currentTask)}>
                        View Feedback
                      </Button>
                    ) : (
                      <Button onClick={() => openSubmit(currentTask)}>
                        <Send className="h-4 w-4 mr-2" /> Submit Work
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Tasks grouped by week */}
      <div className="space-y-4">
        {tasksByWeek.map(([week, weekTasks]) => (
          <Card key={week}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {week === "unsorted" ? "Tasks" : `Week ${week}`}
                <Badge variant="outline">
                  {weekTasks.filter((t) => t.assignment_status === "approved").length}/{weekTasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {weekTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onSubmit={() => openSubmit(task)}
                  onViewFeedback={() => setViewTask(task)}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submission dialog */}
      <ScrollableDialog
        open={!!submitTask}
        onOpenChange={(v) => !v && setSubmitTask(null)}
        title={submitTask?.submission_status === "resubmitted" ? "Resubmit Task" : "Submit Task"}
        description={
          <span className="break-words">
            {submitTask?.title}
            {submitTask?.expected_deliverable && (
              <span className="block mt-1 text-xs">
                Expected: {submitTask.expected_deliverable}
              </span>
            )}
          </span>
        }
        maxWidthClassName="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitTask(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Submit Task
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4 pb-2">
          {/* Task context (Markdown) */}
          {submitTask?.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Task</p>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <MarkdownRenderer content={submitTask.description} />
              </div>
            </div>
          )}

          {/* Description (Markdown editor) */}
          <div className="space-y-1.5">
            <Label htmlFor="content">
              Description <span className="text-destructive">*</span>{" "}
              <span className="text-muted-foreground text-xs font-normal">
                (Markdown supported — explain what you completed)
              </span>
            </Label>
            <MarkdownEditor
              id="content"
              value={submitForm.content}
              onChange={(v) => setSubmitForm({ ...submitForm, content: v })}
              placeholder="I completed the landing page by following the design mockup. Used Tailwind for styling..."
              rows={6}
              ariaLabel="Submission description (Markdown)"
            />
          </div>

          {/* Links */}
          <div className="space-y-1.5">
            <Label>
              Links{" "}
              <span className="text-muted-foreground text-xs font-normal">
                (GitHub, live demo, Figma, docs, etc.)
              </span>
            </Label>
            <div className="space-y-2">
              {submitForm.links.map((link, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Label (e.g., GitHub repo)"
                    value={link.label}
                    onChange={(e) => {
                      const links = [...submitForm.links];
                      links[idx] = { ...links[idx], label: e.target.value };
                      setSubmitForm({ ...submitForm, links });
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => {
                      const links = [...submitForm.links];
                      links[idx] = { ...links[idx], url: e.target.value };
                      setSubmitForm({ ...submitForm, links });
                    }}
                    className="flex-[2]"
                  />
                  {submitForm.links.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const links = submitForm.links.filter((_, i) => i !== idx);
                        setSubmitForm({ ...submitForm, links });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSubmitForm({
                    ...submitForm,
                    links: [...submitForm.links, { label: "", url: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add another link
              </Button>
            </div>
          </div>

          {/* Tools used */}
          <div className="space-y-1.5">
            <Label htmlFor="tools" className="flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" /> Tools Used
              <span className="text-muted-foreground text-xs font-normal">(comma-separated)</span>
            </Label>
            <Input
              id="tools"
              placeholder="React, Next.js, Tailwind CSS, Supabase, Git"
              value={submitForm.tools_used}
              onChange={(e) => setSubmitForm({ ...submitForm, tools_used: e.target.value })}
            />
          </div>

          {/* Skills learned */}
          <div className="space-y-1.5">
            <Label htmlFor="skills" className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Skills Learned
              <span className="text-muted-foreground text-xs font-normal">(comma-separated)</span>
            </Label>
            <Input
              id="skills"
              placeholder="API integration, authentication, database queries, responsive design"
              value={submitForm.skills_learned}
              onChange={(e) => setSubmitForm({ ...submitForm, skills_learned: e.target.value })}
            />
          </div>

          {/* Problems solved (Markdown) */}
          <div className="space-y-1.5">
            <Label htmlFor="problems" className="flex items-center gap-1">
              <Lightbulb className="h-3.5 w-3.5" /> Problems Solved
              <span className="text-muted-foreground text-xs font-normal">(Markdown supported)</span>
            </Label>
            <MarkdownEditor
              id="problems"
              value={submitForm.problems_solved}
              onChange={(v) => setSubmitForm({ ...submitForm, problems_solved: v })}
              placeholder="I had trouble with CORS errors when calling the API. Solved it by configuring the right headers..."
              rows={3}
              hidePreview
              ariaLabel="Problems solved (Markdown)"
            />
          </div>
        </div>
      </ScrollableDialog>

      {/* Feedback / view dialog */}
      <ScrollableDialog
        open={!!viewTask}
        onOpenChange={(v) => !v && setViewTask(null)}
        title={viewTask?.title}
        description={
          <span>
            {viewTask?.week_number && `Week ${viewTask.week_number}`}
            {viewTask?.day_number ? ` · Day ${viewTask.day_number}` : ""}
            {" · "}
            <span className="capitalize">{viewTask?.assignment_status}</span>
          </span>
        }
        maxWidthClassName="max-w-2xl"
        footer={
          viewTask && viewTask.submission_status === "resubmitted" ? (
            <>
              <Button variant="outline" onClick={() => setViewTask(null)}>Close</Button>
              <Button onClick={() => { const t = viewTask; setViewTask(null); if (t) openSubmit(t); }}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Resubmit
              </Button>
            </>
          ) : viewTask && viewTask.submission_status !== "approved" && viewTask.submission_status !== null ? (
            <>
              <Button variant="outline" onClick={() => setViewTask(null)}>Close</Button>
              <Button onClick={() => { const t = viewTask; setViewTask(null); if (t) openSubmit(t); }}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Update Submission
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setViewTask(null)}>Close</Button>
          )
        }
      >
        {viewTask && (
          <div className="space-y-4 pb-2">
            {/* Task details — Markdown rendered */}
            {viewTask.description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Task</p>
                <MarkdownRenderer content={viewTask.description} />
              </div>
            )}
            {viewTask.expected_deliverable && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Expected Deliverable</p>
                <MarkdownRenderer content={viewTask.expected_deliverable} compact />
              </div>
            )}
            {viewTask.resources && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Resources</p>
                <MarkdownRenderer content={viewTask.resources} compact />
              </div>
            )}
            {viewTask.youtube_url && (
              <a
                href={viewTask.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Youtube className="h-4 w-4 text-red-500" /> Watch YouTube video
              </a>
            )}

            <Separator />

            {/* Submission */}
            {viewTask.submission_id ? (
              <>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Your Submission</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {viewTask.submission_submitted_at && new Date(viewTask.submission_submitted_at).toLocaleString()}
                  </p>
                </div>
                {viewTask.submission_content && (
                  <MarkdownRenderer content={viewTask.submission_content} />
                )}
                {viewTask.submission_links && viewTask.submission_links.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Links</p>
                    <ul className="space-y-1">
                      {viewTask.submission_links.map((l, i) => (
                        <li key={i}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            {l.label || l.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {viewTask.submission_tools_used && (
                  <p className="text-sm"><span className="font-medium">Tools:</span> {viewTask.submission_tools_used}</p>
                )}
                {viewTask.submission_skills_learned && (
                  <p className="text-sm"><span className="font-medium">Skills:</span> {viewTask.submission_skills_learned}</p>
                )}
                {viewTask.submission_problems_solved && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Problems Solved</p>
                    <MarkdownRenderer content={viewTask.submission_problems_solved} compact />
                  </div>
                )}

                {/* Feedback — Markdown rendered */}
                {viewTask.submission_feedback && (
                  <div className="p-3 rounded-md bg-muted">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Supervisor Feedback</p>
                    <MarkdownRenderer content={viewTask.submission_feedback} />
                    {viewTask.submission_score != null && (
                      <p className="text-xs mt-2"><span className="font-medium">Score:</span> {viewTask.submission_score}/100</p>
                    )}
                  </div>
                )}

                {/* Status / actions */}
                {viewTask.submission_status === "resubmitted" && (
                  <div className="p-3 rounded-md bg-orange-50 border border-orange-200">
                    <p className="text-sm font-medium text-orange-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Changes requested
                    </p>
                    <p className="text-xs text-orange-800 mt-1">
                      Please update your work based on the feedback and resubmit.
                    </p>
                  </div>
                )}
                {viewTask.submission_status === "approved" && (
                  <div className="p-3 rounded-md bg-green-50 border border-green-200">
                    <p className="text-sm font-medium text-green-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Approved
                    </p>
                    <p className="text-xs text-green-800 mt-1">
                      Great work! The next task is now unlocked.
                    </p>
                    {nextTask && (
                      <Button size="sm" className="mt-2" onClick={() => { const t = viewTask; setViewTask(null); if (t) openSubmit(nextTask); }}>
                        Go to Next Task <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">You haven&apos;t submitted work for this task yet.</p>
                <Button className="mt-3" onClick={() => { const t = viewTask; setViewTask(null); if (t) openSubmit(t); }}>
                  <Send className="h-4 w-4 mr-2" /> Submit Work
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollableDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskRow — one task with current/locked/completed state
// ---------------------------------------------------------------------------
function TaskRow({
  task,
  onSubmit,
  onViewFeedback,
}: {
  task: Task;
  onSubmit: () => void;
  onViewFeedback: () => void;
}) {
  const isApproved = task.assignment_status === "approved";
  const isSubmitted =
    task.submission_status === "submitted" || task.submission_status === "resubmitted";
  const isResubmit = task.submission_status === "resubmitted";
  const isLocked = !task.is_unlocked;
  const isCurrent = task.is_current;

  const Icon = isApproved ? CheckCircle2 : isCurrent ? Clock : isLocked ? Lock : Clock;
  const iconColor = isApproved
    ? "text-green-600"
    : isCurrent
      ? "text-blue-600"
      : isLocked
        ? "text-muted-foreground"
        : "text-muted-foreground";

  return (
    <div
      className={
        "flex flex-col sm:flex-row sm:items-start gap-3 p-3 border rounded transition-colors " +
        (isCurrent ? "border-primary bg-primary/5" : "hover:bg-accent/30")
      }
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon className={"h-5 w-5 mt-0.5 flex-shrink-0 " + iconColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {task.day_number && (
              <span className="text-xs text-muted-foreground">Day {task.day_number}</span>
            )}
            <p className={"font-medium break-words " + (isLocked ? "text-muted-foreground" : "")}>
              {task.title}
            </p>
            {isApproved && (
              <Badge variant="outline" className="border-green-500 text-green-700 text-xs">
                Completed
              </Badge>
            )}
            {isResubmit && (
              <Badge variant="outline" className="border-orange-500 text-orange-700 text-xs">
                Changes requested
              </Badge>
            )}
            {isSubmitted && !isApproved && !isResubmit && (
              <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                Awaiting review
              </Badge>
            )}
            {isCurrent && !isSubmitted && (
              <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                Current
              </Badge>
            )}
            {isLocked && (
              <Badge variant="outline" className="text-muted-foreground text-xs">
                <Lock className="h-3 w-3 mr-1" /> Locked
              </Badge>
            )}
          </div>
          {task.description && !isLocked && (
            <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
              <MarkdownRenderer content={task.description} compact />
            </div>
          )}
          {task.expected_deliverable && !isLocked && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">Deliverable:</span> {task.expected_deliverable}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.youtube_url && !isLocked && (
              <span className="flex items-center gap-1 text-red-600">
                <Youtube className="h-3 w-3" /> Video
              </span>
            )}
            {task.submission_submitted_at && (
              <span>
                Submitted {new Date(task.submission_submitted_at).toLocaleDateString()}
              </span>
            )}
            {task.submission_score != null && (
              <span>Score: {task.submission_score}/100</span>
            )}
          </div>
          {isLocked && (
            <p className="text-xs text-muted-foreground mt-1">
              Complete and get approval on the previous task to unlock this one.
            </p>
          )}
        </div>
      </div>

      <div className="flex sm:flex-col gap-1.5 sm:items-end">
        {isApproved ? (
          <Button size="sm" variant="ghost" onClick={onViewFeedback} className="w-full sm:w-auto">
            View Feedback
          </Button>
        ) : isSubmitted ? (
          <Button size="sm" variant="outline" onClick={onViewFeedback} className="w-full sm:w-auto">
            View Feedback
          </Button>
        ) : isLocked ? (
          <Button size="sm" variant="ghost" disabled className="w-full sm:w-auto">
            <Lock className="h-3.5 w-3.5 mr-1" /> Locked
          </Button>
        ) : (
          <Button size="sm" onClick={onSubmit} className="w-full sm:w-auto">
            <Send className="h-3.5 w-3.5 mr-1" /> Submit
          </Button>
        )}
      </div>
    </div>
  );
}
