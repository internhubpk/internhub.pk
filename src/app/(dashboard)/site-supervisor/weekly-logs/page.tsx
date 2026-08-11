"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ScrollText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Calendar,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Hourglass,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface WeeklyLogEntry {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatarUrl?: string | null;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  status: "submitted" | "approved" | "rejected" | "revision_required" | "pending" | "late";
  tasksCompleted: string[];
  challenges: string | null;
  learnings: string | null;
  nextWeekGoals: string | null;
  hoursWorked: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  supervisorFeedback: string | null;
  isLate: boolean;
  daysLate: number;
}

interface LogStats {
  totalLogs: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  lateSubmissions: number;
  averageHours: number;
}

export default function SiteSupervisorWeeklyLogsPage() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<WeeklyLogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showLateOnly, setShowLateOnly] = useState(false);
  
  // Review dialog state
  const [selectedLog, setSelectedLog] = useState<WeeklyLogEntry | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    fetchWeeklyLogs();
  }, []);

  async function fetchWeeklyLogs() {
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
        setMockData();
        setIsLoading(false);
        return;
      }

      // Get assigned students
      const { data: assignments } = await supabase
        .from("student_internships")
        .select("student_id")
        .eq("site_supervisor_id", supervisor.id);

      const studentIds = (assignments || []).map(a => a.student_id);

      if (studentIds.length === 0) {
        setLogs([]);
        setStats({
          totalLogs: 0,
          pendingReview: 0,
          approved: 0,
          rejected: 0,
          lateSubmissions: 0,
          averageHours: 0,
        });
        setIsLoading(false);
        return;
      }

      // Fetch weekly logs for assigned students
      const { data: weeklyLogs } = await supabase
        .from("weekly_logs")
        .select(`
          *,
          student:students(id, full_name, email, avatar_url)
        `)
        .in("student_id", studentIds)
        .order("week_start_date", { ascending: false})
        .limit(100);

      const processedLogs: WeeklyLogEntry[] = (weeklyLogs || []).map((log: any) => {
        const student = log.student || {};
        const weekEnd = new Date(log.week_end_date);
        const submittedAt = log.submitted_at ? new Date(log.submitted_at) : null;
        const gracePeriodEnd = new Date(weekEnd.getTime() + 3 * 24 * 60 * 60 * 1000);

        return {
          id: log.id,
          studentId: student.id,
          studentName: student.full_name || `Student ${student.id?.slice(0, 6)}`,
          studentEmail: student.email || "",
          avatarUrl: student.avatar_url,
          weekNumber: log.week_number,
          weekStart: log.week_start_date,
          weekEnd: log.week_end_date,
          status: log.status,
          tasksCompleted: log.tasks_completed || [],
          challenges: log.challenges,
          learnings: log.learnings,
          nextWeekGoals: log.next_week_goals,
          hoursWorked: log.hours_worked,
          submittedAt: log.submitted_at,
          reviewedAt: log.reviewed_at,
          supervisorFeedback: log.supervisor_feedback,
          isLate: submittedAt ? submittedAt > gracePeriodEnd : false,
          daysLate: submittedAt && submittedAt > gracePeriodEnd
            ? Math.floor((submittedAt.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        };
      });

      setLogs(processedLogs);

      // Calculate stats
      setStats({
        totalLogs: processedLogs.length,
        pendingReview: processedLogs.filter(l => l.status === "submitted").length,
        approved: processedLogs.filter(l => l.status === "approved").length,
        rejected: processedLogs.filter(l => l.status === "rejected").length,
        lateSubmissions: processedLogs.filter(l => l.isLate).length,
        averageHours: processedLogs.filter(l => l.hoursWorked).reduce((sum, l) => sum + (l.hoursWorked || 0), 0) 
          / (processedLogs.filter(l => l.hoursWorked).length || 1),
      });

    } catch (error) {
      console.error("Error fetching weekly logs:", error);
      setMockData();
    } finally {
      setIsLoading(false);
    }
  }

  function setMockData() {
    const mockLogs: WeeklyLogEntry[] = [
      {
        id: "log1",
        studentId: "s1",
        studentName: "Ahmed Khan",
        studentEmail: "ahmed@university.edu.pk",
        avatarUrl: null,
        weekNumber: 6,
        weekStart: "2024-07-08",
        weekEnd: "2024-07-14",
        status: "submitted",
        tasksCompleted: ["Fixed login authentication bug", "Implemented password reset feature", "Wrote unit tests for auth module"],
        challenges: "Had some difficulty with OAuth integration documentation",
        learnings: "Learned about JWT token management and refresh token rotation",
        nextWeekGoals: "Complete OAuth integration, start working on user profile API",
        hoursWorked: 38,
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: null,
        supervisorFeedback: null,
        isLate: false,
        daysLate: 0,
      },
      {
        id: "log2",
        studentId: "s2",
        studentName: "Fatima Ali",
        studentEmail: "fatima@university.edu.pk",
        avatarUrl: null,
        weekNumber: 6,
        weekStart: "2024-07-08",
        weekEnd: "2024-07-14",
        status: "approved",
        tasksCompleted: ["Built responsive dashboard UI", "Integrated charts library", "Created data visualization components"],
        challenges: "Performance optimization for large datasets took longer than expected",
        learnings: "Mastered React Query for server state management",
        nextWeekGoals: "Add export functionality, implement dark mode",
        hoursWorked: 42,
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        supervisorFeedback: "Excellent work on the dashboard! The visualizations look great.",
        isLate: false,
        daysLate: 0,
      },
      {
        id: "log3",
        studentId: "s3",
        studentName: "Usman Malik",
        studentEmail: "usman@university.edu.pk",
        avatarUrl: null,
        weekNumber: 5,
        weekStart: "2024-07-01",
        weekEnd: "2024-07-07",
        status: "submitted",
        tasksCompleted: ["Set up development environment", "Configured CI/CD pipeline", "Documented deployment process"],
        challenges: "CI/CD configuration had some issues with environment variables",
        learnings: "GitHub Actions workflow configuration",
        nextWeekGoals: "Start working on monitoring setup, create runbooks",
        hoursWorked: 35,
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: null,
        supervisorFeedback: null,
        isLate: true,
        daysLate: 2,
      },
      {
        id: "log4",
        studentId: "s1",
        studentName: "Ahmed Khan",
        studentEmail: "ahmed@university.edu.pk",
        avatarUrl: null,
        weekNumber: 5,
        weekStart: "2024-07-01",
        weekEnd: "2024-07-07",
        status: "approved",
        tasksCompleted: ["Database schema design", "API endpoint implementation", "Code review participation"],
        challenges: "None significant this week",
        learnings: "PostgreSQL indexing strategies",
        nextWeekGoals: "Focus on authentication features",
        hoursWorked: 40,
        submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        supervisorFeedback: "Good progress on the backend work. Keep it up!",
        isLate: false,
        daysLate: 0,
      },
      {
        id: "log5",
        studentId: "s4",
        studentName: "Ayesha Raza",
        studentEmail: "ayesha@university.edu.pk",
        avatarUrl: null,
        weekNumber: 6,
        weekStart: "2024-07-08",
        weekEnd: "2024-07-14",
        status: "rejected",
        tasksCompleted: ["Data cleaning scripts", "Exploratory analysis"],
        challenges: "Missing data required manual intervention",
        learnings: "Pandas advanced techniques",
        nextWeekGoals: "Build prediction model",
        hoursWorked: 36,
        submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        supervisorFeedback: "Please provide more details on the methodology used. Also include visualization of results.",
        isLate: false,
        daysLate: 0,
      },
    ];

    setLogs(mockLogs);
    setStats({
      totalLogs: mockLogs.length,
      pendingReview: mockLogs.filter(l => l.status === "submitted").length,
      approved: mockLogs.filter(l => l.status === "approved").length,
      rejected: mockLogs.filter(l => l.status === "rejected").length,
      lateSubmissions: mockLogs.filter(l => l.isLate).length,
      averageHours: Math.round(mockLogs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0) / mockLogs.length),
    });
  }

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        searchQuery === "" ||
        log.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.studentEmail.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      const matchesLate = !showLateOnly || log.isLate;

      return matchesSearch && matchesStatus && matchesLate;
    });
  }, [logs, searchQuery, statusFilter, showLateOnly]);

  async function handleReview(action: "approve" | "reject" | "request_revision") {
    if (!selectedLog || !reviewFeedback.trim()) {
      if (action !== "approve") {
        alert("Please provide feedback before rejecting or requesting revision.");
        return;
      }
    }

    setIsSubmittingReview(true);
    
    try {
      const response = await fetch("/api/site-supervisor/weekly-logs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: selectedLog.id,
          action,
          feedback: reviewFeedback,
        }),
      });

      if (response.ok) {
        alert(`Log ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "flagged for revision"} successfully!`);
        
        // Update local state
        setLogs(prev => prev.map(log =>
          log.id === selectedLog.id
            ? { ...log, status: action === "approve" ? "approved" as const : action === "reject" ? "rejected" as const : "revision_required" as const, supervisorFeedback: reviewFeedback, reviewedAt: new Date().toISOString() }
            : log
        ));

        setSelectedLog(null);
        setReviewFeedback("");
        fetchWeeklyLogs();
      } else {
        alert("Error processing review. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  function getStatusBadge(status: WeeklyLogEntry["status"]) {
    switch (status) {
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Clock className="h-3 w-3 mr-1" /> Pending Review
        </Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
        </Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" /> Rejected
        </Badge>;
      case "revision_required":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          <AlertTriangle className="h-3 w-3 mr-1" /> Revision Required
        </Badge>;
      case "pending":
        return <Badge variant="secondary">Not Submitted</Badge>;
      case "late":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Hourglass className="h-3 w-3 mr-1" /> Late
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ScrollText className="h-8 w-8" />
            Weekly Logs Review
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve weekly logs from your assigned interns
          </p>
        </div>
        <Button variant="outline" onClick={fetchWeeklyLogs}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalLogs || 0}</p>
                <p className="text-xs text-muted-foreground">Total Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats?.pendingReview || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{stats?.approved || 0}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">{stats?.rejected || 0}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats?.lateSubmissions || 0}</p>
                <p className="text-xs text-muted-foreground">Late Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-600">{stats?.averageHours || 0}h</p>
                <p className="text-xs text-muted-foreground">Avg Hours/Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="revision_required">Revision Required</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showLateOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowLateOnly(!showLateOnly)}
              className={showLateOnly ? "" : ""}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Late Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-muted-foreground">Loading weekly logs...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Logs Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== "all" || showLateOnly
                ? "Try adjusting your search or filters."
                : "No weekly logs have been submitted by your assigned interns yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`hover:shadow-md transition-all ${
                log.status === "submitted" ? "border-blue-200 bg-blue-50/20 ring-1 ring-blue-100" :
                log.isLate ? "border-yellow-200 bg-yellow-50/20" :
                ""
              }`}>
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Student Info */}
                    <div className="flex items-center gap-4 lg:min-w-[280px]">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={log.avatarUrl || undefined} alt={log.studentName} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {log.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{log.studentName}</h3>
                        <p className="text-sm text-muted-foreground truncate">{log.studentEmail}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(log.status)}
                          {log.isLate && (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                              {log.daysLate}d late
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Week & Content Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Week {log.weekNumber}</span>
                        <span className="text-muted-foreground text-sm">
                          ({formatDate(log.weekStart)} - {formatDate(log.weekEnd)})
                        </span>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          <strong>Tasks:</strong>{" "}
                          {log.tasksCompleted.slice(0, 2).join(", ")}
                          {log.tasksCompleted.length > 2 && ` +${log.tasksCompleted.length - 2} more`}
                        </p>
                      </div>

                      {log.supervisorFeedback && (
                        <div className="p-2 rounded bg-muted/50 mt-2">
                          <p className="text-sm">
                            <MessageSquare className="h-3 w-3 inline mr-1" />
                            <span className="font-medium">Your Feedback:</span>{" "}
                            {log.supervisorFeedback}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Hours & Actions */}
                    <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                      <div className="text-center px-4 py-2 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{log.hoursWorked || "-"}</p>
                        <p className="text-xs text-muted-foreground">hours</p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setReviewFeedback(log.supervisorFeedback || "");
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {log.status === "submitted" ? "Review" : "View"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <ScrollText className="h-5 w-5" />
                  Week {selectedLog.weekNumber} Log Review
                </DialogTitle>
                <DialogDescription>
                  Reviewing submission from {selectedLog.studentName}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="content" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="content">Log Content</TabsTrigger>
                  <TabsTrigger value="review">Your Review</TabsTrigger>
                </TabsList>

                {/* Log Content Tab */}
                <TabsContent value="content" className="space-y-4 mt-4">
                  {/* Student Header */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={selectedLog.avatarUrl || undefined} alt={selectedLog.studentName} />
                            <AvatarFallback className="bg-primary/10 text-primary text-lg">
                              {selectedLog.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-xl font-semibold">{selectedLog.studentName}</h3>
                            <p className="text-muted-foreground">{selectedLog.studentEmail}</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {getStatusBadge(selectedLog.status)}
                          {selectedLog.isLate && (
                            <p className="text-sm text-yellow-600 mt-1">
                              Submitted {selectedLog.daysLate} days late
                            </p>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Week Number</p>
                          <p className="font-semibold text-lg">Week {selectedLog.weekNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Period</p>
                          <p className="font-semibold">{formatDate(selectedLog.weekStart)} - {formatDate(selectedLog.weekEnd)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Submitted On</p>
                          <p className="font-semibold">
                            {selectedLog.submittedAt 
                              ? new Date(selectedLog.submittedAt).toLocaleDateString()
                              : "Not submitted"
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Hours Worked</p>
                          <p className="font-semibold text-lg">{selectedLog.hoursWorked || 0} hrs</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tasks Completed */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Tasks Completed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedLog.tasksCompleted.map((task, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Challenges, Learnings, Goals */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          Challenges
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {selectedLog.challenges || "No challenges reported"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-500" />
                          Learnings
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {selectedLog.learnings || "No learnings reported"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="h-4 w-4 text-purple-500" />
                          Next Week Goals
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {selectedLog.nextWeekGoals || "No goals specified"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Review Tab */}
                <TabsContent value="review" className="space-y-4 mt-4">
                  {selectedLog.status !== "submitted" && selectedLog.supervisorFeedback && (
                    <Card className="border-green-200 bg-green-50/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-green-800">Previous Review</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(selectedLog.status)}
                          <span className="text-sm text-muted-foreground">
                            Reviewed on {selectedLog.reviewedAt 
                              ? new Date(selectedLog.reviewedAt).toLocaleDateString()
                              : "N/A"
                            }
                          </span>
                        </div>
                        <p className="text-sm bg-white p-3 rounded-lg border">
                          {selectedLog.supervisorFeedback}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedLog.status === "submitted" && (
                    <>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Provide Your Feedback</CardTitle>
                          <CardDescription>
                            Your feedback will be visible to the student
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="feedback">Supervisor Feedback *</Label>
                            <Textarea
                              id="feedback"
                              placeholder="Provide detailed feedback on the student's weekly performance..."
                              value={reviewFeedback}
                              onChange={(e) => setReviewFeedback(e.target.value)}
                              rows={6}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex flex-col sm:flex-row gap-3 justify-end">
                        <Button
                          variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => handleReview("approve")}
                          disabled={isSubmittingReview}
                        >
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => handleReview("request_revision")}
                          disabled={isSubmittingReview || !reviewFeedback.trim()}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Request Revision
                        </Button>
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => handleReview("reject")}
                          disabled={isSubmittingReview || !reviewFeedback.trim()}
                        >
                          <ThumbsDown className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
