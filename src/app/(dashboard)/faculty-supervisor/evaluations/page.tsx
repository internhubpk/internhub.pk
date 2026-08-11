"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Filter,
  Eye,
  Star,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  Send,
  Download,
  Printer,
  ChevronRight,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  CalendarDays,
  User,
  BarChart3,
  ClipboardCheck,
  TrendingUp,
  Award,
} from "lucide-react";

// Types
type EvaluationStatus = "pending" | "in_progress" | "approved" | "rejected" | "revision_required";
type SubmissionType = "weekly_log" | "task_submission" | "document" | "midterm" | "final";

interface PendingEvaluation {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatar?: string;
  submissionType: SubmissionType;
  title: string;
  description: string;
  submittedAt: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  contentPreview?: string;
  attachments?: { name: string; url: string; size: number }[];
}

interface EvaluationRecord {
  id: string;
  studentName: string;
  type: SubmissionType;
  title: string;
  submittedAt: string;
  evaluatedAt: string;
  status: EvaluationStatus;
  score: number;
  maxScore: number;
  evaluatorComments: string;
}

interface WeeklyReport {
  id: string;
  studentName: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  tasksCompleted: number;
  tasksPending: number;
  hoursLogged: number;
  overallScore: number;
  supervisorRemarks: string;
  status: "draft" | "submitted" | "approved";
}

interface EvaluationCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  score: number;
}

// Mock pending evaluations
const mockPendingEvaluations: PendingEvaluation[] = [
  {
    id: "pe1",
    studentId: "1",
    studentName: "Sarah Johnson",
    studentEmail: "sarah.j@university.edu",
    submissionType: "weekly_log",
    title: "Week 4 Weekly Log - Frontend Development",
    description: "Weekly progress report covering React component development work.",
    submittedAt: "2024-02-12T10:30:00Z",
    dueDate: "2024-02-13",
    priority: "high",
    contentPreview: "This week I focused on developing reusable React components for the dashboard...",
    attachments: [
      { name: "component-screenshots.zip", url: "#", size: 2500000 },
      { name: "code-review-notes.txt", url: "#", size: 5000 },
    ],
  },
  {
    id: "pe2",
    studentId: "4",
    studentName: "Ahmed Khan",
    studentEmail: "ahmed.k@university.edu",
    submissionType: "task_submission",
    title: "Data Analysis Report - Q1",
    description: "Comprehensive data analysis report using Python and pandas.",
    submittedAt: "2024-02-12T09:15:00Z",
    dueDate: "2024-02-14",
    priority: "medium",
    contentPreview: "The Q1 analysis covers customer behavior patterns and sales trends...",
    attachments: [
      { name: "q1-analysis-report.pdf", url: "#", size: 4500000 },
      { name: "data-visualization.png", url: "#", size: 1200000 },
    ],
  },
  {
    id: "pe3",
    studentId: "3",
    studentName: "Emily Davis",
    studentEmail: "emily.d@university.edu",
    submissionType: "task_submission",
    title: "Social Media Campaign Analysis",
    description: "Analysis of social media metrics and campaign performance.",
    submittedAt: "2024-02-11T14:20:00Z",
    dueDate: "2024-02-13",
    priority: "low",
    contentPreview: "This report analyzes the performance of our Q1 social media campaigns across multiple platforms...",
  },
  {
    id: "pe4",
    studentId: "2",
    studentName: "Mike Chen",
    studentEmail: "mike.chen@university.edu",
    submissionType: "document",
    title: "UI Component Library Documentation",
    description: "Technical documentation for the component library built with Storybook.",
    submittedAt: "2024-02-11T16:45:00Z",
    dueDate: "2024-02-10",
    priority: "high",
    contentPreview: "This documentation covers all components in our UI library including usage examples...",
    attachments: [
      { name: "ui-library-docs.pdf", url: "#", size: 3200000 },
    ],
  },
];

