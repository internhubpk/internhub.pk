"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import {
  Users,
  Briefcase,
  TrendingUp,
  GraduationCap,
  Building2,
  FileText,
  Download,
  Search,
  Filter,
  UserCheck,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Eye,
  Plus,
  RefreshCw,
  PieChart,
  Activity,
  BookOpen,
  Bell,
  MessageSquare,
  StickyNote,
  PenTool,
  Target,
  Award,
  Zap,
} from "lucide-react";

// Mock data
const departmentInfo = {
  name: "Department of Computer Science",
  code: "CS",
  head: "Dr. Jane Smith",
  totalStudents: 156,
  activeInternships: 42,
  completionRate: 87.5,
  facultyCount: 12,
};

const mockDepartmentStudents = [
  {
    id: "s1",
    name: "Sarah Johnson",
    email: "sarah.j@university.edu",
    program: "B.Sc. Computer Science",
    semester: 6,
    cgpa: 3.8,
    internshipStatus: "active" as const,
    company: "TechCorp Inc.",
    progress: 75,
    initials: "SJ",
  },
  {
    id: "s2",
    name: "Michael Chen",
    email: "michael.c@university.edu",
    program: "B.Sc. Information Technology",
    semester: 5,
    cgpa: 3.6,
    internshipStatus: "active" as const,
    company: "Global Systems LLC",
    progress: 60,
    initials: "MC",
  },
  {
    id: "s3",
    name: "Emily Rodriguez",
    email: "emily.r@university.edu",
    program: "M.Sc. Data Science",
    semester: 4,
    cgpa: 3.9,
    internshipStatus: "active" as const,
    company: "DataDriven Co.",
    progress: 90,
    initials: "ER",
  },
  {
    id: "s4",
    name: "James Wilson",
    email: "james.w@university.edu",
    program: "B.Sc. Computer Science",
    semester: 7,
    cgpa: 3.2,
    internshipStatus: "pending" as const,
    company: null,
    progress: 0,
    initials: "JW",
  },
  {
    id: "s5",
    name: "Aisha Patel",
    email: "aisha.p@university.edu",
    program: "B.Sc. Cybersecurity",
    semester: 5,
    cgpa: 3.7,
    internshipStatus: "active" as const,
    company: "SecureNet Solutions",
    progress: 30,
    initials: "AP",
  },
  {
    id: "s6",
    name: "David Kim",
    email: "david.k@university.edu",
    program: "B.Sc. Software Engineering",
    semester: 8,
    cgpa: 3.4,
    internshipStatus: "completed" as const,
    company: "WebStudio Pro",
    progress: 100,
    initials: "DK",
  },
];

const mockDepartmentInternships = [
  {
    id: "i1",
    title: "Software Engineering Intern",
    company: "TechCorp Inc.",
    studentName: "Sarah Johnson",
    status: "active" as const,
    startDate: "2024-01-02",
    endDate: "2024-04-15",
    progress: 75,
    program: "Computer Science",
  },
  {
    id: "i2",
    title: "IT Support Specialist",
    company: "Global Systems LLC",
    studentName: "Michael Chen",
    status: "active" as const,
    startDate: "2024-01-08",
    endDate: "2024-04-22",
    progress: 60,
    program: "Information Technology",
  },
  {
    id: "i3",
    title: "Data Analyst Intern",
    company: "DataDriven Co.",
    studentName: "Emily Rodriguez",
    status: "active" as const,
    startDate: "2023-12-01",
    endDate: "2024-03-15",
    progress: 90,
    program: "Data Science",
  },
  {
    id: "i4",
    title: "Security Analyst Intern",
    company: "SecureNet Solutions",
    studentName: "Aisha Patel",
    status: "active" as const,
    startDate: "2024-01-10",
    endDate: "2024-04-25",
    progress: 30,
    program: "Cybersecurity",
  },
  {
    id: "i5",
    title: "Frontend Developer Intern",
    company: "WebStudio Pro",
    studentName: "David Kim",
    status: "completed" as const,
    startDate: "2023-09-01",
    endDate: "2023-12-20",
    progress: 100,
    program: "Software Engineering",
  },
];

