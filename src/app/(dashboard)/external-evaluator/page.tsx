"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, ClipboardCheck, Users, Clock, CheckCircle, GraduationCap, CheckSquare, ScrollText, Send, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

type EvaluationStatus = "pending" | "in_progress" | "submitted" | "approved" | "rejected";

interface Evaluation {
  id: string;
  student_name: string;
  student_email?: string;
  type: string;
  status: EvaluationStatus;
  rating: number | null;
  submitted_at: string | null;
  created_at: string | null;
}

interface DashboardStats {
  evaluationsAssigned: number;
  evaluationsCompleted: number;
  studentsAssigned: number;
}

const STATUS_BADGE_VARIANT: Record<EvaluationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  in_progress: "default",
  submitted: "default",
  approved: "default",
  rejected: "destructive",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function formatType(type: string | null | undefined): string {
  if (!type) return "Evaluation";
  return type.replace(/_/g, " ");
}

export default function ExternalEvaluatorDashboard() {
  const { user, profile } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    evaluationsAssigned: 0,
    evaluationsCompleted: 0,
    studentsAssigned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      // Without an authenticated user there is nothing to fetch. Bail out of
      // the loading state so the page doesn't spin forever.
      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const supabase = createClient();

      const evaluatorId = user.id;
      const evaluatorRole = "external_evaluator";

      // All queries are scoped by evaluator_id = user.id (which matches
      // profiles.user_id, which evaluations.evaluator_id references) and
      // evaluator_role = 'external_evaluator'. RLS will further enforce this.
      //
      // We ALSO query student_internships.external_evaluator_id (migration
      // 0071) to count students who are assigned to this external
      // evaluator but may not yet have an evaluation row. This gives a
      // more accurate "Students Assigned" count than the evaluations-only
      // query below.
      const [pendingRes, completedRes, studentsRes, recentRes, assignedStudentsRes] = await Promise.allSettled([
        supabase
          .from("evaluations")
          .select("id", { count: "exact", head: true })
          .eq("evaluator_id", evaluatorId)
          .eq("evaluator_role", evaluatorRole)
          .in("status", ["pending", "in_progress"]),
        supabase
          .from("evaluations")
          .select("id", { count: "exact", head: true })
          .eq("evaluator_id", evaluatorId)
          .eq("evaluator_role", evaluatorRole)
          .in("status", ["submitted", "approved"]),
        supabase
          .from("evaluations")
          .select("student_user_id")
          .eq("evaluator_id", evaluatorId)
          .eq("evaluator_role", evaluatorRole),
        supabase
          .from("evaluations")
          .select(
            `
            id,
            type,
            status,
            rating,
            submitted_at,
            created_at,
            student_user_id,
            student_profile:student_user_id(full_name, email, avatar_url)
          `
          )
          .eq("evaluator_id", evaluatorId)
          .eq("evaluator_role", evaluatorRole)
          .order("created_at", { ascending: false })
          .limit(5),
        // New: also fetch students assigned via student_internships.external_evaluator_id
        supabase
          .from("student_internships")
          .select("student_user_id, status")
          .eq("external_evaluator_id", evaluatorId)
          .in("status", ["assigned", "active"]),
      ]);

      if (cancelled) return;

      const evaluationsAssigned =
        pendingRes.status === "fulfilled" ? pendingRes.value.count ?? 0 : 0;
      const evaluationsCompleted =
        completedRes.status === "fulfilled" ? completedRes.value.count ?? 0 : 0;
      // Distinct student count — UNION of:
      //   (a) students with an evaluation row for this evaluator
      //   (b) students assigned via student_internships.external_evaluator_id
      // This gives an accurate count of "students this external evaluator
      // is responsible for" — including those who haven't been evaluated
      // yet but are formally assigned.
      const evalStudentRows =
        studentsRes.status === "fulfilled" ? (studentsRes.value.data ?? []) : [];
      const assignedStudentRows =
        assignedStudentsRes.status === "fulfilled" ? (assignedStudentsRes.value.data ?? []) : [];
      const distinctStudents = new Set<string>();
      evalStudentRows.forEach((row: { student_user_id: string }) => {
        if (row.student_user_id) distinctStudents.add(row.student_user_id);
      });
      assignedStudentRows.forEach((row: { student_user_id: string }) => {
        if (row.student_user_id) distinctStudents.add(row.student_user_id);
      });

      setStats({
        evaluationsAssigned,
        evaluationsCompleted,
        studentsAssigned: distinctStudents.size,
      });

      const recentRows =
        recentRes.status === "fulfilled" ? (recentRes.value.data ?? []) : [];
      const recent: Evaluation[] = recentRows.map((row: any) => ({
        id: row.id,
        student_name: row.student_profile?.full_name || "Unknown Student",
        student_email: row.student_profile?.email,
        type: row.type,
        status: (row.status as EvaluationStatus) ?? "pending",
        rating: typeof row.rating === "number" ? row.rating : null,
        submitted_at: row.submitted_at ?? null,
        created_at: row.created_at ?? null,
      }));

      setEvaluations(recent);
      setIsLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const greetingName =
    profile?.full_name || profile?.first_name || (user?.email ? user.email.split("@")[0] : "Evaluator");

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="External Evaluator Dashboard"
        description={`Welcome back, ${greetingName}. Manage your assigned evaluations below.`}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Evaluations</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.evaluationsAssigned}</div>
            <p className="text-xs text-muted-foreground">Awaiting your review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.evaluationsCompleted}</div>
            <p className="text-xs text-muted-foreground">Successfully evaluated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students Assigned</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.studentsAssigned}</div>
            <p className="text-xs text-muted-foreground">Distinct students</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions — link to the full site-supervisor feature set */}
      <Card>
        <CardHeader>
          <CardTitle>Supervision Tools</CardTitle>
          <CardDescription>
            As an external evaluator, you have the full supervisor toolkit —
            manage your assigned students, create and review tasks, sign
            weekly logs, and submit evaluations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/site-supervisor/students"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Assigned Students</p>
                <p className="text-xs text-muted-foreground">View & manage your students</p>
              </div>
            </Link>
            <Link
              href="/site-supervisor/tasks"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-medium">Tasks</p>
                <p className="text-xs text-muted-foreground">Assign & review student work</p>
              </div>
            </Link>
            <Link
              href="/site-supervisor/evaluations"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium">Evaluations</p>
                <p className="text-xs text-muted-foreground">Submit HEC-aligned evaluations</p>
              </div>
            </Link>
            <Link
              href="/site-supervisor/weekly-logs"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ScrollText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium">Weekly Logs</p>
                <p className="text-xs text-muted-foreground">Review & sign weekly logs</p>
              </div>
            </Link>
            <Link
              href="/site-supervisor/notifications"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <Send className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">Message your assigned students</p>
              </div>
            </Link>
            <Link
              href="/site-supervisor/settings"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center">
                <Settings className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="font-medium">Settings</p>
                <p className="text-xs text-muted-foreground">Change your password</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Evaluations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Recent Evaluations</CardTitle>
            <CardDescription>Your latest evaluation assignments</CardDescription>
          </div>
          <Link href="/external-evaluator/evaluations">
            <Button variant="outline" size="sm">
              View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : evaluations.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No evaluations assigned</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ll see assigned evaluations here once they&apos;re allocated to you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluations.map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{evaluation.student_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {formatType(evaluation.type)}
                    </p>
                    {evaluation.student_email && (
                      <p className="text-xs text-muted-foreground">{evaluation.student_email}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {evaluation.status === "submitted" || evaluation.status === "approved"
                        ? `Submitted: ${formatDate(evaluation.submitted_at)}`
                        : `Assigned: ${formatDate(evaluation.created_at)}`}
                    </span>
                    {evaluation.rating !== null && (
                      <Badge variant="outline">Rating: {evaluation.rating}/5</Badge>
                    )}
                    <Badge variant={STATUS_BADGE_VARIANT[evaluation.status] || "secondary"}>
                      {evaluation.status.replace("_", " ")}
                    </Badge>
                    <Link href="/external-evaluator/evaluations">
                      <Button size="sm">Review</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
