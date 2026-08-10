"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EvaluationForm, type EvaluationFormData } from "@/components/supervisors/evaluation-form";
import { SignaturePad } from "@/components/supervisors/signature-pad";
import type { EvaluationCriteria } from "@/types";
import {
  User,
  Mail,
  Phone,
  Building2,
  Award,
  ClipboardCheck,
  Clock,
  Star,
  CheckCircle2,
  AlertCircle,
  Send,
  FileText,
  TrendingUp,
  Calendar,
  ExternalLink,
  Briefcase,
  GraduationCap,
  ChevronRight,
  Eye,
  Download,
  Search,
  Filter,
  BarChart3,
  Shield,
  MessageSquare,
  PenTool,
  ThumbsUp,
  Zap,
  Target,
} from "lucide-react";

// Mock data
const evaluatorProfile = {
  id: "eval1",
  name: "Dr. Alexandra Thompson",
  email: "a.thompson@industry-experts.com",
  phone: "+1 (555) 123-4567",
  organization: "Tech Industry Advisory Board",
  expertise: ["Software Engineering", "Data Science", "IT Management", "Cybersecurity"],
  bio: "Seasoned technology executive with 25+ years of experience in software development and IT leadership. Former CTO at Fortune 500 companies. Passionate about mentoring the next generation of tech professionals.",
  assignedUniversity: "State University of Technology",
  totalEvaluationsCompleted: 47,
  averageRatingGiven: 4.3,
};

const mockAssignedEvaluations = [
  {
    id: "ae1",
    studentName: "Sarah Johnson",
    university: "State University of Technology",
    internshipTitle: "Software Engineering Intern",
    company: "TechCorp Inc.",
    dueDate: "2024-01-22",
    status: "pending" as const,
    program: "B.Sc. Computer Science",
  },
  {
    id: "ae2",
    studentName: "Michael Chen",
    university: "State University of Technology",
    internshipTitle: "IT Support Specialist",
    company: "Global Systems LLC",
    dueDate: "2024-01-25",
    status: "in_progress" as const,
    program: "B.Sc. Information Technology",
  },
  {
    id: "ae3",
    studentName: "Emily Rodriguez",
    university: "State University of Technology",
    internshipTitle: "Data Analyst Intern",
    company: "DataDriven Co.",
    dueDate: "2024-01-28",
    status: "pending" as const,
    program: "M.Sc. Data Science",
  },
  {
    id: "ae4",
    studentName: "James Wilson",
    university: "State University of Technology",
    internshipTitle: "Frontend Developer Intern",
    company: "WebStudio Pro",
    dueDate: "2024-01-18",
    status: "overdue" as const,
    program: "B.Sc. Computer Science",
  },
];

const mockEvaluationHistory = [
  {
    id: "eh1",
    studentName: "David Kim",
    university: "State University of Technology",
    internshipTitle: "Frontend Developer Intern",
    company: "WebStudio Pro",
    completedAt: "2024-01-10T14:30:00Z",
    score: 44,
    maxScore: 50,
    industryReadinessScore: 8.5,
    recommendation: "Strongly Recommend",
    comments: "Excellent technical skills and professional demeanor. Ready for industry work.",
  },
  {
    id: "eh2",
    studentName: "Lisa Wang",
    university: "State University of Technology",
    internshipTitle: "Backend Developer Intern",
    company: "CloudTech Solutions",
    completedAt: "2024-01-05T09:15:00Z",
    score: 41,
    maxScore: 50,
    industryReadinessScore: 7.8,
    recommendation: "Recommend",
    comments: "Good foundation in backend technologies. Would benefit from more exposure to cloud platforms.",
  },
  {
    id: "eh3",
    studentName: "Robert Martinez",
    university: "State University of Technology",
    internshipTitle: "DevOps Engineer Intern",
    company: "InfraCorp Inc.",
    completedAt: "2023-12-20T16:45:00Z",
    score: 46,
    maxScore: 50,
    industryReadinessScore: 9.0,
    recommendation: "Strongly Recommend",
    comments: "Outstanding performance across all criteria. Exceptional problem-solving abilities.",
  },
];