const mockFacultySupervisors = [
  {
    id: "f1",
    name: "Dr. John Anderson",
    specialization: "Software Engineering",
    assignedStudents: 8,
    maxCapacity: 10,
    status: "active" as const,
    initials: "JA",
  },
  {
    id: "f2",
    name: "Prof. Maria Garcia",
    specialization: "Data Science & AI",
    assignedStudents: 6,
    maxCapacity: 10,
    status: "active" as const,
    initials: "MG",
  },
  {
    id: "f3",
    name: "Dr. Robert Lee",
    specialization: "Cybersecurity",
    assignedStudents: 10,
    maxCapacity: 10,
    status: "full" as const,
    initials: "RL",
  },
  {
    id: "f4",
    name: "Dr. Sarah Williams",
    specialization: "Web Technologies",
    assignedStudents: 5,
    maxCapacity: 10,
    status: "active" as const,
    initials: "SW",
  },
  {
    id: "f5",
    name: "Prof. Ahmed Hassan",
    specialization: "Database Systems",
    assignedStudents: 9,
    maxCapacity: 10,
    status: "active" as const,
    initials: "AH",
  },
];

const mockReports = [
  {
    id: "r1",
    title: "Q4 2023 Department Summary",
    type: "quarterly" as const,
    generatedAt: "2024-01-01T00:00:00Z",
    size: "2.4 MB",
    format: "PDF",
  },
  {
    id: "r2",
    title: "Internship Completion Report - Fall 2023",
    type: "semester" as const,
    generatedAt: "2023-12-20T00:00:00Z",
    size: "1.8 MB",
    format: "PDF",
  },
  {
    id: "r3",
    title: "Student Performance Analytics - December",
    type: "monthly" as const,
    generatedAt: "2024-01-05T00:00:00Z",
    size: "956 KB",
    format: "Excel",
  },
];

// Completion rates by program
const completionRatesByProgram = [
  { program: "Computer Science", total: 45, completed: 40, rate: 88.9 },
  { program: "Information Technology", total: 38, completed: 33, rate: 86.8 },
  { program: "Data Science", total: 25, completed: 23, rate: 92.0 },
  { program: "Cybersecurity", total: 28, completed: 24, rate: 85.7 },
  { program: "Software Engineering", total: 20, completed: 19, rate: 95.0 },
];

// Coordination memos/notes
const coordinationMemos = [
  {
    id: "m1",
    title: "Spring 2025 Internship Registration Deadline",
    content: "All students must complete their internship registration by February 15th, 2025. Late registrations will require special approval.",
    date: "2025-01-20",
    priority: "high" as const,
    author: "Department Head",
  },
  {
    id: "m2",
    title: "New Industry Partnership Opportunity",
    content: "InnovateTech Inc. has expressed interest in partnering with our department for a new AI/ML internship track. Meeting scheduled for next week.",
    date: "2025-01-18",
    priority: "medium" as const,
    author: "Industry Liaison",
  },
  {
    id: "m3",
    title: "Faculty Workshop: Evaluation Guidelines Update",
    content: "Reminder about the upcoming workshop on updated evaluation guidelines for Spring semester. All faculty supervisors are expected to attend.",
    date: "2025-01-15",
    priority: "low" as const,
    author: "Academic Coordinator",
  },
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
    pending: { label: "Pending", className: "badge-warning" },
    completed: { label: "Completed", className: "badge-primary" },
    full: { label: "Full Capacity", className: "badge-danger" },
  };

  const item = config[status] || { label: status, className: "badge-secondary" };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string }> = {
    high: { label: "High", className: "badge-danger" },
    medium: { label: "Medium", className: "badge-warning" },
    low: { label: "Low", className: "badge-info" },
  };
  
  const item = config[priority] || { label: priority, className: "badge-secondary" };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}

