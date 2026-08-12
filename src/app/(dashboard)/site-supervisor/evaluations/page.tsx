"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  CheckSquare,
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

// Types
interface EvaluationStudent {
  id: string;
  /** Alias for `id` — some handlers use `studentId` for clarity. */
  studentId?: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  internshipTitle: string;
  lastEvaluationDate?: string | null;
  daysSinceEvaluation: number;
  evaluationStatus: "current" | "due" | "overdue" | "completed";
}

interface EvaluationRecord {
  id: string;
  studentId: string;
  studentName: string;
  periodStart: string;
  periodEnd: string;
  overallRating: number;
  decision: "satisfactory" | "needs_improvement" | "unsatisfactory";
  submittedAt: string;
  signedAt: string;
  technicalScore: number;
  professionalScore: number;
  workQualityScore: number;
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
      
      // Get supervisor record
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "site")
        .single();

      if (!supervisor) {
        // No supervisor record - keep empty state
        setIsLoading(false);
        return;
      }

      // Fetch assigned students with evaluation status
      const { data: assignments } = await supabase
        .from("student_internships")
        .select(`
          id,
          student_id,
          status,
          start_date,
          end_date,
          progress,
          last_evaluation_at,
          student:students(
            id,
            full_name,
            email,
            avatar_url
          ),
          internship:internships(id, title)
        `)
        .eq("site_supervisor_id", supervisor.id);

      const studentList: EvaluationStudent[] = (assignments || []).map((assign: any) => {
        const student = assign.student || {};
        const internship = assign.internship || {};
        const lastEval = assign.last_evaluation_at ? new Date(assign.last_evaluation_at) : null;
        const daysSince = lastEval ? Math.floor((Date.now() - lastEval.getTime()) / (1000 * 60 * 60 * 24)) : 999;

        let evalStatus: EvaluationStudent["evaluationStatus"];
        if (!lastEval || daysSince > 21) evalStatus = "overdue";
        else if (daysSince > 18) evalStatus = "due";
        else if (daysSince >= 0) evalStatus = "current";
        else evalStatus = "completed";

        return {
          id: assign.id,
          studentId: student.id,
          name: student.full_name || `Student ${student.id?.slice(0, 6)}`,
          email: student.email || "",
          avatarUrl: student.avatar_url,
          internshipTitle: internship.title || "N/A",
          lastEvaluationDate: assign.last_evaluation_at,
          daysSinceEvaluation: daysSince === 999 ? -1 : daysSince,
          evaluationStatus: evalStatus,
        };
      });

      setStudents(studentList);

      // Fetch past evaluations
      const { data: evals } = await supabase
        .from("site_supervisor_evaluations")
        .select(`
          *,
          student:students(full_name)
        `)
        .eq("evaluator_id", supervisor.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setEvaluations((evals || []).map((e: any) => ({
        id: e.id,
        studentId: e.student_id,
        studentName: e.student?.full_name || "Unknown",
        periodStart: e.evaluation_period_start,
        periodEnd: e.evaluation_period_end,
        overallRating: e.overall_rating,
        decision: e.decision,
        submittedAt: e.created_at,
        signedAt: e.signed_at,
        technicalScore: ((e.technical_knowledge + e.problem_solving + e.code_quality + e.learning_agility) / 4),
        professionalScore: ((e.communication + e.teamwork + e.punctuality + e.initiative + e.adaptability) / 5),
        workQualityScore: ((e.task_completion_rate + e.deliverable_quality + e.deadline_adherence + e.documentation_quality) / 4),
      })));

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
      (technicalAvg * 0.30) + (professionalAvg * 0.35) + (workQualityAvg * 0.35)
      * 100
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
    
    setIsSubmitting(true);
    
    try {
      const supabase = createClient();
      
      const response = await fetch("/api/site-supervisor/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          student_id: formData.studentId,
          evaluation_period_start: formData.periodStart,
          evaluation_period_end: formData.periodEnd,
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
          signature_image: formData.signatureData,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CheckSquare className="h-8 w-8" />
            HEC Evaluations
          </h1>
          <p className="text-muted-foreground mt-1">
            3-week cycle evaluations compliant with HEC guidelines
          </p>
        </div>
        <Button onClick={() => setActiveTab("new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Evaluation
        </Button>
      </div>

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
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-50">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {students.filter(s => s.evaluationStatus === "overdue").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-50">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">
                      {students.filter(s => s.evaluationStatus === "due").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Due This Week</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {students.filter(s => s.evaluationStatus === "current").length}
                    </p>
                    <p className="text-xs text-muted-foreground">On Track</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{evaluations.length}</p>
                    <p className="text-xs text-muted-foreground">Total Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
                            handleSelectStudent(student.studentId);
                            setActiveTab("new");
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
                      <SelectItem key={student.studentId} value={student.studentId}>
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
                type="button"
                variant="secondary"
                disabled={!formData.studentId}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
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
                              {new Date(evaluation.periodStart).toLocaleDateString()} -{" "}
                              {new Date(evaluation.periodEnd).toLocaleDateString()}
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
                            <Button variant="outline" size="icon">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon">
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
                        {new Date(selectedEvaluation.signedAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline">
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
