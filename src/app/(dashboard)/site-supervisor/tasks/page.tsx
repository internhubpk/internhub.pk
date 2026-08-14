"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Plus, RefreshCw, Trash2, Edit, Eye, CheckCircle2, XCircle,
  Clock, AlertCircle, ChevronDown, ChevronRight, Youtube,
  FileText, Link as LinkIcon, ExternalLink, Send, MessageSquare,
  Loader2, Calendar, Video, Users, CheckSquare, ListTodo, Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StudentOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  internship_title: string | null;
  internship_id: string | null;
}

interface TaskSubmission {
  id: string;
  student_user_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  feedback: string | null;
  score: number | null;
  content: string | null;
  notes: string | null;
  url: string | null;
  links: Array<{ label: string; url: string; type?: string }> | null;
  tools_used: string | null;
  skills_learned: string | null;
  problems_solved: string | null;
  student: { user_id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface TaskAssignment {
  id: string;
  student_user_id: string;
  status: string;
  due_date: string | null;
  student: { user_id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  expected_deliverable: string | null;
  resources: string | null;
  youtube_url: string | null;
  due_date: string | null;
  week_number: number | null;
  day_number: number | null;
  sort_order: number;
  requires_previous_completion: boolean;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  assignments: TaskAssignment[];
  submissions: TaskSubmission[];
  total_assigned: number;
  submitted_count: number;
  approved_count: number;
}

interface TaskFormData {
  title: string;
  description: string;
  expected_deliverable: string;
  resources: string;
  youtube_url: string;
  due_date: string;
  week_number: string;
  day_number: string;
  priority: "low" | "medium" | "high" | "urgent";
  requires_previous_completion: boolean;
  student_user_ids: string[];
}

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  expected_deliverable: "",
  resources: "",
  youtube_url: "",
  due_date: "",
  week_number: "",
  day_number: "",
  priority: "medium",
  requires_previous_completion: true,
  student_user_ids: [],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SiteSupervisorTasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWeek, setFilterWeek] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Review dialog state
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<TaskSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "request_changes" | "feedback">("approve");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewScore, setReviewScore] = useState<string>("");
  const [reviewing, setReviewing] = useState(false);

  // Expanded task groups (week view)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number | string>>(new Set());

