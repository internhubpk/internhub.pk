"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarIcon,
  FileText,
  Upload,
  Download,
  Eye,
  Edit3,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User,
  Building2,
  MapPin,
  Mail,
  Phone,
  Award,
  GraduationCap,
  BookOpen,
  ClipboardList,
  TrendingUp,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Send,
  Bell,
  Megaphone,
  Activity,
  Timer,
  BarChart3,
  Zap,
  Target,
  Flame,
} from "lucide-react";
import { InternshipProgressCard } from "@/components/student/internship-progress";
import { WeeklyLogForm, type WeeklyLogFormData } from "@/components/student/weekly-log-form";
import { DocumentUpload } from "@/components/student/document-upload";
import type { 
  InternshipProgress as InternshipProgressType, 
  WeeklyLog, 
  Report, 
  Attendance,
  Document,
  StudentInternship 
} from "@/types";

// ============ MOCK DATA ============
const mockProgress: InternshipProgressType = {
  currentWeek: 4,
  totalWeeks: 12,
  percentage: 33,
  weeklyLogsSubmitted: 3,
  weeklyLogsRequired: 12,
  reportsSubmitted: 1,
  reportsRequired: 4,
  evaluationsCompleted: 0,
  evaluationsRequired: 2,
  nextDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  certificateStatus: "not_issued",
  transcriptStatus: "pending",
};

const mockWeeklyLogs: WeeklyLog[] = [
  {
    id: "1",
    student_internship_id: "si-1",
    week_number: 1,
    week_start: "2025-01-06",
    week_end: "2025-01-12",
    tasks_completed: "Set up development environment, attended team meetings, reviewed codebase documentation.",
    challenges: "Getting familiar with the existing codebase and understanding the project architecture.",
    learnings: "Learned about React best practices, company coding standards, and agile methodology.",
    next_week_goals: "Complete onboarding tasks, start working on first assigned ticket.",
    hours_worked: 40,
    status: "approved",
    submitted_at: "2025-01-13T10:00:00Z",
    reviewed_at: "2025-01-14T15:00:00Z",
  },
  {
    id: "2",
    student_internship_id: "si-1",
    week_number: 2,
    week_start: "2025-01-13",
    week_end: "2025-01-19",
    tasks_completed: "Completed UI components for dashboard, participated in code reviews, fixed bugs.",
    challenges: "Understanding complex state management patterns in the application.",
    learnings: "Improved TypeScript skills, learned Redux Toolkit patterns.",
    next_week_goals: "Start implementing API integration for user management module.",
    hours_worked: 42,
    status: "approved",
    submitted_at: "2025-01-20T09:30:00Z",
    reviewed_at: "2025-01-21T11:00:00Z",
  },
  {
    id: "3",
    student_internship_id: "si-1",
    week_number: 3,
    week_start: "2025-01-20",
    week_end: "2025-01-26",
    tasks_completed: "Implemented REST API endpoints, wrote unit tests, documented APIs.",
    challenges: "Debugging async issues with API calls, handling edge cases.",
    learnings: "Gained experience with Express.js, Jest testing framework.",
    next_week_goals: "Continue API work, start frontend integration.",
    hours_worked: 38,
    status: "submitted",
    submitted_at: "2025-01-27T10:00:00Z",
  },
];

const mockReports: Report[] = [
  {
    id: "r1",
    student_internship_id: "si-1",
    title: "Weekly Report - Week 1 & 2",
    content: "Summary of activities during first two weeks...",
    report_type: "weekly",
    status: "approved",
    submitted_at: "2025-01-15T10:00:00Z",
    reviewed_at: "2025-01-16T14:00:00Z",
  },
  {
    id: "r2",
    student_internship_id: "si-1",
    title: "Monthly Progress Report - January",
    report_type: "monthly",
    status: "submitted",
    submitted_at: "2025-02-01T09:00:00Z",
  },
];

const mockAttendance: Attendance[] = Array.from({ length: 20 }, (_, i) => {
  const date = new Date(2025, 0, 6 + i);
  const statuses: Attendance["status"][] = ["present", "present", "present", "present", "present", "late", "present"];
  return {
    id: `att-${i}`,
    student_internship_id: "si-1",
    date: date.toISOString().split("T")[0],
    check_in: "09:00",
    check_out: "17:30",
    hours_worked: 8.5,
    status: statuses[i % statuses.length],
  };
});

