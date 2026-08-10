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
import { EvaluationForm, SkillAssessment, type EvaluationFormData } from "@/components/supervisors/evaluation-form";
import { SignaturePad } from "@/components/supervisors/signature-pad";
import type { EvaluationCriteria } from "@/types";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  FileText,
  MessageSquare,
  Star,
  Upload,
  Plus,
  Search,
  TrendingUp,
  UserCheck,
  ClipboardList,
  PenTool,
  StickyNote,
  ChevronRight,
  Timer,
  BarChart3,
  Filter,
  Download,
  Bell,
  CalendarDays,
  FileUp,
  PenLine,
  ThumbsUp,
  Eye,
} from "lucide-react";

// Mock data
const mockInterns = [
  {
    id: "1",
    name: "Sarah Johnson",
    avatar: null,
    initials: "SJ",
    company: "TechCorp Inc.",
    startDate: "2024-01-02",
    endDate: "2024-04-15",
    daysRemaining: 45,
    status: "active" as const,
    currentWeek: 6,
    totalWeeks: 15,
    lastLogStatus: "submitted" as const,
    email: "sarah.j@techcorp.com",
    department: "Engineering",
  },
  {
    id: "2",
    name: "Michael Chen",
    avatar: null,
    initials: "MC",
    company: "TechCorp Inc.",
    startDate: "2024-01-08",
    endDate: "2024-04-22",
    daysRemaining: 52,
    status: "active" as const,
    currentWeek: 5,
    totalWeeks: 15,
    lastLogStatus: "pending" as const,
    email: "michael.c@techcorp.com",
    department: "IT Support",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    avatar: null,
    initials: "ER",
    company: "TechCorp Inc.",
    startDate: "2023-12-01",
    endDate: "2024-03-15",
    daysRemaining: 14,
    status: "active" as const,
    currentWeek: 13,
    totalWeeks: 15,
    lastLogStatus: "approved" as const,
    email: "emily.r@techcorp.com",
    department: "Data Analytics",
  },
];

const mockPendingActivities = [
  {
    id: "a1",
    internName: "Sarah Johnson",
    internId: "1",
    weekNumber: 6,
    tasksCompleted: "Implemented user authentication module, fixed 5 bugs in dashboard",
    hoursWorked: 38,
    challenges: "Some issues with OAuth integration",
    learnings: "Deepened understanding of JWT tokens and session management",
    submittedAt: "2024-01-15T17:00:00Z",
    status: "pending" as const,
  },
  {
    id: "a2",
    internName: "Michael Chen",
    internId: "2",
    weekNumber: 5,
    tasksCompleted: "Configured new firewall rules, updated documentation",
    hoursWorked: 40,
    challenges: "Legacy system compatibility issues",
    learnings: "Network security best practices",
    submittedAt: "2024-01-15T16:30:00Z",
    status: "pending" as const,
  },
  {
    id: "a3",
    internName: "Sarah Johnson",
    internId: "1",
    weekNumber: 5,
    tasksCompleted: "API endpoint development, code review participation",
    hoursWorked: 42,
    challenges: "Performance optimization for large datasets",
    learnings: "Database indexing strategies",
    submittedAt: "2024-01-08T18:00:00Z",
    status: "pending" as const,
  },
];

const mockEvaluations = [
  {
    id: "e1",
    internName: "Sarah Johnson",
    period: "Week 1-3 Evaluation",
    dueDate: "2024-01-20",
    isOverdue: false,
    status: "completed" as const,
    score: 43,
    maxScore: 50,
  },
  {
    id: "e2",
    internName: "Michael Chen",
    period: "Week 1-3 Evaluation",
    dueDate: "2024-01-25",
    isOverdue: false,
    status: "in_progress" as const,
    score: null,
    maxScore: 50,
  },
  {
    id: "e3",
    internName: "Sarah Johnson",
    period: "Week 4-6 Evaluation",
    dueDate: "2024-01-28",
    isOverdue: false,
    status: "pending" as const,
    score: null,
    maxScore: 50,
  },
  {
    id: "e4",
    internName: "Emily Rodriguez",
    period: "Week 10-12 Evaluation",
    dueDate: "2024-01-18",
    isOverdue: true,
    status: "overdue" as const,
    score: null,
    maxScore: 50,
  },
];

