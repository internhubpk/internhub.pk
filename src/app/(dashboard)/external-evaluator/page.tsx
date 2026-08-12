"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, ClipboardCheck, Users, Clock, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

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
      const [pendingRes, completedRes, studentsRes, recentRes] = await Promise.allSettled([
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
      ]);

      if (cancelled) return;

      const evaluationsAssigned =
        pendingRes.status === "fulfilled" ? pendingRes.value.count ?? 0 : 0;
      const evaluationsCompleted =
        completedRes.status === "fulfilled" ? completedRes.value.count ?? 0 : 0;
      // Distinct student count — derived client-side from the (possibly
      // unpaginated) student_user_id list. evaluations is scoped per
      // evaluator so this list is small enough to dedupe in JS.
      const studentRows =
        studentsRes.status === "fulfilled" ? (studentsRes.value.data ?? []) : [];
      const distinctStudents = new Set(
        studentRows.map((row: { student_user_id: string }) => row.student_user_id)
      );

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">External Evaluator Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {greetingName}. Manage your assigned evaluations below.
        </p>
      </div>

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
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
