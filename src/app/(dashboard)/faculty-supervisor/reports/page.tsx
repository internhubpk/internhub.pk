"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
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
  Search,
  Filter,
  Download,
  Save,
  Printer,
  FileText,
  Award,
  BarChart3,
  CalendarDays,
  User,
  Users,
  CheckCircle2,
  Star,
  Eye,
  FileCheck,
  ClipboardList,
  TrendingUp,
  GraduationCap,
  Building2,
  Signature,
  Loader2,
  ChevronRight,
  Clock,
} from "lucide-react";

// Types
interface StudentForReport {
  id: string;
  name: string;
  email: string;
  program: string;
  company: string;
  internshipTitle: string;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "on_leave";
  overallProgress: number;
  finalGrade?: string;
  gpa?: number;
  cgpa?: number;
  studentIdNumber?: string;
}

interface MarksheetEntry {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  tasksCompleted: number;
  tasksTotal: number;
  attendance: number;
  weeklyScore: number;
  maxScore: number;
  remarks: string;
}

interface CertificateData {
  studentName: string;
  programName: string;
  companyName: string;
  internshipTitle: string;
  startDate: string;
  endDate: string;
  finalGrade: string;
  supervisorName: string;
  coordinatorName: string;
  issueDate: string;
  certificateId: string;
}

// Default empty data - will be populated from database
const DEFAULT_STUDENTS: StudentForReport[] = [];
const DEFAULT_MARKSHEET: MarksheetEntry[] = [];