// Mock evaluation history
const mockEvaluationHistory: EvaluationRecord[] = [
  {
    id: "eh1",
    studentName: "Sarah Johnson",
    type: "task_submission",
    title: "React Component Development",
    submittedAt: "2024-02-04T14:00:00Z",
    evaluatedAt: "2024-02-05T09:30:00Z",
    status: "approved",
    score: 95,
    maxScore: 100,
    evaluatorComments: "Excellent work! Components are well-structured and follow best practices.",
  },
  {
    id: "eh2",
    studentName: "Mike Chen",
    type: "task_submission",
    title: "UI Component Library Setup",
    submittedAt: "2024-02-03T16:00:00Z",
    evaluatedAt: "2024-02-04T11:00:00Z",
    status: "approved",
    score: 88,
    maxScore: 100,
    evaluatorComments: "Good implementation. Consider adding more accessibility features.",
  },
  {
    id: "eh3",
    studentName: "Ahmed Khan",
    type: "weekly_log",
    title: "Week 3 Weekly Log - Data Modeling",
    submittedAt: "2024-02-05T10:00:00Z",
    evaluatedAt: "2024-02-06T08:15:00Z",
    status: "approved",
    score: 18,
    maxScore: 20,
    evaluatorComments: "Good progress on the data modeling task. Keep up the detailed logging.",
  },
  {
    id: "eh4",
    studentName: "Sarah Johnson",
    type: "weekly_log",
    title: "Week 2 Weekly Log - Project Setup",
    submittedAt: "2024-01-29T11:00:00Z",
    evaluatedAt: "2024-01-30T09:00:00Z",
    status: "revision_required",
    score: 14,
    maxScore: 20,
    evaluatorComments: "Please provide more details about challenges faced and how you overcame them.",
  },
  {
    id: "eh5",
    studentName: "Emily Davis",
    type: "task_submission",
    title: "Market Research Survey Design",
    submittedAt: "2024-01-28T15:00:00Z",
    evaluatedAt: "2024-01-29T10:30:00Z",
    status: "rejected",
    score: 45,
    maxScore: 100,
    evaluatorComments: "Survey design needs significant revision. Please review the guidelines and resubmit.",
  },
];

// Mock weekly reports
const mockWeeklyReports: WeeklyReport[] = [
  {
    id: "wr1",
    studentName: "Sarah Johnson",
    weekNumber: 4,
    weekStart: "2024-02-05",
    weekEnd: "2024-02-11",
    tasksCompleted: 5,
    tasksPending: 2,
    hoursLogged: 38,
    overallScore: 90,
    supervisorRemarks: "Excellent progress this week. Sarah has shown great initiative in learning new technologies.",
    status: "submitted",
  },
  {
    id: "wr2",
    studentName: "Ahmed Khan",
    weekNumber: 4,
    weekStart: "2024-02-05",
    weekEnd: "2024-02-11",
    tasksCompleted: 6,
    tasksPending: 1,
    hoursLogged: 42,
    overallScore: 95,
    supervisorRemarks: "Outstanding performance. Ahmed consistently exceeds expectations.",
    status: "approved",
  },
  {
    id: "wr3",
    studentName: "Mike Chen",
    weekNumber: 4,
    weekStart: "2024-02-05",
    weekEnd: "2024-02-11",
    tasksCompleted: 3,
    tasksPending: 4,
    hoursLogged: 32,
    overallScore: 72,
    supervisorRemarks: "Needs to improve time management. Some tasks are falling behind schedule.",
    status: "submitted",
  },
];

// Default evaluation criteria
const defaultCriteria: EvaluationCriteria[] = [
  { id: "c1", name: "Quality of Work", description: "Overall quality and thoroughness", weight: 25, score: 0 },
  { id: "c2", name: "Timeliness", description: "Submission on or before deadline", weight: 15, score: 0 },
  { id: "c3", name: "Technical Accuracy", description: "Correctness of technical content", weight: 25, score: 0 },
  { id: "c4", name: "Documentation", description: "Clarity and completeness of documentation", weight: 15, score: 0 },
  { id: "c5", name: "Communication", description: "Clarity of written communication", weight: 10, score: 0 },
  { id: "c6", name: "Initiative", description: "Self-direction and problem-solving", weight: 10, score: 0 },
];