const initialRemarks = [
  {
    id: "r1",
    internId: "1",
    internName: "Sarah Johnson",
    remark: "Excellent problem-solving skills this week. Demonstrated strong initiative on the auth project.",
    date: "2024-01-15",
    author: "You",
  },
  {
    id: "r2",
    internId: "2",
    internName: "Michael Chen",
    remark: "Needs to improve time management. Some deliverables were delayed.",
    date: "2024-01-14",
    author: "You",
  },
  {
    id: "r3",
    internId: "1",
    internName: "Sarah Johnson",
    remark: "Great teamwork during sprint planning. Collaborated well with senior developers.",
    date: "2024-01-08",
    author: "You",
  },
];

// Weekly calendar schedule mock
const weeklySchedule = [
  { day: "Mon", date: "Jan 20", activities: ["Sarah - Week 6 Review", "Team Standup"] },
  { day: "Tue", date: "Jan 21", activities: ["Michael - Week 5 Review"] },
  { day: "Wed", date: "Jan 22", activities: ["Sprint Planning"] },
  { day: "Thu", date: "Jan 23", activities: ["Code Review Session"] },
  { day: "Fri", date: "Jan 24", activities: ["Weekly Reports Due"] },
  { day: "Sat", date: "Jan 25", activities: [] },
  { day: "Sun", date: "Jan 26", activities: [] },
];

// Rating summary mock data
const ratingSummary = [
  { category: "Technical Performance", average: 8.2, trend: "up" },
  { category: "Attendance & Punctuality", average: 9.0, trend: "stable" },
  { category: "Professional Behavior", average: 8.5, trend: "up" },
  { category: "Communication", average: 7.8, trend: "down" },
  { category: "Initiative & Learning", average: 8.0, trend: "up" },
  { category: "Task Completion", average: 8.3, trend: "stable" },
];

const siteEvaluationCriteria: EvaluationCriteria[] = [
  { id: "sc1", name: "Technical Performance", description: "Quality of work and technical competence", max_score: 10, weight: 0.25 },
  { id: "sc2", name: "Attendance & Punctuality", description: "Reliability and timeliness", max_score: 10, weight: 0.15 },
  { id: "sc3", name: "Professional Behavior", description: "Workplace conduct and professionalism", max_score: 10, weight: 0.15 },
  { id: "sc4", name: "Communication", description: "Team communication and reporting", max_score: 10, weight: 0.15 },
  { id: "sc5", name: "Initiative & Learning", description: "Self-motivation and skill development", max_score: 10, weight: 0.15 },
  { id: "sc6", name: "Task Completion", description: "Meeting deadlines and quality standards", max_score: 10, weight: 0.15 },
];

const skillsList = [
  "Problem Solving",
  "Technical Writing",
  "Team Collaboration",
  "Time Management",
  "Adaptability",
  "Attention to Detail",
  "Leadership",
  "Critical Thinking",
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
    active: { label: "Active", className: "badge-success" },
    pending: { label: "Pending Review", className: "badge-warning" },
    approved: { label: "Approved", className: "badge-success" },
    rejected: { label: "Rejected", className: "badge-danger" },
    completed: { label: "Completed", className: "badge-success" },
    in_progress: { label: "In Progress", className: "badge-primary" },
    overdue: { label: "Overdue!", className: "badge-danger" },
    submitted: { label: "Submitted", className: "badge-info" },
  };

  const item = config[status] || { label: status, className: "badge-secondary" };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}

