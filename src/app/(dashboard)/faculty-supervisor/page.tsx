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
  User,
  Mail,
  Phone,
  MapPin,
  BarChart3,
  Zap,
  Award,
  Video,
  ThumbsUp,
  Bell,
  ChevronRight,
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
    initials: "SJ",
    program: "Computer Science",
    internshipTitle: "Software Engineering Intern",
    company: "TechCorp Inc.",
    progress: 75,
    status: "active" as const,
    lastActivity: "2 hours ago",
    weeklyLogStatus: "submitted",
    email: "sarah.j@university.edu",
    phone: "+1 (555) 123-4567",
    startDate: "2025-01-06",
    endDate: "2025-03-28",
    supervisor: "John Smith (Site)",
  },
  {
    id: "2",
    name: "Michael Chen",
    avatar: null,
    initials: "MC",
    program: "Information Technology",
    internshipTitle: "IT Support Specialist",
    company: "Global Systems LLC",
    progress: 60,
    status: "active" as const,
    lastActivity: "5 hours ago",
    weeklyLogStatus: "pending",
    email: "michael.c@university.edu",
    phone: "+1 (555) 234-5678",
    startDate: "2025-01-13",
    endDate: "2025-04-04",
    supervisor: "Jane Doe (Site)",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    avatar: null,
    initials: "ER",
    program: "Data Science",
    internshipTitle: "Data Analyst Intern",
    company: "DataDriven Co.",
    progress: 90,
    status: "active" as const,
    lastActivity: "1 day ago",
    weeklyLogStatus: "approved",
    email: "emily.r@university.edu",
    phone: "+1 (555) 345-6789",
    startDate: "2024-12-01",
    endDate: "2025-02-28",
    supervisor: "Bob Wilson (Site)",
  },
  {
    id: "4",
    name: "James Wilson",
    avatar: null,
    initials: "JW",
    program: "Computer Science",
    internshipTitle: "Frontend Developer Intern",
    company: "WebStudio Pro",
    progress: 45,
    status: "active" as const,
    lastActivity: "3 days ago",
    weeklyLogStatus: "overdue",
    email: "james.w@university.edu",
    phone: "+1 (555) 456-7890",
    startDate: "2025-02-01",
    endDate: "2025-05-17",
    supervisor: "Alice Brown (Site)",
  },
  {
    id: "5",
    name: "Aisha Patel",
    avatar: null,
    initials: "AP",
    program: "Cybersecurity",
    internshipTitle: "Security Analyst Intern",
    company: "SecureNet Solutions",
    progress: 30,
    status: "active" as const,
    lastActivity: "1 week ago",
    weeklyLogStatus: "draft",
    email: "aisha.p@university.edu",
    phone: "+1 (555) 567-8901",
    startDate: "2025-02-15",
    endDate: "2025-05-31",
    supervisor: "Carol Davis (Site)",
  },
];

const mockReports = [
  {
    id: "r1",
    studentName: "Sarah Johnson",
    studentId: "1",
    title: "Weekly Report - Week 8",
    type: "weekly" as const,
    submittedAt: "2024-01-15T10:30:00Z",
    status: "pending_review" as const,
    priority: "high" as const,
    preview: "This week I focused on implementing the new authentication system...",
  },
  {
    id: "r2",
    studentName: "Michael Chen",
    studentId: "2",
    title: "Monthly Progress Report - January",
    type: "monthly" as const,
    submittedAt: "2024-01-14T14:20:00Z",
    status: "pending_review" as const,
    priority: "medium" as const,
    preview: "During January, I completed the network infrastructure audit...",
  },
  {
    id: "r3",
    studentName: "Emily Rodriguez",
    studentId: "3",
    title: "Final Internship Report",
    type: "final" as const,
    submittedAt: "2024-01-13T09:00:00Z",
    status: "under_review" as const,
    priority: "high" as const,
    preview: "This report summarizes my experience and learnings during my internship...",
  },
  {
    id: "r4",
    studentName: "James Wilson",
    studentId: "4",
    title: "Weekly Report - Week 6",
    type: "weekly" as const,
    submittedAt: "2024-01-12T16:45:00Z",
    status: "pending_review" as const,
    priority: "low" as const,
    preview: "I continued working on the React component library this week...",
  },
  {
    id: "r5",
    studentName: "Aisha Patel",
    studentId: "5",
    title: "Weekly Report - Week 4",
    type: "weekly" as const,
    submittedAt: "2024-01-11T11:15:00Z",
    status: "pending_review" as const,
    priority: "medium" as const,
    preview: "This week's focus was on vulnerability assessment training...",
  },
];

