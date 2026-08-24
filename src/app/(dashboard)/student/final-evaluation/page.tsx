"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Award,
  Building2,
  TrendingUp,
  CheckCircle2,
  Clock,
  Lock,
  BarChart3,
  FileText,
  ClipboardList,
  Activity,
  GraduationCap,
  Calculator,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

// -----------------------------------------------------------------------------
// Types — matching the shape persisted by computeFinalGrade().
// -----------------------------------------------------------------------------

interface FinalGradeRow {
  id: string;
  student_id: string;
  internship_id: string;
  site_supervisor_score: number | null;
  student_reports_score: number | null;
  faculty_supervisor_score: number | null;
  activity_log_score: number | null;
  final_score: number | null;
  letter_grade: string | null;
  status: "pending" | "computed" | "locked" | "failed" | string;
  metadata: Record<string, unknown> | null;
  computed_at: string | null;
  // DC subcriteria (from migration 0088)
  dc_evidence_score?: number | null;
  dc_reflection_score?: number | null;
  dc_clarity_score?: number | null;
  dc_work_learning_score?: number | null;
  department_coordinator_report_score?: number | null;
  dc_evaluator_id?: string | null;
  dc_evaluated_at?: string | null;
  dc_evaluation_comments?: string | null;
  updated_at: string | null;
}

interface InternshipRow {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  duration_weeks: number | null;
  company_name: string | null;
}

interface FinalEvaluationData {
  internship: InternshipRow;
  finalGrade: FinalGradeRow | null;
}

// -----------------------------------------------------------------------------
// Weights — MUST mirror src/lib/final-grade.ts FINAL_GRADE_WEIGHTS.
// Kept in sync here for display purposes only (the server is the source of
// truth for actual calculations).
// -----------------------------------------------------------------------------

const WEIGHTS = {
  site_supervisor: 0.4,
  student_reports: 0.3,
  faculty_supervisor: 0.25,
  activity_log: 0.05,
};

// -----------------------------------------------------------------------------
// Page component
// -----------------------------------------------------------------------------

