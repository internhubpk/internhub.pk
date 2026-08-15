"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Filter,
  Star,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  Edit3,
  FileText,
  Download,
  Send,
  MoreVertical,
  TrendingUp,
  Users,
  ClipboardCheck,
  MessageSquare,
  Calendar,
  GraduationCap,
  Building2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Medal,
  Target,
  Lightbulb,
  Heart,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { PageHeader } from "@/components/dashboard/page-header";

// Types
type EvaluationStatus = "pending" | "in_progress" | "submitted" | "approved" | "rejected";

interface FinalEvaluation {
  id: string;
  intern_id: string;
  intern_name: string;
  intern_email: string;
  internship_id: string;
  internship_title: string;
  supervisor_name?: string | null;
  evaluator_role?: string | null;
  status: EvaluationStatus;
  overall_rating?: number | null;
  skills_rating?: number | null;
  attitude_rating?: number | null;
  punctuality_rating?: number | null;
  quality_rating?: number | null;
  comments?: string | null;
  strengths?: string[] | null;
  areas_for_improvement?: string[] | null;
  recommendation?: "hire" | "strong_hire" | "no_hire" | null;
  certificate_issued: boolean;
  submitted_at?: string | null;
  evaluated_by?: string | null;
  created_at: string;
}

// Default empty state - evaluations will be fetched from database
const DEFAULT_EVALUATIONS: FinalEvaluation[] = [];

const DEFAULT_PROGRAMS = ["All Programs"];