export default function FacultySupervisorReportsPage() {
  const { user, profile } = useAuth();
  // State
  const [students, setStudents] = useState<StudentForReport[]>(DEFAULT_STUDENTS);
  const [marksheet, setMarksheet] = useState<MarksheetEntry[]>(DEFAULT_MARKSHEET);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dialog states
  const [isMarksheetDialogOpen, setIsMarksheetDialogOpen] = useState(false);
  const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentForReport | null>(null);
  
  // Certificate form state
  const [certificateForm, setCertificateForm] = useState({
    coordinatorName: "",
    additionalRemarks: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingCertificate, setIsSavingCertificate] = useState(false);
  const [universityName, setUniversityName] = useState<string>("University");
  const [departmentName, setDepartmentName] = useState<string>("Department");

  // Persist certificate to the `certificates` table via the
  // /api/faculty-supervisor/reports endpoint. The certificate isn't a file
  // upload — we save a metadata row so the student & coordinators can see
  // that it was issued, and the print/PDF remains the actual certificate.
  const handleSaveCertificateToDB = async () => {
    if (!user || !selectedStudent) return;
    setIsSavingCertificate(true);
    try {
      const res = await fetch("/api/faculty-supervisor/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_certificate",
          student_user_id: selectedStudent.id,
          report_data: {
            student_name: selectedStudent.name,
            program_name: selectedStudent.program || "Internship Program",
            company_name: selectedStudent.company || "",
            internship_title: selectedStudent.internshipTitle || "",
            supervisor_name: profile?.full_name || "",
            coordinator_name: certificateForm.coordinatorName || "",
            additional_remarks: certificateForm.additionalRemarks || "",
            issue_date: new Date().toISOString(),
            certificate_id: `CERT-${Date.now()}-${selectedStudent.id.toUpperCase()}`,
          },
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error?.message || `Failed to save certificate (HTTP ${res.status})`);
      }
      // Toast-style feedback (no toast lib here — use alert as a fallback).
      alert("Certificate saved to student's record.");
    } catch (err) {
      console.error("Error saving certificate:", err);
      alert(err instanceof Error ? err.message : "Failed to save certificate.");
    } finally {
      setIsSavingCertificate(false);
    }
  };

  // Fetch data from database
  useEffect(() => {
    async function fetchData() {
      if (!user) { setIsLoading(false); return; }
      
      try {
        const supabase = createClient();

        // Fetch supervised students. faculty_supervisor_id references
        // profiles.user_id (not supervisors.id); student_internships has no FK
        // to `students`, so we join profiles via student_user_id and fetch the
        // `students` rows separately for program/cgpa.
        const { data: studentData } = await supabase
          .from("student_internships")
          .select(`
            id,
            status,
            start_date,
            end_date,
            student_user_id,
            student_profile:student_user_id(full_name, email, avatar_url),
            internship:internships(id, title, location, remote),
            company:company_id(name)
          `)
          .eq("faculty_supervisor_id", user.id);

        const studentUserIds = Array.from(
          new Set((studentData || []).map((s: any) => s.student_user_id))
        );

        // Fetch students-table records (cgpa, program_id) for these users.
        let recordByUser = new Map<string, any>();
        let programMap: Record<string, string> = {};
        if (studentUserIds.length > 0) {
          const { data: records } = await supabase
            .from("students")
            .select("user_id, cgpa, student_id_number, program_id")
            .in("user_id", studentUserIds);
          (records || []).forEach((r: any) => recordByUser.set(r.user_id, r));
          const programIds = Array.from(
            new Set((records || []).map((r: any) => r.program_id).filter(Boolean))
          );
          if (programIds.length > 0) {
            const { data: programs } = await supabase
              .from("programs")
              .select("id, name")
              .in("id", programIds);
            (programs || []).forEach((p: any) => {
              programMap[p.id] = p.name;
            });
          }
        }

        // Compute progress from weekly_logs (approved / total).
        let logsByStudent = new Map<string, { approved: number; total: number }>();
        if (studentUserIds.length > 0) {
          const { data: logs } = await supabase
            .from("weekly_logs")
            .select("student_user_id, status")
            .in("student_user_id", studentUserIds);
          (logs || []).forEach((log: any) => {
            const cur = logsByStudent.get(log.student_user_id) || { approved: 0, total: 0 };
            cur.total += 1;
            if (log.status === "approved") cur.approved += 1;
            logsByStudent.set(log.student_user_id, cur);
          });
        }

        const studentList: StudentForReport[] = (studentData || []).map((s: any) => {
          const meta = logsByStudent.get(s.student_user_id) || { approved: 0, total: 0 };
          const progress = meta.total > 0 ? Math.round((meta.approved / meta.total) * 100) : 0;
          const record = recordByUser.get(s.student_user_id);
          const programName = record?.program_id ? programMap[record.program_id] || "Unknown Program" : "Unknown Program";
          return {
            id: s.student_user_id || s.id,
            name: s.student_profile?.full_name || `Student ${s.student_user_id?.slice(0, 6)}`,
            email: s.student_profile?.email || "",
            program: programName,
            company: s.company?.name || "N/A",
            internshipTitle: s.internship?.title || "N/A",
            startDate: s.start_date || "",
            endDate: s.end_date || "",
            status: s.status === "active" ? "active" : s.status === "completed" ? "completed" : "on_leave",
            overallProgress: progress,
            gpa: record?.cgpa ? Number(record.cgpa) : undefined,
            cgpa: record?.cgpa ? Number(record.cgpa) : undefined,
            studentIdNumber: record?.student_id_number,
          };
        });

        setStudents(studentList);

        // Fetch the supervisor's university and department names so the
        // certificate template uses real values instead of hardcoded "STATE
        // UNIVERSITY" / "Department of Computer Science".
        if (profile?.university_id) {
          const { data: uni } = await supabase
            .from("universities")
            .select("name")
            .eq("id", profile.university_id)
            .maybeSingle();
          if (uni?.name) setUniversityName(uni.name);
        }
        if (profile?.department_id) {
          const { data: dept } = await supabase
            .from("departments")
            .select("name")
            .eq("id", profile.department_id)
            .maybeSingle();
          if (dept?.name) setDepartmentName(dept.name);
        }
      } catch (error) {
        console.error("Error fetching report data:", error);
        // Keep empty state on error
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [user, profile]);

  // Fetch marksheet data when a student is selected.
  useEffect(() => {
    if (!user || !selectedStudent) return;
    const studentUserId = selectedStudent.id;
    const supervisorUserId = user.id;

    async function fetchMarksheet() {
      try {
        const supabase = createClient();
        const [logsRes, evalsRes, attRes] = await Promise.all([
          supabase
            .from("weekly_logs")
            .select(`
              id,
              week_number,
              week_start_date,
              week_end_date,
              status,
              supervisor_feedback,
              hours_worked,
              tasks_completed
            `)
            .eq("student_user_id", studentUserId)
            .order("week_start_date", { ascending: true }),
          supabase
            .from("evaluations")
            .select("id, type, status, scores, comments, rating, created_at")
            .eq("student_user_id", studentUserId)
            .eq("evaluator_id", supervisorUserId)
            .order("created_at", { ascending: true }),
          supabase
            .from("attendance")
            .select("id, date, status")
            .eq("student_user_id", studentUserId),
        ]);

        const logs = logsRes.data || [];
        const evals = evalsRes.data || [];
        const att = attRes.data || [];

        // Build weekly marksheet rows from weekly_logs.
        const rows: MarksheetEntry[] = logs.map((log: any) => {
          const tasksList = Array.isArray(log.tasks_completed) ? log.tasks_completed : [];
          // Attendance for this week (date between week_start_date and week_end_date).
          const ws = log.week_start_date ? new Date(log.week_start_date) : null;
          const we = log.week_end_date ? new Date(log.week_end_date) : null;
          const weekAtt = att.filter((a: any) => {
            const d = new Date(a.date);
            return (!ws || d >= ws) && (!we || d <= we);
          });
          const presentCount = weekAtt.filter((a: any) => a.status === "present" || a.status === "late" || a.status === "half_day").length;
          const weekAttPct = weekAtt.length > 0 ? Math.round((presentCount / weekAtt.length) * 100) : 0;
          // Weekly score from any evaluation created during this week.
          const weekEval = evals.find((e: any) => {
            const ed = new Date(e.created_at);
            return ws && we && ed >= ws && ed <= we;
          });
          let weeklyScore = 0;
          let maxScore = 10;
          if (weekEval && weekEval.scores && typeof weekEval.scores === "object") {
            const vals = Object.values(weekEval.scores).filter((v): v is number => typeof v === "number");
            weeklyScore = vals.reduce((acc, v) => acc + v, 0);
            maxScore = vals.length * 10 || 10;
          }
          return {
            weekNumber: log.week_number || 0,
            weekStart: log.week_start_date || "",
            weekEnd: log.week_end_date || "",
            tasksCompleted: tasksList.length,
            tasksTotal: tasksList.length,
            attendance: weekAttPct,
            weeklyScore,
            maxScore,
            remarks: log.supervisor_feedback || "",
          };
        });
        setMarksheet(rows);
      } catch (error) {
        console.error("Error fetching marksheet:", error);
        setMarksheet([]);
      }
    }

    fetchMarksheet();
  }, [user, selectedStudent]);

  // Ref for printing
  const certificateRef = useRef<HTMLDivElement>(null);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.company.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, statusFilter]);

  // Stats
  const stats = {
    totalStudents: students.length,
    completedInternships: students.filter(s => s.status === "completed").length,
    activeInternships: students.filter(s => s.status === "active").length,
    avgProgress: students.length > 0 ? Math.round(students.reduce((acc, s) => acc + s.overallProgress, 0) / students.length) : 0,
    avgGpa: students.length > 0 ? (students.reduce((acc, s) => acc + (s.gpa || 0), 0) / students.length).toFixed(2) : "0.00",
  };

  const getGradeBadge = (grade?: string) => {
    if (!grade) return <Badge variant="secondary">In Progress</Badge>;
    
    switch (grade) {
      case "A":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">A - Excellent</Badge>;
      case "B+":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-bold">B+ - Very Good</Badge>;
      case "B":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-bold">B - Good</Badge>;
      case "C+":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold">C+ - Satisfactory</Badge>;
      case "C":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold">C - Acceptable</Badge>;
      default:
        return <Badge variant="outline">{grade}</Badge>;
    }
  };

  const getStudentInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateFinalScore = () => {
    if (marksheet.length === 0) return 0;
    const totalScore = marksheet.reduce((acc, entry) => acc + entry.weeklyScore, 0);
    const maxPossible = marksheet.reduce((acc, entry) => acc + entry.maxScore, 0);
    return Math.round((totalScore / maxPossible) * 100);
  };

  const getLetterGrade = (percentage: number) => {
    if (percentage >= 93) return "A";
    if (percentage >= 87) return "B+";
    if (percentage >= 80) return "B";
    if (percentage >= 73) return "C+";
    if (percentage >= 70) return "C";
    if (percentage >= 67) return "D+";
    if (percentage >= 60) return "D";
    return "F";
  };

  const openMarksheetDialog = (student: StudentForReport) => {
    setSelectedStudent(student);
    setIsMarksheetDialogOpen(true);
  };

  const openCertificateDialog = (student: StudentForReport) => {
    setSelectedStudent(student);
    setCertificateForm({
      coordinatorName: "",
      additionalRemarks: "",
    });
    setIsCertificateDialogOpen(true);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    // Use the browser print dialog (user can choose “Save as PDF”).
    // A real PDF library (jsPDF / pdfmake) isn't installed in this project,
    // and a setTimeout no-op would just mislead the user.
    setIsGenerating(true);
    try {
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  // Certificate Template Component
  const CertificateTemplate = ({ data }: { data: CertificateData }) => (
    <div 
      ref={certificateRef}
      className="bg-white p-12 border-2 border-gray-300 rounded-lg shadow-lg max-w-[800px] mx-auto print:shadow-none print:border-black"
      style={{ fontFamily: "'Times New Roman', serif" }}
    >
      {/* University Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{universityName}</h1>
            <p className="text-sm text-gray-600">{departmentName}</p>
            <p className="text-xs text-gray-500">Internship Completion Certificate</p>
          </div>
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Award className="h-10 w-10 text-primary" />
          </div>
        </div>
        
        {/* Decorative line */}
        <div className="border-t-2 border-b-2 border-primary py-2 mt-4 mb-6">
          <h2 className="text-xl font-semibold tracking-widest uppercase">
            Internship Completion Certificate
          </h2>
        </div>
      </div>

      {/* Certificate Body */}
      <div className="space-y-6 text-center">
        <p className="text-lg leading-relaxed">
          This is to certify that
        </p>
        
        <div className="py-2">
          <span className="text-2xl font-bold text-primary underline decoration-2 underline-offset-4">
            {data.studentName}
          </span>
        </div>

        <p className="text-base leading-relaxed">
          has successfully completed the requirements for the<br />
          <span className="font-semibold">{data.programName}</span> program<br />
          and has satisfactorily completed their internship at
        </p>

        <div className="py-2">
          <span className="text-xl font-bold text-primary">
            {data.companyName}
          </span>
        </div>

        <p className="text-sm text-gray-600">
          Position: {data.internshipTitle}
        </p>

        {/* Duration Box */}
        <div className="inline-block bg-muted/50 px-8 py-4 rounded-lg my-4">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Duration</p>
          <p className="text-lg font-semibold">
            {formatDate(data.startDate)} — {formatDate(data.endDate)}
          </p>
        </div>

        {/* Final Grade */}
        <div className="flex items-center justify-center gap-4 my-6">
          <span className="text-lg">Final Grade:</span>
          <span className={`text-3xl font-bold px-6 py-2 rounded-lg ${
            data.finalGrade === 'A' ? 'bg-emerald-100 text-emerald-700' :
            data.finalGrade?.includes('B') ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {data.finalGrade}
          </span>
        </div>

        {/* Performance Summary */}
        <div className="grid grid-cols-3 gap-4 my-6 text-sm">
          <div className="p-3 bg-muted/30 rounded">
            <p className="font-semibold">Attendance</p>
            <p className="text-lg font-bold text-emerald-600">{(() => {
              const total = marksheet.reduce((acc, e) => acc + (e.attendance > 0 ? 1 : 0), 0);
              const sum = marksheet.reduce((acc, e) => acc + e.attendance, 0);
              return total > 0 ? Math.round(sum / total) : 0;
            })()}%</p>
          </div>
          <div className="p-3 bg-muted/30 rounded">
            <p className="font-semibold">Overall Score</p>
            <p className="text-lg font-bold text-blue-600">{calculateFinalScore()}%</p>
          </div>
          <div className="p-3 bg-muted/30 rounded">
            <p className="font-semibold">GPA</p>
            <p className="text-lg font-bold text-purple-600">{selectedStudent?.gpa || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Signatures Section */}
      <div className="mt-12 grid grid-cols-2 gap-8">
        {/* Supervisor Signature */}
        <div className="text-center">
          <div className="border-b-2 border-gray-400 pb-1 mb-2 min-h-[60px] flex items-end justify-center">
            <span className="font-script text-2xl italic text-gray-600">{data.supervisorName}</span>
          </div>
          <p className="font-semibold">Program Supervisor</p>
          <p className="text-xs text-gray-500">Signature & Date</p>
        </div>

        {/* Coordinator Signature */}
        <div className="text-center">
          <div className="border-b-2 border-gray-400 pb-1 mb-2 min-h-[60px] flex items-end justify-center">
            {data.coordinatorName ? (
              <span className="font-script text-2xl italic text-gray-600">{data.coordinatorName}</span>
            ) : (
              <span className="text-gray-400 italic">_____________________</span>
            )}
          </div>
          <p className="font-semibold">Department Coordinator</p>
          <p className="text-xs text-gray-500">Signature & Date</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
        <p>Certificate ID: {data.certificateId}</p>
        <p>Issue Date: {formatDate(data.issueDate)}</p>
        <p className="mt-2 text-gray-400">
          This certificate is issued electronically and can be verified at university.edu.pk/verify
        </p>
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reports & Certificates</h1>
          <p className="text-muted-foreground mt-1">Loading reports...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Skeleton className="h-5 w-5 mb-2" />
                <Skeleton className="h-7 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Reports & Certificates"
        description="Generate marksheets, certificates, and progress reports"
        actions={
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export All Data
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Students" value={stats.totalStudents} icon={Users} variant="default" />
        <StatCard label="Completed" value={stats.completedInternships} icon={CheckCircle2} variant="success" />
        <StatCard label="In Progress" value={stats.activeInternships} icon={TrendingUp} variant="info" />
        <StatCard label="Avg Progress" value={`${stats.avgProgress}%`} icon={BarChart3} variant="default" />
        <StatCard label="Avg GPA" value={stats.avgGpa} icon={Star} variant="warning" />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="marksheets" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="marksheets" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Marksheets
          </TabsTrigger>
          <TabsTrigger value="certificates" className="gap-2">
            <Award className="h-4 w-4" /> Certificates
          </TabsTrigger>
        </TabsList>

        {/* Marksheets Tab */}
        <TabsContent value="marksheets" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Students List with Report Actions */}
          <div className="space-y-4">
            {filteredStudents.map((student) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col lg:flex-row gap-4">
                      {/* Student Info */}
                      <div className="flex items-center gap-3 lg:w-[320px] shrink-0">
                        <Avatar className="h-14 w-14">
                          <AvatarFallback className="bg-primary/10 text-primary text-lg">
                            {getStudentInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-lg">{student.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{student.program}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <StatusBadge status={student.status} />
                            {getGradeBadge(student.finalGrade)}
                          </div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <Building2 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-sm font-medium truncate">{student.company}</p>
                          <p className="text-xs text-muted-foreground">Company</p>
                        </div>
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <CalendarDays className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-sm font-medium">{formatDate(student.startDate)}</p>
                          <p className="text-xs text-muted-foreground">Start Date</p>
                        </div>
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <BarChart3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-lg font-bold text-primary">{student.overallProgress}%</p>
                          <p className="text-xs text-muted-foreground">Progress</p>
                        </div>
                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                          <Star className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                          <p className="text-lg font-bold text-amber-600">{student.gpa || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">GPA</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="lg:w-[220px] shrink-0 flex flex-col gap-2 justify-center">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 w-full"
                          onClick={() => openMarksheetDialog(student)}
                        >
                          <FileText className="h-4 w-4" /> View Marksheet
                        </Button>
                        <Button 
                          size="sm" 
                          className="gap-2 w-full"
                          onClick={() => openCertificateDialog(student)}
                          disabled={student.status !== "completed"}
                        >
                          <Award className="h-4 w-4" /> Generate Certificate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {filteredStudents.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No students found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filter criteria.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Certificates Tab */}
        <TabsContent value="certificates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Certificates Ready for Generation</CardTitle>
              <CardDescription>
                Students who have completed their internships are eligible for certificates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {students.filter(s => s.status === "completed").map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Award className="h-8 w-8 text-amber-500" />
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.internshipTitle} at {student.company}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getGradeBadge(student.finalGrade)}
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => openCertificateDialog(student)}
                      >
                        <Award className="h-4 w-4" /> Generate
                      </Button>
                    </div>
                  </div>
                ))}
                
                {students.filter(s => s.status === "completed").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No completed internships yet.</p>
                    <p className="text-sm">Certificates will be available once students complete their internships.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Marksheet View Dialog */}
      <Dialog open={isMarksheetDialogOpen} onOpenChange={setIsMarksheetDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <ClipboardList className="h-6 w-6" />
                  Evaluation Marksheet - {selectedStudent.name}
                </DialogTitle>
                <DialogDescription>
                  Weekly evaluation record for {selectedStudent.internshipTitle} at {selectedStudent.company}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Student Info Header */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarFallback className="bg-primary/10 text-primary text-xl">
                            {getStudentInitials(selectedStudent.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                          <p className="text-muted-foreground">{selectedStudent.program}</p>
                          <p className="text-sm">{selectedStudent.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground">Company</p>
                          <p className="font-medium">{selectedStudent.company}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium">{formatDate(selectedStudent.startDate)} — {formatDate(selectedStudent.endDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Final Score</p>
                          <p className="text-2xl font-bold text-primary">{calculateFinalScore()}%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly Evaluation Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Weekly Evaluation Record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Week</TableHead>
                            <TableHead>Date Range</TableHead>
                            <TableHead className="text-center">Tasks</TableHead>
                            <TableHead className="text-center">Attendance</TableHead>
                            <TableHead className="text-center">Score</TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marksheet.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No marksheet data available for this student yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            marksheet.map((entry) => (
                            <TableRow key={entry.weekNumber}>
                              <TableCell className="font-medium">{entry.weekNumber}</TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {formatDate(entry.weekStart)} — {formatDate(entry.weekEnd)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`${entry.tasksCompleted === entry.tasksTotal ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {entry.tasksCompleted}/{entry.tasksTotal}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`${entry.attendance >= 95 ? 'text-emerald-600' : entry.attendance >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {entry.attendance}%
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={
                                  entry.weeklyScore >= entry.maxScore * 0.9 ? "default" :
                                  entry.weeklyScore >= entry.maxScore * 0.7 ? "secondary" : "destructive"
                                }>
                                  {entry.weeklyScore}/{entry.maxScore}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <span className="text-sm text-muted-foreground line-clamp-1">
                                  {entry.remarks}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-primary">{calculateFinalScore()}%</p>
                      <p className="text-sm text-muted-foreground">Overall Score</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-emerald-600">{getLetterGrade(calculateFinalScore())}</p>
                      <p className="text-sm text-muted-foreground">Letter Grade</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-blue-600">{(() => {
                        const total = marksheet.reduce((acc, e) => acc + (e.attendance > 0 ? 1 : 0), 0);
                        const sum = marksheet.reduce((acc, e) => acc + e.attendance, 0);
                        return total > 0 ? Math.round(sum / total) : 0;
                      })()}%</p>
                      <p className="text-sm text-muted-foreground">Avg Attendance</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-purple-600">{selectedStudent?.cgpa || selectedStudent?.gpa || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">CGPA</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Print Marksheet
                  </Button>
                  <Button className="gap-2">
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="gap-2"
                    onClick={() => openCertificateDialog(selectedStudent)}
                  >
                    <Award className="h-4 w-4" /> Generate Certificate
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsMarksheetDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Certificate Generation Dialog */}
      <Dialog open={isCertificateDialogOpen} onOpenChange={setIsCertificateDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Award className="h-6 w-6" />
                  Generate Certificate - {selectedStudent.name}
                </DialogTitle>
                <DialogDescription>
                  Preview and customize the completion certificate.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="preview" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="customize">Customize</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-4">
                  <CertificateTemplate
                    data={{
                      studentName: selectedStudent.name,
                      programName: selectedStudent.program,
                      companyName: selectedStudent.company,
                      internshipTitle: selectedStudent.internshipTitle,
                      startDate: selectedStudent.startDate,
                      endDate: selectedStudent.endDate,
                      finalGrade: selectedStudent.finalGrade || getLetterGrade(calculateFinalScore()),
                      supervisorName: profile?.full_name || "Supervisor",
                      coordinatorName: certificateForm.coordinatorName || "Pending",
                      issueDate: new Date().toISOString(),
                      certificateId: `CERT-${Date.now()}-${selectedStudent.id.toUpperCase()}`,
                    }}
                  />

                  <div className="flex flex-wrap justify-center gap-4 mt-6 print:hidden">
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      onClick={handlePrintCertificate}
                    >
                      <Printer className="h-5 w-5" /> Print Certificate
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      onClick={handleSaveCertificateToDB}
                      disabled={isSavingCertificate}
                    >
                      {isSavingCertificate ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Save className="h-5 w-5" />
                      )}
                      Save to Student Record
                    </Button>
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={handleDownloadPDF}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Download className="h-5 w-5" />
                      )}
                      Download PDF
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="customize" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Certificate Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="coordinatorName">Coordinator Name</Label>
                        <Input
                          id="coordinatorName"
                          placeholder="Enter department coordinator's name..."
                          value={certificateForm.coordinatorName}
                          onChange={(e) => setCertificateForm(prev => ({ ...prev, coordinatorName: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          This will appear as the second signature on the certificate.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="additionalRemarks">Additional Remarks (Optional)</Label>
                        <Textarea
                          id="additionalRemarks"
                          placeholder="Any additional notes or special recognition..."
                          value={certificateForm.additionalRemarks}
                          onChange={(e) => setCertificateForm(prev => ({ ...prev, additionalRemarks: e.target.value }))}
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Supervisor Name</Label>
                          <Input value={profile?.full_name || ""} disabled />
                          <p className="text-xs text-muted-foreground">Auto-filled from your profile</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Issue Date</Label>
                          <Input 
                            type="date" 
                            defaultValue={new Date().toISOString().split('T')[0]} 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => (document.querySelector('[value="preview"]') as HTMLElement | null)?.click()}
                    >
                      Preview Changes
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="print:hidden">
                <Button variant="outline" onClick={() => setIsCertificateDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// (Clock is now imported in the main import block above)