const mockDocuments: (Document & { description?: string; canUpload?: boolean })[] = [
  {
    id: "doc-1",
    entity_type: "student",
    entity_id: "s-1",
    document_type: "offer_letter",
    file_name: "Internship_Offer_Letter.pdf",
    file_url: "#",
    file_size: 245000,
    mime_type: "application/pdf",
    uploaded_by: "system",
    is_verified: true,
    created_at: "2024-12-15T10:00:00Z",
    description: "Official internship offer letter from company",
    canUpload: false,
  },
  {
    id: "doc-2",
    entity_type: "internship",
    entity_id: "si-1",
    document_type: "completion_letter",
    file_name: null,
    file_url: null,
    file_size: 0,
    mime_type: "",
    uploaded_by: "",
    is_verified: false,
    created_at: "",
    description: "Will be issued upon successful completion",
    canUpload: false,
  },
  {
    id: "doc-3",
    entity_type: "internship",
    entity_id: "si-1",
    document_type: "internship_letter",
    file_name: "University_Internship_Letter.pdf",
    file_url: "#",
    file_size: 180000,
    mime_type: "application/pdf",
    uploaded_by: "university",
    is_verified: true,
    created_at: "2024-12-20T08:00:00Z",
    description: "Official letter from university authorizing internship",
    canUpload: false,
  },
  {
    id: "doc-4",
    entity_type: "student",
    entity_id: "s-1",
    document_type: "certificate",
    file_name: null,
    file_url: null,
    file_size: 0,
    mime_type: "",
    uploaded_by: "",
    is_verified: false,
    created_at: "",
    description: "Completion certificate - not yet available",
    canUpload: false,
  },
];

const mockInternshipDetails: StudentInternship & {
  company_name?: string;
  company_logo?: string;
  supervisor_name?: string;
  supervisor_email?: string;
  supervisor_phone?: string;
} = {
  id: "si-1",
  student_id: "s-1",
  internship_id: "int-1",
  application_id: "app-1",
  faculty_supervisor_id: "fs-1",
  site_supervisor_id: "ss-1",
  start_date: "2025-01-06",
  end_date: "2025-03-28",
  status: "active",
  weekly_hours: 40,
  total_hours: 120,
  progress_percentage: 33,
  created_at: "2024-12-20T10:00:00Z",
  updated_at: "2025-01-27T10:00:00Z",
  company_name: "TechCorp Solutions Inc.",
  company_logo: null,
  supervisor_name: "Sarah Johnson",
  supervisor_email: "sarah.johnson@techcorp.com",
  supervisor_phone: "+1 (555) 123-4567",
};

// New mock data for enhanced sections
const upcomingDeadlines = [
  { id: 1, title: "Week 4 Weekly Log", dueDate: "2025-02-02", urgency: "high" as const, type: "log" },
  { id: 2, title: "Mid-term Evaluation Form", dueDate: "2025-02-15", urgency: "medium" as const, type: "evaluation" },
  { id: 3, title: "February Monthly Report", dueDate: "2025-02-28", urgency: "low" as const, type: "report" },
];

const recentActivities = [
  { id: 1, action: "Weekly log approved", detail: "Week 3 log approved by supervisor", time: "2 hours ago", icon: CheckCircle2, color: "text-success" },
  { id: 2, action: "New announcement", detail: "Company holiday on Feb 14th", time: "5 hours ago", icon: Megaphone, color: "text-info" },
  { id: 3, action: "Report submitted", detail: "Monthly progress report for January", time: "1 day ago", icon: Send, color: "text-primary" },
  { id: 4, action: "Feedback received", detail: "Positive feedback on Week 2 performance", time: "2 days ago", icon: Star, color: "text-warning" },
  { id: 5, action: "Meeting scheduled", detail: "1:1 with site supervisor next Monday", time: "3 days ago", icon: CalendarIcon, color: "text-chart-2" },
];

const announcements = [
  { id: 1, source: "University", title: "Spring Semester Internship Guidelines Updated", date: "2025-01-28", priority: "high" as const },
  { id: 2, source: "Company", title: "Team Building Event - Feb 20th", date: "2025-01-27", priority: "medium" as const },
  { id: 3, source: "University", title: "Internship Completion Requirements", date: "2025-01-25", priority: "low" as const },
];

