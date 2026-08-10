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
} from "lucide-react";

// Mock data
const mockInterns = [
  {
    id: "1",
    name: "Sarah Johnson",
    avatar: null,
    company: "TechCorp Inc.",
    startDate: "2024-01-02",
    endDate: "2024-04-15",
    daysRemaining: 45,
    status: "active" as const,
    currentWeek: 6,
    totalWeeks: 15,
    lastLogStatus: "submitted" as const,
  },
  {
    id: "2",
    name: "Michael Chen",
    avatar: null,
    company: "TechCorp Inc.",
    startDate: "2024-01-08",
    endDate: "2024-04-22",
    daysRemaining: 52,
    status: "active" as const,
    currentWeek: 5,
    totalWeeks: 15,
    lastLogStatus: "pending" as const,
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    avatar: null,
    company: "TechCorp Inc.",
    startDate: "2023-12-01",
    endDate: "2024-03-15",
    daysRemaining: 14,
    status: "active" as const,
    currentWeek: 13,
    totalWeeks: 15,
    lastLogStatus: "approved" as const,
  },
];

const mockPendingActivities = [
  {
    id: "a1",
    internName: "Sarah Johnson",
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
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    active: { label: "Active", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
    pending: { label: "Pending Review", variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    approved: { label: "Approved", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
    rejected: { label: "Rejected", variant: "destructive" },
    completed: { label: "Completed", variant: "default", className: "bg-green-100 text-green-800 border-green-200" },
    in_progress: { label: "In Progress", variant: "secondary", className: "bg-blue-100 text-blue-800 border-blue-200" },
    overdue: { label: "Overdue!", variant: "destructive", className: "bg-red-100 text-red-800 border-red-200 animate-pulse" },
    submitted: { label: "Submitted", variant: "secondary", className: "bg-blue-100 text-blue-800 border-blue-200" },
  };

  const { label, variant, className } = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={variant} className={className}>{label}</Badge>;
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Site Supervisor Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage interns, approve activities, and submit evaluations</p>
      </div>

      {/* Overview Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { title: "Active Interns", value: activeInterns, icon: Users, color: "text-blue-600", bgColor: "bg-blue-100" },
          { title: "Pending Approvals", value: pendingApprovals, icon: ClipboardList, color: "text-yellow-600", bgColor: "bg-yellow-100" },
          { title: "Due Evaluations", value: upcomingEvaluations, icon: Star, color: "text-purple-600", bgColor: "bg-purple-100" },
          { title: "This Week's Hours", value: "120h", icon: Timer, color: "text-green-600", bgColor: "bg-green-100" },
        ].map((stat) => (
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
      <Tabs defaultValue="interns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="interns" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden sm:inline" />
            My Interns
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2 relative">
            <ClipboardList className="h-4 w-4 hidden sm:inline" />
            Activities
            {pendingApprovals > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {pendingApprovals}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="flex items-center gap-2">
            <Star className="h-4 w-4 hidden sm:inline" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="remarks" className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 hidden sm:inline" />
            Remarks
          </TabsTrigger>
        </TabsList>

        {/* My Interns Tab */}
        <TabsContent value="interns" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Assigned Interns</CardTitle>
                  <CardDescription>{mockInterns.length} interns under your supervision</CardDescription>
                </div>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search interns..." className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockInterns.map((intern) => (
                  <motion.div
                    key={intern.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Intern Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={intern.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                            {intern.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{intern.name}</h3>
                            <StatusBadge status={intern.status} />
                          </div>
                          <p className="text-sm text-muted-foreground">{intern.company}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Week {intern.currentWeek} of {intern.totalWeeks}</span>
                            <span>|</span>
                            <StatusBadge status={intern.lastLogStatus} />
                          </div>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="w-full md:w-48 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span>{Math.round((intern.currentWeek / intern.totalWeeks) * 100)}%</span>
                        </div>
                        <Progress value={(intern.currentWeek / intern.totalWeeks) * 100} className="h-2" />
                      </div>

                      {/* Days Remaining & Actions */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className={`text-center px-4 py-2 rounded-lg ${
                          intern.daysRemaining <= 14 ? "bg-red-100" : 
                          intern.daysRemaining <= 30 ? "bg-yellow-100" : "bg-green-100"
                        }`}>
                          <p className={`text-2xl font-bold ${
                            intern.daysRemaining <= 14 ? "text-red-700" : 
                            intern.daysRemaining <= 30 ? "text-yellow-700" : "text-green-700"
                          }`}>
                            {intern.daysRemaining}
                          </p>
                          <p className="text-xs text-muted-foreground">days left</p>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" className="whitespace-nowrap">
                            View Details
                          </Button>
                          <Select defaultValue="active">
                            <SelectTrigger className="w-[120px] h-8 text-xs">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Approval Tab */}
        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Pending Activity Approvals</CardTitle>
                  <CardDescription>
                    Review weekly logs submitted by your interns (Evaluations every 3 weeks)
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 px-3 py-1">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Every 3 Weeks: Evaluation Due
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell className="font-medium">{activity.internName}</TableCell>
                      <TableCell>Week {activity.weekNumber}</TableCell>
                      <TableCell>{activity.hoursWorked}h</TableCell>
                      <TableCell><StatusBadge status={activity.status} /></TableCell>
                      <TableCell>
                        {new Date(activity.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedActivity(activity)}
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
                              <div className="space-y-2">
                                <Label className="font-semibold flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  Tasks Completed
                                </Label>
                                <p className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
                                  {activity.tasksCompleted}
                                </p>
                              </div>

                              {/* Hours Worked */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="font-semibold flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-blue-600" />
                                    Hours Worked
                                  </Label>
                                  <p className="text-2xl font-bold text-primary">{activity.hoursWorked} hrs</p>
                                </div>
                                <div className="space-y-2">
                                  <Label className="font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-orange-600" />
                                    Weekly Status
                                  </Label>
                                  <StatusBadge status="pending" />
                                </div>
                              </div>

                              <Separator />

                              {/* Challenges */}
                              <div className="space-y-2">
                                <Label className="font-semibold flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                  Challenges Faced
                                </Label>
                                <p className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                  {activity.challenges}
                                </p>
                              </div>

                              {/* Learnings */}
                              <div className="space-y-2">
                                <Label className="font-semibold flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-blue-600" />
                                  Key Learnings
                                </Label>
                                <p className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                                  {activity.learnings}
                                </p>
                              </div>

                              <Separator />

                              {/* Supervisor Comment */}
                              <div className="space-y-2">
                                <Label htmlFor="supervisor-comment" className="font-semibold flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  Your Comments
                                </Label>
                                <Textarea
                                  id="supervisor-comment"
                                  placeholder="Add feedback or comments about this week's work..."
                                  value={activityComment}
                                  onChange={(e) => setActivityComment(e.target.value)}
                                  rows={4}
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
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleActivityReject}
                                className="flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                Reject
                              </Button>
                              <Button
                                onClick={handleActivityApprove}
                                disabled={!signatureData}
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

        {/* Evaluations Tab (Every 3 Weeks) */}
        <TabsContent value="evaluations" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Star className="h-5 w-5" />
                Every-3-Weeks Evaluations
              </h2>
              <p className="text-muted-foreground">Complete periodic evaluations for each intern</p>
            </div>
            <Button
              onClick={() => setShowEvaluationForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Evaluation
            </Button>
          </div>

          {/* Evaluation Cycle Tracker */}
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Cycle Tracker</CardTitle>
              <CardDescription>Track evaluation schedules and due dates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border ${
                      evaluation.isOverdue ? "border-red-300 bg-red-50" :
                      evaluation.status === "pending" ? "border-yellow-300 bg-yellow-50" :
                      ""
                    }`}
                  >
                    <div className="space-y-1 mb-3 sm:mb-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{evaluation.internName}</h4>
                        {evaluation.isOverdue && (
                          <Badge variant="destructive" className="animate-pulse">
                            Overdue!
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{evaluation.period}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={`text-xs ${
                          evaluation.isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                        }`}>
                          Due: {new Date(evaluation.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {evaluation.score !== null && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {evaluation.score}/{evaluation.maxScore}
                          </p>
                          <p className="text-xs text-muted-foreground">Score</p>
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

          {/* Evaluation Form Modal */}
          {showEvaluationForm && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Create Site Evaluation</CardTitle>
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
              </CardContent>
            </Card>
          )}

          {/* Skills Assessment Example */}
          <Card>
            <CardHeader>
              <CardTitle>Skills Assessment Template</CardTitle>
              <CardDescription>Example skills checklist for evaluations</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remarks & Notes Tab */}
        <TabsContent value="remarks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Remark Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  Add Remark
                </CardTitle>
                <CardDescription>Add notes or observations about an intern</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Intern</Label>
                  <Select value={remarkIntern} onValueChange={setRemarkIntern}>
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="remark-text">Remark</Label>
                  <Textarea
                    id="remark-text"
                    placeholder="Enter your observation or note..."
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Attach Document (Optional)</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOC, Images up to 10MB
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleAddRemark}
                  disabled={!remarkIntern || !newRemark.trim()}
                  className="w-full"
                >
                  Add Remark
                </Button>
              </CardContent>
            </Card>

            {/* Remarks Timeline */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Remarks History</CardTitle>
                <CardDescription>All remarks and notes you've added</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-4">
                    {remarks.map((remark) => (
                      <div
                        key={remark.id}
                        className="flex gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <StickyNote className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{remark.internName}</span>
                            <span className="text-xs text-muted-foreground">{remark.date}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{remark.remark}</p>
                          <p className="text-xs text-muted-foreground">By {remark.author}</p>
                        </div>
                      </div>
                    ))}
                    
                    {remarks.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No remarks yet. Add your first remark using the form.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
