"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Search,
  Eye,
  CheckCircle,
  Clock,
  Loader2,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";

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

const STATUS_BADGE_VARIANT: Record<EvaluationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  in_progress: "default",
  submitted: "default",
  approved: "default",
  rejected: "destructive",
};

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

export default function ExternalEvaluatorEvaluationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [detailEvaluation, setDetailEvaluation] = useState<Evaluation | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const evaluatorId = user.id;
      const evaluatorRole = "external_evaluator";

      try {
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
            student_profile:student_user_id(full_name, email, avatar_url),
            internship:internship_id(title, company:companies(name))
          `
          )
          .eq("evaluator_id", evaluatorId)
          .eq("evaluator_role", evaluatorRole)
          .order("created_at", { ascending: false });

        if (cancelled) return;

        if (error) {
          console.error("Error fetching evaluations:", error);
          toast({
            title: "Failed to load evaluations",
            description: error.message,
            variant: "destructive",
          });
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
        if (!cancelled) {
          toast({
            title: "Failed to load evaluations",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [user, toast]);

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

  const getStatusBadge = (status: EvaluationStatus) => {
    return (
      <Badge variant={STATUS_BADGE_VARIANT[status] || "secondary"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const handleExport = () => {
    if (filteredEvaluations.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no evaluations matching the current filters.",
        variant: "destructive",
      });
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

    toast({
      title: "Export complete",
      description: `${filteredEvaluations.length} evaluation(s) exported to CSV.`,
    });
  };

  const totalScore = (evaluation: Evaluation): number => {
    if (!evaluation.scores) return 0;
    return Object.values(evaluation.scores).filter((v): v is number => typeof v === "number").length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evaluations</h1>
          <p className="text-muted-foreground">Complete your assigned student evaluations</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={isLoading || evaluations.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"}
            </div>
          </CardContent>
        </Card>
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
              ? "Loading your assigned student evaluations..."
              : `${filteredEvaluations.length} of ${evaluations.length} evaluation(s)`}
          </CardDescription>
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
                Evaluations assigned to you will appear here.
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
                  {filteredEvaluations.map((evaluation) => (
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
                      <TableCell>{getStatusBadge(evaluation.status)}</TableCell>
                      <TableCell>{formatDate(evaluation.submitted_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailEvaluation(evaluation)}
                          aria-label="View evaluation details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="space-y-4">
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
                  <div>{getStatusBadge(detailEvaluation.status)}</div>
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
            </div>
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
