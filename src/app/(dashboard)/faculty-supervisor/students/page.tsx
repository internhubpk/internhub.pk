"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Users,
  Search,
  Eye,
  Star,
  MessageSquare,
  CheckCircle2,
  Clock,
  UserCheck,
  GraduationCap,
  Filter,
  Building2,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  Phone,
  MapPin,
  Award,
  ClipboardCheck,
  BarChart3,
  XCircle,
  ArrowRight,
} from "lucide-react";

// Types
interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  university: string;
  program: string;
  major: string;
  semester: number;
  internshipTitle: string;
  company: string;
  companyLocation: string;
  status: "active" | "on_leave" | "completed" | "withdrawn";
  weeklyLogStatus: "submitted" | "pending" | "not_submitted" | "approved";
  overallProgress: number;
  lastActivity: string;
  startDate: string;
  endDate: string;
  avatarUrl?: string;
  supervisorNotes?: string;
}

interface TaskItem {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending" | "overdue";
  dueDate: string;
  completedAt?: string;
  grade?: string;
}

interface Submission {
  id: string;
  type: "weekly_log" | "task" | "document";
  title: string;
  submittedAt: string;
  status: "approved" | "pending" | "rejected" | "revision_required";
  feedback?: string;
  grade?: number;
}

interface EvaluationRecord {
  id: string;
  type: "weekly" | "midterm" | "final";
  date: string;
  score: number;
  maxScore: number;
  status: "completed" | "pending";
  comments?: string;
}

interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  attendanceRate: number;
}

// Default empty data - will be populated from database
const DEFAULT_STUDENTS: Student[] = [];
const DEFAULT_TASKS: Record<string, TaskItem[]> = {};
const DEFAULT_SUBMISSIONS: Record<string, Submission[]> = {};
const DEFAULT_EVALUATIONS: Record<string, EvaluationRecord[]> = {};
const DEFAULT_ATTENDANCE: Record<string, AttendanceSummary> = {};