// ============ HELPER COMPONENTS ============

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "badge-secondary" },
    submitted: { label: "Submitted", className: "badge-info" },
    approved: { label: "Approved", className: "badge-success" },
    rejected: { label: "Rejected", className: "badge-danger" },
    under_review: { label: "Under Review", className: "badge-warning" },
    pending: { label: "Pending", className: "badge-secondary" },
  };

  const configItem = config[status] || { label: status, className: "badge-secondary" };

  return (
    <span className={`badge ${configItem.className}`}>
      {configItem.label}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: "high" | "medium" | "low" }) {
  const config = {
    high: { label: "Urgent", className: "badge-danger" },
    medium: { label: "Soon", className: "badge-warning" },
    low: { label: "Upcoming", className: "badge-info" },
  };

  return (
    <span className={`badge ${config[urgency].className}`}>
      {config[urgency].label}
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Star icon component
function Star({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

// Briefcase icon component
function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

// ============ MAIN DASHBOARD COMPONENT ============

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isLogFormOpen, setIsLogFormOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // Form handlers
  const handleLogSubmit = useCallback(async (data: WeeklyLogFormData) => {
    console.log("Submitting log:", data);
  }, []);

  const handleSaveDraft = useCallback((data: WeeklyLogFormData) => {
    console.log("Saving draft:", data);
  }, []);

  // Calculate attendance stats
  const attendanceStats = {
    present: mockAttendance.filter(a => a.status === "present").length,
    late: mockAttendance.filter(a => a.status === "late").length,
    absent: mockAttendance.filter(a => a.status === "absent").length,
    total: mockAttendance.length,
    percentage: Math.round(
      (mockAttendance.filter(a => a.status === "present" || a.status === "late").length / mockAttendance.length) * 100
    ),
  };

  // Calculate total hours logged
  const totalHoursLogged = mockWeeklyLogs.reduce((sum, log) => sum + log.hours_worked, 0);

  return (
    <div className="space-y-6 page-container">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dashboard-card bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border-primary/20"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-xl">
                JD
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-h3 font-bold text-foreground">
                Welcome back, John! 👋
              </h1>
              <p className="text-body text-muted-foreground mt-1 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                State University • Computer Science • Semester 6
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="badge badge-success">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active Internship
                </span>
                <span className="text-xs text-muted-foreground">
                  Week {mockProgress.currentWeek} of {mockProgress.totalWeeks}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="focus-ring">
              <CalendarIcon className="mr-2 h-4 w-4" />
              View Schedule
            </Button>
            <Button size="sm" onClick={() => setIsLogFormOpen(true)} className="focus-ring">
              <Plus className="mr-2 h-4 w-4" />
              New Log Entry
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants} className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-muted-foreground">Attendance Rate</p>
              <p className="dashboard-card-value text-2xl mt-1">{attendanceStats.percentage}%</p>
            </div>
            <div className="stat-card-icon bg-success/10 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${attendanceStats.percentage}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{attendanceStats.present}/{attendanceStats.total}</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-muted-foreground">Hours Logged</p>
              <p className="dashboard-card-value text-2xl mt-1">{totalHoursLogged}</p>
            </div>
            <div className="stat-card-icon bg-primary/10 text-primary">
              <Timer className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-success flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +8 this week
            </span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-muted-foreground">Reports Submitted</p>
              <p className="dashboard-card-value text-2xl mt-1">{mockProgress.reportsSubmitted}/{mockProgress.reportsRequired}</p>
            </div>
            <div className="stat-card-icon bg-chart-2/10 text-chart-2">
              <FileText className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3">
            <Progress value={(mockProgress.reportsSubmitted / mockProgress.reportsRequired) * 100} className="h-1.5" />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-muted-foreground">Current Streak</p>
              <p className="dashboard-card-value text-2xl mt-1">3 Weeks</p>
            </div>
            <div className="stat-card-icon bg-warning/10 text-warning">
              <Flame className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Keep it going! 🔥</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Weekly Logs</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Progress Card - Takes 2 columns */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <InternshipProgressCard progress={mockProgress} />
            </motion.div>

            {/* Upcoming Deadlines */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Clock className="h-5 w-5 text-warning" />
                  Upcoming Deadlines
                </h3>
                <Button variant="ghost" size="sm" className="text-primary focus-ring">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {upcomingDeadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className={`p-3 rounded-lg border ${
                      deadline.urgency === "high"
                        ? "bg-danger/5 border-danger/20"
                        : deadline.urgency === "medium"
                        ? "bg-warning/5 border-warning/20"
                        : "bg-info/5 border-info/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          deadline.urgency === "high" ? "bg-danger" :
                          deadline.urgency === "medium" ? "bg-warning" : "bg-info"
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{deadline.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Due {new Date(deadline.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <UrgencyBadge urgency={deadline.urgency} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Second Row: Details & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Internship Details Card */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Internship Details
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Company Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      TC
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{mockInternshipDetails.company_name}</p>
                      <p className="text-xs text-muted-foreground">Technology Company</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BriefcaseIcon className="h-4 w-4" />
                      <span>Software Engineering Intern</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>San Francisco, CA (Hybrid)</span>
                    </div>
                  </div>
                </div>

                {/* Supervisor Info */}
                <div className="space-y-3">
                  <h4 className="text-label text-muted-foreground uppercase tracking-wider">
                    Site Supervisor
                  </h4>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                        SJ
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{mockInternshipDetails.supervisor_name}</p>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {mockInternshipDetails.supervisor_email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {mockInternshipDetails.supervisor_phone}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Timeline */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-semibold mt-1">
                    {new Date(mockInternshipDetails.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm font-semibold mt-1">
                    {new Date(mockInternshipDetails.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Weekly Hours</p>
                  <p className="text-sm font-semibold mt-1">{mockInternshipDetails.weekly_hours} hrs</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-semibold mt-1">{mockProgress.totalWeeks} weeks</p>
                </div>
              </div>
            </motion.div>

            {/* Recent Activity Feed */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Activity className="h-5 w-5 text-chart-2" />
                  Recent Activity
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4 max-h-[320px] overflow-y-auto scrollbar-thin">
                {recentActivities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      activity.color === "text-success" ? "bg-success/10" :
                      activity.color === "text-info" ? "bg-info/10" :
                      activity.color === "text-primary" ? "bg-primary/10" :
                      activity.color === "text-warning" ? "bg-warning/10" : "bg-chart-2/10"
                    }`}>
                      <activity.icon className={`h-4 w-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.detail}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{activity.time}</p>
                    </div>
                    {index < recentActivities.length - 1 && (
                      <div className="absolute left-4 top-8 w-px h-full bg-border ml-2" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Third Row: Announcements & Attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Announcements */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-info" />
                  Announcements
                </h3>
                <Badge variant="outline" className="badge-info">
                  {announcements.length} New
                </Badge>
              </div>
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            announcement.priority === "high" ? "bg-danger/10 text-danger" :
                            announcement.priority === "medium" ? "bg-warning/10 text-warning" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {announcement.source}
                          </span>
                          {announcement.priority === "high" && (
                            <Bell className="h-3 w-3 text-danger" />
                          )}
                        </div>
                        <p className="text-sm font-medium line-clamp-2">{announcement.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(announcement.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Attendance Summary */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-success" />
                  Recent Attendance
                </h3>
                <Button variant="outline" size="sm" className="focus-ring">
                  View Calendar
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-3 rounded-lg bg-success/10">
                  <p className="text-xl font-bold text-success">{attendanceStats.present}</p>
                  <p className="text-xs text-muted-foreground mt-1">Present</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-warning/10">
                  <p className="text-xl font-bold text-warning">{attendanceStats.late}</p>
                  <p className="text-xs text-muted-foreground mt-1">Late</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-danger/10">
                  <p className="text-xl font-bold text-danger">{attendanceStats.absent}</p>
                  <p className="text-xs text-muted-foreground mt-1">Absent</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/10">
                  <p className="text-xl font-bold text-primary">{attendanceStats.percentage}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Rate</p>
                </div>
              </div>

              {/* Mini Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
                {mockAttendance.slice(0, 14).map((att) => (
                  <div
                    key={att.id}
                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium cursor-default ${
                      att.status === "present"
                        ? "bg-success/20 text-success dark:bg-success/30"
                        : att.status === "late"
                        ? "bg-warning/20 text-warning dark:bg-warning/30"
                        : "bg-danger/20 text-danger dark:bg-danger/30"
                    }`}
                    title={`${att.date}: ${att.status}`}
                  >
                    {new Date(att.date).getDate()}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </TabsContent>

        {/* WEEKLY LOGS TAB */}
        <TabsContent value="logs" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h2 className="text-h4 font-semibold">Weekly Activity Logs</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Track your weekly progress and activities during the internship
              </p>
            </div>
            <Button onClick={() => setIsLogFormOpen(true)} className="focus-ring">
              <Plus className="mr-2 h-4 w-4" />
              New Weekly Log
            </Button>
          </motion.div>

          {/* Logs List */}
          <div className="space-y-4">
            {mockWeeklyLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`dashboard-card card-hover ${log.status === "rejected" ? "border-danger/50" : ""}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
                      log.status === "approved" ? "bg-success" :
                      log.status === "submitted" ? "bg-primary" :
                      log.status === "rejected" ? "bg-danger" : "bg-muted-foreground"
                    }`}>
                      W{log.week_number}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-h4 font-semibold">Week {log.week_number} Activity Log</h3>
                        <StatusBadge status={log.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.week_start).toLocaleDateString()} —{" "}
                        {new Date(log.week_end).toLocaleDateString()}
                      </p>
                      <p className="text-xs line-clamp-1">
                        {log.tasks_completed}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <p className="text-sm font-medium">{log.hours_worked} hours</p>
                      {log.submitted_at && (
                        <p className="text-caption text-muted-foreground">
                          Submitted {new Date(log.submitted_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {(log.status === "draft" || log.status === "rejected") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingLogId(log.id)}
                          className="focus-ring"
                        >
                          <Edit3 className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="focus-ring">
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Weekly Log Form Dialog */}
          <WeeklyLogForm
            isOpen={isLogFormOpen}
            onOpenChange={setIsLogFormOpen}
            currentWeek={mockProgress.currentWeek + 1}
            onSubmit={handleLogSubmit}
            onSaveDraft={handleSaveDraft}
          />
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h2 className="text-h4 font-semibold">Reports</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Submit and track your internship reports
              </p>
            </div>
            <Button onClick={() => setIsReportDialogOpen(true)} className="focus-ring">
              <Upload className="mr-2 h-4 w-4" />
              Upload Report
            </Button>
          </motion.div>

          {/* Reports Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th className="hidden sm:table-cell">Type</th>
                  <th className="hidden md:table-cell">Submitted</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{report.title}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">
                      <Badge variant="outline" capitalize>
                        {report.report_type.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="hidden md:table-cell text-muted-foreground">
                      {report.submitted_at
                        ? new Date(report.submitted_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <StatusBadge status={report.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Report Upload Dialog */}
          <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Upload Report</DialogTitle>
                <DialogDescription>
                  Submit your internship report for review
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="form-group">
                  <Label htmlFor="report-title" className="form-label">Report Title</Label>
                  <Input id="report-title" placeholder="e.g., Monthly Progress Report - February" className="form-input" />
                </div>

                <div className="form-group">
                  <Label htmlFor="report-type" className="form-label">Report Type</Label>
                  <Select defaultValue="weekly">
                    <SelectTrigger id="report-type" className="form-input">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly Report</SelectItem>
                      <SelectItem value="monthly">Monthly Report</SelectItem>
                      <SelectItem value="final">Final Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Document</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop your file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOC, DOCX (Max 25MB)
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsReportDialogOpen(false)} className="focus-ring">
                  Cancel
                </Button>
                <Button onClick={() => setIsReportDialogOpen(false)} className="focus-ring">
                  <Send className="mr-2 h-4 w-4" />
                  Submit Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mb-6">
              <h2 className="text-h4 font-semibold">Documents</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your internship-related documents
              </p>
            </div>

            {/* Documents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockDocuments.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`dashboard-card card-hover ${!doc.file_url ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                      doc.document_type === "offer_letter" ? "bg-primary/10 text-primary" :
                      doc.document_type === "completion_letter" ? "bg-chart-2/10 text-chart-2" :
                      doc.document_type === "internship_letter" ? "bg-success/10 text-success" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {doc.document_type === "offer_letter" && <FileText className="h-6 w-6" />}
                      {doc.document_type === "completion_letter" && <Award className="h-6 w-6" />}
                      {doc.document_type === "internship_letter" && <GraduationCap className="h-6 w-6" />}
                      {doc.document_type === "certificate" && <Award className="h-6 w-6" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className="text-h4 font-semibold capitalize">
                        {doc.document_type.replace("_", " ")}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.description || "No description"}
                      </p>
                      
                      {doc.file_name ? (
                        <div className="flex items-center gap-3 text-caption text-muted-foreground">
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          {doc.is_verified && (
                            <>
                              <span>•</span>
                              <span className="text-success flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="text-caption text-muted-foreground italic">
                          Not yet available
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      {doc.file_url ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                      
                      {doc.canUpload && (
                        <DocumentUpload
                          trigger={
                            <Button variant="outline" size="sm" className="mt-1 focus-ring">
                              <Upload className="mr-1 h-3 w-3" />
                              Upload
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
