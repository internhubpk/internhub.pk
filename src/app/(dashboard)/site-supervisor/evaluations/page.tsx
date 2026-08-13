"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  Star,
  FileText,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Edit3,
  Save,
  Send,
  BarChart3,
  Target,
  Users,
  Award,
  BookOpen,
  MessageSquare,
  PenTool,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { SignaturePad } from "@/components/supervisors/signature-pad";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// Types
interface EvaluationStudent {
  id: string;
  /** Alias for `id` — some handlers use `studentId` for clarity. */
  studentId?: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  internshipId?: string | null;
  internshipTitle: string;
  lastEvaluationDate?: string | null;
  daysSinceEvaluation: number;
  evaluationStatus: "current" | "due" | "overdue" | "completed";
}

interface EvaluationRecord {
  id: string;
  studentId: string;
  studentName: string;
  periodStart: string | null;
  periodEnd: string | null;
  overallRating: number;
  decision: "satisfactory" | "needs_improvement" | "unsatisfactory";
  submittedAt: string;
  signedAt: string | null;
  technicalScore: number;
  professionalScore: number;
  workQualityScore: number;
  comments?: string | null;
}

interface EvaluationFormData {
  studentId: string;
  periodStart: string;
  periodEnd: string;
  // Technical Skills (0-10)
  technicalKnowledge: number;
  problemSolving: number;
  codeQuality: number;
  learningAgility: number;
  // Professional Skills (0-10)
  communication: number;
  teamwork: number;
  punctuality: number;
  initiative: number;
  adaptability: number;
  // Work Quality (0-10)
  taskCompletionRate: number;
  deliverableQuality: number;
  deadlineAdherence: number;
  documentationQuality: number;
  // Comments
  strengths: string;
  areasForImprovement: string;
  generalRemarks: string;
  recommendations: string;
  // Decision
  decision: "satisfactory" | "needs_improvement" | "unsatisfactory";
  // Signature
  signatureData: string | null;
}

const initialFormData: EvaluationFormData = {
  studentId: "",
  periodStart: "",
  periodEnd: "",
  technicalKnowledge: 5,
  problemSolving: 5,
  codeQuality: 5,
  learningAgility: 5,
  communication: 5,
  teamwork: 5,
  punctuality: 5,
  initiative: 5,
  adaptability: 5,
  taskCompletionRate: 5,
  deliverableQuality: 5,
  deadlineAdherence: 5,
  documentationQuality: 5,
  strengths: "",
  areasForImprovement: "",
  generalRemarks: "",
  recommendations: "",
  decision: "satisfactory",
  signatureData: null,
};

export default function SiteSupervisorEvaluationsPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"schedule" | "new" | "history">("schedule");
  const [students, setStudents] = useState<EvaluationStudent[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form state
  const [formData, setFormData] = useState<EvaluationFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationRecord | null>(null);

  useEffect(() => {
    fetchEvaluationData();
  }, []);

  async function fetchEvaluationData() {
    if (!user) return;

    setIsLoading(true);
    try {
      const supabase = createClient();

      // student_internships.site_supervisor_id is FK to profiles.user_id —
      // filter by the auth user's id (the supervisor's user_id), NOT the
      // supervisors table PK. RLS uses auth.uid() the same way.
      const supervisorUserId = user.id;

      // Fetch assigned students (real columns only — student_internships has
      // no `student_id`, `progress`, or `last_evaluation_at` columns).
      const { data: assignments } = await supabase
        .from("student_internships")
        .select(`
          id,
          student_user_id,
          internship_id,
          status,
          start_date,
          end_date,
          student_profile:student_user_id(
            full_name,
            first_name,
            last_name,
            email,
            avatar_url
          ),
          internship:internships(id, title)
        `)
        .eq("site_supervisor_id", supervisorUserId)
        .order("updated_at", { ascending: false });

      const internRows = (assignments || []) as any[];
      const studentUserIds = internRows
        .map((r) => r.student_user_id)
        .filter((id): id is string => Boolean(id));

      // Look up most-recent evaluation per student (the supervisor's own) so
      // we can compute "days since last evaluation" without relying on the
      // non-existent `student_internships.last_evaluation_at` column.
      const evalsForStatusRes = studentUserIds.length
        ? await supabase
            .from("evaluations")
            .select("id, student_user_id, created_at")
            .eq("evaluator_id", supervisorUserId)
            .eq("evaluator_role", "site_supervisor")
            .in("student_user_id", studentUserIds)
            .order("created_at", { ascending: false })
        : { data: [] as any[], error: null };

      const lastEvalByStudent = new Map<string, string>();
      (evalsForStatusRes.data || []).forEach((ev: any) => {
        if (ev.student_user_id && !lastEvalByStudent.has(ev.student_user_id)) {
          lastEvalByStudent.set(ev.student_user_id, ev.created_at);
        }
      });

      const studentList: EvaluationStudent[] = internRows.map((assign: any) => {
        const profile = assign.student_profile || {};
        const internship = assign.internship || {};
        const studentUser = assign.student_user_id as string | undefined;
        const lastEvalIso = studentUser ? lastEvalByStudent.get(studentUser) ?? null : null;
        const lastEval = lastEvalIso ? new Date(lastEvalIso) : null;
        const daysSince = lastEval
          ? Math.floor((Date.now() - lastEval.getTime()) / (1000 * 60 * 60 * 24))
          : -1;

        let evalStatus: EvaluationStudent["evaluationStatus"];
        if (!lastEval || daysSince > 21) evalStatus = "overdue";
        else if (daysSince > 18) evalStatus = "due";
        else evalStatus = "current";

        const fullName =
          profile.full_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          (profile.email ? profile.email.split("@")[0] : "Unknown Student");

        return {
          id: assign.id,
          studentId: studentUser || assign.id,
          name: fullName,
          email: profile.email || "",
          avatarUrl: profile.avatar_url ?? null,
          internshipId: internship.id ?? null,
          internshipTitle: internship.title || "N/A",
          lastEvaluationDate: lastEvalIso,
          daysSinceEvaluation: daysSince,
          evaluationStatus: evalStatus,
        };
      });

      setStudents(studentList);

      // Fetch past evaluations directly from `evaluations` (real columns).
      // `evaluations.evaluator_id` references profiles.user_id — filter by
      // the supervisor's user_id, not the supervisors table PK. The
      // `site_supervisor_evaluations` view is just a SELECT on this same
      // table and gives no benefit here.
      const { data: evals } = await supabase
        .from("evaluations")
        .select(`
          id,
          student_user_id,
          type,
          scores,
          rating,
          comments,
          status,
          submitted_at,
          created_at,
          student_profile:student_user_id(
            full_name,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq("evaluator_id", supervisorUserId)
        .eq("evaluator_role", "site_supervisor")
        .order("created_at", { ascending: false })
        .limit(50);

      const num = (v: any) => (typeof v === "number" ? v : 0);
      const avg = (vals: number[]) =>
        vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;

      setEvaluations((evals || []).map((e: any) => {
        const scores = (e.scores && typeof e.scores === "object") ? e.scores as Record<string, any> : {};
        const overall = typeof e.rating === "number" ? e.rating : 0;
        const decision: EvaluationRecord["decision"] =
          overall >= 4 ? "satisfactory" : overall >= 3 ? "needs_improvement" : "unsatisfactory";
        const submittedAt = e.submitted_at || e.created_at;
        const student = e.student_profile || {};
        const studentName =
          student.full_name ||
          [student.first_name, student.last_name].filter(Boolean).join(" ") ||
          "Unknown Student";
        return {
          id: e.id,
          studentId: e.student_user_id,
          studentName,
          // evaluations has no `evaluation_period_start/end` — leave null.
          periodStart: null,
          periodEnd: null,
          overallRating: overall,
          decision,
          submittedAt,
          // evaluations has no `signed_at` — fall back to submittedAt.
          signedAt: submittedAt,
          technicalScore: avg([
            num(scores.technical_knowledge),
            num(scores.problem_solving),
            num(scores.code_quality),
            num(scores.learning_agility),
          ]),
          professionalScore: avg([
            num(scores.communication),
            num(scores.teamwork),
            num(scores.punctuality),
            num(scores.initiative),
            num(scores.adaptability),
          ]),
          workQualityScore: avg([
            num(scores.task_completion_rate),
            num(scores.deliverable_quality),
            num(scores.deadline_adherence),
            num(scores.documentation_quality),
          ]),
          comments: e.comments ?? null,
        };
      }));

    } catch (error) {
      console.error("Error fetching evaluation data:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  // Note: Mock data removed - page shows empty state until real data is available
  // function setMockData() has been removed to prevent showing fake data

  // Calculate computed values
  const calculatedScores = useMemo(() => {
    const technicalAvg = (
      formData.technicalKnowledge + formData.problemSolving +
      formData.codeQuality + formData.learningAgility
    ) / 4;

    const professionalAvg = (
      formData.communication + formData.teamwork +
      formData.punctuality + formData.initiative + formData.adaptability
    ) / 5;

    const workQualityAvg = (
      formData.taskCompletionRate + formData.deliverableQuality +
      formData.deadlineAdherence + formData.documentationQuality
    ) / 4;

    const overallRating = Math.round(
      ((technicalAvg * 0.30) + (professionalAvg * 0.35) + (workQualityAvg * 0.35)) * 100
    ) / 100;

    return { technicalAvg, professionalAvg, workQualityAvg, overallRating };
  }, [formData]);

  // Filter students for schedule view
  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  function handleScoreChange(field: keyof EvaluationFormData, value: number) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function handleSelectStudent(studentId: string) {
    const student = students.find(s => s.studentId === studentId);
    if (student) {
      // Auto-calculate evaluation period based on last evaluation
      const startDate = student.lastEvaluationDate 
        ? new Date(new Date(student.lastEvaluationDate).getTime() + 24 * 60 * 60 * 1000)
        : new Date();
      
      const endDate = new Date(startDate.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 weeks

      setFormData(prev => ({
        ...prev,
        studentId,
        periodStart: startDate.toISOString().split('T')[0],
        periodEnd: endDate.toISOString().split('T')[0],
      }));
    }
  }

  async function handleSubmitEvaluation() {
    if (!formData.signatureData) {
      alert("Please provide your digital signature before submitting.");
      return;
    }
    if (!user) return;

    setIsSubmitting(true);

    try {
      const selectedStudent = students.find((s) => s.studentId === formData.studentId);
      const internshipId = selectedStudent?.internshipId ?? null;

      // Build a single `scores` JSONB object containing all 13 score
      // sliders (real `evaluations.scores` column). The legacy per-column
      // insert fields do not exist on `evaluations`.
      const scores = {
        technical_knowledge: formData.technicalKnowledge,
        problem_solving: formData.problemSolving,
        code_quality: formData.codeQuality,
        learning_agility: formData.learningAgility,
        communication: formData.communication,
        teamwork: formData.teamwork,
        punctuality: formData.punctuality,
        initiative: formData.initiative,
        adaptability: formData.adaptability,
        task_completion_rate: formData.taskCompletionRate,
        deliverable_quality: formData.deliverableQuality,
        deadline_adherence: formData.deadlineAdherence,
        documentation_quality: formData.documentationQuality,
      };

      // Combine all four comment fields into a single `comments` text blob
      // (evaluations has no per-section columns). Include the chosen decision
      // and the signature image as metadata for traceability.
      const comments = [
        formData.strengths ? `Strengths & Achievements:\n${formData.strengths}` : "",
        formData.areasForImprovement
          ? `Areas for Improvement:\n${formData.areasForImprovement}`
          : "",
        formData.generalRemarks ? `General Remarks:\n${formData.generalRemarks}` : "",
        formData.recommendations ? `Recommendations:\n${formData.recommendations}` : "",
        formData.decision ? `Decision: ${formData.decision}` : "",
        formData.signatureData ? `Signature: ${formData.signatureData.slice(0, 80)}…` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      // evaluations.rating is 0-5 — the UI computes a 0-10 weighted average,
      // so scale it down by 2.
      const rating = Math.max(0, Math.min(5, Math.round((calculatedScores.overallRating / 2) * 10) / 10));

      const response = await fetch("/api/site-supervisor/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_user_id: formData.studentId,
          evaluator_id: user.id,
          evaluator_role: "site_supervisor",
          type: "supervisor_evaluation",
          scores,
          rating,
          comments,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          internship_id: internshipId,
        }),
      });

      if (response.ok) {
        alert("Evaluation submitted successfully!");
        setFormData(initialFormData);
        setActiveTab("history");
        fetchEvaluationData();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error?.message || "Failed to submit evaluation"}`);
      }
    } catch (error) {
      console.error("Error submitting evaluation:", error);
      alert("An error occurred while submitting the evaluation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getEvaluationStatusBadge(status: EvaluationStudent["evaluationStatus"]) {
    switch (status) {
      case "current":
        return <Badge className="bg-green-100 text-green-800">On Track</Badge>;
      case "due":
        return <Badge className="bg-yellow-100 text-yellow-800">Due Soon</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      case "completed":
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
    }
  }

  function getDecisionBadge(decision: EvaluationRecord["decision"]) {
    switch (decision) {
      case "satisfactory":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Satisfactory
        </Badge>;
      case "needs_improvement":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <AlertCircle className="h-3 w-3 mr-1" /> Needs Improvement
        </Badge>;
      case "unsatisfactory":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" /> Unsatisfactory
        </Badge>;
    }
  }

  function renderScoreInput(label: string, description: string, value: number, onChange: (v: number) => void) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <span className={`text-sm font-bold px-2 py-0.5 rounded ${
            value >= 8 ? 'text-green-700 bg-green-50' :
            value >= 6 ? 'text-blue-700 bg-blue-50' :
            value >= 4 ? 'text-yellow-700 bg-yellow-50' :
            'text-red-700 bg-red-50'
          }`}>
            {value}/10
          </span>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex gap-1">
            {[0, 5, 10].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                className={`w-8 h-7 text-xs rounded border transition-colors ${
                  Math.abs(value - num) < 0.5
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-muted'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="HEC Evaluations"
        description="3-week cycle evaluations compliant with HEC guidelines"
        actions={
          <Button onClick={() => setActiveTab("new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Evaluation
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            New Evaluation
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            History ({evaluations.length})
          </TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6 mt-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Overdue"
              value={students.filter(s => s.evaluationStatus === "overdue").length}
              icon={AlertCircle}
              variant="danger"
            />
            <StatCard
              label="Due This Week"
              value={students.filter(s => s.evaluationStatus === "due").length}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              label="On Track"
              value={students.filter(s => s.evaluationStatus === "current").length}
              icon={CheckCircle2}
              variant="success"
            />
            <StatCard label="Total Completed" value={evaluations.length} icon={BarChart3} variant="info" />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Student Evaluation Status List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evaluation Schedule by Student</CardTitle>
              <CardDescription>
                HEC requires evaluations every 3 weeks during internship
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No students found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStudents.map((student) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        student.evaluationStatus === "overdue" ? 'border-red-200 bg-red-50/30' :
                        student.evaluationStatus === "due" ? 'border-yellow-200 bg-yellow-50/30' :
                        ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={student.avatarUrl || undefined} alt={student.name} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.internshipTitle}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className={`font-medium ${
                            student.daysSinceEvaluation > 21 ? 'text-red-600' :
                            student.daysSinceEvaluation > 18 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {student.daysSinceEvaluation < 0 ? "Never evaluated" : `${student.daysSinceEvaluation} days ago`}
                          </p>
                          <p className="text-xs text-muted-foreground">Last evaluation</p>
                        </div>
                        
                        {getEvaluationStatusBadge(student.evaluationStatus)}
                        
                        <Button
                          size="sm"
                          onClick={() => {
                            if (student.studentId) {
                              handleSelectStudent(student.studentId);
                              setActiveTab("new");
                            }
                          }}
                        >
                          {student.evaluationStatus === "overdue" ? "Evaluate Now" : "Evaluate"}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3-Week Cycle Visual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                HEC 3-Week Evaluation Cycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-6 gap-2 mb-2">
                    {["Week 1-3", "Week 4-6", "Week 7-9", "Week 10-12", "Week 13-15", "Week 16-18"].map((period, i) => (
                      <div key={period} className="text-center p-2 rounded-lg bg-muted text-sm font-medium">
                        {period}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { status: "completed", label: "✓ Done" },
                      { status: "completed", label: "✓ Done" },
                      { status: "current", label: "Current" },
                      { status: "upcoming", label: "Upcoming" },
                      { status: "upcoming", label: "Upcoming" },
                      { status: "future", label: "Future" },
                    ].map((week, i) => (
                      <div key={i} className={`text-center p-4 rounded-lg border-2 ${
                        week.status === "completed" ? "border-green-300 bg-green-50" :
                        week.status === "current" ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200" :
                        week.status === "upcoming" ? "border-gray-200 bg-gray-50" :
                        "border-dashed border-gray-200 bg-white"
                      }`}>
                        <span className={`text-sm ${
                          week.status === "completed" ? "text-green-700" :
                          week.status === "current" ? "text-amber-700 font-semibold" :
                          "text-gray-500"
                        }`}>
                          {week.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>HEC Requirement:</strong> Site supervisors must evaluate their assigned interns every 3 weeks throughout the internship duration. Each evaluation must include digital signature and be timestamped.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Evaluation Tab */}
        <TabsContent value="new" className="space-y-6 mt-6">
          <form onSubmit={(e) => { e.preventDefault(); setShowPreviewDialog(true); }}>
            {/* Student Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Select Student
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.studentId} onValueChange={handleSelectStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student to evaluate" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.studentId || student.id} value={student.studentId || student.id}>
                        <div className="flex items-center gap-2">
                          <span>{student.name}</span>
                          {getEvaluationStatusBadge(student.evaluationStatus)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {formData.studentId && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {students.find(s => s.studentId === formData.studentId)?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {students.find(s => s.studentId === formData.studentId)?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {students.find(s => s.studentId === formData.studentId)?.internshipTitle}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evaluation Period */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Evaluation Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="period-start">Period Start Date</Label>
                    <Input
                      id="period-start"
                      type="date"
                      value={formData.periodStart}
                      onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period-end">Period End Date</Label>
                    <Input
                      id="period-end"
                      type="date"
                      value={formData.periodEnd}
                      onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                {(formData.periodStart && formData.periodEnd) && (() => {
                  const start = new Date(formData.periodStart);
                  const end = new Date(formData.periodEnd);
                  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div className={`mt-3 p-3 rounded-lg ${
                      days === 21 ? "bg-green-50 border border-green-200" :
                      days > 14 && days <= 28 ? "bg-yellow-50 border border-yellow-200" :
                      "bg-red-50 border border-red-200"
                    }`}>
                      <p className={`text-sm ${days === 21 ? "text-green-700" : days > 14 && days <= 28 ? "text-yellow-700" : "text-red-700"}`}>
                        <strong>Evaluation Window:</strong> {days} days
                        {days === 21 && " ✓ Standard 3-week HEC cycle"}
                        {days !== 21 && days > 0 && ` (Standard is 21 days)`}
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Technical Skills Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Technical Skills Assessment
                </CardTitle>
                <CardDescription>Rate each criterion on a scale of 0-10 (Weight: 30%)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderScoreInput(
                  "Technical Knowledge",
                  "Understanding of core concepts and technologies used in the role",
                  formData.technicalKnowledge,
                  (v) => handleScoreChange("technicalKnowledge", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Problem-Solving Ability",
                  "Capacity to analyze issues and develop effective solutions",
                  formData.problemSolving,
                  (v) => handleScoreChange("problemSolving", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Code/Work Quality",
                  "Quality of code produced or work delivered (if applicable)",
                  formData.codeQuality,
                  (v) => handleScoreChange("codeQuality", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Learning Agility",
                  "Ability to quickly learn new tools, technologies, and processes",
                  formData.learningAgility,
                  (v) => handleScoreChange("learningAgility", v)
                )}
                
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-800">Technical Skills Average</span>
                    <span className="text-xl font-bold text-blue-700">
                      {calculatedScores.technicalAvg.toFixed(1)} / 10
                    </span>
                  </div>
                  <Progress value={calculatedScores.technicalAvg * 10} className="h-2 mt-2" />
                </div>
              </CardContent>
            </Card>

            {/* Professional Skills Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Professional Skills Assessment
                </CardTitle>
                <CardDescription>Rate each criterion on a scale of 0-10 (Weight: 35%)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderScoreInput(
                  "Communication Skills",
                  "Clarity in verbal and written communication",
                  formData.communication,
                  (v) => handleScoreChange("communication", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Teamwork & Collaboration",
                  "Ability to work effectively with team members",
                  formData.teamwork,
                  (v) => handleScoreChange("teamwork", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Punctuality & Attendance",
                  "Consistency in attendance and meeting deadlines",
                  formData.punctuality,
                  (v) => handleScoreChange("punctuality", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Initiative & Enthusiasm",
                  "Proactiveness and positive attitude toward work",
                  formData.initiative,
                  (v) => handleScoreChange("initiative", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Adaptability",
                  "Flexibility in handling changing requirements and situations",
                  formData.adaptability,
                  (v) => handleScoreChange("adaptability", v)
                )}

                <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-purple-800">Professional Skills Average</span>
                    <span className="text-xl font-bold text-purple-700">
                      {calculatedScores.professionalAvg.toFixed(1)} / 10
                    </span>
                  </div>
                  <Progress value={calculatedScores.professionalAvg * 10} className="h-2 mt-2" />
                </div>
              </CardContent>
            </Card>

            {/* Work Quality Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-600" />
                  Work Quality Metrics
                </CardTitle>
                <CardDescription>Rate each criterion on a scale of 0-10 (Weight: 35%)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderScoreInput(
                  "Task Completion Rate",
                  "Percentage of assigned tasks completed successfully",
                  formData.taskCompletionRate,
                  (v) => handleScoreChange("taskCompletionRate", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Quality of Deliverables",
                  "Overall quality and thoroughness of work products",
                  formData.deliverableQuality,
                  (v) => handleScoreChange("deliverableQuality", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Meeting Deadlines",
                  "Consistency in delivering work on time",
                  formData.deadlineAdherence,
                  (v) => handleScoreChange("deadlineAdherence", v)
                )}
                <Separator />
                {renderScoreInput(
                  "Documentation Quality",
                  "Quality of documentation and reporting",
                  formData.documentationQuality,
                  (v) => handleScoreChange("documentationQuality", v)
                )}

                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-green-800">Work Quality Average</span>
                    <span className="text-xl font-bold text-green-700">
                      {calculatedScores.workQualityAvg.toFixed(1)} / 10
                    </span>
                  </div>
                  <Progress value={calculatedScores.workQualityAvg * 10} className="h-2 mt-2" />
                </div>
              </CardContent>
            </Card>

            {/* Overall Rating & Decision */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Overall Rating & Decision
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-6 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 rounded-lg bg-white">
                      <p className="text-sm text-muted-foreground">Technical (30%)</p>
                      <p className="text-3xl font-bold text-blue-600">{calculatedScores.technicalAvg.toFixed(1)}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-white">
                      <p className="text-sm text-muted-foreground">Professional (35%)</p>
                      <p className="text-3xl font-bold text-purple-600">{calculatedScores.professionalAvg.toFixed(1)}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-white">
                      <p className="text-sm text-muted-foreground">Work Quality (35%)</p>
                      <p className="text-3xl font-bold text-green-600">{calculatedScores.workQualityAvg.toFixed(1)}</p>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Overall Weighted Rating</p>
                    <p className="text-5xl font-bold text-primary">{calculatedScores.overallRating.toFixed(1)}</p>
                    <Progress value={calculatedScores.overallRating * 10} className="h-3 mt-3 max-w-md mx-auto" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Evaluation Decision</Label>
                  <Select
                    value={formData.decision}
                    onValueChange={(v) => setFormData(prev => ({
                      ...prev,
                      decision: v as EvaluationFormData["decision"]
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="satisfactory">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Satisfactory Progress
                        </div>
                      </SelectItem>
                      <SelectItem value="needs_improvement">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          Needs Improvement
                        </div>
                      </SelectItem>
                      <SelectItem value="unsatisfactory">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Unsatisfactory Progress
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Comments Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments & Feedback
                </CardTitle>
                <CardDescription>Detailed feedback supports markdown formatting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="strengths" className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Strengths & Achievements
                  </Label>
                  <Textarea
                    id="strengths"
                    placeholder="Highlight the intern's strengths and notable achievements during this evaluation period..."
                    value={formData.strengths}
                    onChange={(e) => setFormData(prev => ({ ...prev, strengths: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="improvements" className="flex items-center gap-2 text-orange-700">
                    <AlertCircle className="h-4 w-4" />
                    Areas for Improvement
                  </Label>
                  <Textarea
                    id="improvements"
                    placeholder="Identify areas where the intern could improve..."
                    value={formData.areasForImprovement}
                    onChange={(e) => setFormData(prev => ({ ...prev, areasForImprovement: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    General Remarks
                  </Label>
                  <Textarea
                    id="remarks"
                    placeholder="Any additional observations or comments about the intern's performance..."
                    value={formData.generalRemarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, generalRemarks: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recommendations" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Recommendations
                  </Label>
                  <Textarea
                    id="recommendations"
                    placeholder="Suggestions for future development or career guidance..."
                    value={formData.recommendations}
                    onChange={(e) => setFormData(prev => ({ ...prev, recommendations: e.target.value }))}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Digital Signature */}
            <SignaturePad
              label="Digital Signature (Required)"
              onSignatureChange={(data) => setFormData(prev => ({ ...prev, signatureData: data }))}
              value={formData.signatureData}
            />

            {/* Submit Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setFormData(initialFormData)}>
                Reset Form
              </Button>
              <Button
                type="submit"
                disabled={!formData.studentId || !formData.signatureData}
                size="lg"
                className="min-w-[160px]"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Evaluation
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evaluation History</CardTitle>
              <CardDescription>All completed evaluations with scores and decisions</CardDescription>
            </CardHeader>
            <CardContent>
              {evaluations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No evaluations completed yet</p>
                  <Button
                    className="mt-4"
                    onClick={() => setActiveTab("new")}
                  >
                    Start First Evaluation
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluations.map((evaluation) => (
                    <motion.div
                      key={evaluation.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-xl border hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {evaluation.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-lg">{evaluation.studentName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {evaluation.periodStart
                                ? new Date(evaluation.periodStart).toLocaleDateString()
                                : "—"}
                              {" - "}
                              {evaluation.periodEnd
                                ? new Date(evaluation.periodEnd).toLocaleDateString()
                                : "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Submitted {new Date(evaluation.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs text-muted-foreground">Technical</p>
                              <p className="font-semibold text-blue-600">{evaluation.technicalScore.toFixed(1)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Professional</p>
                              <p className="font-semibold text-purple-600">{evaluation.professionalScore.toFixed(1)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Work Quality</p>
                              <p className="font-semibold text-green-600">{evaluation.workQualityScore.toFixed(1)}</p>
                            </div>
                          </div>

                          <div className="text-center min-w-[80px]">
                            <p className="text-3xl font-bold text-primary">{evaluation.overallRating.toFixed(1)}</p>
                            {getDecisionBadge(evaluation.decision)}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEvaluation(evaluation)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.print()}
                              title="Print"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.print()}
                              title="Save as PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog before submit */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Evaluation Before Submission</DialogTitle>
            <DialogDescription>
              Please review all details carefully. This evaluation will be officially recorded.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {students.find(s => s.studentId === formData.studentId)?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">
                      {students.find(s => s.studentId === formData.studentId)?.name}
                    </h3>
                    <p className="text-muted-foreground">
                      {formData.periodStart} to {formData.periodEnd}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 my-6">
                  <div className="text-center p-3 rounded-lg bg-blue-50">
                    <p className="text-sm text-muted-foreground">Technical</p>
                    <p className="text-2xl font-bold text-blue-600">{calculatedScores.technicalAvg.toFixed(1)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-purple-50">
                    <p className="text-sm text-muted-foreground">Professional</p>
                    <p className="text-2xl font-bold text-purple-600">{calculatedScores.professionalAvg.toFixed(1)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50">
                    <p className="text-sm text-muted-foreground">Work Quality</p>
                    <p className="text-2xl font-bold text-green-600">{calculatedScores.workQualityAvg.toFixed(1)}</p>
                  </div>
                </div>

                <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground">Overall Rating</p>
                  <p className="text-4xl font-bold text-primary">{calculatedScores.overallRating.toFixed(1)}</p>
                  <Badge className="mt-2" variant={
                    formData.decision === "satisfactory" ? "default" :
                    formData.decision === "needs_improvement" ? "secondary" : "destructive"
                  }>
                    {formData.decision.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>

                {formData.signatureData && (
                  <div className="mt-4 p-4 border rounded-lg">
                    <p className="text-sm font-medium mb-2">Digital Signature:</p>
                    <img
                      src={formData.signatureData}
                      alt="Signature"
                      className="max-h-[80px]"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                Go Back & Edit
              </Button>
              <Button
                onClick={() => {
                  setShowPreviewDialog(false);
                  handleSubmitEvaluation();
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Evaluation Detail Dialog */}
      <Dialog open={!!selectedEvaluation} onOpenChange={() => setSelectedEvaluation(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedEvaluation && (
            <>
              <DialogHeader>
                <DialogTitle>Evaluation Details</DialogTitle>
                <DialogDescription>
                  Full evaluation record for {selectedEvaluation.studentName}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                {/* Score Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Technical Skills (30%)</span>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedEvaluation.technicalScore * 10} className="w-32 h-2" />
                          <span className="font-semibold w-12 text-right">{selectedEvaluation.technicalScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Professional Skills (35%)</span>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedEvaluation.professionalScore * 10} className="w-32 h-2" />
                          <span className="font-semibold w-12 text-right">{selectedEvaluation.professionalScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Work Quality (35%)</span>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedEvaluation.workQualityScore * 10} className="w-32 h-2" />
                          <span className="font-semibold w-12 text-right">{selectedEvaluation.workQualityScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-lg font-semibold">
                        <span>Overall Rating</span>
                        <span className="text-primary">{selectedEvaluation.overallRating.toFixed(1)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Decision & Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Decision</p>
                      <div className="mt-1">{getDecisionBadge(selectedEvaluation.decision)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Signed On</p>
                      <p className="font-semibold mt-1">
                        {selectedEvaluation.signedAt
                          ? new Date(selectedEvaluation.signedAt).toLocaleString()
                          : "—"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