// Comments template library
const commentTemplates = [
  {
    id: "t1",
    name: "Excellent Performance",
    template: "Demonstrated exceptional skills throughout the internship. Technical proficiency is outstanding and work quality consistently exceeded expectations. Highly recommended for future opportunities."
  },
  {
    id: "t2",
    name: "Good Foundation",
    template: "Shows solid foundational knowledge and a willingness to learn. Would benefit from additional exposure to [specific area]. Good potential for growth."
  },
  {
    id: "t3",
    name: "Needs Improvement",
    template: "While showing effort in some areas, improvement is needed in [specific areas]. Recommend focusing on [suggestions] to enhance industry readiness."
  },
  {
    id: "t4",
    name: "Professional Demeanor",
    template: "Maintained professional conduct throughout the internship. Communication skills are strong and collaboration with team members was effective."
  },
];

// Evaluation statistics
const evaluationStats = {
  totalCompleted: 47,
  avgScore: 42.5,
  avgIndustryReadiness: 8.2,
  stronglyRecommended: 35,
  recommended: 10,
  recommendWithReservations: 2,
  notRecommended: 0,
};

const externalEvaluatorCriteria: EvaluationCriteria[] = [
  { id: "ec1", name: "Industry Knowledge", description: "Understanding of current industry practices and trends", max_score: 10, weight: 0.15 },
  { id: "ec2", name: "Technical Proficiency", description: "Demonstrated technical skills relevant to the field", max_score: 10, weight: 0.20 },
  { id: "ec3", name: "Professional Communication", description: "Ability to communicate effectively in a business context", max_score: 10, weight: 0.15 },
  { id: "ec4", name: "Problem-Solving & Critical Thinking", description: "Analytical and creative approach to challenges", max_score: 10, weight: 0.15 },
  { id: "ec5", name: "Work Ethic & Initiative", description: "Self-motivation, reliability, and proactive behavior", max_score: 10, weight: 0.15 },
  { id: "ec6", name: "Teamwork & Collaboration", description: "Ability to work effectively with others", max_score: 10, weight: 0.10 },
  { id: "ec7", name: "Industry Readiness", description: "Overall preparedness for entering the workforce", max_score: 10, weight: 0.10 },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "badge-warning" },
    in_progress: { label: "In Progress", className: "badge-primary" },
    completed: { label: "Completed", className: "badge-success" },
    overdue: { label: "Overdue!", className: "badge-danger" },
  };

  const item = config[status] || { label: status, className: "badge-secondary" };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const config: Record<string, { label: string; className: string }> = {
    "Strongly Recommend": { label: "Strongly Recommend", className: "badge-success" },
    "Recommend": { label: "Recommend", className: "badge-info" },
    "Recommend with Reservations": { label: "Recommend w/ Reservations", className: "badge-warning" },
    "Do Not Recommend": { label: "Do Not Recommend", className: "badge-danger" },
  };

  const item = config[recommendation] || { label: recommendation, className: "badge-secondary" };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}