const mockEvaluations = [
  {
    id: "e1",
    studentName: "Sarah Johnson",
    studentId: "1",
    period: "Mid-term Evaluation",
    dueDate: "2024-01-20",
    status: "completed" as const,
    score: 42,
    maxScore: 50,
    criteria: {
      technical: 8,
      problem_solving: 7,
      communication: 9,
      professionalism: 9,
      initiative: 9,
    },
  },
  {
    id: "e2",
    studentName: "Michael Chen",
    studentId: "2",
    period: "Mid-term Evaluation",
    dueDate: "2024-01-22",
    status: "in_progress" as const,
    score: null,
    maxScore: 50,
    criteria: null,
  },
  {
    id: "e3",
    studentName: "Emily Rodriguez",
    studentId: "3",
    period: "Final Evaluation",
    dueDate: "2024-01-25",
    status: "pending" as const,
    score: null,
    maxScore: 50,
    criteria: null,
  },
];

const mockActivityFeed = [
  {
    id: "a1",
    type: "submission" as const,
    message: 'Sarah Johnson submitted "Weekly Report - Week 8"',
    timestamp: "2 hours ago",
    icon: FileCheck,
    color: "text-primary",
  },
  {
    id: "a2",
    type: "review" as const,
    message: 'You approved Michael Chen\'s Weekly Log for Week 7',
    timestamp: "5 hours ago",
    icon: CheckCircle2,
    color: "text-success",
  },
  {
    id: "a3",
    type: "alert" as const,
    message: "James Wilson has an overdue weekly log submission",
    timestamp: "1 day ago",
    icon: AlertCircle,
    color: "text-danger",
  },
  {
    id: "a4",
    type: "evaluation" as const,
    message: "You completed mid-term evaluation for Emily Rodriguez",
    timestamp: "2 days ago",
    icon: Star,
    color: "text-warning",
  },
  {
    id: "a5",
    type: "feedback" as const,
    message: "You sent feedback to Aisha Patel regarding her progress",
    timestamp: "3 days ago",
    icon: MessageSquare,
    color: "text-chart-2",
  },
];

// Communication threads mock data
const communicationThreads = [
  {
    studentId: "1",
    studentName: "Sarah Johnson",
    messages: [
      { id: 1, from: "student", text: "Hi Professor, I have a question about the final report requirements.", time: "10:30 AM" },
      { id: 2, from: "faculty", text: "Sure Sarah, what would you like to know?", time: "11:15 AM" },
      { id: 3, from: "student", text: "Should I include code samples in the appendix?", time: "11:20 AM" },
    ],
    unreadCount: 1,
  },
  {
    studentId: "3",
    studentName: "Emily Rodriguez",
    messages: [
      { id: 1, from: "student", text: "Thank you for the positive feedback on my mid-term evaluation!", time: "Yesterday" },
      ],
    unreadCount: 0,
  },
];

// Meeting slots mock data
const meetingSlots = [
  { date: "Mon, Jan 20", time: "10:00 AM", available: true },
  { date: "Mon, Jan 20", time: "2:00 PM", available: true },
  { date: "Tue, Jan 21", time: "11:00 AM", available: false },
  { date: "Tue, Jan 21", time: "3:00 PM", available: true },
  { date: "Wed, Jan 22", time: "9:00 AM", available: true },
  { date: "Wed, Jan 22", time: "1:00 PM", available: true },
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
  const config: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "badge-success" },
    pending: { label: "Pending", className: "badge-secondary" },
    submitted: { label: "Submitted", className: "badge-info" },
    approved: { label: "Approved", className: "badge-success" },
    rejected: { label: "Rejected", className: "badge-danger" },
    overdue: { label: "Overdue", className: "badge-danger" },
    draft: { label: "Draft", className: "badge-secondary" },
    pending_review: { label: "Pending Review", className: "badge-warning" },
    under_review: { label: "Under Review", className: "badge-info" },
    in_progress: { label: "In Progress", className: "badge-primary" },
    completed: { label: "Completed", className: "badge-success" },
    high: { label: "High Priority", className: "badge-danger" },
    medium: { label: "Medium", className: "badge-warning" },
    low: { label: "Low", className: "badge-info" },
  };

  const item = config[status] || { label: status, className: "badge-secondary" };
  
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}