export default function FacultySupervisorStudentsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>(DEFAULT_STUDENTS);
  const [tasks] = useState<Record<string, TaskItem[]>>(DEFAULT_TASKS);
  const [submissions] = useState<Record<string, Submission[]>>(DEFAULT_SUBMISSIONS);
  const [evaluations] = useState<Record<string, EvaluationRecord[]>>(DEFAULT_EVALUATIONS);
  const [attendance] = useState<Record<string, AttendanceSummary>>(DEFAULT_ATTENDANCE);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [progressFilter, setProgressFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch data from database
  useEffect(() => {
    async function fetchData() {
      if (!user) { setIsLoading(false); return; }
      
      try {
        const supabase = createClient();
        
        // Get supervisor record
        const { data: supervisor } = await supabase
          .from("supervisors")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "faculty")
          .single();

        if (!supervisor) {
          setIsLoading(false);
          return;
        }

        // Fetch supervised students with their internship details
        const { data: studentData } = await supabase
          .from("student_internships")
          .select(`
            id,
            status,
            start_date,
            end_date,
            progress,
            last_activity_at,
            student:students(
              id,
              full_name,
              email,
              phone,
              avatar_url,
              program:programs(name),
              university:universities(name)
            ),
            internship:internships(title, company, location)
          `)
          .eq("faculty_supervisor_id", supervisor.id);

        const studentList: Student[] = (studentData || []).map((s: any) => ({
          id: s.student?.id || s.id,
          name: s.student?.full_name || `Student ${s.id?.slice(0, 6)}`,
          email: s.student?.email || "",
          phone: s.student?.phone,
          university: s.student?.university?.name || "Unknown University",
          program: s.student?.program?.name || "Unknown Program",
          major: "", // Would come from student profile
          semester: 0, // Would come from student profile
          internshipTitle: s.internship?.title || "N/A",
          company: s.internship?.company || "N/A",
          companyLocation: s.internship?.location || "N/A",
          status: s.status || "active",
          weeklyLogStatus: "not_submitted" as Student["weeklyLogStatus"],
          overallProgress: s.progress || 0,
          lastActivity: s.last_activity_at || "",
          startDate: s.start_date || "",
          endDate: s.end_date || "",
          avatarUrl: s.student?.avatar_url,
        }));

        setStudents(studentList);
      } catch (error) {
        console.error("Error fetching student data:", error);
        // Keep empty state on error
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [user]);

  // Get unique programs for filter
  const programs = useMemo(() => {
    return [...new Set(students.map((s) => s.program))];
  }, [students]);

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.major.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || student.status === statusFilter;
      const matchesProgram = programFilter === "all" || student.program === programFilter;

      let matchesProgress = true;
      if (progressFilter === "on_track") matchesProgress = student.overallProgress >= 70;
      else if (progressFilter === "needs_focus") matchesProgress = student.overallProgress >= 40 && student.overallProgress < 70;
      else if (progressFilter === "at_risk") matchesProgress = student.overallProgress < 40;

      return matchesSearch && matchesStatus && matchesProgram && matchesProgress;
    });
  }, [students, searchTerm, statusFilter, programFilter, progressFilter]);

  // Check if a specific student should be opened (from URL param)
  React.useEffect(() => {
    const studentId = searchParams.get("id");
    if (studentId) {
      const student = students.find((s) => s.id === studentId);
      if (student) {
        setSelectedStudent(student);
        setIsDetailOpen(true);
      }
    }
  }, [searchParams, students]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <UserCheck className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "on_leave":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            On Leave
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "withdrawn":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Withdrawn
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLogStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            <Clock className="mr-1 h-3 w-3" />
            Submitted
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <AlertCircle className="mr-1 h-3 w-3" />
            Pending Review
          </Badge>
        );
      case "not_submitted":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Not Submitted
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
            In Progress
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive" className="text-xs">
            Overdue
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="text-xs">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getSubmissionStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="text-xs">
            Rejected
          </Badge>
        );
      case "revision_required":
        return (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
            Revision Required
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getStudentInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 70) return "bg-emerald-500";
    if (progress >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-600";
    if (rate >= 75) return "text-amber-600";
    return "text-red-600";
  };

  // Calculate summary stats
  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === "active").length,
    onLeave: students.filter((s) => s.status === "on_leave").length,
    logsPending: students.filter((s) => s.weeklyLogStatus === "pending" || s.weeklyLogStatus === "not_submitted").length,
    avgProgress: Math.round(students.reduce((acc, s) => acc + s.overallProgress, 0) / students.length),
    onTrack: students.filter((s) => s.overallProgress >= 70).length,
    atRisk: students.filter((s) => s.overallProgress < 40).length,
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Students</h1>
          <p className="text-muted-foreground mt-1">Loading students...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col items-center text-center animate-pulse">
                <div className="h-5 w-5 bg-muted rounded mb-2"></div>
                <div className="h-7 w-12 bg-muted rounded mb-1"></div>
                <div className="h-3 w-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading student data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Students</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and support your assigned interns across programs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <UserCheck className="h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Clock className="h-5 w-5 text-amber-600 mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.logsPending}</p>
            <p className="text-xs text-muted-foreground">Logs Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <TrendingUp className="h-5 w-5 text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{stats.avgProgress}%</p>
            <p className="text-xs text-muted-foreground">Avg Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.onTrack}</p>
            <p className="text-xs text-muted-foreground">On Track</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <AlertCircle className="h-5 w-5 text-red-600 mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.atRisk}</p>
            <p className="text-xs text-muted-foreground">At Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-[200px]">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program} value={program}>
                      {program}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={progressFilter} onValueChange={setProgressFilter}>
                <SelectTrigger className="w-[140px]">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Progress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Progress</SelectItem>
                  <SelectItem value="on_track">On Track (≥70%)</SelectItem>
                  <SelectItem value="needs_focus">Needs Focus (40-69%)</SelectItem>
                  <SelectItem value="at_risk">At Risk (&lt;40%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student List - Mobile Cards / Desktop Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-4">
          {filteredStudents.map((student) => (
            <Card
              key={student.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedStudent(student);
                setIsDetailOpen(true);
              }}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={student.avatarUrl} alt={student.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getStudentInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{student.name}</h3>
                      <p className="text-sm text-muted-foreground">{student.internshipTitle}</p>
                    </div>
                  </div>
                  {getStatusBadge(student.status)}
                </div>

                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {student.company}
                  </span>
                  <span>•</span>
                  <span>{student.major}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">{student.overallProgress}%</span>
                  </div>
                  <Progress value={student.overallProgress} className="h-2" />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  {getLogStatusBadge(student.weeklyLogStatus)}
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Eye className="h-3 w-3" /> Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Internship</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Weekly Log</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => { setSelectedStudent(student); setIsDetailOpen(true); }}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.avatarUrl} alt={student.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getStudentInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{student.major}</p>
                        <p className="text-xs text-muted-foreground">Semester {student.semester}</p>
                      </div>
                    </TableCell>
                    <TableCell>{student.internshipTitle}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{student.company}</p>
                        <p className="text-xs text-muted-foreground">{student.companyLocation}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(student.status)}</TableCell>
                    <TableCell>{getLogStatusBadge(student.weeklyLogStatus)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={student.overallProgress} className="h-2 flex-1" />
                        <span className="text-sm text-muted-foreground w-10 text-right">
                          {student.overallProgress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(student.lastActivity).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedStudent(student);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {filteredStudents.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No students found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Student Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedStudent.avatarUrl} alt={selectedStudent.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getStudentInitials(selectedStudent.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {selectedStudent.name}
                    <p className="text-sm font-normal text-muted-foreground">
                      {selectedStudent.internshipTitle} at {selectedStudent.company}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Program: {selectedStudent.program} • Semester {selectedStudent.semester}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="submissions">Submissions</TabsTrigger>
                  <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{selectedStudent.overallProgress}%</p>
                      <p className="text-xs text-muted-foreground">Overall Progress</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-emerald-600">{selectedStudent.status}</p>
                      <p className="text-xs text-muted-foreground">Status</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-bold text-blue-600">{selectedStudent.university.split(" ")[0]}</p>
                      <p className="text-xs text-muted-foreground">University</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-bold text-purple-600">{selectedStudent.company}</p>
                      <p className="text-xs text-muted-foreground">Company</p>
                    </div>
                  </div>

                  {/* Contact & Internship Info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedStudent.email}</span>
                        </div>
                        {selectedStudent.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedStudent.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedStudent.companyLocation}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Internship Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Position:</span>
                          <span className="font-medium">{selectedStudent.internshipTitle}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Company:</span>
                          <span className="font-medium">{selectedStudent.company}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Start Date:</span>
                          <span className="font-medium">{new Date(selectedStudent.startDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">End Date:</span>
                          <span className="font-medium">{new Date(selectedStudent.endDate).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Progress Bar */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Internship Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Completion</span>
                          <span>{selectedStudent.overallProgress}% Complete</span>
                        </div>
                        <Progress value={selectedStudent.overallProgress} className="h-3" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Started: {new Date(selectedStudent.startDate).toLocaleDateString()}</span>
                          <span>Ends: {new Date(selectedStudent.endDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Supervisor Notes */}
                  {selectedStudent.supervisorNotes && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Supervisor Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm bg-muted/30 p-3 rounded-lg italic">
                          &ldquo;{selectedStudent.supervisorNotes}&rdquo;
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button variant="outline" className="gap-2">
                      <MessageSquare className="h-4 w-4" /> Send Message
                    </Button>
                    <Button variant="secondary" className="gap-2">
                      <Star className="h-4 w-4" /> Evaluate
                    </Button>
                    <Button className="gap-2">
                      <Eye className="h-4 w-4" /> Full Profile
                    </Button>
                  </div>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Current Tasks</CardTitle>
                      <CardDescription>Tasks assigned to this student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(tasks[selectedStudent.id] || []).map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{task.title}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                                {task.completedAt && (
                                  <span className="text-xs text-emerald-600">
                                    Completed: {new Date(task.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                                {task.grade && (
                                  <Badge variant="secondary" className="text-xs">Grade: {task.grade}</Badge>
                                )}
                              </div>
                            </div>
                            {getTaskStatusBadge(task.status)}
                          </div>
                        ))}
                        {(!tasks[selectedStudent.id] || tasks[selectedStudent.id].length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No tasks assigned yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Submissions Tab */}
                <TabsContent value="submissions" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Submission History</CardTitle>
                      <CardDescription>All submissions from this student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(submissions[selectedStudent.id] || []).map((submission) => (
                          <div key={submission.id} className="flex items-start justify-between p-3 rounded-lg border">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{submission.title}</p>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {submission.type.replace("_", " ")}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                                </span>
                                {submission.grade !== undefined && (
                                  <span className="text-xs font-medium text-emerald-600">
                                    Score: {submission.grade}%
                                  </span>
                                )}
                              </div>
                              {submission.feedback && (
                                <p className="text-xs text-muted-foreground mt-2 italic bg-muted/30 p-2 rounded">
                                  &ldquo;{submission.feedback}&rdquo;
                                </p>
                              )}
                            </div>
                            {getSubmissionStatusBadge(submission.status)}
                          </div>
                        ))}
                        {(!submissions[selectedStudent.id] || submissions[selectedStudent.id].length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No submissions yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Evaluations Tab */}
                <TabsContent value="evaluations" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Evaluation History</CardTitle>
                      <CardDescription>Past evaluations for this student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(evaluations[selectedStudent.id] || []).map((evaluation) => (
                          <div key={evaluation.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm capitalize">
                                  {evaluation.type.replace("_", " ")} Evaluation
                                </p>
                                <Badge variant={evaluation.status === "completed" ? "default" : "secondary"} className="text-xs">
                                  {evaluation.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Date: {new Date(evaluation.date).toLocaleDateString()}
                                </span>
                                <span className={`text-xs font-medium ${evaluation.score >= evaluation.maxScore * 0.8 ? 'text-emerald-600' : evaluation.score >= evaluation.maxScore * 0.6 ? 'text-amber-600' : 'text-red-600'}`}>
                                  Score: {evaluation.score}/{evaluation.maxScore}
                                </span>
                              </div>
                              {evaluation.comments && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  &ldquo;{evaluation.comments}&rdquo;
                                </p>
                              )}
                            </div>
                            <div className="ml-4 text-right">
                              <p className="text-2xl font-bold text-primary">
                                {Math.round((evaluation.score / evaluation.maxScore) * 100)}%
                              </p>
                            </div>
                          </div>
                        ))}
                        {(!evaluations[selectedStudent.id] || evaluations[selectedStudent.id].length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No evaluations yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Attendance Summary</CardTitle>
                      <CardDescription>Attendance record during internship</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {attendance[selectedStudent.id] ? (
                        <div className="space-y-4">
                          {/* Overall Attendance Rate */}
                          <div className="text-center p-6 bg-muted/50 rounded-lg">
                            <p className={`text-4xl font-bold ${getAttendanceColor(attendance[selectedStudent.id].attendanceRate)}`}>
                              {attendance[selectedStudent.id].attendanceRate}%
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">Overall Attendance Rate</p>
                          </div>

                          {/* Breakdown */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-emerald-50 rounded-lg">
                              <p className="text-xl font-bold text-emerald-600">
                                {attendance[selectedStudent.id].present}
                              </p>
                              <p className="text-xs text-muted-foreground">Present</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                              <p className="text-xl font-bold text-red-600">
                                {attendance[selectedStudent.id].absent}
                              </p>
                              <p className="text-xs text-muted-foreground">Absent</p>
                            </div>
                            <div className="text-center p-4 bg-amber-50 rounded-lg">
                              <p className="text-xl font-bold text-amber-600">
                                {attendance[selectedStudent.id].late}
                              </p>
                              <p className="text-xs text-muted-foreground">Late</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-xl font-bold text-gray-600">
                                {attendance[selectedStudent.id].leave}
                              </p>
                              <p className="text-xs text-muted-foreground">On Leave</p>
                            </div>
                          </div>

                          {/* Total Days */}
                          <div className="text-center text-sm text-muted-foreground">
                            Total Working Days: {attendance[selectedStudent.id].totalDays}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No attendance data available</p>
                        </div>
                      )}
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