  // ---------------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchStudents(), fetchTasks()]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function fetchStudents() {
    if (!user) return;
    const supabase = (await import("@/utils/supabase/client")).createClient();
    const { data, error } = await supabase
      .from("student_internships")
      .select(
        `student_user_id, internship_id,
         student:profiles!student_internships_student_user_id_fkey(user_id, full_name, email, avatar_url),
         internship:internships(id, title)`
      )
      .eq("site_supervisor_id", user.id)
      .in("status", ["assigned", "active"]);
    if (error) throw error;
    const rows = (data || []).map((r: any) => ({
      user_id: r.student_user_id,
      full_name: r.student?.full_name ?? null,
      email: r.student?.email ?? null,
      avatar_url: r.student?.avatar_url ?? null,
      internship_title: r.internship?.title ?? null,
      internship_id: r.internship_id ?? null,
    }));
    setStudents(rows);
  }

  async function fetchTasks() {
    if (!user) return;
    const res = await fetch("/api/site-supervisor/tasks", { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Failed to fetch tasks (${res.status})`);
    }
    const json = await res.json();
    setTasks(json.data || []);
  }

  // ---------------------------------------------------------------------------
  // Group tasks by week
  // ---------------------------------------------------------------------------
  const tasksByWeek = useMemo(() => {
    const groups = new Map<number | string, Task[]>();
    for (const t of tasks) {
      const key = t.week_number ?? "unsorted";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    // Sort within each week by day_number then sort_order
    for (const [k, list] of groups) {
      list.sort((a, b) => {
        const dn = (a.day_number ?? 99) - (b.day_number ?? 99);
        if (dn !== 0) return dn;
        return a.sort_order - b.sort_order;
      });
    }
    // Sort weeks numerically (with "unsorted" last)
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "unsorted") return 1;
      if (b[0] === "unsorted") return -1;
      return (a[0] as number) - (b[0] as number);
    }) as Array<[number | string, Task[]]>;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterWeek !== "all") {
        const wk = t.week_number?.toString() ?? "unsorted";
        if (wk !== filterWeek) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !(t.description || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, filterWeek, searchQuery]);

  // ---------------------------------------------------------------------------
  // Create / Edit handlers
  // ---------------------------------------------------------------------------
  function openCreate() {
    setEditingTask(null);
    setFormData({
      ...EMPTY_FORM,
      // Default week_number to the next empty week
      week_number: tasks.length === 0 ? "1" : "",
      student_user_ids: students.length === 1 ? [students[0].user_id] : [],
    });
    setShowCreateDialog(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      expected_deliverable: task.expected_deliverable || "",
      resources: task.resources || "",
      youtube_url: task.youtube_url || "",
      due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      week_number: task.week_number?.toString() || "",
      day_number: task.day_number?.toString() || "",
      priority: (task.priority as any) || "medium",
      requires_previous_completion: task.requires_previous_completion,
      student_user_ids: task.assignments?.map((a) => a.student_user_id) || [],
    });
    setShowCreateDialog(true);
  }

  async function handleSave() {
    if (!formData.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (formData.student_user_ids.length === 0) {
      toast({ title: "Select at least one student", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(editingTask ? { task_id: editingTask.id } : {}),
        title: formData.title.trim(),
        description: formData.description.trim(),
        expected_deliverable: formData.expected_deliverable.trim(),
        resources: formData.resources.trim(),
        youtube_url: formData.youtube_url.trim(),
        due_date: formData.due_date || null,
        week_number: formData.week_number ? parseInt(formData.week_number, 10) : null,
        day_number: formData.day_number ? parseInt(formData.day_number, 10) : null,
        priority: formData.priority,
        requires_previous_completion: formData.requires_previous_completion,
        student_user_ids: formData.student_user_ids,
      };
      const url = "/api/site-supervisor/tasks";
      const method = editingTask ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Save failed (${res.status})`);
      }
      toast({
        title: editingTask ? "Task updated" : "Task created",
        description: `"${formData.title}" ${editingTask ? "updated" : `assigned to ${formData.student_user_ids.length} student(s)`}.`,
      });
      setShowCreateDialog(false);
      await fetchTasks();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // Delete-confirmation state (driven by AlertDialog — no native confirm())
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/site-supervisor/tasks?task_id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Delete failed (${res.status})`);
      }
      toast({ title: "Task deleted", description: `"${deleteTarget.title}" was removed.` });
      setDeleteTarget(null);
      await fetchTasks();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Review handlers
  // ---------------------------------------------------------------------------
  function openReview(task: Task, submission: TaskSubmission) {
    setReviewTask(task);
    setReviewSubmission(submission);
    setReviewAction(submission.status === "resubmitted" ? "request_changes" : "approve");
    setReviewFeedback(submission.feedback || "");
    setReviewScore(submission.score?.toString() || "");
  }

  async function handleSubmitReview() {
    if (!reviewTask || !reviewSubmission) return;
    if ((reviewAction === "request_changes" || reviewAction === "feedback") && !reviewFeedback.trim()) {
      toast({ title: "Feedback required", variant: "destructive" });
      return;
    }
    setReviewing(true);
    try {
      const res = await fetch(`/api/site-supervisor/tasks/${reviewTask.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: reviewSubmission.id,
          action: reviewAction,
          feedback: reviewFeedback.trim(),
          score: reviewScore ? parseFloat(reviewScore) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Review failed (${res.status})`);
      }
      toast({
        title:
          reviewAction === "approve"
            ? "Submission approved"
            : reviewAction === "request_changes"
              ? "Changes requested"
              : "Feedback added",
        description:
          reviewAction === "approve"
            ? "The next task is now unlocked for this student."
            : "The student has been notified.",
      });
      setReviewTask(null);
      setReviewSubmission(null);
      await fetchTasks();
    } catch (err: any) {
      toast({ title: "Review failed", description: err.message, variant: "destructive" });
    } finally {
      setReviewing(false);
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
        <PageHeader title="Tasks" description="Create and manage tasks for your students" />
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
        title="Tasks"
        description="Create tasks organized by Week → Day → Task. Assign to one or more of your students."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate} disabled={students.length === 0}>
              <Plus className="h-4 w-4 mr-2" /> New Task
            </Button>
          </div>
        }
      />

      {students.length === 0 && (
        <Card className="border-warning">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium">No students assigned</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can't create tasks until a coordinator assigns students to you.
                  Once students are assigned, you'll see them here and in the task creation form.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Tasks" value={tasks.length} icon={ListTodo} variant="info" />
        <StatCard
          label="Awaiting Review"
          value={tasks.filter((t) => t.submitted_count > 0 && t.approved_count < t.total_assigned).length}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          label="Completed"
          value={tasks.filter((t) => t.status === "completed").length}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Students"
          value={students.length}
          icon={Users}
          variant="default"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterWeek} onValueChange={setFilterWeek}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All weeks</SelectItem>
            {Array.from(tasksByWeek.keys()).map((wk) => (
              <SelectItem key={wk} value={wk.toString()}>
                {wk === "unsorted" ? "Unsorted" : `Week ${wk}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tasks grouped by week */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center text-center">
              <ListTodo className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No tasks yet.</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Create your first task to start guiding your students through their internship.
              </p>
              {students.length > 0 && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" /> Create your first task
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasksByWeek.map(([week, weekTasks]) => {
            const weekKey = week;
            const isExpanded = expandedWeeks.has(weekKey) || filterWeek !== "all";
            return (
              <Card key={weekKey}>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() => {
                    const next = new Set(expandedWeeks);
                    if (isExpanded) next.delete(weekKey);
                    else next.add(weekKey);
                    setExpandedWeeks(next);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <CardTitle className="text-lg">
                        {week === "unsorted" ? "Unsorted Tasks" : `Week ${week}`}
                      </CardTitle>
                      <Badge variant="outline">{weekTasks.length}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {weekTasks.filter((t) => t.status === "completed").length}/{weekTasks.length} completed
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-3 pt-0">
                    {weekTasks
                      .filter((t) => {
                        if (filterWeek !== "all") return true; // already filtered
                        if (searchQuery) {
                          const q = searchQuery.toLowerCase();
                          return t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
                        }
                        return true;
                      })
                      .map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onEdit={() => openEdit(task)}
                          onDelete={() => setDeleteTarget(task)}
                          onReview={(sub) => openReview(task, sub)}
                        />
                      ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog — pinned header/footer, scrollable content */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0"
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>{editingTask ? "Edit Task" : "Create New Task"}</DialogTitle>
            <DialogDescription>
              {editingTask
                ? "Update the task details. Student assignment changes apply to new students only."
                : "Fill in the task details. Fields marked optional can be left blank."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title">Task Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  placeholder="e.g., Set up Git & GitHub"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Week / Day / Priority */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="week">Week #</Label>
                  <Input
                    id="week"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={formData.week_number}
                    onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="day">Day #</Label>
                  <Input
                    id="day"
                    type="number"
                    min="1"
                    max="7"
                    placeholder="1"
                    value={formData.day_number}
                    onChange={(e) => setFormData({ ...formData, day_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v as any })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Task Description <span className="text-muted-foreground text-xs">(Markdown supported)</span></Label>
                <Textarea
                  id="description"
                  placeholder="Explain what the student should do, the goals, and any context..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Expected Deliverable */}
              <div className="space-y-1.5">
                <Label htmlFor="deliverable">
                  Expected Deliverable <span className="text-muted-foreground text-xs">(what the student should produce)</span>
                </Label>
                <Textarea
                  id="deliverable"
                  placeholder="e.g., A working GitHub repository with a README and 3 commits."
                  rows={2}
                  value={formData.expected_deliverable}
                  onChange={(e) => setFormData({ ...formData, expected_deliverable: e.target.value })}
                />
              </div>

              {/* Resources */}
              <div className="space-y-1.5">
                <Label htmlFor="resources">
                  Resources / References <span className="text-muted-foreground text-xs">(optional, Markdown)</span>
                </Label>
                <Textarea
                  id="resources"
                  placeholder="Links to docs, articles, research material..."
                  rows={2}
                  value={formData.resources}
                  onChange={(e) => setFormData({ ...formData, resources: e.target.value })}
                />
              </div>

              {/* YouTube URL */}
              <div className="space-y-1.5">
                <Label htmlFor="youtube">
                  YouTube Video URL <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <div className="relative">
                  <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="youtube"
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="pl-9"
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                  />
                </div>
              </div>

              {/* Due date + gating */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="due">
                    Due Date <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="due"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unlock Behavior</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="gate"
                      checked={formData.requires_previous_completion}
                      onCheckedChange={(v) =>
                        setFormData({ ...formData, requires_previous_completion: !!v })
                      }
                    />
                    <Label htmlFor="gate" className="text-sm font-normal cursor-pointer">
                      Require previous task approval before this one unlocks
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Student assignment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Assign to Students <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          student_user_ids: students.map((s) => s.user_id),
                        })
                      }
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setFormData({ ...formData, student_user_ids: [] })}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students assigned to you.</p>
                ) : (
                  <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                    {students.map((s) => {
                      const checked = formData.student_user_ids.includes(s.user_id);
                      return (
                        <label
                          key={s.user_id}
                          className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-accent/50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (v) {
                                setFormData({
                                  ...formData,
                                  student_user_ids: [...formData.student_user_ids, s.user_id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  student_user_ids: formData.student_user_ids.filter(
                                    (id) => id !== s.user_id
                                  ),
                                });
                              }
                            }}
                          />
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={s.avatar_url || undefined} />
                            <AvatarFallback>
                              {(s.full_name || s.email || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{s.full_name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t bg-background">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : editingTask ? (
                "Save Changes"
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" /> Create & Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog (replaces native confirm()) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  This will permanently delete <strong>“{deleteTarget.title}”</strong> and
                  remove all student submissions for this task. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Delete Task</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review dialog — pinned header/footer, scrollable content */}
      <Dialog open={!!reviewTask} onOpenChange={(v) => !v && setReviewTask(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Review Submission</DialogTitle>
            <DialogDescription>
              {reviewTask?.title} — {reviewSubmission?.student?.full_name || reviewSubmission?.student?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
            {reviewSubmission && (
              <div className="space-y-4 pb-2">
                {/* Task details */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Task
                  </h4>
                  <p className="font-medium">{reviewTask?.title}</p>
                  {reviewTask?.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {reviewTask.description}
                    </p>
                  )}
                  {reviewTask?.expected_deliverable && (
                    <p className="text-sm mt-2">
                      <span className="font-medium">Expected deliverable: </span>
                      <span className="text-muted-foreground">{reviewTask.expected_deliverable}</span>
                    </p>
                  )}
                </div>

                <Separator />

                {/* Student submission */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Student Submission
                  </h4>
                  {reviewSubmission.content && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{reviewSubmission.content}</p>
                    </div>
                  )}
                  {reviewSubmission.links && reviewSubmission.links.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Links</p>
                      <ul className="space-y-1">
                        {reviewSubmission.links.map((l, i) => (
                          <li key={i}>
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {l.label || l.url}
                              {l.type && (
                                <Badge variant="outline" className="text-xs">{l.type}</Badge>
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {reviewSubmission.tools_used && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Tools Used</p>
                      <p className="text-sm">{reviewSubmission.tools_used}</p>
                    </div>
                  )}
                  {reviewSubmission.skills_learned && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Skills Learned</p>
                      <p className="text-sm">{reviewSubmission.skills_learned}</p>
                    </div>
                  )}
                  {reviewSubmission.problems_solved && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Problems Solved</p>
                      <p className="text-sm whitespace-pre-wrap">{reviewSubmission.problems_solved}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Submitted: {new Date(reviewSubmission.submitted_at).toLocaleString()}
                  </p>
                </div>

                <Separator />

                {/* Review action */}
                <div className="space-y-3">
                  <Label>Action</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={reviewAction === "approve" ? "default" : "outline"}
                      onClick={() => setReviewAction("approve")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                    </Button>
                    <Button
                      type="button"
                      variant={reviewAction === "request_changes" ? "default" : "outline"}
                      onClick={() => setReviewAction("request_changes")}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" /> Request Changes
                    </Button>
                    <Button
                      type="button"
                      variant={reviewAction === "feedback" ? "default" : "outline"}
                      onClick={() => setReviewAction("feedback")}
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" /> Feedback Only
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="feedback">
                      Feedback {reviewAction !== "approve" && <span className="text-destructive">*</span>}
                    </Label>
                    <Textarea
                      id="feedback"
                      placeholder={
                        reviewAction === "approve"
                          ? "Optional praise or notes for the student..."
                          : reviewAction === "request_changes"
                            ? "Explain what needs to be changed before the student can resubmit..."
                            : "Provide feedback on the submission..."
                      }
                      rows={3}
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="score">
                      Score <span className="text-muted-foreground text-xs">(optional, 0-100)</span>
                    </Label>
                    <Input
                      id="score"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="85"
                      value={reviewScore}
                      onChange={(e) => setReviewScore(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t bg-background">
            <Button variant="outline" onClick={() => setReviewTask(null)} disabled={reviewing}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={reviewing}>
              {reviewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : reviewAction === "approve" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Unlock Next
                </>
              ) : reviewAction === "request_changes" ? (
                <>
                  <Send className="h-4 w-4 mr-2" /> Request Changes
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" /> Add Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskRow component — renders one task with its assignments/submissions
// ---------------------------------------------------------------------------
function TaskRow({
  task,
  onEdit,
  onDelete,
  onReview,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onReview: (submission: TaskSubmission) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completionPct =
    task.total_assigned === 0
      ? 0
      : Math.round((task.approved_count / task.total_assigned) * 100);

  const pendingSubs = task.submissions.filter(
    (s) => s.status === "submitted" || s.status === "resubmitted"
  );

  return (
    <div className="border rounded-lg p-3 hover:bg-accent/30">
      <div className="flex items-start gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{task.title}</p>
            {task.day_number && (
              <Badge variant="outline" className="text-xs">Day {task.day_number}</Badge>
            )}
            {task.priority && task.priority !== "medium" && (
              <Badge
                variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"}
                className="text-xs"
              >
                {task.priority}
              </Badge>
            )}
            {task.status === "completed" && (
              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
              </Badge>
            )}
            {pendingSubs.length > 0 && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-900 hover:bg-amber-100">
                <Clock className="h-3 w-3 mr-1" /> {pendingSubs.length} to review
              </Badge>
            )}
            {task.youtube_url && <Youtube className="h-3.5 w-3.5 text-red-500" />}
            {task.due_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.expected_deliverable && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">Deliverable:</span> {task.expected_deliverable}
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <Progress value={completionPct} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {task.approved_count}/{task.total_assigned} approved
            </span>
          </div>

          {/* Student chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {task.assignments?.slice(0, 5).map((a) => {
              const sub = task.submissions.find((s) => s.student_user_id === a.student_user_id);
              const status = sub?.status || a.status;
              return (
                <Badge
                  key={a.id}
                  variant="outline"
                  className={
                    "text-xs " +
                    (status === "approved"
                      ? "border-green-500 text-green-700"
                      : status === "submitted" || status === "resubmitted"
                        ? "border-amber-500 text-amber-700"
                        : "text-muted-foreground")
                  }
                >
                  {a.student?.full_name || a.student?.email || "—"}
                </Badge>
              );
            })}
            {task.assignments && task.assignments.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{task.assignments.length - 5} more
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          {pendingSubs.length > 0 && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setExpanded(true)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" /> Review ({pendingSubs.length})
            </Button>
          )}
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded: submissions list */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Student submissions</p>
          {task.assignments?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned.</p>
          ) : (
            <ul className="space-y-2">
              {task.assignments?.map((a) => {
                const sub = task.submissions.find((s) => s.student_user_id === a.student_user_id);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-2 rounded border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={a.student?.avatar_url || undefined} />
                        <AvatarFallback>
                          {(a.student?.full_name || a.student?.email || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {a.student?.full_name || a.student?.email || "Unnamed"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sub
                            ? `${sub.status} · ${new Date(sub.submitted_at).toLocaleDateString()}`
                            : `Not submitted · ${a.status}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub?.status === "submitted" || sub?.status === "resubmitted" ? (
                        <Button size="sm" variant="default" onClick={() => onReview(sub)}>
                          Review
                        </Button>
                      ) : sub?.status === "approved" ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {a.status}
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