// Star Rating Component (defined outside to avoid re-creation on each render)
function StarRating({ rating, onRate, readonly = false }: { 
  rating: number; 
  onRate?: (rating: number) => void; 
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onRate?.(star)}
          className={`p-0.5 rounded transition-colors ${
            readonly ? 'cursor-default' : 'hover:bg-yellow-100'
          }`}
        >
          <Star
            className={`h-6 w-6 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function FacultySupervisorEvaluationsPage() {
  // State
  const [pendingEvaluations] = useState<PendingEvaluation[]>(mockPendingEvaluations);
  const [evaluationHistory] = useState<EvaluationRecord[]>(mockEvaluationHistory);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>(mockWeeklyReports);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // Dialog states
  const [isEvaluateDialogOpen, setIsEvaluateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<PendingEvaluation | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<EvaluationRecord | null>(null);
  
  // Form state
  const [evaluationForm, setEvaluationForm] = useState({
    rating: 5,
    criteria: defaultCriteria,
    comments: "",
    feedback: "",
    decision: "approve" as "approve" | "reject" | "request_revision",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter evaluations
  const filteredHistory = useMemo(() => {
    return evaluationHistory.filter((item) => {
      const matchesSearch =
        item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesType = typeFilter === "all" || item.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [evaluationHistory, searchTerm, statusFilter, typeFilter]);

  // Stats
  const stats = {
    pending: pendingEvaluations.length,
    highPriority: pendingEvaluations.filter(e => e.priority === "high").length,
    completedToday: 3,
    totalEvaluated: evaluationHistory.length,
    avgScore: Math.round(evaluationHistory.reduce((acc, e) => acc + (e.score / e.maxScore) * 100, 0) / evaluationHistory.length),
  };

  const getSubmissionTypeBadge = (type: SubmissionType) => {
    switch (type) {
      case "weekly_log":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Weekly Log</Badge>;
      case "task_submission":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Task</Badge>;
      case "document":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Document</Badge>;
      case "midterm":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Midterm</Badge>;
      case "final":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Final</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: EvaluationStatus) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <ThumbsUp className="mr-1 h-3 w-3" /> Approved
        </Badge>;
      case "rejected":
        return <Badge variant="destructive">
          <ThumbsDown className="mr-1 h-3 w-3" /> Rejected
        </Badge>;
      case "revision_required":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Revision Required</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High Priority</Badge>;
      case "medium":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStudentInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const openEvaluateDialog = (evaluation: PendingEvaluation) => {
    setSelectedEvaluation(evaluation);
    setEvaluationForm({
      rating: 5,
      criteria: defaultCriteria.map(c => ({ ...c, score: 0 })),
      comments: "",
      feedback: "",
      decision: "approve",
    });
    setIsEvaluateDialogOpen(true);
  };

  const openViewDialog = (record: EvaluationRecord) => {
    setSelectedHistoryItem(record);
    setIsViewDialogOpen(true);
  };

  const handleCriterionChange = (criterionId: string, score: number) => {
    setEvaluationForm(prev => ({
      ...prev,
      criteria: prev.criteria.map(c =>
        c.id === criterionId ? { ...c, score } : c
      ),
    }));
  };

  const calculateTotalScore = () => {
    const totalWeighted = evaluationForm.criteria.reduce(
      (acc, c) => acc + (c.score * c.weight),
      0
    );
    const totalWeight = evaluationForm.criteria.reduce(
      (acc, c) => acc + c.weight,
      0
    );
    return totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0;
  };

  const handleSubmitEvaluation = async () => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsEvaluateDialogOpen(false);
    setSelectedEvaluation(null);
  };

  const handleApproveReport = async (reportId: string) => {
    setWeeklyReports(prev =>
      prev.map(r => r.id === reportId ? { ...r, status: "approved" as const } : r)
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Evaluation Center</h1>
          <p className="text-muted-foreground mt-1">
            Review submissions, grade students, and generate reports
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Clock className="h-5 w-5 text-amber-600 mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <AlertCircle className="h-5 w-5 text-red-600 mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.highPriority}</p>
            <p className="text-xs text-muted-foreground">High Priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.completedToday}</p>
            <p className="text-xs text-muted-foreground">Done Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <ClipboardCheck className="h-5 w-5 text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{stats.totalEvaluated}</p>
            <p className="text-xs text-muted-foreground">Total Evaluated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <BarChart3 className="h-5 w-5 text-purple-600 mb-1" />
            <p className="text-2xl font-bold text-purple-600">{stats.avgScore}%</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="queue" className="gap-2">
            <Clock className="h-4 w-4" /> Evaluation Queue
            {stats.pending > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <ClipboardCheck className="h-4 w-4" /> History
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileText className="h-4 w-4" /> Weekly Reports
          </TabsTrigger>
        </TabsList>

        {/* Evaluation Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          {/* High Priority Alert */}
          {stats.highPriority > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  <span className="font-medium text-red-800">
                    You have {stats.highPriority} high-priority evaluation(s) requiring immediate attention.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Queue List */}
          <div className="space-y-4">
            {pendingEvaluations.map((evaluation, index) => (
              <motion.div
                key={evaluation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`hover:shadow-md transition-shadow ${evaluation.priority === 'high' ? 'border-red-200' : ''}`}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col lg:flex-row gap-4">
                      {/* Student Info */}
                      <div className="flex items-start gap-3 lg:w-[280px] shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={evaluation.studentAvatar} alt={evaluation.studentName} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getStudentInitials(evaluation.studentName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{evaluation.studentName}</p>
                          <p className="text-sm text-muted-foreground truncate">{evaluation.studentEmail}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {getSubmissionTypeBadge(evaluation.submissionType)}
                            {getPriorityBadge(evaluation.priority)}
                          </div>
                        </div>
                      </div>

                      {/* Submission Details */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="font-semibold">{evaluation.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {evaluation.description}
                        </p>
                        
                        {evaluation.contentPreview && (
                          <div className="p-3 bg-muted/30 rounded-lg text-sm italic line-clamp-2">
                            &ldquo;{evaluation.contentPreview}&rdquo;
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Submitted: {formatRelativeTime(evaluation.submittedAt)}
                          </span>
                          <span>Due: {new Date(evaluation.dueDate).toLocaleDateString()}</span>
                          {evaluation.attachments && evaluation.attachments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" /> {evaluation.attachments.length} file(s)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex lg:flex-col gap-2 lg:w-[140px] shrink-0 justify-end">
                        <Button 
                          onClick={() => openEvaluateDialog(evaluation)}
                          className="gap-2"
                        >
                          <Star className="h-4 w-4" /> Evaluate
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <Eye className="h-4 w-4" /> View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {pendingEvaluations.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">
                    No pending evaluations at the moment.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by student or title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="revision_required">Revision Required</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="weekly_log">Weekly Log</SelectItem>
                      <SelectItem value="task_submission">Task</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <span className="font-medium">{record.studentName}</span>
                    </TableCell>
                    <TableCell>{getSubmissionTypeBadge(record.type)}</TableCell>
                    <TableCell>
                      <span className="max-w-[200px] block truncate">{record.title}</span>
                    </TableCell>
                    <TableCell>{formatDate(record.submittedAt)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(record.score / record.maxScore) * 100} 
                          className="h-2 w-16"
                        />
                        <span className="text-sm font-medium min-w-[48px]">
                          {record.score}/{record.maxScore}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openViewDialog(record)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredHistory.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No evaluation records found matching your filters.
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Weekly Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4">
            {weeklyReports.map((report) => (
              <Card key={report.id}>
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Report Header */}
                    <div className="lg:w-[280px] shrink-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{report.studentName}</h3>
                        {report.status === "approved" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                            <Clock className="mr-1 h-3 w-3" /> Submitted
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Week {report.weekNumber}: {report.weekStart} — {report.weekEnd}
                      </p>
                    </div>

                    {/* Report Metrics */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xl font-bold text-emerald-600">{report.tasksCompleted}</p>
                        <p className="text-xs text-muted-foreground">Tasks Done</p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xl font-bold text-amber-600">{report.tasksPending}</p>
                        <p className="text-xs text-muted-foreground">Tasks Pending</p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xl font-bold text-blue-600">{report.hoursLogged}h</p>
                        <p className="text-xs text-muted-foreground">Hours Logged</p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xl font-bold text-purple-600">{report.overallScore}%</p>
                        <p className="text-xs text-muted-foreground">Overall Score</p>
                      </div>
                    </div>

                    {/* Actions & Remarks */}
                    <div className="lg:w-[220px] shrink-0 flex flex-col gap-2">
                      {report.supervisorRemarks && (
                        <p className="text-sm text-muted-foreground italic line-clamp-2">
                          &ldquo;{report.supervisorRemarks}&rdquo;
                        </p>
                      )}
                      <div className="flex gap-2 mt-auto">
                        <Button variant="outline" size="sm" className="gap-1 flex-1">
                          <Eye className="h-3 w-3" /> View
                        </Button>
                        {report.status !== "approved" && (
                          <Button 
                            size="sm" 
                            className="gap-1 flex-1"
                            onClick={() => handleApproveReport(report.id)}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Evaluate Dialog */}
      <Dialog open={isEvaluateDialogOpen} onOpenChange={setIsEvaluateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedEvaluation && (
            <>
              <DialogHeader>
                <DialogTitle>Evaluate Submission</DialogTitle>
                <DialogDescription>
                  Review and evaluate {selectedEvaluation.studentName}&apos;s submission
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Submission Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedEvaluation.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {selectedEvaluation.description}
                        </CardDescription>
                      </div>
                      {getSubmissionTypeBadge(selectedEvaluation.submissionType)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedEvaluation.contentPreview && (
                      <div className="mb-4 p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm italic">&ldquo;{selectedEvaluation.contentPreview}&rdquo;</p>
                      </div>
                    )}
                    
                    {selectedEvaluation.attachments && selectedEvaluation.attachments.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Attachments:</Label>
                        {selectedEvaluation.attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded border">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <Button variant="ghost" size="sm">Download</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Overall Rating */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Overall Rating</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <StarRating 
                        rating={evaluationForm.rating}
                        onRate={(rating) => setEvaluationForm(prev => ({ ...prev, rating }))}
                      />
                      <span className="text-lg font-semibold">{evaluationForm.rating}/5</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Criteria */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Evaluation Criteria</CardTitle>
                    <CardDescription>Score each criterion (0-10 scale)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {evaluationForm.criteria.map((criterion) => (
                        <div key={criterion.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="font-medium">{criterion.name}</Label>
                              <p className="text-xs text-muted-foreground">{criterion.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">({criterion.weight}% weight)</span>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                value={criterion.score || ""}
                                onChange={(e) => handleCriterionChange(criterion.id, parseInt(e.target.value) || 0)}
                                className="w-16 text-center"
                              />
                              <span className="text-sm text-muted-foreground">/10</span>
                            </div>
                          </div>
                          <Progress value={(criterion.score / 10) * 100} className="h-2" />
                        </div>
                      ))}
                      
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Total Weighted Score:</span>
                          <span className="text-xl font-bold text-primary">{calculateTotalScore()}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Comments & Feedback */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Evaluator Comments</CardTitle>
                      <CardDescription>Internal notes (not visible to student)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="Add your internal comments..."
                        value={evaluationForm.comments}
                        onChange={(e) => setEvaluationForm(prev => ({ ...prev, comments: e.target.value }))}
                        rows={4}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Feedback for Student</CardTitle>
                      <CardDescription>This will be visible to the student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="Provide constructive feedback..."
                        value={evaluationForm.feedback}
                        onChange={(e) => setEvaluationForm(prev => ({ ...prev, feedback: e.target.value }))}
                        rows={4}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Decision */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Decision</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4">
                      {(["approve", "reject", "request_revision"] as const).map((option) => (
                        <label
                          key={option}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                            evaluationForm.decision === option
                              ? option === "approve"
                                ? "border-emerald-300 bg-emerald-50"
                                : option === "reject"
                                ? "border-red-300 bg-red-50"
                                : "border-orange-300 bg-orange-50"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="decision"
                            value={option}
                            checked={evaluationForm.decision === option}
                            onChange={() => setEvaluationForm(prev => ({ ...prev, decision: option }))}
                            className="sr-only"
                          />
                          {option === "approve" && <ThumbsUp className="h-5 w-5 text-emerald-600" />}
                          {option === "reject" && <ThumbsDown className="h-5 w-5 text-red-600" />}
                          {option === "request_revision" && <AlertCircle className="h-5 w-5 text-orange-600" />}
                          <span className="font-medium capitalize">
                            {option.replace("_", " ")}
                          </span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsEvaluateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitEvaluation}
                  disabled={isSubmitting}
                  className={
                    evaluationForm.decision === "approve" 
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : evaluationForm.decision === "reject"
                      ? "bg-red-600 hover:bg-red-700"
                      : ""
                  }
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {evaluationForm.decision === "approve" && "Approve Submission"}
                  {evaluationForm.decision === "reject" && "Reject Submission"}
                  {evaluationForm.decision === "request_revision" && "Request Revision"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* View History Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedHistoryItem && (
            <>
              <DialogHeader>
                <DialogTitle>Evaluation Details</DialogTitle>
                <DialogDescription>
                  Completed on {formatDate(selectedHistoryItem.evaluatedAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Student</Label>
                    <p className="font-medium">{selectedHistoryItem.studentName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <div>{getSubmissionTypeBadge(selectedHistoryItem.type)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Submission Title</Label>
                    <p className="font-medium">{selectedHistoryItem.title}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div>{getStatusBadge(selectedHistoryItem.status)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Score</Label>
                  <div className="flex items-center gap-4 mt-1">
                    <Progress 
                      value={(selectedHistoryItem.score / selectedHistoryItem.maxScore) * 100} 
                      className="h-3 flex-1"
                    />
                    <span className="text-xl font-bold">
                      {selectedHistoryItem.score}/{selectedHistoryItem.maxScore}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        ({Math.round((selectedHistoryItem.score / selectedHistoryItem.maxScore) * 100)}%)
                      </span>
                    </span>
                  </div>
                </div>

                {selectedHistoryItem.evaluatorComments && (
                  <div>
                    <Label className="text-muted-foreground">Evaluator Comments</Label>
                    <p className="mt-1 p-3 bg-muted/30 rounded-lg text-sm">
                      {selectedHistoryItem.evaluatorComments}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