export default function SiteSupervisorDashboard() {
  // State declarations
  const [selectedActivity, setSelectedActivity] = useState<typeof mockPendingActivities[0] | null>(null);
  const [activityComment, setActivityComment] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [selectedEvalIntern, setSelectedEvalIntern] = useState("");
  const [newRemark, setNewRemark] = useState("");
  const [remarkIntern, setRemarkIntern] = useState("");
  const [remarks, setRemarks] = useState(initialRemarks);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Calculate stats
  const activeInterns = mockInterns.filter(i => i.status === "active").length;
  const pendingApprovals = mockPendingActivities.filter(a => a.status === "pending").length;
  const upcomingEvaluations = mockEvaluations.filter(e => e.status !== "completed").length;

  const handleActivityApprove = useCallback(() => {
    console.log("Approved activity:", selectedActivity?.id, "with comment:", activityComment);
    setSelectedActivity(null);
    setActivityComment("");
  }, [selectedActivity, activityComment]);

  const handleActivityReject = useCallback(() => {
    console.log("Rejected activity:", selectedActivity?.id, "with comment:", activityComment);
    setSelectedActivity(null);
    setActivityComment("");
  }, [selectedActivity, activityComment]);

  const handleBatchApprove = useCallback(() => {
    console.log("Batch approving activities:", selectedActivities);
    setSelectedActivities([]);
  }, [selectedActivities]);

  const handleEvaluationSubmit = useCallback(async (data: EvaluationFormData) => {
    console.log("Submitting site evaluation:", data);
    setShowEvaluationForm(false);
  }, []);

  const handleAddRemark = useCallback(() => {
    if (!remarkIntern || !newRemark.trim()) return;
    
    const remark = {
      id: `r${remarks.length + 1}`,
      internId: remarkIntern,
      internName: mockInterns.find(i => i.id === remarkIntern)?.name || "Unknown",
      remark: newRemark,
      date: new Date().toISOString().split("T")[0],
      author: "You",
    };
    
    setRemarks([remark, ...remarks]);
    setNewRemark("");
    setRemarkIntern("");
  }, [remarkIntern, newRemark, remarks]);

  return (
    <div className="space-y-6 page-container">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dashboard-card bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5 border-success/20"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-h2 font-bold text-foreground">Site Supervisor Dashboard</h1>
            <p className="text-body text-muted-foreground mt-1">Manage interns, approve activities, and submit evaluations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)} className="focus-ring">
              <FileUp className="mr-2 h-4 w-4" />
              Upload Document
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
        {[
          { title: "Active Interns", value: activeInterns, icon: Users, color: "bg-primary/10 text-primary" },
          { title: "Pending Approvals", value: pendingApprovals, icon: ClipboardList, color: "bg-warning/10 text-warning" },
          { title: "Due Evaluations", value: upcomingEvaluations, icon: Star, color: "bg-chart-2/10 text-chart-2" },
          { title: "This Week's Hours", value: "120h", icon: Timer, color: "bg-success/10 text-success" },
        ].map((stat) => (
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
      <Tabs defaultValue="interns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="interns" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden sm:inline" />
            My Interns
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2 relative">
            <ClipboardList className="h-4 w-4 hidden sm:inline" />
            Activities
            {pendingApprovals > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-danger text-white text-[10px] rounded-full flex items-center justify-center">
                {pendingApprovals}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="flex items-center gap-2">
            <Star className="h-4 w-4 hidden sm:inline" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 hidden sm:inline" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="remarks" className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 hidden sm:inline" />
            Remarks
          </TabsTrigger>
        </TabsList>

        {/* My Interns Tab */}
        <TabsContent value="interns" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Assigned Interns</h2>
              <p className="text-small text-muted-foreground mt-1">{mockInterns.length} interns under your supervision</p>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search interns..." className="pl-10 form-input" />
            </div>
          </div>

          <div className="space-y-4">
            {mockInterns.map((intern) => (
              <motion.div
                key={intern.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="dashboard-card card-hover"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Intern Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                      <AvatarImage src={intern.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-emerald-600 text-white font-semibold text-lg">
                        {intern.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-h4 font-semibold">{intern.name}</h3>
                        <StatusBadge status={intern.status} />
                      </div>
                      <p className="text-small text-muted-foreground">{intern.company} • {intern.department}</p>
                      <div className="flex items-center gap-4 mt-2 text-caption text-muted-foreground">
                        <span>Week {intern.currentWeek} of {intern.totalWeeks}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <StatusBadge status={intern.lastLogStatus} />
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="w-full md:w-48 space-y-1">
                    <div className="flex justify-between text-caption">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-gradient-brand">{Math.round((intern.currentWeek / intern.totalWeeks) * 100)}%</span>
                    </div>
                    <Progress value={(intern.currentWeek / intern.totalWeeks) * 100} className="h-2" />
                  </div>

                  {/* Days Remaining & Actions */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className={`text-center px-4 py-2 rounded-lg ${
                      intern.daysRemaining <= 14 ? "bg-danger/10" : 
                      intern.daysRemaining <= 30 ? "bg-warning/10" : "bg-success/10"
                    }`}>
                      <p className={`text-2xl font-bold ${
                        intern.daysRemaining <= 14 ? "text-danger" : 
                        intern.daysRemaining <= 30 ? "text-warning" : "text-success"
                      }`}>
                        {intern.daysRemaining}
                      </p>
                      <p className="text-caption text-muted-foreground">days left</p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" className="whitespace-nowrap focus-ring">
                        <Eye className="mr-1 h-3 w-3" />
                        View Details
                      </Button>
                      <Select defaultValue="active">
                        <SelectTrigger className="w-[120px] h-8 text-xs form-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_leave">On Leave</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Activities Approval Tab with Bulk Actions */}
        <TabsContent value="activities" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Pending Activity Approvals</h2>
              <p className="text-small text-muted-foreground mt-1">
                Review weekly logs submitted by your interns
                <Badge variant="outline" className="ml-2 badge-info">
                  <Calendar className="h-3 w-3 mr-1" />
                  Every 3 Weeks: Evaluation Due
                </Badge>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedActivities.length > 0 && (
                <Button onClick={handleBatchApprove} size="sm" className="focus-ring">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Selected ({selectedActivities.length})
                </Button>
              )}
              <Button variant="outline" size="sm" className="focus-ring">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>

          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedActivities(mockPendingActivities.map(a => a.id));
                        } else {
                          setSelectedActivities([]);
                        }
                      }}
                      className="rounded border-border focus-ring"
                    />
                  </TableHead>
                  <TableHead>Intern</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPendingActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedActivities.includes(activity.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedActivities([...selectedActivities, activity.id]);
                          } else {
                            setSelectedActivities(selectedActivities.filter(id => id !== activity.id));
                          }
                        }}
                        className="rounded border-border focus-ring"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{activity.internName}</TableCell>
                    <TableCell>Week {activity.weekNumber}</TableCell>
                    <TableCell>{activity.hoursWorked}h</TableCell>
                    <TableCell><StatusBadge status={activity.status} /></TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(activity.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedActivity(activity)}
                            className="focus-ring"
                          >
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Weekly Log Review - Week {activity.weekNumber}
                            </DialogTitle>
                            <DialogDescription>
                              Submitted by {activity.internName} on{" "}
                              {new Date(activity.submittedAt).toLocaleDateString()}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="py-4 space-y-6">
                            {/* Tasks Completed */}
                            <div className="form-group">
                              <Label className="form-label flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                Tasks Completed
                              </Label>
                              <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                                <p className="text-sm">{activity.tasksCompleted}</p>
                              </div>
                            </div>

                            {/* Hours Worked */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="form-group">
                                <Label className="form-label flex items-center gap-2">
                                  <Timer className="h-4 w-4 text-primary" />
                                  Hours Worked
                                </Label>
                                <p className="dashboard-card-value text-2xl">{activity.hoursWorked} hrs</p>
                              </div>
                              <div className="form-group">
                                <Label className="form-label flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-warning" />
                                  Weekly Status
                                </Label>
                                <StatusBadge status="pending" />
                              </div>
                            </div>

                            <Separator />

                            {/* Challenges */}
                            <div className="form-group">
                              <Label className="form-label flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-warning" />
                                Challenges Faced
                              </Label>
                              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                                <p className="text-sm">{activity.challenges}</p>
                              </div>
                            </div>

                            {/* Learnings */}
                            <div className="form-group">
                              <Label className="form-label flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Key Learnings
                              </Label>
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <p className="text-sm">{activity.learnings}</p>
                              </div>
                            </div>

                            <Separator />

                            {/* Supervisor Comment */}
                            <div className="form-group">
                              <Label htmlFor="supervisor-comment" className="form-label flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-chart-2" />
                                Your Comments
                              </Label>
                              <Textarea
                                id="supervisor-comment"
                                placeholder="Add feedback or comments about this week's work..."
                                value={activityComment}
                                onChange={(e) => setActivityComment(e.target.value)}
                                rows={4}
                                className="form-input"
                              />
                            </div>

                            {/* Digital Signature */}
                            <SignaturePad
                              label="Your Signature"
                              onSignatureChange={setSignatureData}
                              showDownload={false}
                            />
                          </div>

                          <DialogFooter className="gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedActivity(null);
                                setActivityComment("");
                              }}
                              className="focus-ring"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleActivityReject}
                              className="focus-ring"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              onClick={handleActivityApprove}
                              disabled={!signatureData}
                              className="focus-ring"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
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
          </div>
        </TabsContent>

        {/* Evaluations Tab with Rating Summary Charts */}
        <TabsContent value="evaluations" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 text-warning" />
                Every-3-Weeks Evaluations
              </h2>
              <p className="text-small text-muted-foreground mt-1">Complete periodic evaluations for each intern</p>
            </div>
            <Button
              onClick={() => setShowEvaluationForm(true)}
              className="focus-ring"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Evaluation
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evaluation Cycle Tracker */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title">Evaluation Cycle Tracker</h3>
              </div>
              <div className="space-y-3">
                {mockEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className={`p-4 rounded-lg border ${
                      evaluation.isOverdue ? "border-danger/50 bg-danger/5" :
                      evaluation.status === "pending" ? "border-warning/50 bg-warning/5" : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{evaluation.internName}</h4>
                          {evaluation.isOverdue && (
                            <span className="badge badge-danger">Overdue!</span>
                          )}
                        </div>
                        <p className="text-caption text-muted-foreground">{evaluation.period}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-xs ${
                            evaluation.isOverdue ? "text-danger font-medium" : "text-muted-foreground"
                          }`}>
                            Due: {new Date(evaluation.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {evaluation.score !== null && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-gradient-brand">{evaluation.score}/{evaluation.maxScore}</p>
                            <p className="text-caption text-muted-foreground">Score</p>
                          </div>
                        )}
                        <StatusBadge status={evaluation.status} />
                        
                        {evaluation.status !== "completed" && (
                          <Button
                            size="sm"
                            variant={evaluation.isOverdue ? "default" : "outline"}
                            onClick={() => {
                              setSelectedEvalIntern(evaluation.internName);
                              setShowEvaluationForm(true);
                            }}
                            className="focus-ring"
                          >
                            {evaluation.status === "in_progress" ? "Continue" : "Start"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating Summary Chart */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-chart-2" />
                  Rating Summary
                </h3>
              </div>
              <div className="space-y-4">
                {ratingSummary.map((rating) => (
                  <div key={rating.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{rating.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{rating.average.toFixed(1)}</span>
                        {rating.trend === "up" ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : rating.trend === "down" ? (
                          <TrendingUp className="h-4 w-4 text-danger rotate-180" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          rating.average >= 8.5 ? "bg-success" :
                          rating.average >= 7.5 ? "bg-primary" : "bg-warning"
                        }`}
                        style={{ width: `${(rating.average / 10) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="pt-2">
                  <p className="text-caption text-muted-foreground mb-2">Overall Average</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gradient-brand">
                      {(ratingSummary.reduce((sum, r) => sum + r.average, 0) / ratingSummary.length).toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">/ 10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluation Form Modal */}
          {showEvaluationForm && (
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title">Create Site Evaluation</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEvaluationForm(false)}
                  className="focus-ring"
                >
                  Cancel
                </Button>
              </div>
              <EvaluationForm
                criteria={siteEvaluationCriteria}
                onSubmit={handleEvaluationSubmit}
                students={mockInterns.map(i => ({ id: i.id, name: i.name }))}
                showStudentSelector={true}
                showSignature={true}
                ratingType="scale"
                title="Site Supervisor Evaluation"
                subtitle="Evaluate intern performance based on workplace observations"
                submitLabel="Submit Evaluation"
                onCancel={() => setShowEvaluationForm(false)}
              />
            </div>
          )}

          {/* Skills Assessment Example */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">Skills Assessment Template</h3>
            </div>
            <SkillAssessment
              skills={skillsList}
              assessedSkills={{
                "Problem Solving": "good",
                "Technical Writing": "satisfactory",
                "Team Collaboration": "excellent",
              }}
              onChange={() => {}}
              readOnly
            />
          </div>
        </TabsContent>

        {/* Weekly Schedule Tab */}
        <TabsContent value="schedule" className="mt-6 space-y-4">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                This Week's Schedule
              </h3>
              <Button variant="outline" size="sm" className="focus-ring">
                <ChevronRight className="mr-1 h-4 w-4" />
                Next Week
              </Button>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {weeklySchedule.map((day, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    day.activities.length > 0 
                      ? "border-primary/30 bg-primary/5" 
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="text-center mb-2">
                    <p className="text-caption text-muted-foreground">{day.day}</p>
                    <p className="text-h4 font-semibold">{day.date.split(" ")[1]}</p>
                  </div>
                  
                  <div className="space-y-1 mt-3">
                    {day.activities.length > 0 ? (
                      day.activities.map((activity, actIndex) => (
                        <div
                          key={actIndex}
                          className="text-xs p-2 rounded bg-background border border-border truncate"
                          title={activity}
                        >
                          {activity}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No events</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title flex items-center gap-2">
                <Bell className="h-5 w-5 text-warning" />
                Upcoming Deadlines
              </h3>
            </div>
            
            <div className="space-y-3">
              {mockEvaluations
                .filter(e => e.status !== "completed")
                .slice(0, 3)
                .map((eval_) => (
                  <div
                    key={eval_.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      eval_.isOverdue ? "bg-danger/5 border border-danger/20" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {eval_.internName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{eval_.period}</p>
                        <p className="text-caption text-muted-foreground">{eval_.internName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${eval_.isOverdue ? "text-danger" : ""}`}>
                        {eval_.isOverdue ? "Overdue!" : new Date(eval_.dueDate).toLocaleDateString()}
                      </p>
                      <Button size="sm" variant="outline" className="mt-1 focus-ring">
                        Evaluate Now
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </TabsContent>

        {/* Remarks & Notes Tab with Timeline */}
        <TabsContent value="remarks" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Remark Form */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-primary" />
                  Add Remark
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="form-group">
                  <Label className="form-label">Select Intern</Label>
                  <Select value={remarkIntern} onValueChange={setRemarkIntern}>
                    <SelectTrigger className="form-input">
                      <SelectValue placeholder="Choose an intern" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockInterns.map((intern) => (
                        <SelectItem key={intern.id} value={intern.id}>
                          {intern.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label htmlFor="remark-text" className="form-label">Remark</Label>
                  <Textarea
                    id="remark-text"
                    placeholder="Enter your observation or note..."
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    rows={4}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <Label className="form-label">Attach Document (Optional)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-caption text-muted-foreground mt-1">
                      PDF, DOC, Images up to 10MB
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleAddRemark}
                  disabled={!remarkIntern || !newRemark.trim()}
                  className="w-full focus-ring"
                >
                  <PenLine className="mr-2 h-4 w-4" />
                  Add Remark
                </Button>
              </div>
            </div>

            {/* Remarks Timeline */}
            <div className="dashboard-card lg:col-span-2">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title">Remarks History Timeline</h3>
                <p className="text-caption text-muted-foreground">{remarks.length} remarks added</p>
              </div>
              
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-4 p-2">
                  {remarks.map((remark, index) => (
                    <div key={remark.id} className="flex gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <StickyNote className="h-5 w-5 text-primary" />
                        </div>
                        {index < remarks.length - 1 && (
                          <div className="w-px flex-1 bg-border min-h-[40px]" />
                        )}
                      </div>
                      
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{remark.internName}</span>
                              <span className="badge badge-secondary text-xs">{index === 0 ? "Latest" : ""}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{remark.remark}</p>
                            <div className="flex items-center gap-2 mt-2 text-caption text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{remark.date}</span>
                              <span className="w-1 h-1 rounded-full bg-border" />
                              <span>By {remark.author}</span>
                            </div>
                          </div>
                          
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 focus-ring">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {remarks.length === 0 && (
                    <div className="text-center py-12">
                      <StickyNote className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No remarks yet. Add your first remark using the form.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Upload Document Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Supporting Document</DialogTitle>
            <DialogDescription>
              Upload documents related to intern supervision or evaluations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="form-group">
              <Label className="form-label">Document Type</Label>
              <Select>
                <SelectTrigger className="form-input">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evaluation_form">Evaluation Form</SelectItem>
                  <SelectItem value="timesheet">Timesheet Record</SelectItem>
                  <SelectItem value="incident_report">Incident Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="form-group">
              <Label className="form-label">Related Intern (Optional)</Label>
              <Select>
                <SelectTrigger className="form-input">
                  <SelectValue placeholder="Select intern" />
                </SelectTrigger>
                <SelectContent>
                  {mockInterns.map(intern => (
                    <SelectItem key={intern.id} value={intern.id}>{intern.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="form-group">
              <Label className="form-label">Document</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Drag & drop files here or click to browse</p>
                <p className="text-caption text-muted-foreground mt-1">
                  PDF, DOC, DOCX, XLSX up to 25MB
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="focus-ring">
              Cancel
            </Button>
            <Button onClick={() => setShowUploadDialog(false)} className="focus-ring">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoreVertical({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  );
}
