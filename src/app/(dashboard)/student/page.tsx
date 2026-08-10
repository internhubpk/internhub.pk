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
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    draft: { label: "Draft", variant: "secondary" },
    submitted: { label: "Submitted", variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
    approved: { label: "Approved", variant: "default", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", variant: "destructive" },
    under_review: { label: "Under Review", variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200" },
    pending: { label: "Pending", variant: "secondary" },
  };

  const configItem = config[status] || { label: status, variant: "outline" };

  return (
    <Badge variant={configItem.variant} className={configItem.className}>
      {configItem.label}
    </Badge>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
    // In production: await submitWeeklyLog(data);
  }, []);

  const handleSaveDraft = useCallback((data: WeeklyLogFormData) => {
    console.log("Saving draft:", data);
    // In production: await saveDraft(data);
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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-xl">
                    JD
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Welcome back, John! 👋
                  </h1>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    State University • Computer Science • Semester 6
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Active Internship
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Week {mockProgress.currentWeek} of {mockProgress.totalWeeks}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  View Schedule
                </Button>
                <Button size="sm" onClick={() => setIsLogFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Log Entry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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

            {/* Quick Stats */}
            <motion.div variants={itemVariants}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <p className="text-2xl font-bold text-emerald-600">{attendanceStats.percentage}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Attendance Rate</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <p className="text-2xl font-bold text-blue-600">{mockInternshipDetails.total_hours}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Hours</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                      <p className="text-2xl font-bold text-purple-600">{mockWeeklyLogsSubmitted}/{mockWeeklyLogsRequired}</p>
                      <p className="text-xs text-muted-foreground mt-1">Logs Done</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <p className="text-2xl font-bold text-amber-600">{mockProgress.currentWeek}</p>
                      <p className="text-xs text-muted-foreground mt-1">Current Week</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Upcoming Deadline */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Weekly log due soon!
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Submit by Friday at 11:59 PM
                      </p>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => setIsLogFormOpen(true)}>
                      Submit Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Internship Details Card */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Internship Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Company Info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        TC
                      </div>
                      <div>
                        <p className="font-semibold">{mockInternshipDetails.company_name}</p>
                        <p className="text-sm text-muted-foreground">Technology Company</p>
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
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      Site Supervisor
                    </h4>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-purple-100 text-purple-700">
                          SJ
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{mockInternshipDetails.supervisor_name}</p>
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

                  {/* Timeline */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      Duration
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Start Date</span>
                        <span className="font-medium">
                          {new Date(mockInternshipDetails.start_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">End Date</span>
                        <span className="font-medium">
                          {new Date(mockInternshipDetails.end_date).toLocaleDateString()}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Weekly Hours</span>
                        <span className="font-medium">{mockInternshipDetails.weekly_hours} hrs</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Duration</span>
                        <span className="font-medium">{mockProgress.totalWeeks} weeks</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Attendance Summary */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Recent Attendance
                  </CardTitle>
                  <Button variant="outline" size="sm">
                    View Full Calendar
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-xl font-bold text-emerald-600">{attendanceStats.present}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-xl font-bold text-amber-600">{attendanceStats.late}</p>
                    <p className="text-xs text-muted-foreground">Late</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <p className="text-xl font-bold text-red-600">{attendanceStats.absent}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <p className="text-xl font-bold text-blue-600">{attendanceStats.percentage}%</p>
                    <p className="text-xs text-muted-foreground">Rate</p>
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
                      className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium ${
                        att.status === "present"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                          : att.status === "late"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                      }`}
                      title={`${att.date}: ${att.status}`}
                    >
                      {new Date(att.date).getDate()}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* WEEKLY LOGS TAB */}
        <TabsContent value="logs" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold">Weekly Activity Logs</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Track your weekly progress and activities during the internship
              </p>
            </div>
            <Button onClick={() => setIsLogFormOpen(true)}>
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
              >
                <Card className={`hover:shadow-md transition-shadow ${
                  log.status === "rejected" ? "border-red-200 dark:border-red-800" : ""
                }`}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
                          log.status === "approved" ? "bg-emerald-500" :
                          log.status === "submitted" ? "bg-blue-500" :
                          log.status === "rejected" ? "bg-red-500" : "bg-gray-400"
                        }`}>
                          W{log.week_number}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">Week {log.week_number} Activity Log</h3>
                            <StatusBadge status={log.status} />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.week_start).toLocaleDateString()} —{" "}
                            {new Date(log.week_end).toLocaleDateString()}
                          </p>
                          <p className="text-sm line-clamp-1">
                            {log.tasks_completed}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                        <div className="text-right">
                          <p className="text-sm font-medium">{log.hours_worked} hours</p>
                          {log.submitted_at && (
                            <p className="text-xs text-muted-foreground">
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
                            >
                              <Edit3 className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
            className="flex items-center justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold">Reports</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Submit and track your internship reports
              </p>
            </div>
            <Button onClick={() => setIsReportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Report
            </Button>
          </motion.div>

          {/* Reports Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium text-sm">Title</th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden sm:table-cell">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden md:table-cell">Submitted</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockReports.map((report) => (
                      <tr key={report.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{report.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell">
                          <Badge variant="outline" capitalize>
                            {report.report_type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                          {report.submitted_at
                            ? new Date(report.submitted_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={report.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

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
                <div className="space-y-2">
                  <Label htmlFor="report-title">Report Title</Label>
                  <Input id="report-title" placeholder="e.g., Monthly Progress Report - February" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select defaultValue="weekly">
                    <SelectTrigger id="report-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly Report</SelectItem>
                      <SelectItem value="monthly">Monthly Report</SelectItem>
                      <SelectItem value="final">Final Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DocumentUpload
                  acceptedTypes={[
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  ]}
                  maxSizeMB={25}
                  documentType="Report"
                  trigger={
                    <Button variant="outline" className="w-full">
                      <Upload className="mr-2 h-4 w-4" />
                      Choose File or Drag & Drop
                    </Button>
                  }
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsReportDialogOpen(false)}>
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
              <h2 className="text-xl font-semibold">Documents</h2>
              <p className="text-muted-foreground text-sm mt-1">
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
                >
                  <Card className={`hover:shadow-md transition-all ${!doc.file_url ? "opacity-70" : ""}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                          doc.document_type === "offer_letter" ? "bg-blue-100 text-blue-600" :
                          doc.document_type === "completion_letter" ? "bg-purple-100 text-purple-600" :
                          doc.document_type === "internship_letter" ? "bg-emerald-100 text-emerald-600" :
                          "bg-amber-100 text-amber-600"
                        }`}>
                          {doc.document_type === "offer_letter" && <FileText className="h-6 w-6" />}
                          {doc.document_type === "completion_letter" && <Award className="h-6 w-6" />}
                          {doc.document_type === "internship_letter" && <GraduationCap className="h-6 w-6" />}
                          {doc.document_type === "certificate" && <Award className="h-6 w-6" />}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-medium capitalize">
                            {doc.document_type.replace("_", " ")}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {doc.description || "No description"}
                          </p>
                          
                          {doc.file_name ? (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span>•</span>
                              <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                              {doc.is_verified && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Not yet available
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 shrink-0">
                          {doc.file_url ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                <Button variant="outline" size="sm" className="mt-1">
                                  <Upload className="mr-1 h-3 w-3" />
                                  Upload
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Icon component helper
function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

// Mock values for display
const mockWeeklyLogsSubmitted = mockWeeklyLogs.filter(l => l.status === "approved").length;
const mockWeeklyLogsRequired = mockProgress.totalWeeks;