export default function DepartmentCoordinatorDashboard() {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewMemoDialog, setShowNewMemoDialog] = useState(false);

  // Filter students based on search and status
  const filteredStudents = mockDepartmentStudents.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.program.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus =
      statusFilter === "all" || student.internshipStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleExportReport = useCallback((format: "pdf" | "excel") => {
    console.log(`Exporting report in ${format} format`);
  }, []);

  return (
    <div className="space-y-6 page-container">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dashboard-card bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-yellow-500/5 border-chart-2/20"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-h2 font-bold text-foreground">{departmentInfo.name}</h1>
            <p className="text-body text-muted-foreground mt-1 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Headed by {departmentInfo.head}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-small text-muted-foreground">Code: {departmentInfo.code}</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="badge badge-success">Accredited</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowNewMemoDialog(true)} className="focus-ring">
              <StickyNote className="mr-2 h-4 w-4" />
              New Memo
            </Button>
            <Button size="sm" className="focus-ring">
              <Download className="mr-2 h-4 w-4" />
              Export All Data
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Department Overview Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { 
            title: "Total Students", 
            value: departmentInfo.totalStudents, 
            icon: GraduationCap, 
            color: "bg-primary/10 text-primary",
            subtitle: `${departmentInfo.activeInternships} on internship`
          },
          { 
            title: "Active Internships", 
            value: departmentInfo.activeInternships, 
            icon: Briefcase, 
            color: "bg-success/10 text-success",
            subtitle: "Currently ongoing"
          },
          { 
            title: "Completion Rate", 
            value: `${departmentInfo.completionRate}%`, 
            icon: TrendingUp, 
            color: "bg-chart-2/10 text-chart-2",
            subtitle: "Above target"
          },
          { 
            title: "Faculty Supervisors", 
            value: departmentInfo.facultyCount, 
            icon: Users, 
            color: "bg-warning/10 text-warning",
            subtitle: "Active supervisors"
          },
        ].map((stat) => (
          <motion.div key={stat.title} variants={itemVariants} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className={`stat-card-icon ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <p className="dashboard-card-value text-2xl">{stat.value}</p>
            <p className="dashboard-card-title">{stat.title}</p>
            <p className="dashboard-card-description">{stat.subtitle}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 hidden sm:inline" />
            Students
          </TabsTrigger>
          <TabsTrigger value="internships" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 hidden sm:inline" />
            Internships
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4 hidden sm:inline" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="faculty" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden sm:inline" />
            Faculty
          </TabsTrigger>
          <TabsTrigger value="memos" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 hidden sm:inline" />
            Memos
          </TabsTrigger>
        </TabsList>

        {/* Students Tab with Performance Summary */}
        <TabsContent value="students" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Department Students</h2>
              <p className="text-small text-muted-foreground mt-1">{filteredStudents.length} students found</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 form-input"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] form-input">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="data-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>CGPA</TableHead>
                  <TableHead>Internship Status</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-chart-2 text-white text-xs font-medium">
                            {student.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-caption text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{student.program}</span>
                      <br />
                      <span className="text-caption text-muted-foreground">Sem {student.semester}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${
                        student.cgpa >= 3.7 ? "text-success" :
                        student.cgpa >= 3.0 ? "text-warning" : "text-danger"
                      }`}>
                        {student.cgpa.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={student.internshipStatus} />
                    </TableCell>
                    <TableCell>
                      {student.company || (
                        <span className="text-caption text-muted-foreground">Not placed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="w-24 space-y-1">
                        <Progress value={student.progress} className="h-2" />
                        <span className="text-caption text-muted-foreground">{student.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStudent(student.id)}
                        className="focus-ring"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredStudents.length === 0 && (
            <div className="dashboard-card text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No students match your search criteria.</p>
            </div>
          )}
        </TabsContent>

        {/* Internships Tab with Completion Rates by Program */}
        <TabsContent value="internships" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold">Department Internships</h2>
              <p className="text-small text-muted-foreground mt-1">All internships related to your department's programs</p>
            </div>
            <Button variant="outline" className="focus-ring">
              <Download className="h-4 w-4 mr-2" />
              Export List
            </Button>
          </div>

          {/* Active Internships List */}
          <div className="space-y-3">
            {mockDepartmentInternships.map((internship) => (
              <motion.div
                key={internship.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="dashboard-card card-hover"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-h4 font-semibold">{internship.title}</h3>
                        <p className="text-small text-muted-foreground">{internship.company}</p>
                        <span className="badge badge-secondary mt-1">{internship.program}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 ml-8 text-caption text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" />
                        {internship.studentName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(internship.startDate).toLocaleDateString()} - {new Date(internship.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-32 space-y-1">
                      <div className="flex justify-between text-caption">
                        <span>Progress</span>
                        <span className="font-medium">{internship.progress}%</span>
                      </div>
                      <Progress value={internship.progress} className="h-2" />
                    </div>
                    <StatusBadge status={internship.status} />
                    
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="focus-ring">
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Completion Rates by Program */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title flex items-center gap-2">
                <PieChart className="h-5 w-5 text-success" />
                Completion Rates by Program
              </h3>
            </div>
            
            <div className="space-y-4">
              {completionRatesByProgram.map((program) => (
                <div key={program.program} className="flex items-center gap-4">
                  <div className="w-40">
                    <p className="text-sm font-medium truncate">{program.program}</p>
                    <p className="text-caption text-muted-foreground">{program.total} students</p>
                  </div>
                  
                  <div className="flex-1">
                    <Progress value={program.rate} className="h-3" />
                  </div>
                  
                  <div className="w-16 text-right">
                    <span className={`text-lg font-bold ${
                      program.rate >= 90 ? "text-success" :
                      program.rate >= 85 ? "text-primary" : "text-warning"
                    }`}>
                      {program.rate}%
                    </span>
                  </div>
                  
                  <div className="w-20 text-caption text-muted-foreground">
                    {program.completed}/{program.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Department Reports
              </h2>
              <p className="text-small text-muted-foreground mt-1">Generate and download department-level reports</p>
            </div>
            <Button className="focus-ring">
              <Plus className="h-4 w-4 mr-2" />
              Generate New Report
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Quick Generate Cards */}
            {[
              { icon: BarChart3, title: "Summary Report", desc: "Overall department statistics and metrics", format: "pdf" },
              { icon: PieChart, title: "Student Performance", desc: "Detailed performance analytics by student", format: "excel" },
              { icon: Activity, title: "Internship Status", desc: "Current status of all active internships", format: "pdf" },
            ].map((card) => (
              <div key={card.title} className="dashboard-card card-hover cursor-pointer border-dashed">
                <CardContent className="py-6 text-center">
                  <card.icon className="h-10 w-10 mx-auto text-primary mb-3" />
                  <h3 className="text-h4 font-semibold mb-1">{card.title}</h3>
                  <p className="text-small text-muted-foreground mb-4">{card.desc}</p>
                  <Button size="sm" variant="outline" onClick={() => handleExportReport(card.format as "pdf" | "excel")} className="focus-ring">
                    Generate {card.format.toUpperCase()}
                  </Button>
                </CardContent>
              </div>
            ))}
          </div>

          {/* Generated Reports History */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">Generated Reports History</h3>
            </div>
            
            <div className="data-table-container mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell>
                        <span className="badge badge-secondary capitalize">{report.type}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(report.generatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{report.size}</TableCell>
                      <TableCell>
                        <span className="badge badge-outline">{report.format}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="focus-ring">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Faculty Coordination Tab with Workload Distribution */}
        <TabsContent value="faculty" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Faculty Workload Overview */}
            <div className="dashboard-card lg:col-span-2">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title">Faculty Workload Distribution</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                {mockFacultySupervisors.map((faculty) => {
                  const workloadPercentage = (faculty.assignedStudents / faculty.maxCapacity) * 100;
                  
                  return (
                    <div
                      key={faculty.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-warning text-white font-semibold">
                            {faculty.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h4 className="font-semibold truncate">{faculty.name}</h4>
                          <p className="text-small text-muted-foreground">{faculty.specialization}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="w-40 space-y-1">
                          <div className="flex justify-between text-caption">
                            <span>Workload</span>
                            <span className="font-medium">
                              {faculty.assignedStudents}/{faculty.maxCapacity}
                            </span>
                          </div>
                          <Progress
                            value={workloadPercentage}
                            className={`h-2 ${
                              workloadPercentage >= 90 ? "[&>div]:bg-danger" :
                              workloadPercentage >= 70 ? "[&>div]:bg-warning" : ""
                            }`}
                          />
                        </div>
                        
                        <StatusBadge status={faculty.status} />

                        <Button size="sm" variant="outline" className="focus-ring">
                          Manage
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations & Quick Actions */}
            <div className="space-y-4">
              <div className="dashboard-card">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title flex items-center gap-2">
                    <Zap className="h-5 w-5 text-warning" />
                    Recommendations
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-info/5 border border-info/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-info mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Workload Balancing</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Dr. Robert Lee is at full capacity. Consider reassigning.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Optimal Match Available</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          James Wilson would be a good fit for Dr. Anderson.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Upcoming Deadlines</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          3 mid-term evaluations due this week.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full focus-ring">
                  View All Recommendations
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="dashboard-card">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-chart-2" />
                    Quick Stats
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Capacity</span>
                    <span className="font-semibold">{mockFacultySupervisors.reduce((sum, f) => sum + f.maxCapacity, 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Assigned</span>
                    <span className="font-semibold">{mockFacultySupervisors.reduce((sum, f) => sum + f.assignedStudents, 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Available Slots</span>
                    <span className="font-semibold text-success">
                      {mockFacultySupervisors.reduce((sum, f) => sum + (f.maxCapacity - f.assignedStudents), 0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Utilization Rate</span>
                    <span className="font-bold text-gradient-brand">
                      {Math.round((mockFacultySupervisors.reduce((sum, f) => sum + f.assignedStudents, 0) / mockFacultySupervisors.reduce((sum, f) => sum + f.maxCapacity, 0)) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Coordination Memos Tab */}
        <TabsContent value="memos" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h4 font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-chart-2" />
                Coordination Memos & Notes
              </h2>
              <p className="text-small text-muted-foreground mt-1">Internal communications and announcements</p>
            </div>
            <Button onClick={() => setShowNewMemoDialog(true)} className="focus-ring">
              <PenTool className="mr-2 h-4 w-4" />
              New Memo
            </Button>
          </div>

          <div className="space-y-4">
            {coordinationMemos.map((memo) => (
              <div key={memo.id} className="dashboard-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      memo.priority === "high" ? "bg-danger/10 text-danger" :
                      memo.priority === "medium" ? "bg-warning/10 text-warning" : "bg-info/10 text-info"
                    }`}>
                      <StickyNote className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold">{memo.title}</h3>
                        <PriorityBadge priority={memo.priority} />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{memo.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-caption text-muted-foreground">
                        <span>{memo.author}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{new Date(memo.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 focus-ring">
                    <MoreVerticalIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Memo Dialog */}
      <Dialog open={showNewMemoDialog} onOpenChange={setShowNewMemoDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Memo</DialogTitle>
            <DialogDescription>
              Add a new coordination memo or announcement
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="form-group">
              <Label htmlFor="memo-title" className="form-label">Title</Label>
              <Input id="memo-title" placeholder="Enter memo title..." className="form-input" />
            </div>

            <div className="form-group">
              <Label htmlFor="memo-priority" className="form-label">Priority</Label>
              <Select defaultValue="medium">
                <SelectTrigger id="memo-priority" className="form-input">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="low">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="form-group">
              <Label htmlFor="memo-content" className="form-label">Content</Label>
              <Textarea
                id="memo-content"
                placeholder="Enter memo content..."
                rows={5}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <Label htmlFor="memo-audience" className="form-label">Audience</Label>
              <Select defaultValue="all">
                <SelectTrigger id="memo-audience" className="form-input">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Faculty & Staff</SelectItem>
                  <SelectItem value="faculty">Faculty Only</SelectItem>
                  <SelectItem value="students">Students Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMemoDialog(false)} className="focus-ring">
              Cancel
            </Button>
            <Button onClick={() => setShowNewMemoDialog(false)} className="focus-ring">
              <Send className="mr-2 h-4 w-4" />
              Publish Memo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  );
}