export default function StudentFinalEvaluationPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<FinalEvaluationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.role !== "student") {
      setError("Only students can access this page.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all the student's internships (via student_internships join).
      const { data: siRows, error: siErr } = await supabase
        .from("student_internships")
        .select("id, internship_id, status")
        .eq("student_user_id", user.id)
        .order("created_at", { ascending: false });

      if (siErr) throw siErr;
      const si = siRows || [];
      if (si.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const internshipIds = si.map((r) => r.internship_id).filter(Boolean) as string[];

      // 2. Fetch internship details.
      const { data: internships, error: iErr } = await supabase
        .from("internships")
        .select(`
          id,
          title,
          status,
          start_date,
          end_date,
          duration_weeks,
          companies:company_id(name)
        `)
        .in("id", internshipIds);

      if (iErr) throw iErr;

      // 3. Fetch final_grades for these internships.
      const { data: finalGrades, error: fgErr } = await supabase
        .from("final_grades")
        .select("*")
        .eq("student_id", user.id)
        .in("internship_id", internshipIds);

      if (fgErr) throw fgErr;

      // 4. Build the merged dataset.
      const merged: FinalEvaluationData[] = (internships || []).map((internship: any) => {
        const finalGrade = (finalGrades || []).find(
          (fg) => fg.internship_id === internship.id
        ) as FinalGradeRow | undefined;
        return {
          internship: {
            id: internship.id,
            title: internship.title,
            status: internship.status,
            start_date: internship.start_date,
            end_date: internship.end_date,
            duration_weeks: internship.duration_weeks,
            company_name: internship.companies?.name || null,
          },
          finalGrade: finalGrade || null,
        };
      });

      setData(merged);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[student/final-evaluation] load:", msg);
      setError("Unable to load final evaluations: " + msg);
      toast.error("Unable to load final evaluations", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [user, profile, supabase]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const handleRecalculate = async (internshipId: string) => {
    if (!user) return;
    setRecalculating(internshipId);
    try {
      const response = await fetch("/api/final-grades/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: user.id,
          internship_id: internshipId,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to compute final grade");
      }
      toast.success("Final evaluation updated", {
        description:
          json.data?.status === "computed"
            ? `Final score: ${json.data.final_score}/100 (${json.data.letter_grade || "—"}).`
            : `Status: ${json.data?.status || "pending"}. Some components are still incomplete.`,
      });
      // Refresh the data.
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[student/final-evaluation] recalculate:", msg);
      toast.error("Failed to compute final grade", { description: msg });
    } finally {
      setRecalculating(null);
    }
  };

  // ----- Render -----
  if (authLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile || profile.role !== "student") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm">
                Only students can access this page. Please sign in with a student account.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Final Evaluation"
        description="Your final internship evaluation breakdown. The 30% 'Student Reports' component is the Department Coordinator's evaluation of your weekly reports — based on evidence-based reporting, reflection, clarity, and the connection between work and learning."
      />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm">{error}</p>
                <Button size="sm" variant="outline" onClick={() => loadData()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No internships found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Once you have an internship and your supervisors submit evaluations, your final evaluation will appear here.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/student/internships">Browse Internships</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.map(({ internship, finalGrade }) => (
            <FinalEvaluationCard
              key={internship.id}
              internship={internship}
              finalGrade={finalGrade}
              recalculating={recalculating === internship.id}
              onRecalculate={() => handleRecalculate(internship.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Per-internship card showing the 4-component breakdown.
// -----------------------------------------------------------------------------

interface FinalEvaluationCardProps {
  internship: InternshipRow;
  finalGrade: FinalGradeRow | null;
  recalculating: boolean;
  onRecalculate: () => void;
}

function FinalEvaluationCard({ internship, finalGrade, recalculating, onRecalculate }: FinalEvaluationCardProps) {
  // Compute contributions and component availability.
  const components = useMemo(() => {
    const fg = finalGrade;
    const siteScore = fg?.site_supervisor_score ?? null;
    const reportsScore = fg?.student_reports_score ?? null;
    const facultyScore = fg?.faculty_supervisor_score ?? null;
    const activityScore = fg?.activity_log_score ?? null;

    const siteContribution = siteScore !== null ? siteScore * WEIGHTS.site_supervisor : null;
    const reportsContribution = reportsScore !== null ? reportsScore * WEIGHTS.student_reports : null;
    const facultyContribution = facultyScore !== null ? facultyScore * WEIGHTS.faculty_supervisor : null;
    const activityContribution = activityScore !== null ? activityScore * WEIGHTS.activity_log : null;

    const availableCount = [siteScore, reportsScore, facultyScore, activityScore].filter(
      (v) => v !== null
    ).length;

    let statusLabel: string;
    let statusVariant: "default" | "secondary" | "destructive" | "outline";
    let statusIcon: React.ReactNode;
    if (!fg) {
      statusLabel = "Not Started";
      statusVariant = "outline";
      statusIcon = <Clock className="h-3 w-3" />;
    } else if (fg.status === "locked") {
      statusLabel = "Locked";
      statusVariant = "default";
      statusIcon = <Lock className="h-3 w-3" />;
    } else if (fg.status === "computed") {
      statusLabel = "Computed";
      statusVariant = "default";
      statusIcon = <CheckCircle2 className="h-3 w-3" />;
    } else if (availableCount === 0) {
      statusLabel = "Pending";
      statusVariant = "outline";
      statusIcon = <Clock className="h-3 w-3" />;
    } else {
      statusLabel = `Partially Evaluated (${availableCount}/4)`;
      statusVariant = "secondary";
      statusIcon = <Clock className="h-3 w-3" />;
    }

    return {
      siteScore,
      reportsScore,
      facultyScore,
      activityScore,
      siteContribution,
      reportsContribution,
      facultyContribution,
      activityContribution,
      availableCount,
      statusLabel,
      statusVariant,
      statusIcon,
    };
  }, [finalGrade]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Award className="h-5 w-5" />
              {internship.title || "Untitled Internship"}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {internship.company_name || "Unknown company"}
              </span>
              <span>•</span>
              <Badge variant="outline">{internship.status}</Badge>
              {internship.start_date && (
                <>
                  <span>•</span>
                  <span>{new Date(internship.start_date).toLocaleDateString()}</span>
                  {internship.end_date && (
                    <span>→ {new Date(internship.end_date).toLocaleDateString()}</span>
                  )}
                </>
              )}
              {internship.duration_weeks && (
                <>
                  <span>•</span>
                  <span>{internship.duration_weeks} weeks</span>
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={components.statusVariant} className="flex items-center gap-1">
              {components.statusIcon}
              {components.statusLabel}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onRecalculate}
              disabled={recalculating || finalGrade?.status === "locked"}
              title={finalGrade?.status === "locked" ? "Final grade is locked and cannot be recalculated." : "Refresh the calculation"}
            >
              {recalculating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculating…
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Recalculate
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Final score banner */}
        <div className="rounded-lg border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 md:p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Final Score
              </div>
              {finalGrade?.final_score !== null && finalGrade?.final_score !== undefined ? (
                <div className="text-4xl md:text-5xl font-bold tabular-nums">
                  {Number(finalGrade.final_score).toFixed(2)}
                  <span className="text-lg text-muted-foreground font-normal">/100</span>
                </div>
              ) : (
                <div className="text-2xl text-muted-foreground font-medium">
                  {components.availableCount === 0
                    ? "Awaiting evaluation components"
                    : `${components.availableCount}/4 components submitted`}
                </div>
              )}
            </div>
            {finalGrade?.letter_grade && (
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Letter Grade
                </div>
                <div className="text-5xl font-bold">{finalGrade.letter_grade}</div>
              </div>
            )}
          </div>
          {components.availableCount > 0 && components.availableCount < 4 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Final grade is pending — {4 - components.availableCount} component
              {4 - components.availableCount === 1 ? "" : "s"} still need
              {4 - components.availableCount === 1 ? "s" : ""} to be submitted before the final score can be computed.
            </p>
          )}
        </div>

        {/* Component breakdown */}
        <div className="grid gap-4 md:grid-cols-2">
          <ComponentCard
            label="Site Supervisor Evaluation"
            weight="40%"
            score={components.siteScore}
            contribution={components.siteContribution}
            icon={<Building2 className="h-5 w-5" />}
            description="Evaluation submitted by your industry/site supervisor at the host organization."
          />
          <ComponentCard
            label="Student Reports — Department Coordinator Evaluation"
            weight="30%"
            score={components.reportsScore}
            contribution={components.reportsContribution}
            icon={<ClipboardList className="h-5 w-5" />}
            description="Department Coordinator evaluation of your weekly reports. Subcriteria: evidence-based reporting, reflection, clarity, and connection between work and learning."
            subcriteria={
              finalGrade && (finalGrade.dc_evidence_score !== undefined || finalGrade.dc_evidence_score !== null) && finalGrade.dc_evaluator_id
                ? {
                    evidence: finalGrade.dc_evidence_score ?? null,
                    reflection: finalGrade.dc_reflection_score ?? null,
                    clarity: finalGrade.dc_clarity_score ?? null,
                    work_learning: finalGrade.dc_work_learning_score ?? null,
                    evaluated_at: finalGrade.dc_evaluated_at || null,
                    comments: finalGrade.dc_evaluation_comments || null,
                  }
                : null
            }
          />
          <ComponentCard
            label="Faculty Supervisor Evaluation"
            weight="25%"
            score={components.facultyScore}
            contribution={components.facultyContribution}
            icon={<GraduationCap className="h-5 w-5" />}
            description="Academic evaluation by your assigned faculty supervisor (midterm + final)."
          />
          <ComponentCard
            label="Activity Log Completion"
            weight="5%"
            score={components.activityScore}
            contribution={components.activityContribution}
            icon={<Activity className="h-5 w-5" />}
            description="Completion ratio of your weekly activity logs vs. expected weeks."
          />
        </div>

        {/* Calculation detail */}
        {finalGrade?.final_score !== null && finalGrade?.final_score !== undefined && (
          <Card className="bg-muted/30 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Calculation Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5 font-mono tabular-nums">
              {components.siteScore !== null && (
                <div className="flex justify-between gap-2">
                  <span>Site Supervisor</span>
                  <span>
                    {components.siteScore.toFixed(2)} × {WEIGHTS.site_supervisor} = {components.siteContribution?.toFixed(2)}
                  </span>
                </div>
              )}
              {components.reportsScore !== null && (
                <div className="flex justify-between gap-2">
                  <span>DC Report Evaluation</span>
                  <span>
                    {components.reportsScore.toFixed(2)} × {WEIGHTS.student_reports} = {components.reportsContribution?.toFixed(2)}
                  </span>
                </div>
              )}
              {components.facultyScore !== null && (
                <div className="flex justify-between gap-2">
                  <span>Faculty Supervisor</span>
                  <span>
                    {components.facultyScore.toFixed(2)} × {WEIGHTS.faculty_supervisor} = {components.facultyContribution?.toFixed(2)}
                  </span>
                </div>
              )}
              {components.activityScore !== null && (
                <div className="flex justify-between gap-2">
                  <span>Activity Log</span>
                  <span>
                    {components.activityScore.toFixed(2)} × {WEIGHTS.activity_log} = {components.activityContribution?.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t pt-1.5 mt-1.5 flex justify-between gap-2 font-bold">
                <span>Final Score</span>
                <span>{Number(finalGrade.final_score).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Computed-at timestamp */}
        {finalGrade?.computed_at && (
          <p className="text-xs text-muted-foreground">
            Last computed: {new Date(finalGrade.computed_at).toLocaleString()}
            {finalGrade.status === "locked" && (
              <span className="ml-2 text-primary font-medium">— Locked, no further changes allowed.</span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Sub-component: component card
// -----------------------------------------------------------------------------

interface ComponentCardProps {
  label: string;
  weight: string;
  score: number | null;
  contribution: number | null;
  icon: React.ReactNode;
  description: string;
  subcriteria?: {
    evidence: number | null;
    reflection: number | null;
    clarity: number | null;
    work_learning: number | null;
    evaluated_at: string | null;
    comments: string | null;
  } | null;
}

function ComponentCard({ label, weight, score, contribution, icon, description, subcriteria }: ComponentCardProps) {
  const hasScore = score !== null;
  return (
    <Card className={hasScore ? "border-primary/30" : "border-dashed"}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className="text-muted-foreground mt-0.5">{icon}</div>
            <div>
              <CardTitle className="text-sm leading-tight">{label}</CardTitle>
              <CardDescription className="text-xs mt-1">{description}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">Weight: {weight}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasScore ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">Score</span>
              <span className="text-xl font-bold tabular-nums">
                {Number(score).toFixed(2)}<span className="text-sm text-muted-foreground font-normal">/100</span>
              </span>
            </div>
            <Progress value={Number(score)} className="h-2" />
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Contribution to final</span>
              <span className="font-medium tabular-nums">
                {contribution?.toFixed(2)}
              </span>
            </div>

            {/* DC subcriteria breakdown */}
            {subcriteria && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Department Coordinator Subcriteria
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <SubcriteriaRow label="Evidence" value={subcriteria.evidence} max={25} />
                  <SubcriteriaRow label="Reflection" value={subcriteria.reflection} max={25} />
                  <SubcriteriaRow label="Clarity" value={subcriteria.clarity} max={25} />
                  <SubcriteriaRow label="Work ↔ Learning" value={subcriteria.work_learning} max={25} />
                </div>
                {subcriteria.comments && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">DC Comments</div>
                    <p className="text-xs italic bg-muted/30 p-2 rounded">{subcriteria.comments}</p>
                  </div>
                )}
                {subcriteria.evaluated_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Evaluated: {new Date(subcriteria.evaluated_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Clock className="h-4 w-4" />
            <span>Awaiting evaluation</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubcriteriaRow({ label, value, max }: { label: string; value: number | null; max: number }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {value ?? "—"}<span className="text-muted-foreground font-normal">/{max}</span>
      </span>
    </div>
  );
}
