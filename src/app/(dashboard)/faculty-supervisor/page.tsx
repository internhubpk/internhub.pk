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
import type { EvaluationCriteria } from "@/types";
import {
  Users,
  FileCheck,
  ClipboardCheck,
  Star,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Calendar,
  TrendingUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";

// Mock data for demonstration
const mockStats = {
  assignedStudents: 12,
  pendingReviews: 5,
  completedEvaluations: 28,
  averageRating: 4.2,
};

const mockStudents = [
  {
    id: "1",
    name: "Sarah Johnson",
    avatar: null,
    program: "Computer Science",
    internshipTitle: "Software Engineering Intern",
    company: "TechCorp Inc.",
    progress: 75,
    status: "active" as const,
    lastActivity: "2 hours ago",
    weeklyLogStatus: "submitted",
  },
  {
    id: "2",
    name: "Michael Chen",
    avatar: null,
    program: "Information Technology",
    internshipTitle: "IT Support Specialist",
    company: "Global Systems LLC",
    progress: 60,
    status: "active" as const,
    lastActivity: "5 hours ago",
    weeklyLogStatus: "pending",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    avatar: null,
    program: "Data Science",
    internshipTitle: "Data Analyst Intern",
    company: "DataDriven Co.",
    progress: 90,
    status: "active" as const,
    lastActivity: "1 day ago",
    weeklyLogStatus: "approved",
  },
  {
    id: "4",
    name: "James Wilson",
    avatar: null,
    program: "Computer Science",
    internshipTitle: "Frontend Developer Intern",
    company: "WebStudio Pro",
    progress: 45,
    status: "active" as const,
    lastActivity: "3 days ago",
    weeklyLogStatus: "overdue",
  },
  {
    id: "5",
    name: "Aisha Patel",
    avatar: null,
    program: "Cybersecurity",
    internshipTitle: "Security Analyst Intern",
    company: "SecureNet Solutions",
    progress: 30,
    status: "active" as const,
    lastActivity: "1 week ago",
    weeklyLogStatus: "draft",
  },
];

const mockReports = [
  {
    id: "r1",
    studentName: "Sarah Johnson",
    title: "Weekly Report - Week 8",
    type: "weekly" as const,
    submittedAt: "2024-01-15T10:30:00Z",
    status: "pending_review" as const,
    preview: "This week I focused on implementing the new authentication system...",
  },
  {
    id: "r2",
    studentName: "Michael Chen",
    title: "Monthly Progress Report - January",
    type: "monthly" as const,
    submittedAt: "2024-01-14T14:20:00Z",
    status: "pending_review" as const,
    preview: "During January, I completed the network infrastructure audit...",
  },
  {
    id: "r3",
    studentName: "Emily Rodriguez",
    title: "Final Internship Report",
    type: "final" as const,
    submittedAt: "2024-01-13T09:00:00Z",
    status: "under_review" as const,
    preview: "This report summarizes my experience and learnings during my internship...",
  },
  {
    id: "r4",
    studentName: "James Wilson",
    title: "Weekly Report - Week 6",
    type: "weekly" as const,
    submittedAt: "2024-01-12T16:45:00Z",
    status: "pending_review" as const,
    preview: "I continued working on the React component library this week...",
  },
  {
    id: "r5",
    studentName: "Aisha Patel",
    title: "Weekly Report - Week 4",
    type: "weekly" as const,
    submittedAt: "2024-01-11T11:15:00Z",
    status: "pending_review" as const,
    preview: "This week's focus was on vulnerability assessment training...",
  },
];

const mockEvaluations = [
  {
    id: "e1",
    studentName: "Sarah Johnson",
    period: "Mid-term Evaluation",
    dueDate: "2024-01-20",
    status: "completed" as const,
    score: 42,
    maxScore: 50,
  },
  {
    id: "e2",
    studentName: "Michael Chen",
    period: "Mid-term Evaluation",
    dueDate: "2024-01-22",
    status: "in_progress" as const,
    score: null,
    maxScore: 50,
  },
  {
    id: "e3",
    studentName: "Emily Rodriguez",
    period: "Final Evaluation",
    dueDate: "2024-01-25",
    status: "pending" as const,
    score: null,
    maxScore: 50,
  },
];

const mockActivityFeed = [
  {
    id: "a1",
    type: "submission" as const,
    message: 'Sarah Johnson submitted "Weekly Report - Week 8"',
    timestamp: "2 hours ago",
    icon: FileCheck,
  },
  {
    id: "a2",
    type: "review" as const,
    message: 'You approved Michael Chen\'s Weekly Log for Week 7',
    timestamp: "5 hours ago",
    icon: CheckCircle2,
  },
  {
    id: "a3",
    type: "alert" as const,
    message: "James Wilson has an overdue weekly log submission",
    timestamp: "1 day ago",
    icon: AlertCircle,
  },
  {
    id: "a4",
    type: "evaluation" as const,
    message: "You completed mid-term evaluation for Emily Rodriguez",
    timestamp: "2 days ago",
    icon: Star,
  },
  {
    id: "a5",
    type: "feedback" as const,
    message: "You sent feedback to Aisha Patel regarding her progress",
    timestamp: "3 days ago",
    icon: MessageSquare,
  },
];

const evaluationCriteria: EvaluationCriteria[] = [
  { id: "c1", name: "Technical Knowledge", description: "Demonstrates understanding of core concepts", max_score: 10, weight: 0.2 },
  { id: "c2", name: "Problem Solving", description: "Ability to analyze and solve complex problems", max_score: 10, weight: 0.2 },
  { id: "c3", name: "Communication Skills", description: "Written and verbal communication effectiveness", max_score: 10, weight: 0.15 },
  { id: "c4", name: "Professionalism", description: "Work ethic, punctuality, and attitude", max_score: 10, weight: 0.15 },
  { id: "c5", name: "Initiative & Learning", description: "Self-motivation and ability to learn new skills", max_score: 10, weight: 0.15 },
  { id: "c6", name: "Teamwork", description: "Collaboration with team members", max_score: 10, weight: 0.15 },
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

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    active: { label: "Active", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
    pending: { label: "Pending", variant: "secondary" },
    submitted: { label: "Submitted", variant: "secondary", className: "bg-blue-100 text-blue-800 border-blue-200" },
    approved: { label: "Approved", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
    rejected: { label: "Rejected", variant: "destructive" },
    overdue: { label: "Overdue", variant: "destructive", className: "bg-red-100 text-red-800 border-red-200" },
    draft: { label: "Draft", variant: "outline" },
    pending_review: { label: "Pending Review", variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    under_review: { label: "Under Review", variant: "secondary", className: "bg-purple-100 text-purple-800 border-purple-200" },
    in_progress: { label: "In Progress", variant: "secondary", className: "bg-blue-100 text-blue-800 border-blue-200" },
    completed: { label: "Completed", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
  };

  const { label, variant, className } = config[status] || { label: status, variant: "outline" as const };
  
  return <Badge variant={variant} className={className}>{label}</Badge>;
}

export default function FacultySupervisorDashboard() {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<typeof mockReports[0] | null>(null);
  const [reportAction, setReportAction] = useState<"approve" | "reject" | null>(null);
  const [reportComment, setReportComment] = useState("");
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [feedbackStudent, setFeedbackStudent] = useState<string>("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);

  // Stats cards
  const statsCards = [
    {
      title: "Assigned Students",
      value: mockStats.assignedStudents,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Pending Reviews",
      value: mockStats.pendingReviews,
      icon: FileCheck,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Completed Evaluations",
      value: mockStats.completedEvaluations,
      icon: ClipboardCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Average Rating Given",
      value: mockStats.averageRating.toFixed(1),
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const handleReportAction = useCallback((action: "approve" | "reject") => {
    setReportAction(action);
    // In real app, this would call API
    console.log(`Report ${selectedReport?.id} ${action}ed with comment:`, reportComment);
    setSelectedReport(null);
    setReportAction(null);
    setReportComment("");
  }, [selectedReport, reportComment]);

  const handleBatchApprove = useCallback(() => {
    console.log("Batch approving reports:", selectedReports);
    setSelectedReports([]);
  }, [selectedReports]);

  const handleSendFeedback = useCallback(() => {
    console.log("Sending feedback to", feedbackStudent, ":", feedbackMessage);
    setFeedbackMessage("");
    setFeedbackStudent("");
  }, [feedbackStudent, feedbackMessage]);

  const handleEvaluationSubmit = useCallback(async (data: EvaluationFormData) => {
    console.log("Submitting evaluation:", data);
    setShowEvaluationForm(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Faculty Supervisor Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your students, reviews, and evaluations</p>
      </div>

      {/* Overview Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statsCards.map((stat) => (
          <motion.div key={stat.title} variants={itemVariants}>
            <Card className="hover:shadow-md transition-shadow">
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
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden sm:inline" />
            My Students
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2 relative">
            <FileCheck className="h-4 w-4 hidden sm:inline" />
            Reports
            {mockStats.pendingReviews > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {mockStats.pendingReviews}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 hidden sm:inline" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 hidden sm:inline" />
            Feedback
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Clock className="h-4 w-4 hidden sm:inline" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* My Students Tab */}
        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>My Students</CardTitle>
                  <CardDescription>{mockStudents.length} students under your supervision</CardDescription>
                </div>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search students..." className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div
                      className="flex items-start gap-4 cursor-pointer"
                      onClick={() =>
                        setExpandedStudent(
                          expandedStudent === student.id ? null : student.id
                        )
                      }
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={student.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {student.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold">{student.name}</h3>
                          <StatusBadge status={student.status} />
                          <StatusBadge status={student.weeklyLogStatus} />
                        </div>
                        <p className="text-sm text-muted-foreground">{student.program}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                          <span className="font-medium">{student.internshipTitle}</span>
                          <span className="text-muted-foreground">@ {student.company}</span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{student.progress}%</span>
                          </div>
                          <Progress value={student.progress} className="h-2" />
                        </div>
                      </div>

                      <div className="shrink-0">
                        {expandedStudent === student.id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedStudent === student.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 pt-4 border-t"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Last Activity</Label>
                            <p className="text-sm font-medium">{student.lastActivity}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Weekly Log</Label>
                            <StatusBadge status={student.weeklyLogStatus} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Current Phase</Label>
                            <p className="text-sm font-medium">
                              {student.progress > 80 ? "Final Phase" : student.progress > 50 ? "Mid-term" : "Initial"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Actions</Label>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                View Profile
                              </Button>
                              <Button size="sm" variant="outline">
                                Send Message
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Review Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Reports Review Queue</CardTitle>
                  <CardDescription>{mockReports.length} reports awaiting your review</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedReports.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchApprove}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Selected ({selectedReports.length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedReports.length === mockReports.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedReports(mockReports.map(r => r.id));
                          } else {
                            setSelectedReports([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Report Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReports.includes(report.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedReports([...selectedReports, report.id]);
                            } else {
                              setSelectedReports(selectedReports.filter(id => id !== report.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{report.studentName}</TableCell>
                      <TableCell>{report.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" capitalize>
                          {report.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(report.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedReport(report)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{report.title}</DialogTitle>
                              <DialogDescription>
                                Submitted by {report.studentName} on{" "}
                                {new Date(report.submittedAt).toLocaleDateString()}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="py-4 space-y-4">
                              {/* Report Preview */}
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <Label className="text-sm font-medium mb-2 block">Report Preview</Label>
                                <p className="text-sm whitespace-pre-wrap">{report.preview}</p>
                                <p className="text-sm text-muted-foreground mt-2 italic">
                                  ... (full content would be displayed here)
                                </p>
                              </div>

                              {/* Review Comment */}
                                      <div className="space-y-2">
                                        <Label htmlFor="review-comment">Review Comment</Label>
                                        <Textarea
                                          id="review-comment"
                                          placeholder="Add your comments or feedback..."
                                          value={reportComment}
                                          onChange={(e) => setReportComment(e.target.value)}
                                          rows={4}
                                        />
                                      </div>
                                    </div>

                                    <DialogFooter className="gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedReport(null);
                                          setReportComment("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => handleReportAction("reject")}
                                        className="flex items-center gap-2"
                                      >
                                        <XCircle className="h-4 w-4" />
                                        Reject
                                      </Button>
                                      <Button
                                        onClick={() => handleReportAction("approve")}
                                        className="flex items-center gap-2"
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Approve
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Evaluations Panel</h2>
              <p className="text-muted-foreground">Create and manage student evaluations</p>
            </div>
            <Button
              onClick={() => setShowEvaluationForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Evaluation
            </Button>
          </div>

          {/* Evaluation Form Modal */}
          {showEvaluationForm && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Create New Evaluation</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEvaluationForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <EvaluationForm
                  criteria={evaluationCriteria}
                  onSubmit={handleEvaluationSubmit}
                  students={mockStudents.map(s => ({ id: s.id, name: s.name, program: s.program }))}
                  showStudentSelector={true}
                  showSignature={true}
                  ratingType="scale"
                  submitLabel="Submit Evaluation"
                  onCancel={() => setShowEvaluationForm(false)}
                />
              </CardContent>
            </Card>
          )}

          {/* Evaluations List */}
          <Card>
            <CardHeader>
              <CardTitle>Evaluation History</CardTitle>
              <CardDescription>Your past and upcoming evaluations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                  >
                    <div className="space-y-1">
                      <h4 className="font-semibold">{evaluation.studentName}</h4>
                      <p className="text-sm text-muted-foreground">{evaluation.period}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(evaluation.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {evaluation.score !== null ? (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {evaluation.score}/{evaluation.maxScore}
                          </p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                      ) : (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Not started</p>
                        </div>
                      )}
                      <StatusBadge status={evaluation.status} />
                      
                      {evaluation.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowEvaluationForm(true)}
                        >
                          {evaluation.status === "in_progress" ? "Continue" : "Start"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Send Feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send Feedback
                </CardTitle>
                <CardDescription>Provide feedback to your students</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student-select">Select Student</Label>
                  <Select value={feedbackStudent} onValueChange={setFeedbackStudent}>
                    <SelectTrigger id="student-select">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-message">Feedback Message</Label>
                  <Textarea
                    id="feedback-message"
                    placeholder="Type your feedback here..."
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    rows={5}
                  />
                </div>

                <Button
                  onClick={handleSendFeedback}
                  disabled={!feedbackStudent || !feedbackMessage.trim()}
                  className="w-full"
                >
                  Send Feedback
                </Button>
              </CardContent>
            </Card>

            {/* Meeting Scheduler Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Schedule Meeting
                </CardTitle>
                <CardDescription>Set up a meeting with a student</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-8 border-2 border-dashed rounded-lg text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Meeting Scheduler</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Integration with calendar coming soon. You can schedule meetings directly through email or your preferred calendar app.
                  </p>
                  <Button variant="outline" disabled>
                    Open Calendar (Coming Soon)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feedback History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Feedback History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { student: "Sarah Johnson", message: "Great progress on the authentication module. Keep up the good work!", date: "2 days ago" },
                  { student: "Michael Chen", message: "Please ensure you document all network configurations properly.", date: "5 days ago" },
                  { student: "Emily Rodriguez", message: "Excellent analysis on the Q4 data. Your insights were valuable.", date: "1 week ago" },
                ].map((fb, i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{fb.student}</span>
                      <span className="text-xs text-muted-foreground">{fb.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{fb.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Feed Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Feed</CardTitle>
                  <CardDescription>Recent actions and notifications</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-4">
                  {mockActivityFeed.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="shrink-0 mt-0.5">
                        <div className={`p-2 rounded-full ${
                          activity.type === "submission" ? "bg-blue-100" :
                          activity.type === "review" ? "bg-green-100" :
                          activity.type === "alert" ? "bg-red-100" :
                          activity.type === "evaluation" ? "bg-purple-100" :
                          "bg-gray-100"
                        }`}>
                          <activity.icon className={`h-4 w-4 ${
                            activity.type === "submission" ? "text-blue-600" :
                            activity.type === "review" ? "text-green-600" :
                            activity.type === "alert" ? "text-red-600" :
                            activity.type === "evaluation" ? "text-purple-600" :
                            "text-gray-600"
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Checkbox component for table selection
function Checkbox({ 
  checked, 
  onCheckedChange,
  className 
}: { 
  checked?: boolean; 
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={`rounded border-input h-4 w-4 ${className || ""}`}
    />
  );
}