export default function ExternalEvaluatorDashboard() {
  const [selectedEvaluation, setSelectedEvaluation] = useState<string | null>(null);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [selectedEvalStudent, setSelectedEvalStudent] = useState("");
  const [viewingHistory, setViewingHistory] = useState<typeof mockEvaluationHistory[0] | null>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  // Stats
  const pendingCount = mockAssignedEvaluations.filter(e => e.status === "pending").length;
  const inProgressCount = mockAssignedEvaluations.filter(e => e.status === "in_progress").length;
  const overdueCount = mockAssignedEvaluations.filter(e => e.status === "overdue").length;

  const handleEvaluationSubmit = useCallback(async (data: EvaluationFormData) => {
    console.log("Submitting external evaluation:", data);
    setShowEvaluationForm(false);
    setSelectedEvaluation(null);
  }, []);

  return (
    <div className="space-y-6 page-container">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dashboard-card bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border-chart-2/20"
      >
        <h1 className="text-h2 font-bold text-foreground">External Evaluator Dashboard</h1>
        <p className="text-body text-muted-foreground mt-1 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Industry expert evaluation portal
        </p>
      </motion.div>

      {/* Profile Section - Professional Evaluator Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="dashboard-card overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row">
          {/* Profile Info */}
          <div className="flex-1 p-6 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-2xl font-bold">
                  AT
                </AvatarFallback>
              </Avatar>

              <div className="space-y-3 flex-1">
                <div>
                  <h2 className="text-h3 font-bold">{evaluatorProfile.name}</h2>
                  <p className="text-h4 text-muted-foreground font-normal">{evaluatorProfile.organization}</p>
                </div>

                <p className="text-body max-w-2xl">{evaluatorProfile.bio}</p>

                <div className="flex flex-wrap gap-2 pt-2">
                  {evaluatorProfile.expertise.map((skill) => (
                    <span key={skill} className="badge badge-secondary">{skill}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Quick Stats */}
          <div className="lg:w-80 p-6 bg-muted/30 space-y-4 border-l border-border">
            <h3 className="text-label uppercase tracking-wider text-muted-foreground px-1">Contact Information</h3>
            
            <div className="space-y-3 px-1">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{evaluatorProfile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{evaluatorProfile.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{evaluatorProfile.assignedUniversity}</span>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 px-1">
              <div className="stat-card !p-3">
                <Award className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="dashboard-card-value text-xl">{evaluatorProfile.totalEvaluationsCompleted}</p>
                <p className="dashboard-card-description !mt-1">Evaluations</p>
              </div>
              <div className="stat-card !p-3">
                <Star className="h-5 w-5 mx-auto text-warning mb-1" />
                <p className="dashboard-card-value text-xl">{evaluatorProfile.averageRatingGiven}</p>
                <p className="dashboard-card-description !mt-1">Avg Rating</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          { title: "Pending Evaluations", value: pendingCount, icon: Clock, color: "bg-warning/10 text-warning" },
          { title: "In Progress", value: inProgressCount, icon: ClipboardCheck, color: "bg-primary/10 text-primary" },
          { title: "Overdue", value: overdueCount, icon: AlertCircle, color: "bg-danger/10 text-danger" },
        ].map((stat) => (
          <motion.div key={stat.title} variants={itemVariants} className={`stat-card ${stat.title === "Overdue" && stat.value > 0 ? "border-danger/50" : ""}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`stat-card-icon ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <p className="dashboard-card-value text-2xl">{stat.value}</p>
            <p className="dashboard-card-title">{stat.title}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="assigned" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="assigned" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 hidden sm:inline" />
            Assigned Evaluations
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="h-4 w-4 hidden sm:inline" />
            History & Stats
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 hidden sm:inline" />
            Comment Templates
          </TabsTrigger>
        </TabsList>

        {/* Assigned Evaluations Tab */}
        <TabsContent value="assigned" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Assigned Evaluations</h2>
              <p className="text-small text-muted-foreground mt-1">Evaluations assigned to you for completion</p>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search evaluations..." className="pl-10 form-input" />
            </div>
          </div>

          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Internship</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAssignedEvaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-medium">
                            {evaluation.studentName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{evaluation.studentName}</p>
                          <p className="text-caption text-muted-foreground">{evaluation.program}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{evaluation.internshipTitle}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{evaluation.company}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${
                        evaluation.status === "overdue" ? "text-danger font-medium" : ""
                      }`}>
                        {new Date(evaluation.dueDate).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={evaluation.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedEvaluation(evaluation.id);
                          setSelectedEvalStudent(evaluation.studentName);
                          setShowEvaluationForm(true);
                        }}
                        className="focus-ring"
                      >
                        {evaluation.status === "in_progress" ? "Continue" : "Start"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Evaluation Form Modal */}
          {showEvaluationForm && (
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">External Evaluation</h3>
                  <p className="text-small text-muted-foreground">Evaluating: {selectedEvalStudent}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEvaluationForm(false);
                    setSelectedEvaluation(null);
                  }}
                  className="focus-ring"
                >
                  Cancel
                </Button>
              </div>
              
              <EvaluationForm
                criteria={externalEvaluatorCriteria}
                onSubmit={handleEvaluationSubmit}
                showStudentSelector={false}
                showSignature={true}
                ratingType="scale"
                title="External Evaluator Assessment"
                subtitle="Evaluate this student's readiness for the industry based on your expertise"
                submitLabel="Submit Evaluation"
                onCancel={() => {
                  setShowEvaluationForm(false);
                  setSelectedEvaluation(null);
                }}
              />

              {/* Additional Industry Expert Fields */}
              <div className="dashboard-card mt-6">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title flex items-center gap-2">
                    <Zap className="h-5 w-5 text-chart-2" />
                    Industry Expert Assessment
                  </h3>
                </div>
                
                <div className="space-y-4 p-6">
                  {/* Industry Readiness Score */}
                  <div className="form-group">
                    <Label className="form-label">Industry Readiness Score (1-10)</Label>
                    <Select defaultValue="">
                      <SelectTrigger className="form-input">
                        <SelectValue placeholder="Select score" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(10)].map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {i + 1}/10
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recommendation */}
                  <div className="form-group">
                    <Label className="form-label">Overall Recommendation</Label>
                    <Select defaultValue="">
                      <SelectTrigger className="form-input">
                        <SelectValue placeholder="Select recommendation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strongly_recommend">Strongly Recommend</SelectItem>
                        <SelectItem value="recommend">Recommend</SelectItem>
                        <SelectItem value="recommend_reservations">Recommend with Reservations</SelectItem>
                        <SelectItem value="not_recommend">Do Not Recommend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Detailed Comments */}
                  <div className="form-group">
                    <Label className="form-label">Detailed Comments for University</Label>
                    <Textarea
                      placeholder="Provide detailed feedback that will be shared with the university..."
                      rows={5}
                      className="form-input"
                    />
                  </div>

                  {/* Template Library Button */}
                  <Button
                    variant="outline"
                    onClick={() => setShowTemplateLibrary(true)}
                    className="focus-ring"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Use Comment Template
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* History Tab with Statistics */}
        <TabsContent value="history" className="mt-6 space-y-6">
          {/* Statistics Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Total Completed
                </h3>
              </div>
              <div className="pt-2">
                <p className="dashboard-card-value text-3xl">{evaluationStats.totalCompleted}</p>
                <p className="dashboard-card-description">All time</p>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Star className="h-5 w-5 text-warning" />
                  Avg Score
                </h3>
              </div>
              <div className="pt-2">
                <p className="dashboard-card-value text-3xl">{evaluationStats.avgScore}<span className="text-lg text-muted-foreground">/50</span></p>
                <p className="dashboard-card-description">out of {evaluationStats.maxScore || 50}</p>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Target className="h-5 w-5 text-success" />
                  Industry Ready
                </h3>
              </div>
              <div className="pt-2">
                <p className="dashboard-card-value text-3xl">{evaluationStats.avgIndustryReadiness}<span className="text-lg text-muted-foreground">/10</span></p>
                <p className="dashboard-card-description">Avg readiness</p>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-chart-2" />
                  Top Rating
                </h3>
              </div>
              <div className="pt-2 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Strongly Rec.</span>
                  <span className="font-semibold text-success">{evaluationStats.stronglyRecommended}</span>
                </div>
                <Progress 
                  value={(evaluationStats.stronglyRecommended / evaluationStats.totalCompleted) * 100} 
                  className="h-2 mt-1" 
                />
              </div>
            </div>
          </div>

          {/* Evaluation History List */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">Evaluation History</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="focus-ring">
                  <Download className="mr-2 h-4 w-4" />
                  Export All
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {mockEvaluationHistory.map((history) => (
                <div
                  key={history.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setViewingHistory(history)}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      {/* Student & Internship Info */}
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-chart-2 text-white font-semibold">
                            {history.studentName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">{history.studentName}</h4>
                          <p className="text-small text-muted-foreground">{history.university}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{history.internshipTitle}</span>
                            <span className="text-muted-foreground">@</span>
                            <span className="text-sm">{history.company}</span>
                          </div>
                        </div>
                      </div>

                      {/* Scores & Recommendation */}
                      <div className="flex flex-wrap items-center gap-6 ml-16">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gradient-brand">{history.score}/{history.maxScore}</p>
                          <p className="text-caption text-muted-foreground">Total Score</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-success">{history.industryReadinessScore}/10</p>
                          <p className="text-caption text-muted-foreground">Industry Ready</p>
                        </div>
                        <RecommendationBadge recommendation={history.recommendation} />
                      </div>

                      {/* Comments Preview */}
                      <div className="ml-16 p-3 rounded-lg bg-muted/30 max-w-2xl">
                        <p className="text-sm text-muted-foreground italic line-clamp-2">
                          "{history.comments}"
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-caption text-muted-foreground">
                        {new Date(history.completedAt).toLocaleDateString()}
                      </span>
                      
                      <Button variant="outline" size="sm" className="focus-ring">
                        <Eye className="h-4 w-4 mr-1" />
                        View Full
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Comment Templates Tab */}
        <TabsContent value="templates" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-chart-2" />
                Comments Template Library
              </h2>
              <p className="text-small text-muted-foreground mt-1">Save time with pre-written comment templates</p>
            </div>
            <Button onClick={() => setShowNewTemplateDialog(true)} className="focus-ring">
              <PenTool className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commentTemplates.map((template) => (
              <div key={template.id} className="dashboard-card card-hover">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title">{template.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 focus-ring"
                    onClick={() => navigator.clipboard.writeText(template.template)}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 max-h-[150px] overflow-y-auto scrollbar-thin">
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {template.template}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 focus-ring"
                    onClick={() => {
                      navigator.clipboard.writeText(template.template);
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 focus-ring"
                    onClick={() => setShowTemplateLibrary(false)}
                  >
                    Use This
                  </Button>
                </div>
              </div>
            ))}

            {/* Create New Template Dialog */}
            {showTemplateLibrary && (
              <div className="dashboard-card md:col-span-2">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title">Create New Template</h3>
                </div>
                
                <div className="space-y-4 p-6">
                  <div className="form-group">
                    <Label htmlFor="template-name" className="form-label">Template Name</Label>
                    <Input id="template-name" placeholder="e.g., Excellent Performance" className="form-input" />
                  </div>

                  <div className="form-group">
                    <Label htmlFor="template-content" className="form-label">Template Content</Label>
                    <Textarea
                      id="template-content"
                      placeholder="Write your comment template here..."
                      rows={6}
                      className="form-input"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowTemplateLibrary(false)} className="focus-ring">
                      Cancel
                    </Button>
                    <Button onClick={() => setShowTemplateLibrary(false)} className="focus-ring">
                      Save Template
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Evaluation Details Dialog */}
      <Dialog open={!!viewingHistory} onOpenChange={(open) => !open && setViewingHistory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>
              {viewingHistory?.studentName} - {viewingHistory?.internshipTitle}
            </DialogDescription>
          </DialogHeader>

          {viewingHistory && (
            <div className="py-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Student</Label>
                  <p className="font-medium">{viewingHistory.studentName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Company</Label>
                  <p className="font-medium">{viewingHistory.company}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Total Score</Label>
                  <p className="font-medium text-lg">{viewingHistory.score}/{viewingHistory.maxScore}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Industry Readiness</Label>
                  <p className="font-medium text-lg text-success">{viewingHistory.industryReadinessScore}/10</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Recommendation</Label>
                <RecommendationBadge recommendation={viewingHistory.recommendation} />
              </div>

              <div className="space-y-2">
                <Label>Detailed Comments</Label>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm">{viewingHistory.comments}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingHistory(null)} className="focus-ring">
              Close
            </Button>
            <Button variant="outline" className="focus-ring">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M16 8L8 16L2 10"/>
    </svg>
  );
}

function Zap({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14.5 13 22 11 22 17 21 19 16 13 12 2 11 2 9.5 2S7 5 3Z"/>
    </svg>
  );
}