function PriorityIndicator({ priority }: { priority: "high" | "medium" | "low" }) {
  return (
    <div className={`w-1 h-full rounded-full ${
      priority === "high" ? "bg-danger" :
      priority === "medium" ? "bg-warning" : "bg-info"
    }`} />
  );
}

export default function FacultySupervisorDashboard() {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<typeof mockReports[0] | null>(null);
  const [reportAction, setReportAction] = useState<"approve" | "reject" | null>(null);
  const [reportComment, setReportComment] = useState("");
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [feedbackStudent, setFeedbackStudent] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(4);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [selectedStudentForChat, setSelectedStudentForChat] = useState<string | null>(null);

  // Stats cards
  const statsCards = [
    { title: "Assigned Students", value: mockStats.assignedStudents, icon: Users, color: "bg-primary/10 text-primary" },
    { title: "Pending Reviews", value: mockStats.pendingReviews, icon: FileCheck, color: "bg-warning/10 text-warning" },
    { title: "Completed Evaluations", value: mockStats.completedEvaluations, icon: ClipboardCheck, color: "bg-success/10 text-success" },
    { title: "Average Rating Given", value: mockStats.averageRating.toFixed(1), icon: Star, color: "bg-chart-2/10 text-chart-2" },
  ];

  const handleReportAction = useCallback((action: "approve" | "reject") => {
    setReportAction(action);
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
    console.log("Sending feedback to", feedbackStudent, ":", feedbackMessage, "Rating:", feedbackRating);
    setFeedbackMessage("");
    setFeedbackStudent("");
    setFeedbackRating(4);
  }, [feedbackStudent, feedbackMessage, feedbackRating]);

  const handleEvaluationSubmit = useCallback(async (data: EvaluationFormData) => {
    console.log("Submitting evaluation:", data);
    setShowEvaluationForm(false);
  }, []);

  return (
    <div className="space-y-6 page-container">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dashboard-card bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-cyan-500/5 border-chart-2/20"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-h2 font-bold text-foreground">Faculty Supervisor Dashboard</h1>
            <p className="text-body text-muted-foreground mt-1">Manage your students, reviews, and evaluations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMeetingScheduler(true)} className="focus-ring">
              <Video className="mr-2 h-4 w-4" />
              Schedule Meeting
            </Button>
            <Button size="sm" className="focus-ring">
              <Plus className="mr-2 h-4 w-4" />
              New Evaluation
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statsCards.map((stat) => (
          <motion.div key={stat.title} variants={itemVariants} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className={`stat-card-icon ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <p className="dashboard-card-value text-2xl">{stat.value}</p>
            <p className="dashboard-card-description">{stat.title}</p>
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
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-danger text-white text-[10px] rounded-full flex items-center justify-center">
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
        <TabsContent value="students" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Assigned Students</h2>
              <p className="text-small text-muted-foreground mt-1">{mockStudents.length} students under your supervision</p>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search students..." className="pl-10 form-input" />
            </div>
          </div>

          {/* Student Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockStudents.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`dashboard-card card-hover cursor-pointer ${expandedStudent === student.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}
              >
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-medium">
                      {student.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-h4 font-semibold truncate">{student.name}</h3>
                      <StatusBadge status={student.status} />
                    </div>
                    <p className="text-small text-muted-foreground truncate">{student.internshipTitle}</p>
                    <p className="text-caption text-muted-foreground">{student.company}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption text-muted-foreground">Progress</span>
                      <span className="text-sm font-semibold text-gradient-brand">{student.progress}%</span>
                    </div>
                    <Progress value={student.progress} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-caption text-muted-foreground">Weekly Log</span>
                    <StatusBadge status={student.weeklyLogStatus} />
                  </div>

                  <div className="flex items-center justify-between text-caption text-muted-foreground">
                    <span>Last activity</span>
                    <span>{student.lastActivity}</span>
                  </div>

                  {expandedStudent === student.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-4 border-t border-border mt-4 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-caption text-muted-foreground">Program</p>
                          <p className="font-medium">{student.program}</p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">Site Supervisor</p>
                          <p className="font-medium">{student.supervisor}</p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">Start Date</p>
                          <p className="font-medium">{student.startDate}</p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">End Date</p>
                          <p className="font-medium">{student.endDate}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1 focus-ring" onClick={(e) => { e.stopPropagation(); setSelectedStudentForChat(student.id); }}>
                          <MessageSquare className="mr-1 h-3 w-3" />
                          Message
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 focus-ring" onClick={(e) => e.stopPropagation()}>
                          <Eye className="mr-1 h-3 w-3" />
                          View Profile
                        </Button>
                        <Button size="sm" className="focus-ring" onClick={(e) => { e.stopPropagation(); setShowEvaluationForm(true); }}>
                          <ClipboardCheck className="mr-1 h-3 w-3" />
                          Evaluate
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Reports Tab - Pending Reviews Queue */}
        <TabsContent value="reports" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Pending Reviews</h2>
              <p className="text-small text-muted-foreground mt-1">{mockReports.filter(r => r.status === "pending_review").length} reports awaiting your review</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedReports.length > 0 && (
                <Button onClick={handleBatchApprove} size="sm" className="focus-ring">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Selected ({selectedReports.length})
                </Button>
              )}
              <Button variant="outline" size="sm" className="focus-ring">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {mockReports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`dashboard-card hover:shadow-md transition-all ${report.priority === "high" ? "border-l-4 border-l-danger" : ""}`}
              >
                <div className="flex gap-4">
                  <PriorityIndicator priority={report.priority} />
                  
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedReports.includes(report.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReports([...selectedReports, report.id]);
                            } else {
                              setSelectedReports(selectedReports.filter(id => id !== report.id));
                            }
                          }}
                          className="rounded border-border focus-ring"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{report.title}</h3>
                            <StatusBadge status={report.type} />
                            <StatusBadge status={report.priority} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-small text-muted-foreground">
                            <span>{report.studentName}</span>
                            <span>•</span>
                            <span>Submitted {new Date(report.submittedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={report.status} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                          className="focus-ring"
                        >
                          Review
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 pl-6">
                      {report.preview}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Evaluations</h2>
              <p className="text-small text-muted-foreground mt-1">Track and complete student evaluations</p>
            </div>
            <Button onClick={() => setShowEvaluationForm(true)} className="focus-ring">
              <Plus className="mr-2 h-4 w-4" />
              New Evaluation
            </Button>
          </div>

          {/* Evaluation History Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockEvaluations.map((evaluation, index) => (
              <motion.div
                key={evaluation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`dashboard-card card-hover ${evaluation.status === "pending" ? "border-warning/50" : ""}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-xs">
                        {evaluation.studentName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{evaluation.studentName}</p>
                      <p className="text-caption text-muted-foreground">{evaluation.period}</p>
                    </div>
                  </div>
                  <StatusBadge status={evaluation.status} />
                </div>

                {evaluation.status === "completed" && evaluation.criteria ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium">Total Score</span>
                      <span className="text-lg font-bold text-gradient-brand">{evaluation.score}/{evaluation.maxScore}</span>
                    </div>
                    
                    {/* Mini criteria chart */}
                    <div className="space-y-2">
                      {Object.entries(evaluation.criteria).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize w-24 truncate">{key.replace("_", " ")}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full" 
                              style={{ width: `${(value / 10) * 100}%` }} 
                            />
                          </div>
                          <span className="text-xs font-medium w-4">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(evaluation.dueDate).toLocaleDateString()}
                    </p>
                    <Button 
                      size="sm" 
                      className="mt-3 focus-ring"
                      onClick={() => setShowEvaluationForm(true)}
                    >
                      Start Evaluation
                    </Button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Feedback Tab - Quick Feedback Form */}
        <TabsContent value="feedback" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Feedback Form */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Send Quick Feedback
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="form-group">
                  <Label className="form-label">Select Student</Label>
                  <Select value={feedbackStudent} onValueChange={setFeedbackStudent}>
                    <SelectTrigger className="form-input">
                      <SelectValue placeholder="Choose a student..." />
                    </SelectTrigger>
                    <SelectContent>
                      {mockStudents.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Rating</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        className={`p-1 rounded transition-colors focus-ring ${
                          star <= feedbackRating ? "text-warning" : "text-muted-foreground"
                        }`}
                      >
                        <Star className={`h-6 w-6 ${star <= feedbackRating ? "fill-current" : ""}`} />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">{feedbackRating}/5</span>
                  </div>
                </div>

                <div className="form-group">
                  <Label className="form-label">Feedback Message</Label>
                  <Textarea
                    placeholder="Write your feedback here..."
                    rows={4}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    className="form-input"
                  />
                </div>

                <Button 
                  onClick={handleSendFeedback} 
                  disabled={!feedbackStudent || !feedbackMessage}
                  className="w-full focus-ring"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Feedback
                </Button>
              </div>
            </div>

            {/* Communication Threads */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-chart-2" />
                  Recent Conversations
                </h3>
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                {communicationThreads.map((thread) => (
                  <div
                    key={thread.studentId}
                    className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedStudentForChat(thread.studentId)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {thread.studentName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{thread.studentName}</span>
                      </div>
                      {thread.unreadCount > 0 && (
                        <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 pl-10">
                      {thread.messages[thread.messages.length - 1].text}
                    </p>
                  </div>
                ))}

                {communicationThreads.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No conversations yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Activity Feed Tab */}
        <TabsContent value="activity" className="mt-6 space-y-4">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title flex items-center gap-2">
                <Clock className="h-5 w-5 text-info" />
                Recent Activity
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin p-2">
              {mockActivityFeed.map((activity, index) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.color === "text-primary" ? "bg-primary/10" :
                      activity.color === "text-success" ? "bg-success/10" :
                      activity.color === "text-danger" ? "bg-danger/10" :
                      activity.color === "text-warning" ? "bg-warning/10" : "bg-chart-2/10"
                    }`}>
                      <activity.icon className={`h-5 w-5 ${activity.color}`} />
                    </div>
                    {index < mockActivityFeed.length - 1 && (
                      <div className="absolute left-5 top-10 w-px h-[calc(100%+16px)] bg-border" />
                    )}
                  </div>
                  
                  <div className="flex-1 pb-4">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-caption text-muted-foreground mt-1">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Report Review Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
            <DialogDescription>
              {selectedReport?.title} - {selectedReport?.studentName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm">{selectedReport.preview}</p>
              </div>
              
              <div className="form-group">
                <Label className="form-label">Review Comments</Label>
                <Textarea
                  placeholder="Add your comments..."
                  rows={3}
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedReport(null)} className="focus-ring">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleReportAction("reject")}
              className="focus-ring"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={() => handleReportAction("approve")} className="focus-ring">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation Form Dialog */}
      <Dialog open={showEvaluationForm} onOpenChange={setShowEvaluationForm}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Evaluation</DialogTitle>
            <DialogDescription>
              Complete the evaluation form for the selected student
            </DialogDescription>
          </DialogHeader>
          
          <EvaluationForm
            criteria={evaluationCriteria}
            onSubmit={handleEvaluationSubmit}
            onCancel={() => setShowEvaluationForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Meeting Scheduler Dialog */}
      <Dialog open={showMeetingScheduler} onOpenChange={setShowMeetingScheduler}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
            <DialogDescription>
              Set up a video call or in-person meeting with a student
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="form-group">
              <Label className="form-label">Select Student</Label>
              <Select>
                <SelectTrigger className="form-input">
                  <SelectValue placeholder="Choose a student..." />
                </SelectTrigger>
                <SelectContent>
                  {mockStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="form-group">
              <Label className="form-label">Meeting Type</Label>
              <Select defaultValue="video">
                <SelectTrigger className="form-input">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video Call</SelectItem>
                  <SelectItem value="in-person">In-Person</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="form-group">
              <Label className="form-label">Available Slots</Label>
              <div className="grid grid-cols-2 gap-2">
                {meetingSlots.map((slot, index) => (
                  <button
                    key={index}
                    disabled={!slot.available}
                    className={`p-3 rounded-lg border text-left text-sm transition-colors focus-ring ${
                      slot.available 
                        ? "border-border hover:border-primary/50 hover:bg-primary/5" 
                        : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <p className="font-medium">{slot.date}</p>
                    <p className="text-muted-foreground">{slot.time}</p>
                    {!slot.available && <p className="text-danger text-xs mt-1">Booked</p>}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <Label className="form-label">Agenda (Optional)</Label>
              <Textarea
                placeholder="What would you like to discuss?"
                rows={3}
                className="form-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingScheduler(false)} className="focus-ring">
              Cancel
            </Button>
            <Button onClick={() => setShowMeetingScheduler(false)} className="focus-ring">
              <Video className="mr-2 h-4 w-4" />
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog open={!!selectedStudentForChat} onOpenChange={() => setSelectedStudentForChat(null)}>
        <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
          {/* Chat Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {mockStudents.find(s => s.id === selectedStudentForChat)?.initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{mockStudents.find(s => s.id === selectedStudentForChat)?.name}</p>
                <p className="text-xs text-success flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success" /> Online
                </p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {(communicationThreads.find(t => t.studentId === selectedStudentForChat)?.messages || []).map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === "faculty" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] p-3 rounded-lg ${
                    msg.from === "faculty" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.from === "faculty" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                className="form-input flex-1"
              />
              <Button className="focus-ring">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
