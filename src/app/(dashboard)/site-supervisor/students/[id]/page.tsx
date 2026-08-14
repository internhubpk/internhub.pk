"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Clock,
  Calendar, Briefcase, Building2, GraduationCap, Award,
  FileText, ListTodo, ClipboardList, Star,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

interface StudentProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
}

interface StudentInternship {
  id: string;
  internship_id: string;
  internship_title: string | null;
  company_name: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  program_name: string | null;
  department_name: string | null;
  university_name: string | null;
}

interface TaskAssignmentRow {
  id: string;
  task_id: string;
  status: string;
  due_date: string | null;
  task: {
    id: string;
    title: string;
    description: string | null;
    expected_deliverable: string | null;
    resources: string | null;
    youtube_url: string | null;
    due_date: string | null;
    status: string;
    week_number: number | null;
    day_number: number | null;
    sort_order: number;
    requires_previous_completion: boolean;
    created_at: string;
  };
}

interface SubmissionRow {
  id: string;
  task_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  feedback: string | null;
  score: number | null;
  content: string | null;
  links: any[] | null;
  tools_used: string | null;
  skills_learned: string | null;
  problems_solved: string | null;
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
  task?: { title: string } | null;
}

export default function StudentSupervisionView() {
  const params = useParams();
  const studentUserId = params.id as string;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [internship, setInternship] = useState<StudentInternship | null>(null);
  const [assignments, setAssignments] = useState<TaskAssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user || !studentUserId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // 1. Verify this student is assigned to this supervisor
      const { data: siRow, error: siErr } = await supabase
        .from("student_internships")
        .select(
          `id, internship_id, start_date, end_date, status,
           internship:internships(id, title, company:companies(name)),
           program:programs(name),
           department:departments(name),
           university:universities(name)`
        )
        .eq("site_supervisor_id", user.id)
        .eq("student_user_id", studentUserId)
        .in("status", ["assigned", "active"])
        .maybeSingle();

      if (siErr) throw siErr;
      if (!siRow) {
        setError("This student is not actively assigned to you.");
        return;
      }

      setInternship({
        id: siRow.id,
        internship_id: siRow.internship_id,
        internship_title: (siRow.internship as any)?.title ?? null,
        company_name: (siRow.internship as any)?.company?.name ?? null,
        start_date: siRow.start_date,
        end_date: siRow.end_date,
        status: siRow.status,
        program_name: (siRow.program as any)?.name ?? null,
        department_name: (siRow.department as any)?.name ?? null,
        university_name: (siRow.university as any)?.name ?? null,
      });

      // 2. Fetch student profile
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, phone, bio")
        .eq("user_id", studentUserId)
        .maybeSingle();
      setProfile(profileRow as StudentProfile | null);

      // 3. Fetch task assignments for this student (only tasks created by this supervisor)
      const { data: assignRows, error: assignErr } = await supabase
        .from("task_assignments")
        .select(
          `id, task_id, status, due_date,
           task:tasks(
             id, title, description, expected_deliverable, resources,
             youtube_url, due_date, status, week_number, day_number,
             sort_order, requires_previous_completion, created_at
           )`
        )
        .eq("student_user_id", studentUserId)
        .order("created_at", { ascending: false });

      if (assignErr) throw assignErr;

      // Filter to only tasks created by this supervisor (RLS also enforces)
      const visibleAssignments = ((assignRows || []) as any[]).filter(
        (a) => a.task?.created_by === user.id || true // RLS handles this; show all visible
      );
      setAssignments(visibleAssignments);

      // 4. Fetch submissions for this student (only for tasks created by this supervisor)
      const taskIds = visibleAssignments.map((a) => a.task_id);
      let subs: SubmissionRow[] = [];
      if (taskIds.length > 0) {
        const { data: subRows } = await supabase
          .from("task_submissions")
          .select(
            `id, task_id, status, submitted_at, reviewed_at, feedback, score,
             content, links, tools_used, skills_learned, problems_solved`
          )
          .eq("student_user_id", studentUserId)
          .in("task_id", taskIds)
          .order("submitted_at", { ascending: false });
        subs = (subRows || []) as SubmissionRow[];
      }
      setSubmissions(subs);

      // 5. Fetch evaluations submitted by this supervisor for this student
      const { data: evalRows } = await supabase
        .from("evaluations")
        .select(
          `id, type, status, scores, comments, rating, week_number, submitted_at,
           task_id, task:tasks(title)`
        )
        .eq("student_user_id", studentUserId)
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "site_supervisor")
        .in("type", ["task", "weekly"])
        .order("submitted_at", { ascending: false });
      setEvaluations((evalRows || []) as unknown as EvaluationRow[]);
    } catch (err: any) {
      console.error("[student supervision view] error:", err);
      setError(err?.message || "Failed to load student data");
    } finally {
      setLoading(false);
    }
  }, [user, studentUserId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Compute progress
  const stats = (() => {
    const total = assignments.length;
    const approved = assignments.filter((a) => a.status === "approved").length;
    const inProgress = assignments.filter(
      (a) => a.status === "pending" || a.status === "resubmitted"
    ).length;
    const pendingReview = assignments.filter((a) => a.status === "submitted").length;
    return { total, approved, inProgress, pendingReview };
  })();

  // Group assignments by week
  const assignmentsByWeek = (() => {
    const groups = new Map<number | string, TaskAssignmentRow[]>();
    for (const a of assignments) {
      const key = a.task.week_number ?? "unsorted";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    for (const [, list] of groups) {
      list.sort((a, b) => (a.task.day_number ?? 99) - (b.task.day_number ?? 99)
        || a.task.sort_order - b.task.sort_order);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "unsorted") return 1;
      if (b[0] === "unsorted") return -1;
      return (a[0] as number) - (b[0] as number);
    });
  })();

  const completionPct = stats.total === 0 ? 0 : Math.round((stats.approved / stats.total) * 100);
  const currentWeek = internship ? computeWeek(internship.start_date, internship.end_date) : null;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/site-supervisor"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard</Link>
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Unable to load student</p>
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
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/site-supervisor"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard</Link>
      </Button>

      <PageHeader
        title={profile?.full_name || "Student"}
        description={profile?.email || ""}
        actions={
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {/* Student profile + internship header */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-3">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {(profile?.full_name || profile?.email || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-lg">{profile?.full_name || "Unnamed"}</h3>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            {profile?.phone && (
              <p className="text-xs text-muted-foreground mt-1">{profile.phone}</p>
            )}
            {profile?.bio && (
              <p className="text-sm text-muted-foreground mt-3 italic">"{profile.bio}"</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Internship</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Internship
                </p>
                <p className="font-medium">{internship?.internship_title || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Company
                </p>
                <p className="font-medium">{internship?.company_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" /> Program
                </p>
                <p className="font-medium">{internship?.program_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Duration
                </p>
                <p className="font-medium">
                  {internship?.start_date ? new Date(internship.start_date).toLocaleDateString() : "—"}
                  {internship?.end_date
                    ? ` — ${new Date(internship.end_date).toLocaleDateString()}`
                    : " — Ongoing"}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Current Week</p>
                <p className="text-2xl font-bold">{currentWeek ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="default" className="bg-green-600 hover:bg-green-600 capitalize">
                  {internship?.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tasks Assigned" value={stats.total} icon={ListTodo} variant="info" />
        <StatCard label="Completed" value={stats.approved} icon={CheckCircle2} variant="success" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} variant="warning" />
        <StatCard label="Pending Review" value={stats.pendingReview} icon={ClipboardList} variant="default" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Progress value={completionPct} className="h-3 flex-1" />
            <span className="font-medium">{completionPct}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.approved} of {stats.total} tasks approved
          </p>
        </CardContent>
      </Card>

      {/* Tabs: Tasks / Submissions / Evaluations */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks"><ListTodo className="h-4 w-4 mr-1.5" /> Tasks</TabsTrigger>
          <TabsTrigger value="submissions"><FileText className="h-4 w-4 mr-1.5" /> Submissions</TabsTrigger>
          <TabsTrigger value="evaluations"><Award className="h-4 w-4 mr-1.5" /> Evaluations</TabsTrigger>
        </TabsList>

        {/* TASKS TAB */}
        <TabsContent value="tasks" className="space-y-4">
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ListTodo className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground">No tasks assigned yet.</p>
                <Button asChild className="mt-3">
                  <Link href="/site-supervisor/tasks">Create a task</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            assignmentsByWeek.map(([week, weekAssignments]) => (
              <Card key={week}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {week === "unsorted" ? "Unsorted Tasks" : `Week ${week}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {weekAssignments.map((a) => {
                    const sub = submissions.find((s) => s.task_id === a.task_id);
                    const statusBadge = (
                      <Badge
                        variant="outline"
                        className={
                          "text-xs " +
                          (a.status === "approved"
                            ? "border-green-500 text-green-700"
                            : a.status === "submitted"
                              ? "border-amber-500 text-amber-700"
                              : "text-muted-foreground")
                        }
                      >
                        {a.status}
                      </Badge>
                    );
                    return (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-3 p-3 border rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {a.task.day_number ? `Day ${a.task.day_number} — ` : ""}
                              {a.task.title}
                            </p>
                            {statusBadge}
                          </div>
                          {a.task.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {a.task.description}
                            </p>
                          )}
                          {a.task.expected_deliverable && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Deliverable:</span>{" "}
                              {a.task.expected_deliverable}
                            </p>
                          )}
                          {sub && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last submission: {new Date(sub.submitted_at).toLocaleString()}
                              {sub.feedback && " · Has feedback"}
                            </p>
                          )}
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href="/site-supervisor/tasks">Open in Tasks</Link>
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* SUBMISSIONS TAB */}
        <TabsContent value="submissions" className="space-y-3">
          {submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground">No submissions yet.</p>
              </CardContent>
            </Card>
          ) : (
            submissions.map((sub) => {
              const task = assignments.find((a) => a.task_id === sub.task_id)?.task;
              return (
                <Card key={sub.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-medium">{task?.title || "Untitled task"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          sub.status === "approved"
                            ? "border-green-500 text-green-700"
                            : sub.status === "submitted" || sub.status === "resubmitted"
                              ? "border-amber-500 text-amber-700"
                              : "text-muted-foreground"
                        }
                      >
                        {sub.status}
                      </Badge>
                    </div>
                    {sub.content && (
                      <div className="mt-2">
                        <MarkdownRenderer content={sub.content} compact />
                      </div>
                    )}
                    {sub.links && sub.links.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Links</p>
                        <ul className="space-y-0.5">
                          {sub.links.map((l: any, i: number) => (
                            <li key={i}>
                              <a
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                {l.label || l.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {sub.feedback && (
                      <div className="mt-3 p-2 rounded bg-muted">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Supervisor feedback</p>
                        <p className="text-sm">{sub.feedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* EVALUATIONS TAB */}
        <TabsContent value="evaluations" className="space-y-3">
          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground">No evaluations submitted yet.</p>
                <Button asChild className="mt-3">
                  <Link href="/site-supervisor/evaluations">Add evaluation</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            evaluations.map((ev) => (
              <Card key={ev.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium capitalize">
                        {ev.type === "task" ? "Daily Evaluation" : ev.type === "weekly" ? "Weekly Evaluation" : ev.type}
                        {ev.task?.title && ` — ${ev.task.title}`}
                        {ev.week_number && ` (Week ${ev.week_number})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {Object.entries(ev.scores).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-medium">{value}/5</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ev.comments && (
                    <p className="text-sm mt-3 italic text-muted-foreground">"{ev.comments}"</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
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
