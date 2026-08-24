"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ClipboardList,
  Loader2,
  Search,
  FileText,
  CalendarDays,
  Paperclip,
  Award,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Save,
  Download,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface StudentRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  program_id: string | null;
  program_name: string | null;
  department_id: string | null;
  department_name: string | null;
  student_id_number: string | null;
}

interface WeeklyLogRow {
  id: string;
  week_number: number | null;
  week_start_date: string | null;
  week_end_date: string | null;
  hours_worked: number | null;
  status: string;
  submitted_at: string | null;
  tasks_completed: string[] | null;
  learnings: string | null;
  challenges: string | null;
  challenges_solutions: string | null;
  learning_outcomes: string | null;
  next_week_goals: string | null;
  supporting_evidence: Array<{ name?: string; url?: string; size?: number; type?: string }> | null;
  site_supervisor_remarks: string | null;
  faculty_supervisor_remarks: string | null;
  supervisor_feedback: string | null;
  student_signature_url: string | null;
  site_supervisor_signature_url: string | null;
  faculty_supervisor_signature_url: string | null;
}

interface DailyEntryRow {
  id: string;
  weekly_log_id: string;
  day_of_week: number; // 1=Mon..7=Sun
  entry_date: string;
  tasks_performed: string;
  hours_worked: number | null;
  is_holiday: boolean;
  notes: string | null;
}

interface InternshipRow {
  id: string;
  title: string | null;
  company_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  duration_weeks: number | null;
}

interface ExistingEvaluation {
  id: string;
  student_user_id?: string;
  status: string;
  scores: Record<string, number> | null;
  comments: string | null;
  submitted_at: string | null;
  updated_at: string | null;
}

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SUBCRITERIA: Array<{
  key: "evidence_score" | "reflection_score" | "clarity_score" | "work_learning_score";
  label: string;
  description: string;
}> = [
  {
    key: "evidence_score",
    label: "Evidence-based reporting",
    description: "Does the student attach and reference supporting evidence (screenshots, links, files) for the work performed?",
  },
  {
    key: "reflection_score",
    label: "Reflection",
    description: "Does the student reflect on what they learned, not just list tasks? Are the learnings thoughtful and specific?",
  },
  {
    key: "clarity_score",
    label: "Clarity",
    description: "Are the daily entries, challenges, and solutions clearly written and easy to follow?",
  },
  {
    key: "work_learning_score",
    label: "Work ↔ Learning Connection",
    description: "Does the student explicitly connect the work performed with academic concepts and learning outcomes?",
  },
];

// -----------------------------------------------------------------------------
// Main page component
// -----------------------------------------------------------------------------

export default function DepartmentCoordinatorEvaluationsPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingEvalByStudent, setExistingEvalByStudent] = useState<Record<string, ExistingEvaluation>>({});

  // ----- Load students in the DC's department -----
  const loadStudents = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.role !== "department_coordinator") {
      setLoadError("Only Department Coordinators can access this page.");
      setLoadingStudents(false);
      return;
    }
    if (!profile.department_id) {
      setLoadError("Your account is not associated with a department.");
      setLoadingStudents(false);
      return;
    }
    setLoadingStudents(true);
    setLoadError(null);
    try {
      // Fetch students whose profiles.department_id = caller's department_id.
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          user_id,
          full_name,
          email,
          avatar_url,
          department_id,
          program_id
        `)
        .eq("role", "student")
        .eq("department_id", profile.department_id)
        .order("full_name", { ascending: true });

      if (error) throw error;

      // Fetch the students table rows for additional metadata (student_id_number).
      const userIds = (data || []).map((r) => r.user_id);
      const { data: studentsRows, error: sErr } = await supabase
        .from("students")
        .select("user_id, student_id_number")
        .in("user_id", userIds);

      const idNumberByUser: Record<string, string | null> = {};
      for (const r of studentsRows || []) {
        idNumberByUser[r.user_id] = r.student_id_number;
      }

      // Fetch program names for student program_id values.
      const programIds = (data || []).map((r) => r.program_id).filter(Boolean) as string[];
      let programNameById: Record<string, string> = {};
      if (programIds.length > 0) {
        const { data: programsRows } = await supabase
          .from("programs")
          .select("id, name")
          .in("id", programIds);
        for (const r of programsRows || []) {
          programNameById[r.id] = r.name;
        }
      }

      // Fetch department name.
      const { data: deptRow } = await supabase
        .from("departments")
        .select("id, name")
        .eq("id", profile.department_id)
        .single();

      const finalRows: StudentRow[] = (data || []).map((r) => ({
        user_id: r.user_id,
        full_name: r.full_name,
        email: r.email,
        avatar_url: r.avatar_url,
        program_id: r.program_id,
        program_name: r.program_id ? (programNameById[r.program_id] || null) : null,
        department_id: r.department_id,
        department_name: deptRow?.name || null,
        student_id_number: idNumberByUser[r.user_id] || null,
      }));

      setStudents(finalRows);

      // Also fetch all existing DC report evaluations for these students.
      if (finalRows.length > 0) {
        const { data: evals, error: evalErr } = await supabase
          .from("evaluations")
          .select("id, student_user_id, status, scores, comments, submitted_at, updated_at")
          .eq("evaluator_id", user.id)
          .eq("evaluator_role", "department_coordinator")
          .eq("type", "department_coordinator_report")
          .in("student_user_id", userIds);

        if (!evalErr && evals) {
          const map: Record<string, ExistingEvaluation> = {};
          for (const e of evals as Array<ExistingEvaluation & { student_user_id: string }>) {
            // Keep the most recent per student.
            if (!map[e.student_user_id] || (e.updated_at || "") > (map[e.student_user_id].updated_at || "")) {
              map[e.student_user_id] = e;
            }
          }
          setExistingEvalByStudent(map);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[dc/evaluations] loadStudents:", msg);
      setLoadError("Unable to load students. " + msg);
      toast.error("Unable to load students", { description: msg });
    } finally {
      setLoadingStudents(false);
    }
  }, [user, profile, supabase]);

  useEffect(() => {
    if (!authLoading) {
      loadStudents();
    }
  }, [authLoading, loadStudents]);

  // ----- Filtered students by search -----
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) =>
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.student_id_number || "").toLowerCase().includes(q) ||
      (s.program_name || "").toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // ----- Stats -----
  const stats = useMemo(() => {
    const total = students.length;
    const evaluated = Object.keys(existingEvalByStudent).length;
    const pending = total - evaluated;
    return { total, evaluated, pending };
  }, [students, existingEvalByStudent]);

  // ----- Open evaluation dialog -----
  const handleOpenEvaluate = (student: StudentRow) => {
    setSelectedStudent(student);
    setDialogOpen(true);
  };

  // ----- Render -----
  if (authLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!profile || profile.role !== "department_coordinator") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm">
                Only Department Coordinators can access this page. Please sign in with a Department Coordinator account.
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
        title="Student Reports — Department Coordinator Evaluation"
        description="Evaluate the quality of your students' submitted weekly reports. This is the 30% component of the final grade. Subcriteria: evidence-based reporting, reflection, clarity, and connection between work and learning."
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">In your department</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Evaluated</CardDescription>
            <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400">{stats.evaluated}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Report evaluation submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl text-amber-600 dark:text-amber-400">{stats.pending}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting your evaluation</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + refresh */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, ID, or program..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => loadStudents()} disabled={loadingStudents}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingStudents ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Students table — responsive: card layout on mobile, table on desktop */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Students in Your Department
          </CardTitle>
          <CardDescription>
            Click <strong>Evaluate</strong> to review a student's weekly reports and submit your 30% report-quality score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p>{loadError}</p>
                  <Button size="sm" variant="outline" onClick={() => loadStudents()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : loadingStudents ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {students.length === 0
                  ? "No students have been assigned to your department yet."
                  : "No students match your search."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {students.length === 0
                  ? "Once a Program Coordinator creates students in your department, they will appear here."
                  : "Try a different name, email, or ID."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">Student</th>
                      <th className="text-left font-medium px-4 py-3">Program</th>
                      <th className="text-left font-medium px-4 py-3">ID Number</th>
                      <th className="text-left font-medium px-4 py-3">Evaluation Status</th>
                      <th className="text-right font-medium px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => {
                      const evalState = existingEvalByStudent[s.user_id];
                      return (
                        <tr key={s.user_id} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium">{s.full_name || "Unnamed"}</div>
                            <div className="text-xs text-muted-foreground">{s.email}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{s.program_name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.student_id_number || "—"}</td>
                          <td className="px-4 py-3">
                            {evalState ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Evaluated — {computeEvalTotal(evalState)}/100
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/20">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant={evalState ? "outline" : "default"}
                              onClick={() => handleOpenEvaluate(s)}
                            >
                              {evalState ? "Revise" : "Evaluate"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {filteredStudents.map((s) => {
                  const evalState = existingEvalByStudent[s.user_id];
                  return (
                    <Card key={s.user_id}>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <div className="font-medium">{s.full_name || "Unnamed"}</div>
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Program</div>
                            <div className="font-medium">{s.program_name || "—"}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">ID Number</div>
                            <div className="font-medium">{s.student_id_number || "—"}</div>
                          </div>
                        </div>
                        <div>
                          {evalState ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Evaluated — {computeEvalTotal(evalState)}/100
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/20">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          variant={evalState ? "outline" : "default"}
                          onClick={() => handleOpenEvaluate(s)}
                        >
                          {evalState ? "Revise Evaluation" : "Evaluate Reports"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Evaluation Dialog */}
      {selectedStudent && (
        <EvaluationDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              // Refresh student list (to update eval status) without a flash.
              loadStudents();
            }
          }}
          student={selectedStudent}
          existingEvaluation={existingEvalByStudent[selectedStudent.user_id] || null}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helper: compute the total from an existing evaluation's scores.
// -----------------------------------------------------------------------------

function computeEvalTotal(ev: ExistingEvaluation): number {
  if (!ev.scores) return 0;
  const total =
    (typeof ev.scores.total_score === "number" ? ev.scores.total_score : null) ??
    (ev.scores.evidence_score || 0) +
      (ev.scores.reflection_score || 0) +
      (ev.scores.clarity_score || 0) +
      (ev.scores.work_learning_score || 0);
  return total;
}

// -----------------------------------------------------------------------------
// Evaluation Dialog
// -----------------------------------------------------------------------------

interface EvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentRow;
  existingEvaluation: ExistingEvaluation | null;
}

function EvaluationDialog({ open, onOpenChange, student, existingEvaluation }: EvaluationDialogProps) {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<"reports" | "evaluate">("reports");
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklyLogRow[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntryRow[]>([]);
  const [internship, setInternship] = useState<InternshipRow | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset & load when dialog opens
  useEffect(() => {
    if (!open) return;
    setActiveTab("reports");
    setWeeklyLogs([]);
    setDailyEntries([]);
    setInternship(null);
    setDataError(null);

    // Seed scores from existing evaluation (if any)
    if (existingEvaluation?.scores) {
      setScores({
        evidence_score: existingEvaluation.scores.evidence_score ?? 0,
        reflection_score: existingEvaluation.scores.reflection_score ?? 0,
        clarity_score: existingEvaluation.scores.clarity_score ?? 0,
        work_learning_score: existingEvaluation.scores.work_learning_score ?? 0,
      });
    } else {
      setScores({
        evidence_score: 0,
        reflection_score: 0,
        clarity_score: 0,
        work_learning_score: 0,
      });
    }
    setComments(existingEvaluation?.comments || "");

    // Load the student's weekly_logs + daily_entries + internship
    (async () => {
      setLoadingData(true);
      try {
        // 1. Find the student's active internship
        const { data: siData, error: siErr } = await supabase
          .from("student_internships")
          .select("id, internship_id, status")
          .eq("student_user_id", student.user_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (siErr) throw siErr;
        const si = siData && siData[0];
        if (!si) {
          setDataError("This student has no internship record yet. No weekly reports to review.");
          setLoadingData(false);
          return;
        }

        // 2. Fetch internship details
        const { data: internshipRow, error: iErr } = await supabase
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
          .eq("id", si.internship_id)
          .single();
        if (iErr) throw iErr;
        setInternship({
          id: internshipRow.id,
          title: internshipRow.title,
          company_name: (internshipRow.companies as unknown as { name: string } | null)?.name || null,
          status: internshipRow.status,
          start_date: internshipRow.start_date,
          end_date: internshipRow.end_date,
          duration_weeks: internshipRow.duration_weeks,
        });

        // 3. Fetch weekly_logs for this student + internship
        const { data: logs, error: logsErr } = await supabase
          .from("weekly_logs")
          .select(`
            id,
            week_number,
            week_start_date,
            week_end_date,
            hours_worked,
            status,
            submitted_at,
            tasks_completed,
            learnings,
            challenges,
            challenges_solutions,
            learning_outcomes,
            next_week_goals,
            supporting_evidence,
            site_supervisor_remarks,
            faculty_supervisor_remarks,
            supervisor_feedback,
            student_signature_url,
            site_supervisor_signature_url,
            faculty_supervisor_signature_url
          `)
          .eq("student_user_id", student.user_id)
          .eq("internship_id", si.internship_id)
          .order("week_number", { ascending: true });

        if (logsErr) throw logsErr;
        setWeeklyLogs((logs || []) as WeeklyLogRow[]);

        // 4. Fetch daily entries for all weekly logs in one query
        const logIds = (logs || []).map((l) => (l as WeeklyLogRow).id);
        if (logIds.length > 0) {
          const { data: entries, error: eErr } = await supabase
            .from("weekly_log_daily_entries")
            .select("id, weekly_log_id, day_of_week, entry_date, tasks_performed, hours_worked, is_holiday, notes")
            .in("weekly_log_id", logIds)
            .order("entry_date", { ascending: true });
          if (eErr) throw eErr;
          setDailyEntries((entries || []) as DailyEntryRow[]);
        } else {
          setDailyEntries([]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[dc/evaluations] load data:", msg);
        setDataError("Unable to load the student's reports: " + msg);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [open, student, existingEvaluation, supabase]);

  const totalScore = useMemo(() => {
    return (
      (scores.evidence_score || 0) +
      (scores.reflection_score || 0) +
      (scores.clarity_score || 0) +
      (scores.work_learning_score || 0)
    );
  }, [scores]);

  const handleSubmit = async () => {
    // Validate scores
    for (const sc of SUBCRITERIA) {
      const v = scores[sc.key];
      if (typeof v !== "number" || v < 0 || v > 25) {
        toast.error("Invalid score", {
          description: `${sc.label} must be between 0 and 25.`,
        });
        return;
      }
    }
    if (!internship) {
      toast.error("Cannot submit — no internship found for this student.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/department-coordinator/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_user_id: student.user_id,
          internship_id: internship.id,
          evidence_score: Number(scores.evidence_score),
          reflection_score: Number(scores.reflection_score),
          clarity_score: Number(scores.clarity_score),
          work_learning_score: Number(scores.work_learning_score),
          comments: comments || null,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to submit evaluation");
      }
      toast.success("Evaluation submitted", {
        description: `Total score: ${json.data?.total_score ?? totalScore}/100. ${
          json.data?.recompute?.status === "computed"
            ? `Final grade: ${json.data.recompute.final_score}/100 (${json.data.recompute.letter_grade || "—"}).`
            : json.data?.recompute?.status === "pending"
            ? "Final grade remains pending — other components still incomplete."
            : ""
        }`,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[dc/evaluations] submit:", msg);
      toast.error("Failed to submit evaluation", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Award className="h-5 w-5" />
            <span>Report Evaluation — {student.full_name || "Unnamed"}</span>
            {existingEvaluation && (
              <Badge variant="secondary" className="ml-2">Previously: {computeEvalTotal(existingEvaluation)}/100</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review the student's weekly reports, then evaluate the report quality across the 4 subcriteria. This contributes the 30% "Student Reports" component to the final grade.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "reports" | "evaluate")} className="flex-1 min-h-0 flex flex-col">
          <div className="px-6 pt-3 shrink-0 border-b">
            <TabsList>
              <TabsTrigger value="reports" className="gap-2">
                <FileText className="h-4 w-4" />
                Weekly Reports
              </TabsTrigger>
              <TabsTrigger value="evaluate" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Evaluate (30%)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Reports tab */}
          <TabsContent value="reports" className="flex-1 min-h-0 m-0 overflow-hidden">
            <ScrollArea className="h-full max-h-[60vh]">
              <div className="p-6 space-y-4">
                {loadingData ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : dataError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>{dataError}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Internship summary */}
                    {internship && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Briefcase />
                            {internship.title || "Untitled Internship"}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span>{internship.company_name || "Unknown company"}</span>
                            <span>•</span>
                            <Badge variant="outline">{internship.status}</Badge>
                            {internship.start_date && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {new Date(internship.start_date).toLocaleDateString()}
                                  {internship.end_date ? ` → ${new Date(internship.end_date).toLocaleDateString()}` : ""}
                                </span>
                              </>
                            )}
                            {internship.duration_weeks && (
                              <>
                                <span>•</span>
                                <span>{internship.duration_weeks} weeks</span>
                              </>
                            )}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    )}

                    {/* Weekly logs */}
                    {weeklyLogs.length === 0 ? (
                      <div className="rounded-md border border-dashed p-8 text-center">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">No weekly reports submitted yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The student needs to submit at least one weekly log before you can evaluate.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {weeklyLogs.map((log) => {
                          const entries = dailyEntries.filter((e) => e.weekly_log_id === log.id);
                          return (
                            <Card key={log.id}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <CardTitle className="text-base">
                                    Week {log.week_number ?? "?"}
                                    {log.week_start_date && log.week_end_date && (
                                      <span className="text-xs text-muted-foreground ml-2 font-normal">
                                        {new Date(log.week_start_date).toLocaleDateString()} →{" "}
                                        {new Date(log.week_end_date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </CardTitle>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{log.status}</Badge>
                                    {log.hours_worked != null && (
                                      <span className="text-xs text-muted-foreground">{log.hours_worked}h</span>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4 text-sm">
                                {/* Daily entries */}
                                {entries.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground mb-2">
                                      Daily Activity
                                    </div>
                                    <div className="space-y-2">
                                      {entries.map((e) => (
                                        <div key={e.id} className="rounded-md border bg-muted/30 p-3">
                                          <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="font-medium flex items-center gap-2">
                                              <span>{DAY_NAMES[e.day_of_week] || `Day ${e.day_of_week}`}</span>
                                              <span className="text-xs text-muted-foreground font-normal">
                                                {new Date(e.entry_date).toLocaleDateString()}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {e.is_holiday && (
                                                <Badge variant="secondary" className="text-xs">Holiday</Badge>
                                              )}
                                              {e.hours_worked != null && (
                                                <span className="text-xs text-muted-foreground">{e.hours_worked}h</span>
                                              )}
                                            </div>
                                          </div>
                                          {e.tasks_performed ? (
                                            <p className="text-sm whitespace-pre-wrap">{e.tasks_performed}</p>
                                          ) : (
                                            <p className="text-xs text-muted-foreground italic">No tasks documented.</p>
                                          )}
                                          {e.notes && (
                                            <p className="text-xs text-muted-foreground mt-1 italic">{e.notes}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Legacy tasks_completed array */}
                                {log.tasks_completed && Array.isArray(log.tasks_completed) && log.tasks_completed.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                      Tasks (legacy)
                                    </div>
                                    <ul className="list-disc pl-5 space-y-0.5">
                                      {log.tasks_completed.map((t, i) => (
                                        <li key={i}>{t}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Reflection / Learnings */}
                                {(log.learning_outcomes || log.learnings) && (
                                  <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                      Learning Outcomes
                                    </div>
                                    <p className="whitespace-pre-wrap">{log.learning_outcomes || log.learnings}</p>
                                  </div>
                                )}

                                {/* Challenges */}
                                {(log.challenges_solutions || log.challenges) && (
                                  <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                      Challenges Faced and Solutions
                                    </div>
                                    <p className="whitespace-pre-wrap">{log.challenges_solutions || log.challenges}</p>
                                  </div>
                                )}

                                {/* Next week goals */}
                                {log.next_week_goals && (
                                  <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                      Next Week Goals
                                    </div>
                                    <p className="whitespace-pre-wrap">{log.next_week_goals}</p>
                                  </div>
                                )}

                                {/* Supporting evidence */}
                                {log.supporting_evidence && Array.isArray(log.supporting_evidence) && log.supporting_evidence.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground mb-1 flex items-center gap-1">
                                      <Paperclip className="h-3 w-3" />
                                      Supporting Evidence
                                    </div>
                                    <ul className="space-y-1">
                                      {log.supporting_evidence.map((ev, i) => (
                                        <li key={i}>
                                          {ev.url ? (
                                            <a
                                              href={ev.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                              {ev.name || `Evidence ${i + 1}`}
                                            </a>
                                          ) : (
                                            <span className="text-sm">{ev.name || `Evidence ${i + 1}`}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Supervisor remarks */}
                                {(log.site_supervisor_remarks || log.faculty_supervisor_remarks || log.supervisor_feedback) && (
                                  <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                      Supervisor Remarks
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      {log.site_supervisor_remarks && (
                                        <p><span className="font-medium">Site Supervisor:</span> {log.site_supervisor_remarks}</p>
                                      )}
                                      {log.faculty_supervisor_remarks && (
                                        <p><span className="font-medium">Faculty Supervisor:</span> {log.faculty_supervisor_remarks}</p>
                                      )}
                                      {log.supervisor_feedback && !log.site_supervisor_remarks && !log.faculty_supervisor_remarks && (
                                        <p>{log.supervisor_feedback}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}

                    {/* Generate Word doc link */}
                    {internship && weeklyLogs.length > 0 && (
                      <div className="flex justify-end pt-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/student/weekly-logs`} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Open Student Weekly Logs
                          </Link>
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Evaluate tab */}
          <TabsContent value="evaluate" className="flex-1 min-h-0 m-0 overflow-hidden">
            <ScrollArea className="h-full max-h-[60vh]">
              <div className="p-6 space-y-6">
                <div className="rounded-md border bg-muted/30 p-4">
                  <h3 className="font-medium mb-1">Student Reports — Department Coordinator Evaluation</h3>
                  <p className="text-xs text-muted-foreground">
                    Score each subcriterion from 0 to 25. The total (0–100) is the 30% "Student Reports" component of the final grade. Subcriteria reference the HEC Stage 7 rubric.
                  </p>
                </div>

                {SUBCRITERIA.map((sc) => (
                  <div key={sc.key} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <Label htmlFor={sc.key} className="text-sm font-medium">
                        {sc.label} <span className="text-destructive">*</span>
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Score: <span className="font-medium text-foreground">{scores[sc.key] ?? 0}</span> / 25
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{sc.description}</p>
                    <div className="flex items-center gap-3">
                      <input
                        id={sc.key}
                        type="range"
                        min={0}
                        max={25}
                        step={1}
                        value={scores[sc.key] ?? 0}
                        onChange={(e) =>
                          setScores((prev) => ({ ...prev, [sc.key]: Number(e.target.value) }))
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={25}
                        step={1}
                        value={scores[sc.key] ?? 0}
                        onChange={(e) =>
                          setScores((prev) => {
                            const v = Number(e.target.value);
                            return { ...prev, [sc.key]: Number.isNaN(v) ? 0 : Math.max(0, Math.min(25, v)) };
                          })
                        }
                        className="w-20"
                      />
                    </div>
                  </div>
                ))}

                <div className="rounded-md border bg-primary/5 p-4">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-sm font-medium">Total Report Score</div>
                      <div className="text-xs text-muted-foreground">
                        Weight: 30% of the final grade (Student Reports — DC Evaluation)
                      </div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {totalScore}<span className="text-sm text-muted-foreground font-normal">/100</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comments" className="text-sm font-medium">
                    Comments / Feedback <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="comments"
                    rows={4}
                    placeholder="Provide qualitative feedback to the student. This will be visible to them."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    maxLength={5000}
                  />
                  <p className="text-xs text-muted-foreground">{comments.length} / 5000 characters</p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            {existingEvaluation ? (
              <span>Revising existing evaluation. Submitting will overwrite the previous score.</span>
            ) : (
              <span>First evaluation for this student.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || loadingData || !internship}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Submit Evaluation
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny internal icon import to keep the JSX clean.
function Briefcase() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
