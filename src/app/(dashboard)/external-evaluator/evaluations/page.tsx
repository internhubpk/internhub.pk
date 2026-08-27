"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Search,
  Eye,
  CheckCircle,
  Clock,
  Download,
  X,
  Users,
  Pencil,
  Trash2,
  Loader2,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

type EvaluationStatus = "pending" | "in_progress" | "submitted" | "approved" | "rejected";
type EvaluationType =
  | "weekly_log"
  | "midterm"
  | "final"
  | "company_evaluation"
  | "supervisor_evaluation"
  | "task";

interface Evaluation {
  id: string;
  student_internship_id: string | null;
  student_name: string;
  student_email?: string;
  student_avatar?: string | null;
  internship_title?: string | null;
  company_name?: string | null;
  type: EvaluationType | string;
  status: EvaluationStatus;
  rating: number | null;
  scores: Record<string, number> | null;
  comments: string | null;
  submitted_at: string | null;
  created_at: string | null;
}

// A student placement (student_internships row) assigned to this evaluator.
interface Assignment {
  id: string; // student_internships.id
  student_user_id: string;
  internship_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  student_name: string;
  student_email: string | null;
  internship_title: string | null;
  company_name: string | null;
}

interface EvalFormState {
  type: "final" | "midterm";
  overall: number;
  technical: number;
  attitude: number;
  punctuality: number;
  quality: number;
  comments: string;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "weekly_log", label: "Weekly Log" },
  { value: "midterm", label: "Midterm" },
  { value: "final", label: "Final" },
  { value: "company_evaluation", label: "Company" },
  { value: "supervisor_evaluation", label: "Supervisor" },
  { value: "task", label: "Task" },
];

const DEFAULT_EVAL_FORM: EvalFormState = {
  type: "final",
  overall: 3,
  technical: 3,
  attitude: 3,
  punctuality: 3,
  quality: 3,
  comments: "",
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatType(type: string | null | undefined): string {
  if (!type) return "Evaluation";
  return type.replace(/_/g, " ");
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  // Quote the value and double any embedded quotes per RFC 4180.
  return `"${str.replace(/"/g, '""')}"`;
}

// Read an API response and throw a normalized Error when it failed.
async function parseApiResponse(res: Response): Promise<any> {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || json?.error || "Request failed");
  }
  return json;
}