export default function CompanyHREvaluationsPage() {
  const { profile } = useAuth();
  const [evaluations, setEvaluations] = useState<FinalEvaluation[]>(DEFAULT_EVALUATIONS);
  const [programs, setPrograms] = useState<string[]>(DEFAULT_PROGRAMS);
  const [internsForEvaluation, setInternsForEvaluation] = useState<Array<{
    student_internship_id: string;
    student_user_id: string;
    student_name: string;
    internship_id: string;
    internship_title: string;
  }>>([]);
  const [evaluateTarget, setEvaluateTarget] = useState<{
    student_internship_id: string;
    student_user_id: string;
    internship_id: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [issuingCert, setIssuingCert] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvaluations();
    fetchInternsForEval();
  }, [profile?.company_id]);

  async function fetchEvaluations() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/company-hr/evaluations", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      const evals: FinalEvaluation[] = (j.data || []).map((ev: any) => {
        const scores = ev.scores && typeof ev.scores === "object" ? ev.scores : {};
        return {
          id: ev.id,
          intern_id: ev.student_user_id,
          intern_name: ev.student_name || "Unknown",
          intern_email: ev.student_email || "",
          internship_id: ev.internship_id,
          internship_title: ev.internship_title || "Unknown Program",
          supervisor_name: ev.evaluator_name || null,
          evaluator_role: ev.evaluator_role || null,
          status: ev.status || "pending",
          overall_rating: scores.overall ?? ev.rating ?? 0,
          skills_rating: scores.technical ?? 0,
          attitude_rating: scores.attitude ?? 0,
          punctuality_rating: scores.punctuality ?? 0,
          quality_rating: scores.quality ?? 0,
          comments: ev.comments || "",
          strengths: scores.strengths ? [scores.strengths] : null,
          areas_for_improvement: scores.areas_for_improvement ? [scores.areas_for_improvement] : null,
          recommendation: scores.recommendation || null,
          certificate_issued: ev.certificate_issued || false,
          submitted_at: ev.submitted_at,
          evaluated_by: ev.evaluator_id,
          created_at: ev.created_at,
        };
      });
      setEvaluations(evals);
      const uniquePrograms = Array.from(new Set(evals.map((e) => e.internship_title).filter(Boolean)));
      setPrograms(["All Programs", ...uniquePrograms]);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchInternsForEval() {
    try {
      const res = await fetch("/api/company-hr/interns", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const list = (j.data || [])
        .filter((i: any) => i.status === "active" || i.status === "assigned" || i.status === "completed")
        .map((i: any) => ({
          student_internship_id: i.id,
          student_user_id: i.student_user_id,
          student_name: i.student_name || "Unknown",
          internship_id: i.internship_id,
          internship_title: i.internship_title || "",
        }));
      setInternsForEvaluation(list);
    } catch {
      // ignore
    }
  }

  const handleSubmitEvaluation = async (status: "submitted" | "in_progress") => {
    if (!evaluateTarget) {
      toast.error("Action required", { description: "Please select an intern to evaluate." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/company-hr/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_internship_id: evaluateTarget.student_internship_id,
          student_user_id: evaluateTarget.student_user_id,
          internship_id: evaluateTarget.internship_id,
          scores: {
            overall: formState.overall_rating,
            technical: formState.skills_rating,
            attitude: formState.attitude_rating,
            punctuality: formState.punctuality_rating,
            quality: formState.quality_rating,
            strengths: formState.strengths,
            areas_for_improvement: formState.areas_for_improvement,
            recommendation: formState.recommendation,
          },
          comments: formState.comments,
          strengths: formState.strengths,
          areas_for_improvement: formState.areas_for_improvement,
          recommendation: formState.recommendation,
          status,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `Failed (${res.status})`);
      toast.success(
        status === "submitted" ? "Evaluation submitted" : "Draft saved",
        { description: status === "submitted" ? "The evaluation has been finalized." : "You can continue editing later." }
      );
      setIsEvaluateOpen(false);
      setFormState({
        overall_rating: 0, skills_rating: 0, attitude_rating: 0,
        punctuality_rating: 0, quality_rating: 0,
        comments: "", strengths: "", areas_for_improvement: "",
        recommendation: "",
      });
      setEvaluateTarget(null);
      await fetchEvaluations();
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to save evaluation" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueCertificate = async (evaluationId: string) => {
    setIssuingCert(true);
    try {
      const res = await fetch(`/api/company-hr/evaluations/${evaluationId}/certificate`, {
        method: "POST",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `Failed (${res.status})`);
      toast.success("Certificate issued", { description: "The intern can now download it from their dashboard." });
      await fetchEvaluations();
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to issue certificate" });
    } finally {
      setIssuingCert(false);
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [isEvaluateOpen, setIsEvaluateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<FinalEvaluation | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  
  // Form state for evaluation
  const [formState, setFormState] = useState({
    overall_rating: 0,
    skills_rating: 0,
    attitude_rating: 0,
    punctuality_rating: 0,
    quality_rating: 0,
    comments: "",
    strengths: "",
    areas_for_improvement: "",
    recommendation: "" as "hire" | "strong_hire" | "no_hire" | "",
  });

  const filteredEvaluations = evaluations.filter((eval_) => {
    const matchesSearch = 
      eval_.intern_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eval_.internship_title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || eval_.status === statusFilter;
    const matchesProgram = programFilter === "all" || eval_.internship_title === programFilter;
    
    return matchesSearch && matchesStatus && matchesProgram;
  });

  const getRecommendationBadge = (rec: FinalEvaluation["recommendation"]) => {
    switch (rec) {
      case "strong_hire":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200"><Medal className="mr-1 h-3 w-3" />Strong Hire</Badge>;
      case "hire":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><ThumbsUp className="mr-1 h-3 w-3" />Hire</Badge>;
      case "no_hire":
        return <Badge variant="destructive"><ThumbsDown className="mr-1 h-3 w-3" />No Hire</Badge>;
      default:
        return null;
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();

  const renderStars = (rating: number | null, interactive = false, onChange?: (val: number) => void) => {
    if (!interactive) {
      return (
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${
                rating && star <= rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              }`}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            onMouseEnter={() => onChange?.(star)}
            className="focus:outline-none"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= (rating || 0)
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300 hover:text-amber-200"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  // Stats
  const stats = {
    total: evaluations.length,
    pending: evaluations.filter(e => e.status === "pending").length,
    inProgress: evaluations.filter(e => e.status === "in_progress").length,
    submitted: evaluations.filter(e => e.status === "submitted").length,
    approved: evaluations.filter(e => e.status === "approved").length,
    avgRating: evaluations
      .filter(e => e.overall_rating)
      .reduce((acc, e) => acc + (e.overall_rating || 0), 0) / 
      Math.max(1, evaluations.filter(e => e.overall_rating).length),
    certificatesIssued: evaluations.filter(e => e.certificate_issued).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Final Evaluations"
        description="Review final evaluations and issue completion certificates"
        actions={
          <Button asChild variant="outline">
            <a href="/company-hr/documents" className="gap-2">
              <Award className="h-4 w-4" />
              Manage Certificates
            </a>
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-2xl font-bold text-amber-600">{stats.submitted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Avg Rating</p>
            <p className="text-2xl font-bold text-primary">{stats.avgRating.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Certificates</p>
            <p className="text-2xl font-bold text-purple-600">{stats.certificatesIssued}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="action">Needs Action ({stats.pending + stats.submitted})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.approved})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search evaluations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                {programs.map(program => (
                  <SelectItem key={program} value={program.toLowerCase().replace(" ", "_")}>{program}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Evaluations List */}
          <div className="space-y-4">
            {filteredEvaluations.map((evaluation, index) => (
              <motion.div
                key={evaluation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card className={`transition-all hover:shadow-md ${evaluation.status === 'submitted' ? 'border-amber-200' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{getInitials(evaluation.intern_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{evaluation.intern_name}</h3>
                            <p className="text-sm text-muted-foreground">{evaluation.internship_title}</p>
                          </div>
                          <StatusBadge status={evaluation.status} />
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mb-3">
                          {evaluation.supervisor_name && (
                            <span>Evaluator: {evaluation.supervisor_name}</span>
                          )}
                          {evaluation.overall_rating && (
                            <span className="flex items-center gap-1">
                              Overall Rating:
                              {renderStars(evaluation.overall_rating)}
                              <span className="font-medium text-foreground ml-1">{evaluation.overall_rating}/5</span>
                            </span>
                          )}
                          {evaluation.recommendation && getRecommendationBadge(evaluation.recommendation)}
                        </div>

                        {evaluation.comments && (
                          <p className="text-sm bg-muted/30 p-3 rounded-lg line-clamp-2">
                            &ldquo;{evaluation.comments}&rdquo;
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-sm text-muted-foreground">
                          {evaluation.submitted_at && (
                            <span>Submitted: {new Date(evaluation.submitted_at).toLocaleDateString()}</span>
                          )}
                          <span className={`flex items-center gap-1 ${evaluation.certificate_issued ? 'text-emerald-600' : ''}`}>
                            <Award className="h-3 w-3" />
                            Certificate: {evaluation.certificate_issued ? 'Issued' : 'Not Issued'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 lg:flex-col shrink-0 mt-4 lg:mt-0">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => { setSelectedEvaluation(evaluation); setIsViewOpen(true); }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>

                        {(evaluation.status === "pending" || evaluation.status === "in_progress") && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedEvaluation(evaluation);
                              // Pre-populate the form with existing scores if available
                              setFormState({
                                overall_rating: evaluation.overall_rating || 0,
                                skills_rating: evaluation.skills_rating || 0,
                                attitude_rating: evaluation.attitude_rating || 0,
                                punctuality_rating: evaluation.punctuality_rating || 0,
                                quality_rating: evaluation.quality_rating || 0,
                                comments: evaluation.comments || "",
                                strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.join("\n") : (evaluation.strengths || ""),
                                areas_for_improvement: Array.isArray(evaluation.areas_for_improvement) ? evaluation.areas_for_improvement.join("\n") : (evaluation.areas_for_improvement || ""),
                                recommendation: (evaluation.recommendation || "") as any,
                              });
                              // Look up the student_internship_id for this evaluation
                              const match = internsForEvaluation.find(
                                (i) => i.student_user_id === evaluation.intern_id && i.internship_id === evaluation.internship_id
                              );
                              if (match) {
                                setEvaluateTarget({
                                  student_internship_id: match.student_internship_id,
                                  student_user_id: match.student_user_id,
                                  internship_id: match.internship_id,
                                });
                              } else {
                                setEvaluateTarget(null);
                              }
                              setIsEvaluateOpen(true);
                            }}
                          >
                            <Edit3 className="h-3 w-3 mr-1" /> Evaluate
                          </Button>
                        )}

                        {evaluation.status === "submitted" && !evaluation.certificate_issued && (
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => handleIssueCertificate(evaluation.id)}
                            disabled={issuingCert}
                          >
                            <Award className="h-3 w-3 mr-1" />
                            {issuingCert ? "Issuing..." : "Approve & Issue Certificate"}
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <MoreVertical className="h-4 w-4 mr-1" /> More
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedEvaluation(evaluation); setIsViewOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" /> Full Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                // Fetch the certificate PDF from the existing
                                // /api/company-hr/evaluations/[id]/certificate
                                // endpoint. The endpoint streams a PDF — opening
                                // it in a new tab lets the browser handle the
                                // download/print flow.
                                try {
                                  const res = await fetch(`/api/company-hr/evaluations/${evaluation.id}/certificate`);
                                  if (!res.ok) {
                                    const err = await res.json().catch(() => ({}));
                                    toast.error("Error", { description: err.error || "Failed to generate certificate. The evaluation may not be approved yet." });
                                    return;
                                  }
                                  const blob = await res.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `evaluation-${evaluation.intern_name || evaluation.id}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                } catch (e) {
                                  toast.error("Failed", { description: "Network error while generating certificate." });
                                }
                              }}
                            >
                              <Download className="mr-2 h-4 w-4" /> Export PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                // Navigate to the notifications page so the
                                // HR user can compose a message to the intern.
                                // The notifications page has a real compose
                                // dialog wired to the DB.
                                window.location.href = "/company-hr/notifications";
                              }}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" /> Send to Intern
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {filteredEvaluations.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Evaluations Found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filters
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* View Detail Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          {selectedEvaluation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(selectedEvaluation.intern_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedEvaluation.intern_name}</p>
                    <p className="font-normal text-sm text-muted-foreground">
                      {selectedEvaluation.internship_title}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <StatusBadge status={selectedEvaluation.status} />
                  {selectedEvaluation.recommendation && getRecommendationBadge(selectedEvaluation.recommendation)}
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-6">
                {/* Ratings */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4" /> Performance Ratings
                  </h4>
                  
                  <div className="space-y-3">
                    <RatingRow label="Overall Performance" rating={selectedEvaluation.overall_rating ?? null} icon={<Target className="h-4 w-4" />} />
                    <RatingRow label="Technical Skills" rating={selectedEvaluation.skills_rating ?? null} icon={<Zap className="h-4 w-4" />} />
                    <RatingRow label="Attitude & Teamwork" rating={selectedEvaluation.attitude_rating ?? null} icon={<Heart className="h-4 w-4" />} />
                    <RatingRow label="Punctuality" rating={selectedEvaluation.punctuality_rating ?? null} icon={<Clock className="h-4 w-4" />} />
                    <RatingRow label="Work Quality" rating={selectedEvaluation.quality_rating ?? null} icon={<Lightbulb className="h-4 w-4" />} />
                  </div>
                </div>

                {/* Comments */}
                {selectedEvaluation.comments && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> Evaluator Comments
                    </h4>
                    <div className="p-4 bg-muted/30 rounded-lg text-sm leading-relaxed">
                      {selectedEvaluation.comments}
                    </div>
                  </div>
                )}

                {/* Strengths & Improvements */}
                {(selectedEvaluation.strengths?.length || selectedEvaluation.areas_for_improvement?.length) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedEvaluation.strengths && selectedEvaluation.strengths.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2 text-emerald-700">
                          <ThumbsUp className="h-4 w-4" /> Strengths
                        </h4>
                        <ul className="space-y-1">
                          {selectedEvaluation.strengths.map((strength, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm bg-emerald-50 p-2 rounded">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {selectedEvaluation.areas_for_improvement && selectedEvaluation.areas_for_improvement.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2 text-amber-700">
                          <Lightbulb className="h-4 w-4" /> Areas for Improvement
                        </h4>
                        <ul className="space-y-1">
                          {selectedEvaluation.areas_for_improvement.map((area, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm bg-amber-50 p-2 rounded">
                              <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              {area}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Metadata */}
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <InfoRow label="Evaluator" value={selectedEvaluation.supervisor_name || "N/A"} />
                    <InfoRow label="Evaluator Role" value={selectedEvaluation.evaluator_role ? selectedEvaluation.evaluator_role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "N/A"} />
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <InfoRow label="Created" value={new Date(selectedEvaluation.created_at).toLocaleDateString()} />
                    <InfoRow label="Submitted" value={selectedEvaluation.submitted_at ? new Date(selectedEvaluation.submitted_at).toLocaleDateString() : "N/A"} />
                  </div>
                </div>

              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
                {!selectedEvaluation.certificate_issued && (selectedEvaluation.status === "approved" || selectedEvaluation.status === "submitted") && (
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => handleIssueCertificate(selectedEvaluation.id)}
                    disabled={issuingCert}
                  >
                    <Award className="h-4 w-4 mr-2" />
                    {issuingCert ? "Issuing..." : "Issue Certificate"}
                  </Button>
                )}
                {selectedEvaluation.certificate_issued && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Certificate issued
                  </Badge>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Evaluate Dialog */}
      <Dialog open={isEvaluateOpen} onOpenChange={setIsEvaluateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete Final Evaluation</DialogTitle>
            <DialogDescription>
              Rate this intern&apos;s performance during their internship.
            </DialogDescription>
          </DialogHeader>

          {selectedEvaluation && (
            <DialogBody className="space-y-6">
              <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{getInitials(selectedEvaluation.intern_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedEvaluation.intern_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedEvaluation.internship_title}</p>
                </div>
              </div>

              {/* Rating Inputs */}
              <div className="space-y-4">
                <h4 className="font-semibold">Performance Ratings</h4>
                
                <div className="space-y-4">
                  <InteractiveRatingRow 
                    label="Overall Performance" 
                    value={formState.overall_rating}
                    onChange={(v) => setFormState({ ...formState, overall_rating: v })}
                  />
                  <InteractiveRatingRow 
                    label="Technical Skills" 
                    value={formState.skills_rating}
                    onChange={(v) => setFormState({ ...formState, skills_rating: v })}
                  />
                  <InteractiveRatingRow 
                    label="Attitude & Teamwork" 
                    value={formState.attitude_rating}
                    onChange={(v) => setFormState({ ...formState, attitude_rating: v })}
                  />
                  <InteractiveRatingRow 
                    label="Punctuality" 
                    value={formState.punctuality_rating}
                    onChange={(v) => setFormState({ ...formState, punctuality_rating: v })}
                  />
                  <InteractiveRatingRow 
                    label="Work Quality" 
                    value={formState.quality_rating}
                    onChange={(v) => setFormState({ ...formState, quality_rating: v })}
                  />
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  placeholder="Provide detailed feedback about the intern's performance..."
                  value={formState.comments}
                  onChange={(e) => setFormState({ ...formState, comments: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Strengths & Improvements */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="strengths">Key Strengths (comma-separated)</Label>
                  <Textarea
                    id="strengths"
                    placeholder="e.g., Problem solving, Communication..."
                    value={formState.strengths}
                    onChange={(e) => setFormState({ ...formState, strengths: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="improvements">Areas for Improvement (comma-separated)</Label>
                  <Textarea
                    id="improvements"
                    placeholder="e.g., Time management, Technical depth..."
                    value={formState.areas_for_improvement}
                    onChange={(e) => setFormState({ ...formState, areas_for_improvement: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="space-y-2">
                <Label>Hiring Recommendation</Label>
                <Select value={formState.recommendation} onValueChange={(v) => setFormState({ ...formState, recommendation: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Select recommendation..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strong_hire">Strongly Recommend Hiring</SelectItem>
                    <SelectItem value="hire">Recommend Hiring</SelectItem>
                    <SelectItem value="no_hire">Do Not Recommend</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              </DialogBody>
          )}
          {selectedEvaluation && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEvaluateOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSubmitEvaluation("in_progress")}
                  disabled={submitting || !evaluateTarget}
                >
                  {submitting ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  disabled={!formState.overall_rating || submitting || !evaluateTarget}
                  onClick={() => handleSubmitEvaluation("submitted")}
                >
                  {submitting ? "Submitting..." : "Submit Evaluation"}
                </Button>
              </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper Components
function RatingRow({ label, rating, icon }: { label: string; rating: number | null; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-2">
        {rating !== null ? (
          <>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
              />
            ))}
            <span className="text-sm font-medium ml-1">{rating}/5</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Not rated</span>
        )}
      </div>
    </div>
  );
}

function InteractiveRatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-amber-200'
              }`}
            />
          </button>
        ))}
        <span className="text-sm font-medium w-8">{value > 0 ? `${value}/5` : '-'}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
