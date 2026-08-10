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
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    pending: { label: "Pending", variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    in_progress: { label: "In Progress", variant: "secondary", className: "bg-blue-100 text-blue-800 border-blue-200" },
    completed: { label: "Completed", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
    overdue: { label: "Overdue!", variant: "destructive", className: "bg-red-100 text-red-800 border-red-200 animate-pulse" },
  };

  const { label, variant, className } = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={variant} className={className}>{label}</Badge>;
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    "Strongly Recommend": { label: "Strongly Recommend", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
    "Recommend": { label: "Recommend", variant: "default", className: "bg-blue-100 text-blue-800 border-blue-200" },
    "Recommend with Reservations": { label: "Recommend w/ Reservations", variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    "Do Not Recommend": { label: "Do Not Recommend", variant: "destructive" },
  };

  const { label, variant, className } = config[recommendation] || { label: recommendation, variant: "outline" as const };
  return <Badge variant={variant} className={className}>{label}</Badge>;
}

export default function ExternalEvaluatorDashboard() {
  const [selectedEvaluation, setSelectedEvaluation] = useState<string | null>(null);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [selectedEvalStudent, setSelectedEvalStudent] = useState("");
  const [viewingHistory, setViewingHistory] = useState<typeof mockEvaluationHistory[0] | null>(null);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">External Evaluator Dashboard</h1>
        <p className="text-muted-foreground mt-1">Industry expert evaluation portal</p>
      </div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              {/* Profile Info */}
              <div className="flex-1 p-6 bg-gradient-to-br from-primary/5 to-primary/10">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {evaluatorProfile.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-3 flex-1">
                    <div>
                      <h2 className="text-2xl font-bold">{evaluatorProfile.name}</h2>
                      <p className="text-lg text-muted-foreground">{evaluatorProfile.organization}</p>
                    </div>

                    <p className="text-sm max-w-2xl">{evaluatorProfile.bio}</p>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {evaluatorProfile.expertise.map((skill) => (
                        <Badge key={skill} variant="secondary" className="font-normal">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact & Quick Stats */}
              <div className="md:w-80 p-6 bg-muted/30 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Contact Information</h3>
                
                <div className="space-y-3">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <Award className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xl font-bold">{evaluatorProfile.totalEvaluationsCompleted}</p>
                    <p className="text-xs text-muted-foreground">Evaluations</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <Star className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                    <p className="text-xl font-bold">{evaluatorProfile.averageRatingGiven}</p>
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Overview Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          { title: "Pending Evaluations", value: pendingCount, icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" },
          { title: "In Progress", value: inProgressCount, icon: ClipboardCheck, color: "text-blue-600", bgColor: "bg-blue-100" },
          { title: "Overdue", value: overdueCount, icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100" },
        ].map((stat) => (
          <motion.div key={stat.title} variants={itemVariants}>
            <Card className={`hover:shadow-md transition-shadow ${stat.title === "Overdue" && stat.value > 0 ? "border-red-300" : ""}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="assigned" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="assigned" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 hidden sm:inline" />
            Assigned Evaluations
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="h-4 w-4 hidden sm:inline" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Assigned Evaluations Tab */}
        <TabsContent value="assigned" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Assigned Evaluations</CardTitle>
                  <CardDescription>Evaluations assigned to you for completion</CardDescription>
                </div>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search evaluations..." className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>University</TableHead>
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
                      <TableCell className="font-medium">{evaluation.studentName}</TableCell>
                      <TableCell>
                        <span className="text-sm">{evaluation.university}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{evaluation.program}</span>
                      </TableCell>
                      <TableCell>{evaluation.internshipTitle}</TableCell>
                      <TableCell>{evaluation.company}</TableCell>
                      <TableCell>
                        <span className={`${
                          evaluation.status === "overdue" ? "text-red-600 font-medium" : ""
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
                        >
                          {evaluation.status === "in_progress" ? "Continue" : "Start"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Evaluation Form Modal */}
          {showEvaluationForm && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    External Evaluation - {selectedEvalStudent}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowEvaluationForm(false);
                      setSelectedEvaluation(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
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
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-base">Industry Expert Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Industry Readiness Score */}
                    <div className="space-y-2">
                      <Label htmlFor="readiness-score">Industry Readiness Score (1-10)</Label>
                      <Select defaultValue="">
                        <SelectTrigger id="readiness-score">
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
                    <div className="space-y-2">
                      <Label htmlFor="recommendation">Overall Recommendation</Label>
                      <Select defaultValue="">
                        <SelectTrigger id="recommendation">
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
                    <div className="space-y-2">
                      <Label htmlFor="detailed-comments">Detailed Comments for University</Label>
                      <Textarea
                        id="detailed-comments"
                        placeholder="Provide detailed feedback that will be shared with the university..."
                        rows={5}
                      />
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Evaluation History</CardTitle>
                  <CardDescription>Your past completed evaluations</CardDescription>
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockEvaluationHistory.map((history) => (
                  <div
                    key={history.id}
                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        {/* Student & Internship Info */}
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {history.studentName.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-lg">{history.studentName}</h3>
                            <p className="text-sm text-muted-foreground">{history.university}</p>
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
                            <p className="text-2xl font-bold text-primary">
                              {history.score}/{history.maxScore}
                            </p>
                            <p className="text-xs text-muted-foreground">Total Score</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                              {history.industryReadinessScore}/10
                            </p>
                            <p className="text-xs text-muted-foreground">Industry Readiness</p>
                          </div>
                          <RecommendationBadge recommendation={history.recommendation} />
                        </div>

                        {/* Comments Preview */}
                        <div className="ml-16 p-3 bg-muted/50 rounded-lg max-w-2xl">
                          <p className="text-sm text-muted-foreground italic line-clamp-2">
                            &ldquo;{history.comments}&rdquo;
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          Completed {new Date(history.completedAt).toLocaleDateString()}
                        </span>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingHistory(history)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Full
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Evaluation Details</DialogTitle>
                              <DialogDescription>
                                {history.studentName} - {history.internshipTitle}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="py-4 space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-muted-foreground">Student</Label>
                                  <p className="font-medium">{history.studentName}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Company</Label>
                                  <p className="font-medium">{history.company}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Total Score</Label>
                                  <p className="font-medium text-lg">{history.score}/{history.maxScore}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Industry Readiness</Label>
                                  <p className="font-medium text-lg text-green-600">{history.industryReadinessScore}/10</p>
                                </div>
                              </div>

                              <Separator />

                              <div className="space-y-2">
                                <Label>Recommendation</Label>
                                <RecommendationBadge recommendation={history.recommendation} />
                              </div>

                              <div className="space-y-2">
                                <Label>Detailed Comments</Label>
                                <div className="p-4 bg-muted/50 rounded-lg">
                                  <p className="text-sm">{history.comments}</p>
                                </div>
                              </div>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => setViewingHistory(null)}>
                                Close
                              </Button>
                              <Button variant="outline" className="flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                Download PDF
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