export default function ExternalEvaluatorEvaluationsPage() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [detailEvaluation, setDetailEvaluation] = useState<Evaluation | null>(null);

  // Evaluate dialog state (also used for "Edit"/"Revise" — the API upserts).
  const [evaluateTarget, setEvaluateTarget] = useState<Assignment | null>(null);
  const [evaluateExisting, setEvaluateExisting] = useState<Evaluation | null>(null);
  const [evalForm, setEvalForm] = useState<EvalFormState>(DEFAULT_EVAL_FORM);
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  // Delete confirmation state.
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null);
  const [isDeletingEval, setIsDeletingEval] = useState(false);

  async function fetchData() {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const evaluatorId = user.id;
    const evaluatorRole = "external_evaluator";

    try {
      // 1. Evaluations this evaluator has written (with student + internship
      //    details for display). student_internship_id links each row back to
      //    the placement so the evaluate dialog can pre-fill it.
      const { data, error } = await supabase
        .from("evaluations")
        .select(
          `
          id,
          type,
          status,
          rating,
          scores,
          comments,
          submitted_at,
          created_at,
          student_user_id,
          student_internship_id,
          student_profile:student_user_id(full_name, email, avatar_url),
          internship:internship_id(title, company:companies(name))
        `
        )
        .eq("evaluator_id", evaluatorId)
        .eq("evaluator_role", evaluatorRole)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching evaluations:", error);
        toast.error("Failed to load evaluations", { description: error.message });
        setEvaluations([]);
      } else {
        const mapped: Evaluation[] = (data ?? []).map((row: any) => {
          const internship = Array.isArray(row.internship) ? row.internship[0] : row.internship;
          const company = internship?.company;
          const studentProfile = Array.isArray(row.student_profile)
            ? row.student_profile[0]
            : row.student_profile;

          return {
            id: row.id,
            student_internship_id: row.student_internship_id ?? null,
            student_name: studentProfile?.full_name || "Unknown Student",
            student_email: studentProfile?.email,
            student_avatar: studentProfile?.avatar_url ?? null,
            internship_title: internship?.title ?? null,
            company_name: company?.name ?? null,
            type: row.type ?? "",
            status: (row.status as EvaluationStatus) ?? "pending",
            rating: typeof row.rating === "number" ? row.rating : null,
            scores:
              row.scores && typeof row.scores === "object" && !Array.isArray(row.scores)
                ? (row.scores as Record<string, number>)
                : null,
            comments: row.comments ?? null,
            submitted_at: row.submitted_at ?? null,
            created_at: row.created_at ?? null,
          };
        });
        setEvaluations(mapped);
      }
    } catch (err) {
      console.error("Unexpected error fetching evaluations:", err);
      toast.error("Failed to load evaluations", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }

    // 2. Assigned students (active placements where this user is the external
    //    evaluator) from the dedicated API.
    try {
      const res = await fetch("/api/external-evaluator/evaluations", { cache: "no-store" });
      const json = await parseApiResponse(res);
      const rows: any[] = json?.data?.assignments || [];
      const mapped: Assignment[] = rows.map((row) => {
        const student = Array.isArray(row.student) ? row.student[0] : row.student;
        const internship = Array.isArray(row.internship) ? row.internship[0] : row.internship;
        const company = internship?.company
          ? Array.isArray(internship.company)
            ? internship.company[0]
            : internship.company
          : null;
        return {
          id: row.id,
          student_user_id: row.student_user_id,
          internship_id: row.internship_id,
          status: row.status || "active",
          start_date: row.start_date ?? null,
          end_date: row.end_date ?? null,
          student_name: student?.full_name || "Unknown Student",
          student_email: student?.email ?? null,
          internship_title: internship?.title ?? null,
          company_name: company?.name ?? null,
        };
      });
      setAssignments(mapped);
    } catch (err) {
      console.error("Unexpected error fetching assignments:", err);
      toast.error("Failed to load assigned students", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setAssignments([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [user?.id]);

  // Match evaluations to placements so assignment rows can show the existing
  // evaluation and the evaluate dialog can pre-fill.
  const evaluationByPlacementId = useMemo(() => {
    const map = new Map<string, Evaluation>();
    for (const e of evaluations) {
      if (e.student_internship_id && !map.has(e.student_internship_id)) {
        map.set(e.student_internship_id, e);
      }
    }
    return map;
  }, [evaluations]);

  const assignmentByPlacementId = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of assignments) map.set(a.id, a);
    return map;
  }, [assignments]);

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((evaluation) => {
      const matchesSearch =
        !searchTerm ||
        evaluation.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evaluation.student_email ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evaluation.internship_title ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evaluation.company_name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        evaluation.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || evaluation.status === statusFilter;
      const matchesType = typeFilter === "all" || evaluation.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [evaluations, searchTerm, statusFilter, typeFilter]);

  const filteredAssignments = useMemo(() => {
    if (!assignmentSearch) return assignments;
    const q = assignmentSearch.toLowerCase();
    return assignments.filter(
      (a) =>
        a.student_name.toLowerCase().includes(q) ||
        (a.student_email ?? "").toLowerCase().includes(q) ||
        (a.internship_title ?? "").toLowerCase().includes(q) ||
        (a.company_name ?? "").toLowerCase().includes(q)
    );
  }, [assignments, assignmentSearch]);

  const stats = useMemo(() => {
    const pending = evaluations.filter((e) => e.status === "pending").length;
    const inProgress = evaluations.filter((e) => e.status === "in_progress").length;
    const completed = evaluations.filter(
      (e) => e.status === "submitted" || e.status === "approved"
    ).length;
    const rated = evaluations.filter((e) => e.rating !== null);
    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length
        : null;
    return { pending, inProgress, completed, avgRating };
  }, [evaluations]);

  const handleExport = () => {
    if (filteredEvaluations.length === 0) {
      toast.error("No data to export", { description: "There are no evaluations matching the current filters." });
      return;
    }

    const headers = [
      "Evaluation ID",
      "Student",
      "Student Email",
      "Internship",
      "Company",
      "Type",
      "Status",
      "Rating",
      "Submitted At",
      "Created At",
      "Comments",
    ];

    const rows = filteredEvaluations.map((e) => [
      e.id,
      e.student_name,
      e.student_email ?? "",
      e.internship_title ?? "",
      e.company_name ?? "",
      e.type,
      e.status,
      e.rating !== null ? String(e.rating) : "",
      e.submitted_at ?? "",
      e.created_at ?? "",
      e.comments ?? "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `external-evaluations_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Export complete", { description: `${filteredEvaluations.length} evaluation(s) exported to CSV.` });
  };

  const totalScore = (evaluation: Evaluation): number => {
    if (!evaluation.scores) return 0;
    return Object.values(evaluation.scores).filter((v): v is number => typeof v === "number").length;
  };

  // -------------------------------------------------------------------------
  // Evaluate / Revise dialog
  // -------------------------------------------------------------------------
  function openEvaluateDialog(assignment: Assignment, existing: Evaluation | null) {
    setEvaluateTarget(assignment);
    setEvaluateExisting(existing);
    setEvalForm({
      type: existing?.type === "midterm" ? "midterm" : "final",
      overall: typeof existing?.scores?.overall === "number" ? existing.scores.overall : DEFAULT_EVAL_FORM.overall,
      technical: typeof existing?.scores?.technical === "number" ? existing.scores.technical : DEFAULT_EVAL_FORM.technical,
      attitude: typeof existing?.scores?.attitude === "number" ? existing.scores.attitude : DEFAULT_EVAL_FORM.attitude,
      punctuality: typeof existing?.scores?.punctuality === "number" ? existing.scores.punctuality : DEFAULT_EVAL_FORM.punctuality,
      quality: typeof existing?.scores?.quality === "number" ? existing.scores.quality : DEFAULT_EVAL_FORM.quality,
      comments: existing?.comments ?? "",
    });
  }

  function closeEvaluateDialog() {
    if (isSubmittingEval) return;
    setEvaluateTarget(null);
    setEvaluateExisting(null);
  }

  async function handleSubmitEvaluation() {
    if (!evaluateTarget || !user) return;
    setIsSubmittingEval(true);

    try {
      const res = await fetch("/api/external-evaluator/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_internship_id: evaluateTarget.id,
          student_user_id: evaluateTarget.student_user_id,
          internship_id: evaluateTarget.internship_id,
          type: evalForm.type,
          scores: {
            overall: evalForm.overall,
            technical: evalForm.technical,
            attitude: evalForm.attitude,
            punctuality: evalForm.punctuality,
            quality: evalForm.quality,
          },
          comments: evalForm.comments.trim() || null,
        }),
      });
      await parseApiResponse(res);

      toast.success(
        evaluateExisting ? "Evaluation updated" : "Evaluation submitted",
        { description: `For ${evaluateTarget.student_name}${evaluateTarget.internship_title ? ` — ${evaluateTarget.internship_title}` : ""}.` }
      );
      setEvaluateTarget(null);
      setEvaluateExisting(null);
      fetchData();
    } catch (err) {
      console.error("Error submitting evaluation:", err);
      toast.error("Failed to save evaluation", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsSubmittingEval(false);
    }
  }

  async function handleDeleteEvaluation() {
    if (!deleteTarget) return;
    setIsDeletingEval(true);

    try {
      const res = await fetch(
        `/api/external-evaluator/evaluations?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      await parseApiResponse(res);

      toast.success("Evaluation deleted", { description: `For ${deleteTarget.student_name}.` });
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting evaluation:", err);
      toast.error("Failed to delete evaluation", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsDeletingEval(false);
    }
  }

  // Score input: 0–5 slider with 0.5 steps + a synced number input.
  function renderScoreInput(label: string, description: string, value: number, onChange: (v: number) => void) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded ${
              value >= 4
                ? "text-emerald-700 bg-emerald-50"
                : value >= 2.5
                  ? "text-amber-700 bg-amber-50"
                  : "text-red-700 bg-red-50"
            }`}
          >
            {value.toFixed(1)}/5
          </span>
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            aria-label={label}
            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <Input
            type="number"
            min={0}
            max={5}
            step={0.5}
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isNaN(v)) return;
              onChange(Math.min(5, Math.max(0, Math.round(v * 2) / 2)));
            }}
            className="w-20"
            aria-label={`${label} (number)`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Evaluations"
        description="Evaluate your assigned students and review past evaluations"
        actions={
          <Button variant="outline" onClick={handleExport} disabled={isLoading || evaluations.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs defaultValue="assigned">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="assigned" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assigned Students ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            My Evaluations ({evaluations.length})
          </TabsTrigger>
        </TabsList>

        {/* Assigned Students Tab (default) */}
        <TabsContent value="assigned" className="space-y-6 mt-6">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student, internship, or company..."
                  className="pl-10"
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned Students</CardTitle>
              <CardDescription>
                {isLoading
                  ? "Loading your assigned students..."
                  : `${filteredAssignments.length} of ${assignments.length} assigned student(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No students assigned</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                    No students assigned to you yet — the Department Coordinator
                    assigns students from their dashboard.
                  </p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No matching students</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try adjusting your search.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Internship</TableHead>
                        <TableHead>Placement</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Evaluation</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.map((assignment) => {
                        const existing = evaluationByPlacementId.get(assignment.id) || null;
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              <div className="space-y-0.5">
                                <div>{assignment.student_name}</div>
                                {assignment.student_email && (
                                  <div className="text-xs text-muted-foreground">
                                    {assignment.student_email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="text-sm">
                                  {assignment.internship_title || "—"}
                                </div>
                                {assignment.company_name && (
                                  <div className="text-xs text-muted-foreground">
                                    {assignment.company_name}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={assignment.status} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                                <CalendarRange className="h-3.5 w-3.5" />
                                {formatDate(assignment.start_date)} — {formatDate(assignment.end_date)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {existing ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                    <CheckCircle className="mr-1 h-3 w-3" /> Submitted
                                  </Badge>
                                  {existing.rating !== null && (
                                    <Badge variant="outline">{existing.rating}/5</Badge>
                                  )}
                                  <StatusBadge status={existing.status} size="sm" />
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Not submitted</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={existing ? "outline" : "default"}
                                className="gap-1.5"
                                onClick={() => openEvaluateDialog(assignment, existing)}
                              >
                                {existing ? (
                                  <>
                                    <Pencil className="h-3.5 w-3.5" />
                                    Revise
                                  </>
                                ) : (
                                  <>
                                    <ClipboardCheck className="h-3.5 w-3.5" />
                                    Evaluate
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Evaluations Tab */}
        <TabsContent value="mine" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Pending" value={stats.pending} icon={Clock} variant="warning" />
            <StatCard label="In Progress" value={stats.inProgress} icon={ClipboardCheck} variant="info" />
            <StatCard label="Completed" value={stats.completed} icon={CheckCircle} variant="success" />
            <StatCard
              label="Avg Rating"
              value={stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"}
              icon={CheckCircle}
              variant="default"
            />
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by student, internship, company, or ID..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Evaluations Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Evaluations</CardTitle>
              <CardDescription>
                {isLoading
                  ? "Loading your submitted evaluations..."
                  : `${filteredEvaluations.length} of ${evaluations.length} evaluation(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : evaluations.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No evaluations submitted</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Evaluations you submit for your assigned students will appear here.
                  </p>
                </div>
              ) : filteredEvaluations.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No matching evaluations</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try adjusting your search or filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Internship</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvaluations.map((evaluation) => {
                        const linkedAssignment = evaluation.student_internship_id
                          ? assignmentByPlacementId.get(evaluation.student_internship_id) || null
                          : null;
                        return (
                          <TableRow key={evaluation.id}>
                            <TableCell className="font-medium">
                              <div className="space-y-0.5">
                                <div>{evaluation.student_name}</div>
                                {evaluation.student_email && (
                                  <div className="text-xs text-muted-foreground">
                                    {evaluation.student_email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="text-sm">
                                  {evaluation.internship_title || "—"}
                                </div>
                                {evaluation.company_name && (
                                  <div className="text-xs text-muted-foreground">
                                    {evaluation.company_name}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{formatType(evaluation.type)}</TableCell>
                            <TableCell>
                              {evaluation.rating !== null ? `${evaluation.rating}/5` : "—"}
                            </TableCell>
                            <TableCell><StatusBadge status={evaluation.status} /></TableCell>
                            <TableCell>{formatDate(evaluation.submitted_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setDetailEvaluation(evaluation)}
                                  aria-label="View evaluation details"
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    linkedAssignment && openEvaluateDialog(linkedAssignment, evaluation)
                                  }
                                  disabled={!linkedAssignment || isSubmittingEval}
                                  aria-label="Edit evaluation"
                                  title={
                                    linkedAssignment
                                      ? "Edit this evaluation"
                                      : "Student is no longer assigned to you"
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(evaluation)}
                                  aria-label="Delete evaluation"
                                  title="Delete evaluation"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Evaluate / Revise Dialog */}
      <Dialog
        open={evaluateTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeEvaluateDialog();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {evaluateExisting ? "Revise Evaluation" : "Evaluate Student"}
            </DialogTitle>
            <DialogDescription>
              {evaluateTarget
                ? `${evaluateExisting ? "Update your evaluation for" : "Score and comment on"} ${evaluateTarget.student_name}${
                    evaluateTarget.internship_title ? ` — ${evaluateTarget.internship_title}` : ""
                  }${evaluateTarget.company_name ? ` (${evaluateTarget.company_name})` : ""}.`
                : ""}
              {evaluateExisting && " Submitting again overwrites the existing scores."}
            </DialogDescription>
          </DialogHeader>

          {evaluateTarget && (
            <DialogBody className="space-y-5">
              {/* Student summary */}
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-medium">{evaluateTarget.student_name}</span>
                  {evaluateTarget.student_email && (
                    <span className="text-xs text-muted-foreground">{evaluateTarget.student_email}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <StatusBadge status={evaluateTarget.status} size="sm" />
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="h-3 w-3" />
                    {formatDate(evaluateTarget.start_date)} — {formatDate(evaluateTarget.end_date)}
                  </span>
                </div>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="eval-type">Evaluation Type</Label>
                <Select
                  value={evalForm.type}
                  onValueChange={(v) => setEvalForm((prev) => ({ ...prev, type: v as "final" | "midterm" }))}
                >
                  <SelectTrigger id="eval-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="final">Final</SelectItem>
                    <SelectItem value="midterm">Midterm</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scores (0–5, half-point steps) */}
              <div className="space-y-4">
                <p className="text-sm font-medium">Scores (0–5)</p>
                {renderScoreInput("Overall Performance", "Overall impression of the student's performance.", evalForm.overall, (v) => setEvalForm((prev) => ({ ...prev, overall: v })))}
                {renderScoreInput("Technical Skills", "Job-specific / technical competence.", evalForm.technical, (v) => setEvalForm((prev) => ({ ...prev, technical: v })))}
                {renderScoreInput("Attitude", "Professional attitude and engagement.", evalForm.attitude, (v) => setEvalForm((prev) => ({ ...prev, attitude: v })))}
                {renderScoreInput("Punctuality", "Attendance and timeliness.", evalForm.punctuality, (v) => setEvalForm((prev) => ({ ...prev, punctuality: v })))}
                {renderScoreInput("Quality of Work", "Quality and consistency of deliverables.", evalForm.quality, (v) => setEvalForm((prev) => ({ ...prev, quality: v })))}
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <Label htmlFor="eval-comments">Comments</Label>
                <Textarea
                  id="eval-comments"
                  placeholder="Optional comments, strengths, areas for improvement..."
                  rows={4}
                  value={evalForm.comments}
                  onChange={(e) => setEvalForm((prev) => ({ ...prev, comments: e.target.value }))}
                />
              </div>
            </DialogBody>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEvaluateDialog} disabled={isSubmittingEval}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSubmitEvaluation} disabled={isSubmittingEval}>
              {isSubmittingEval ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {evaluateExisting ? "Saving..." : "Submitting..."}
                </>
              ) : (
                <>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {evaluateExisting ? "Save Changes" : "Submit Evaluation"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Evaluation Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          <>
            <Trash2 className="h-5 w-5 shrink-0" />
            Delete evaluation?
          </>
        }
        description={
          deleteTarget
            ? `This permanently removes your ${formatType(deleteTarget.type)} evaluation for ${deleteTarget.student_name}. The student will no longer see it. This action cannot be undone.`
            : ""
        }
        confirmLabel={isDeletingEval ? "Deleting..." : "Delete"}
        variant="danger"
        loading={isDeletingEval}
        onConfirm={handleDeleteEvaluation}
      />

      {/* Detail Dialog */}
      <Dialog
        open={detailEvaluation !== null}
        onOpenChange={(open) => {
          if (!open) setDetailEvaluation(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>
              {detailEvaluation
                ? `${formatType(detailEvaluation.type)} evaluation for ${detailEvaluation.student_name}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detailEvaluation && (
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Student</p>
                  <p className="font-medium">{detailEvaluation.student_name}</p>
                  {detailEvaluation.student_email && (
                    <p className="text-xs text-muted-foreground">{detailEvaluation.student_email}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div><StatusBadge status={detailEvaluation.status} /></div>
                </div>
                <div>
                  <p className="text-muted-foreground">Internship</p>
                  <p className="font-medium">{detailEvaluation.internship_title || "—"}</p>
                  {detailEvaluation.company_name && (
                    <p className="text-xs text-muted-foreground">{detailEvaluation.company_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{formatType(detailEvaluation.type)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Overall Rating</p>
                  <p className="font-medium">
                    {detailEvaluation.rating !== null ? `${detailEvaluation.rating}/5` : "Not rated"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted At</p>
                  <p className="font-medium">{formatDateTime(detailEvaluation.submitted_at)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Created At</p>
                  <p className="font-medium">{formatDateTime(detailEvaluation.created_at)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Evaluation ID</p>
                  <p className="font-mono text-xs break-all">{detailEvaluation.id}</p>
                </div>
              </div>

              {detailEvaluation.scores &&
              Object.keys(detailEvaluation.scores).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Score Breakdown ({totalScore(detailEvaluation)} criteria)</p>
                  <div className="rounded-md border divide-y">
                    {Object.entries(detailEvaluation.scores).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 text-sm"
                      >
                        <span className="capitalize text-muted-foreground">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {detailEvaluation.comments ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Comments</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md border p-3 bg-muted/30">
                    {detailEvaluation.comments}
                  </p>
                </div>
              ) : null}
            </DialogBody>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailEvaluation(null)}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
