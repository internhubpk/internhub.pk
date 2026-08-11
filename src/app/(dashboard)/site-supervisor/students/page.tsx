"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  Download,
  Eye,
  Mail,
  Phone,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  X,
  GraduationCap,
  Building2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  BarChart3,
  UserCheck,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
interface StudentDetail {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  enrollmentNumber?: string | null;
  university?: string;
  department?: string;
  program?: string;
  internshipTitle?: string;
  company?: string;
  status: "active" | "completed" | "on_leave" | "suspended";
  startDate?: string;
  endDate?: string;
  progress: number;
  lastEvaluationDate?: string | null;
  daysSinceEvaluation: number | null;
  performanceRating: "excellent" | "good" | "satisfactory" | "needs_attention" | null;
  overallRating?: number | null;
}

interface WeeklyLogSummary {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  status: "submitted" | "approved" | "rejected" | "pending" | "late";
  hoursLogged: number;
}

interface EvaluationRecord {
  id: string;
  period: string;
  overallRating: number;
  decision: "satisfactory" | "needs_improvement" | "unsatisfactory";
  date: string;
  technicalScore: number;
  professionalScore: number;
  workQualityScore: number;
}

export default function SiteSupervisorStudentsPage() {
  const { user, profile } = useAuth();
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [evaluationFilter, setEvaluationFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Detail view data
  const [studentLogs, setStudentLogs] = useState<WeeklyLogSummary[]>([]);
  const [studentEvaluations, setStudentEvaluations] = useState<EvaluationRecord[]>([]);

  useEffect(() => {
    fetchAssignedStudents();
  }, []);

  async function fetchAssignedStudents() {
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
        // No supervisor record - keep empty state
        setStudents([]);
        setIsLoading(false);
        return;
      }

      // Fetch assigned students
      const { data: assignments } = await supabase
        .from("student_internships")
        .select(`
          id,
          student_id,
          status,
          start_date,
          end_date,
          progress,
          last_evaluation_at,
          student:students(
            id,
            full_name,
            email,
            phone,
            avatar_url,
            enrollment_number
          ),
          internship:internships(
            id,
            title,
            company:companies(name)
          )
        `)
        .eq("site_supervisor_id", supervisor.id)
        .order("updated_at", { ascending: false });

      const studentData = (assignments || []).map((assign: any) => {
        const student = assign.student || {};
        const internship = assign.internship || {};
        const company = internship.company || {};
        const lastEval = assign.last_evaluation_at ? new Date(assign.last_evaluation_at) : null;

        let rating: StudentDetail["performanceRating"] = null;
        if (lastEval) {
          const daysSinceEval = Math.floor((Date.now() - lastEval.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceEval <= 21 && assign.progress >= 75) rating = "excellent";
          else if (daysSinceEval <= 21 && assign.progress >= 50) rating = "good";
          else if (daysSinceEval <= 28) rating = "satisfactory";
          else rating = "needs_attention";
        }

        return {
          id: assign.id,
          studentId: student.id,
          name: student.full_name || `Student ${student.id?.slice(0, 6)}`,
          email: student.email || "",
          phone: student.phone,
          avatarUrl: student.avatar_url,
          enrollmentNumber: student.enrollment_number,
          internshipTitle: internship.title,
          company: company.name,
          status: assign.status || "active",
          startDate: assign.start_date,
          endDate: assign.end_date,
          progress: assign.progress || 0,
          lastEvaluationDate: assign.last_evaluation_at,
          daysSinceEvaluation: lastEval 
            ? Math.floor((Date.now() - lastEval.getTime()) / (1000 * 60 * 60 * 24))
            : null,
          performanceRating: rating,
        };
      });

      setStudents(studentData);
    } catch (error) {
      console.error("Error fetching students:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  // Note: Mock data removed - page shows empty state until real data is available
  // function setMockStudents() has been removed to prevent showing fake data

  async function openStudentDetail(student: StudentDetail) {
    setSelectedStudent(student);
    setShowDetailModal(true);

    // Mock data for detail views
    setStudentLogs([
      { weekNumber: 6, weekStart: "2024-07-08", weekEnd: "2024-07-14", status: "approved", hoursLogged: 38 },
      { weekNumber: 5, weekStart: "2024-07-01", weekEnd: "2024-07-07", status: "approved", hoursLogged: 40 },
      { weekNumber: 4, weekStart: "2024-06-24", weekEnd: "2024-06-30", status: "submitted", hoursLogged: 36 },
      { weekNumber: 3, weekStart: "2024-06-17", weekEnd: "2024-06-23", status: "approved", hoursLogged: 42 },
      { weekNumber: 2, weekStart: "2024-06-10", weekEnd: "2024-06-16", status: "approved", hoursLogged: 39 },
      { weekNumber: 1, weekStart: "2024-06-03", weekEnd: "2024-06-09", status: "approved", hoursLogged: 41 },
    ]);

    setStudentEvaluations([
      {
        id: "e1",
        period: "Week 4-6",
        overallRating: 8.2,
        decision: "satisfactory",
        date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        technicalScore: 8.0,
        professionalScore: 8.5,
        workQualityScore: 8.0,
      },
      {
        id: "e2",
        period: "Week 1-3",
        overallRating: 7.5,
        decision: "satisfactory",
        date: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        technicalScore: 7.5,
        professionalScore: 7.5,
        workQualityScore: 7.5,
      },
    ]);
  }

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.enrollmentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      // Status filter
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;

      // Evaluation due filter
      let matchesEvaluation = true;
      if (evaluationFilter === "due") {
        matchesEvaluation = !student.daysSinceEvaluation || student.daysSinceEvaluation > 18;
      } else if (evaluationFilter === "overdue") {
        matchesEvaluation = (student.daysSinceEvaluation ?? 0) > 21;
      } else if (evaluationFilter === "current") {
        matchesEvaluation = student.daysSinceEvaluation !== null && student.daysSinceEvaluation <= 18;
      }

      return matchesSearch && matchesStatus && matchesEvaluation;
    });
  }, [students, searchQuery, statusFilter, evaluationFilter]);

  function getPerformanceColor(rating: StudentDetail["performanceRating"]) {
    switch (rating) {
      case "excellent": return "text-green-600 bg-green-50 border-green-200";
      case "good": return "text-blue-600 bg-blue-50 border-blue-200";
      case "satisfactory": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "needs_attention": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  }

  function getPerformanceBadge(rating: StudentDetail["performanceRating"]) {
    switch (rating) {
      case "excellent": return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Excellent</Badge>;
      case "good": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Good</Badge>;
      case "satisfactory": return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Satisfactory</Badge>;
      case "needs_attention": return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Needs Attention</Badge>;
      default: return null;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800"><span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5" />Active</Badge>;
      case "completed":
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      case "on_leave":
        return <Badge className="bg-orange-100 text-orange-800">On Leave</Badge>;
      case "suspended":
        return <Badge className="bg-red-100 text-red-800">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function getLogStatusBadge(status: WeeklyLogSummary["status"]) {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "late":
        return <Badge className="bg-orange-100 text-orange-800">Late</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function getDecisionBadge(decision: EvaluationRecord["decision"]) {
    switch (decision) {
      case "satisfactory":
        return <Badge className="bg-green-100 text-green-800">Satisfactory</Badge>;
      case "needs_improvement":
        return <Badge className="bg-yellow-100 text-yellow-800">Needs Improvement</Badge>;
      case "unsatisfactory":
        return <Badge className="bg-red-100 text-red-800">Unsatisfactory</Badge>;
      default:
        return <Badge variant="secondary">{decision}</Badge>;
    }
  }

  function getTrendIcon(current: number, previous: number) {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GraduationCap className="h-8 w-8" />
            Assigned Students
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage interns assigned to your supervision
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export List
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-xs text-muted-foreground">Total Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{students.filter(s => s.status === "active").length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {students.filter(s => (s.daysSinceEvaluation ?? 0) > 18).length}
                </p>
                <p className="text-xs text-muted-foreground">Eval Due Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {students.filter(s => (s.daysSinceEvaluation ?? 0) > 21).length}
                </p>
                <p className="text-xs text-muted-foreground">Overdue</p>
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
                placeholder="Search by name, email, or enrollment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>

            <Select value={evaluationFilter} onValueChange={setEvaluationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <ClipboardList className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Evaluation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="current">Current Eval</SelectItem>
                <SelectItem value="due">Due Soon</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-muted-foreground">Loading students...</span>
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== "all" || evaluationFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "No students have been assigned to you yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredStudents.map((student, index) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${
                  student.performanceRating === "needs_attention" ? 'border-l-4 border-l-red-500' : ''
                }`}
                onClick={() => openStudentDetail(student)}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Student Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="h-14 w-14 shrink-0">
                        <AvatarImage src={student.avatarUrl || undefined} alt={student.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                          {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg truncate">{student.name}</h3>
                          {getStatusBadge(student.status)}
                          {getPerformanceBadge(student.performanceRating)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {student.enrollmentNumber && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {student.enrollmentNumber}
                            </span>
                          )}
                          {student.internshipTitle && (
                            <span className="hidden sm:inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {student.internshipTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress & Metrics */}
                    <div className="flex items-center gap-6 lg:gap-8">
                      <div className="text-center min-w-[80px]">
                        <p className="text-2xl font-bold">{student.progress}%</p>
                        <Progress value={student.progress} className="h-1.5 mt-1 w-full" />
                        <p className="text-xs text-muted-foreground mt-1">Complete</p>
                      </div>

                      <div className={`text-center px-3 py-2 rounded-lg border ${getPerformanceColor(student.performanceRating)} min-w-[120px]`}>
                        <p className="text-xs uppercase tracking-wide opacity-70">Last Eval</p>
                        <p className="font-semibold">
                          {student.daysSinceEvaluation !== null ? `${student.daysSinceEvaluation}d` : "Never"}
                        </p>
                      </div>

                      <div className="text-right hidden md:block">
                        {student.overallRating && (
                          <>
                            <p className="text-xl font-bold text-primary">{student.overallRating.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">Avg Rating</p>
                          </>
                        )}
                      </div>

                      <Button variant="ghost" size="sm" className="shrink-0">
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Student Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedStudent.avatarUrl || undefined} alt={selectedStudent.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {selectedStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {selectedStudent.name}
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {selectedStudent.enrollmentNumber}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Complete intern details and activity history
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="logs">Weekly Logs</TabsTrigger>
                  <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contact Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${selectedStudent.email}`} className="text-sm hover:text-primary">
                            {selectedStudent.email}
                          </a>
                        </div>
                        {selectedStudent.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <a href={`tel:${selectedStudent.phone}`} className="text-sm hover:text-primary">
                              {selectedStudent.phone}
                            </a>
                          </div>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">University</p>
                            <p className="font-medium">{selectedStudent.university || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Department</p>
                            <p className="font-medium">{selectedStudent.department || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Program</p>
                            <p className="font-medium">{selectedStudent.program || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <div>{getStatusBadge(selectedStudent.status)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Internship Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Internship Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Position</p>
                          <p className="font-medium">{selectedStudent.internshipTitle || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Company</p>
                          <p className="font-medium">{selectedStudent.company || "N/A"}</p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Start Date</p>
                            <p className="font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {selectedStudent.startDate ? new Date(selectedStudent.startDate).toLocaleDateString() : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">End Date</p>
                            <p className="font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {selectedStudent.endDate ? new Date(selectedStudent.endDate).toLocaleDateString() : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="pt-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Overall Progress</span>
                            <span className="font-semibold">{selectedStudent.progress}%</span>
                          </div>
                          <Progress value={selectedStudent.progress} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Performance Summary */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Performance Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-3xl font-bold text-primary">
                            {selectedStudent.overallRating?.toFixed(1) || "N/A"}
                          </p>
                          <p className="text-sm text-muted-foreground">Average Rating</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-3xl font-bold text-emerald-600">
                            {studentEvaluations.length}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Evaluations</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-3xl font-bold text-amber-600">
                            {selectedStudent.daysSinceEvaluation ?? "N/A"}
                          </p>
                          <p className="text-sm text-muted-foreground">Days Since Eval</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <div className="mt-1">
                            {getPerformanceBadge(selectedStudent.performanceRating)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">Current Status</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Weekly Logs Tab */}
                <TabsContent value="logs" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Weekly Log History
                      </CardTitle>
                      <CardDescription>
                        Submission and approval status for each week
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {studentLogs.map((log) => (
                          <div
                            key={log.weekNumber}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm">
                                W{log.weekNumber}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  Week of {new Date(log.weekStart).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(log.weekStart).toLocaleDateString()} -{" "}
                                  {new Date(log.weekEnd).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium">{log.hoursLogged} hrs</p>
                                <p className="text-xs text-muted-foreground">Logged</p>
                              </div>
                              {getLogStatusBadge(log.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Summary stats */}
                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {studentLogs.filter(l => l.status === "approved").length}
                          </p>
                          <p className="text-xs text-muted-foreground">Approved</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {studentLogs.reduce((sum, l) => sum + l.hoursLogged, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Hours</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-amber-600">
                            {Math.round(studentLogs.reduce((sum, l) => sum + l.hoursLogged, 0) / studentLogs.length)}
                          </p>
                          <p className="text-xs text-muted-foreground">Avg Hours/Week</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Evaluations Tab */}
                <TabsContent value="evaluations" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Evaluation History
                      </CardTitle>
                      <CardDescription>
                        Performance ratings over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {studentEvaluations.map((eval_, index) => {
                          const prevEval = index < studentEvaluations.length - 1 
                            ? studentEvaluations[index + 1] 
                            : null;
                          
                          return (
                            <div key={eval_.id} className="p-4 rounded-lg border">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold">{eval_.period}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Evaluated on {new Date(eval_.date).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {prevEval && getTrendIcon(eval_.overallRating, prevEval.overallRating)}
                                  <span className="text-2xl font-bold text-primary">
                                    {eval_.overallRating.toFixed(1)}
                                  </span>
                                  {getDecisionBadge(eval_.decision)}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-2 rounded bg-blue-50">
                                  <p className="text-sm text-muted-foreground">Technical</p>
                                  <p className="font-semibold text-blue-700">{eval_.technicalScore.toFixed(1)}</p>
                                </div>
                                <div className="text-center p-2 rounded bg-purple-50">
                                  <p className="text-sm text-muted-foreground">Professional</p>
                                  <p className="font-semibold text-purple-700">{eval_.professionalScore.toFixed(1)}</p>
                                </div>
                                <div className="text-center p-2 rounded bg-green-50">
                                  <p className="text-sm text-muted-foreground">Work Quality</p>
                                  <p className="font-semibold text-green-700">{eval_.workQualityScore.toFixed(1)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {studentEvaluations.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No evaluations recorded yet
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Attendance Record
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-12 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Attendance tracking will be available here</p>
                        <p className="text-sm mt-1">Integration with attendance system coming soon</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Import ClipboardList icon used in JSX
function ClipboardList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M12 11h4"/>
      <path d="M12 16h4"/>
      <path d="M8 11h.01"/>
      <path d="M8 16h.01"/>
    </svg>
  );
}
