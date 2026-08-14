"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  CheckCircle2, Clock, FileText, MessageSquare, Star,
  AlertCircle, RefreshCw, Building2, GraduationCap, User,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Evaluation {
  id: string;
  type: string;                  // 'task' | 'supervisor_evaluation' | 'weekly' | 'midterm' | 'final' | ...
  status: "pending" | "in_progress" | "submitted" | "approved" | "rejected";
  rating: number | null;         // 0-5
  scores: Record<string, any> | null;
  comments: string | null;
  submitted_at: string | null;
  created_at: string;
  evaluator_role: "site_supervisor" | "faculty_supervisor" | "external_evaluator" | "company_hr" | "super_admin" | string;
  evaluator_name: string | null;
  task_id: string | null;
  task_title: string | null;
  task_week: number | null;
  task_day: number | null;
  internship_title: string | null;
}

// Group evaluations by task (or by week/type for non-task evaluations).
//
// CRITICAL: weekly evaluations (type='weekly', task_id IS NULL) MUST be
// grouped by week_number — NOT by the literal string "weekly". The schema
// allows MULTIPLE weekly evaluations per student (one per week, per
// evaluator role). If all weekly evals share a single group key, the
// second+ weekly eval from the same role gets pushed to `otherEvaluations`
// and renders under "Additional Evaluations" with the literal role label
// — making it look like the student has multiple "Site Supervisor"
// entries when they actually have one site-supervisor eval per week.
//
// Same logic applies to midterm/final/supervisor_evaluation: each type
// gets its own group so multiple evaluators of the same type can
// contribute to a single group with separate site/faculty panels.
interface TaskGroup {
  key: string;                   // task_id | `weekly_<weekN>` | `midterm` | `final` | `supervisor_evaluation` | id
  taskTitle: string;
  weekNumber: number | null;
  dayNumber: number | null;
  internshipTitle: string | null;
  siteSupervisorEval: Evaluation | null;
  facultySupervisorEval: Evaluation | null;
  otherEvaluations: Evaluation[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function roleLabel(role: string): string {
  switch (role) {
    case "site_supervisor": return "Site Supervisor";
    case "faculty_supervisor": return "Faculty Supervisor";
    case "external_evaluator": return "External Evaluator";
    case "company_hr": return "Company HR";
    case "super_admin": return "Administrator";
    default: return role;
  }
}

function roleIcon(role: string) {
  switch (role) {
    case "site_supervisor": return Building2;
    case "faculty_supervisor": return GraduationCap;
    case "external_evaluator": return User;
    default: return User;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge variant="default" className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
    case "submitted":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Submitted</Badge>;
    case "pending":
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case "in_progress":
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
    case "rejected":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ratingStars(rating: number | null): React.ReactNode {
  if (rating === null || rating === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function groupByTask(evals: Evaluation[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();

  for (const e of evals) {
    // Determine the group key + display title for this evaluation.
    //
    // Priority:
    //   1. task_id (if set) — group all evals for the same task together,
    //      regardless of evaluator role. This lets us show "Site Supervisor"
    //      and "Faculty Supervisor" panels side-by-side for the same task.
    //
    //   2. `weekly_<weekN>` for type='weekly' — group by week so each week
    //      gets its own card. Without this, all weekly evals would lump
    //      into a single "weekly" group and the second+ eval per role
    //      would render under "Additional Evaluations" with the literal
    //      role label — looking like duplicate "Site Supervisor" entries.
    //
    //   3. The evaluation type itself for midterm/final/supervisor_evaluation
    //      — one group per type. Multiple evaluators of the same type can
    //      contribute to the same group's site/faculty/other panels.
    //
    //   4. The evaluation id (last-resort fallback) — guarantees each
    //      evaluation gets its own group if it doesn't match any of the
    //      above. Prevents accidental grouping of unrelated evals.
    let key: string;
    let taskTitle: string;
    let weekNumber: number | null = null;
    let dayNumber: number | null = null;

    if (e.task_id) {
      key = e.task_id;
      taskTitle = e.task_title || "Untitled Task";
      weekNumber = e.task_week ?? null;
      dayNumber = e.task_day ?? null;
    } else if (e.type === "weekly") {
      // Group by week_number. If week_number is null, fall back to a
      // unique key per evaluation so unrelated weekly evals don't get
      // lumped together.
      const wk = e.task_week ?? null;
      if (wk !== null) {
        key = `weekly_${wk}`;
        taskTitle = `Weekly Evaluation — Week ${wk}`;
      } else {
        key = `weekly_${e.id}`;
        taskTitle = "Weekly Evaluation";
      }
      weekNumber = wk;
    } else if (e.type === "midterm") {
      key = "midterm";
      taskTitle = "Midterm Evaluation";
    } else if (e.type === "final") {
      key = "final";
      taskTitle = "Final Evaluation";
    } else if (e.type === "supervisor_evaluation") {
      key = "supervisor_evaluation";
      taskTitle = "Supervisor Evaluation";
    } else if (e.type === "company_evaluation") {
      key = "company_evaluation";
      taskTitle = "Company Evaluation";
    } else if (e.type === "weekly_log") {
      // Legacy weekly_log type — group by week_number if available.
      const wk = e.task_week ?? null;
      if (wk !== null) {
        key = `weekly_log_${wk}`;
        taskTitle = `Weekly Log — Week ${wk}`;
      } else {
        key = `weekly_log_${e.id}`;
        taskTitle = "Weekly Log";
      }
      weekNumber = wk;
    } else {
      // Unknown type — group by id to avoid accidental merging.
      key = `other_${e.id}`;
      taskTitle = e.type ? e.type.replace(/_/g, " ") : "Evaluation";
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        taskTitle,
        weekNumber,
        dayNumber,
        internshipTitle: e.internship_title ?? null,
        siteSupervisorEval: null,
        facultySupervisorEval: null,
        otherEvaluations: [],
      });
    }
    const g = groups.get(key)!;
    if (e.evaluator_role === "site_supervisor" && !g.siteSupervisorEval) {
      g.siteSupervisorEval = e;
    } else if (e.evaluator_role === "faculty_supervisor" && !g.facultySupervisorEval) {
      g.facultySupervisorEval = e;
    } else {
      g.otherEvaluations.push(e);
    }
  }

  // Sort: by week asc (nulls last), then day asc, then task title.
  return Array.from(groups.values()).sort((a, b) => {
    const wA = a.weekNumber ?? 9999;
    const wB = b.weekNumber ?? 9999;
    if (wA !== wB) return wA - wB;
    const dA = a.dayNumber ?? 9999;
    const dB = b.dayNumber ?? 9999;
    if (dA !== dB) return dA - dB;
    return a.taskTitle.localeCompare(b.taskTitle);
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function StudentEvaluationsPage() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "task" | "weekly" | "approved" | "pending">("all");

  async function fetchEvaluations() {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch evaluations for current student with joined evaluator profile,
      // task info, and internship info. RLS (can_select_evaluation) ensures
      // we only see our own evaluations — including both site-supervisor
      // and faculty-supervisor evaluations.
      const { data, error } = await supabase
        .from("evaluations")
        .select(`
          id, type, status, rating, scores, comments,
          submitted_at, created_at, evaluator_role, week_number,
          task_id, internship_id,
          evaluator:profiles!evaluations_evaluator_id_fkey(full_name),
          task:tasks(title, week_number, day_number),
          internship:internships(title)
        `)
        .eq("student_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows: Evaluation[] = (data || []).map((e: any) => ({
        id: e.id,
        type: e.type || "Evaluation",
        status: e.status || "pending",
        rating: typeof e.rating === "number" ? e.rating : null,
        scores: e.scores || null,
        comments: e.comments,
        submitted_at: e.submitted_at,
        created_at: e.created_at,
        evaluator_role: e.evaluator_role || "unknown",
        evaluator_name: e.evaluator?.full_name || null,
        task_id: e.task_id ?? null,
        task_title: e.task?.title ?? null,
        task_week: e.task?.week_number ?? e.week_number ?? null,
        task_day: e.task?.day_number ?? null,
        internship_title: e.internship?.title ?? null,
      }));

      setEvaluations(rows);
    } catch (err: any) {
      console.error("Error fetching evaluations:", err);
      setError(err?.message || "Failed to load evaluations");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchEvaluations();
  }, [user]);

  const taskGroups = groupByTask(evaluations);

  const filteredGroups = taskGroups.filter((g) => {
    if (filter === "all") return true;
    // A group is a "task" evaluation if its key is a task_id (UUID-like).
    // A group is "weekly" if its key starts with "weekly" (covers both
    // `weekly_<N>` and the legacy `weekly_log_<N>`).
    if (filter === "task") return !g.key.startsWith("weekly") && !["midterm", "final", "supervisor_evaluation", "company_evaluation"].includes(g.key);
    if (filter === "weekly") return g.key.startsWith("weekly");
    if (filter === "approved") {
      return (g.siteSupervisorEval?.status === "approved") ||
             (g.facultySupervisorEval?.status === "approved");
    }
    if (filter === "pending") {
      return (!g.siteSupervisorEval || g.siteSupervisorEval.status === "pending") ||
             (!g.facultySupervisorEval || g.facultySupervisorEval.status === "pending");
    }
    return true;
  });

  // Aggregate stats
  const stats = {
    total: evaluations.length,
    approved: evaluations.filter((e) => e.status === "approved").length,
    pending: evaluations.filter((e) => e.status === "pending" || e.status === "in_progress").length,
    siteEvalCount: evaluations.filter((e) => e.evaluator_role === "site_supervisor").length,
    facultyEvalCount: evaluations.filter((e) => e.evaluator_role === "faculty_supervisor").length,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="My Evaluations" description="Feedback and ratings from your supervisors." />
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="My Evaluations" description="Feedback and ratings from your supervisors." />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Failed to load evaluations</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button onClick={fetchEvaluations} variant="outline" size="sm" className="mt-3">
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
        title="My Evaluations"
        description="Feedback and ratings from your Site Supervisor and Faculty Supervisor. Each task can be evaluated independently by both."
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Evaluations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.siteEvalCount}</p>
                <p className="text-xs text-muted-foreground">Site Supervisor</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.facultyEvalCount}</p>
                <p className="text-xs text-muted-foreground">Faculty Supervisor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="task">Task Evaluations</TabsTrigger>
          <TabsTrigger value="weekly">Weekly / Program</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4 space-y-4">
          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">
                    {evaluations.length === 0
                      ? "No evaluations yet."
                      : "No evaluations match this filter."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Evaluations will appear here once your supervisors review your work.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredGroups.map((group) => (
              <motion.div
                key={group.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                          {group.taskTitle}
                          {group.weekNumber && (
                            <Badge variant="outline" className="text-xs">
                              Week {group.weekNumber}
                              {group.dayNumber ? ` · Day ${group.dayNumber}` : ""}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {group.internshipTitle || "Internship evaluation"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Site Supervisor evaluation */}
                      <EvaluationPanel
                        title="Site Supervisor"
                        icon={Building2}
                        accentColor="purple"
                        evaluation={group.siteSupervisorEval}
                      />
                      {/* Faculty Supervisor evaluation */}
                      <EvaluationPanel
                        title="Faculty Supervisor"
                        icon={GraduationCap}
                        accentColor="amber"
                        evaluation={group.facultySupervisorEval}
                      />
                    </div>

                    {/* Other evaluations (external evaluator, etc.) */}
                    {group.otherEvaluations.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          Additional Evaluations
                        </p>
                        <div className="space-y-2">
                          {group.otherEvaluations.map((e) => (
                            <div key={e.id} className="text-sm border rounded p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{roleLabel(e.evaluator_role)}</span>
                                {statusBadge(e.status)}
                              </div>
                              {ratingStars(e.rating)}
                              {e.comments && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  <MarkdownRenderer content={e.comments} compact />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvaluationPanel — renders one evaluator's evaluation (or "Pending" state)
// ---------------------------------------------------------------------------
function EvaluationPanel({
  title,
  icon: Icon,
  accentColor,
  evaluation,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: "purple" | "amber";
  evaluation: Evaluation | null;
}) {
  const accentClasses =
    accentColor === "purple"
      ? "from-purple-50 to-white dark:from-purple-950/40 dark:to-background border-purple-200 dark:border-purple-900"
      : "from-amber-50 to-white dark:from-amber-950/40 dark:to-background border-amber-200 dark:border-amber-900";

  const iconClasses =
    accentColor === "purple"
      ? "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
      : "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400";

  if (!evaluation) {
    return (
      <div className={`rounded-lg border bg-gradient-to-br p-4 ${accentClasses}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${iconClasses}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">Evaluation</p>
            </div>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Awaiting evaluation from your {title.toLowerCase()}.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-gradient-to-br p-4 ${accentClasses}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${iconClasses}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">
              {evaluation.evaluator_name || "Evaluator"}
            </p>
          </div>
        </div>
        {statusBadge(evaluation.status)}
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Rating</p>
          {ratingStars(evaluation.rating)}
        </div>

        {evaluation.scores && Object.keys(evaluation.scores).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Criteria Scores</p>
            <div className="space-y-1">
              {Object.entries(evaluation.scores).slice(0, 5).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-medium">{String(v)}/10</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {evaluation.comments && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Comments</p>
            <div className="text-sm whitespace-pre-wrap bg-white/60 dark:bg-black/20 rounded p-2">
              <MarkdownRenderer content={evaluation.comments} compact />
            </div>
          </div>
        )}

        {evaluation.submitted_at && (
          <p className="text-xs text-muted-foreground pt-1">
            Submitted: {new Date(evaluation.submitted_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
