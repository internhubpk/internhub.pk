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
  },
  {
    id: "f2",
    name: "Prof. Maria Garcia",
    specialization: "Data Science & AI",
    assignedStudents: 6,
    maxCapacity: 10,
    status: "active" as const,
  },
  {
    id: "f3",
    name: "Dr. Robert Lee",
    specialization: "Cybersecurity",
    assignedStudents: 10,
    maxCapacity: 10,
    status: "full" as const,
  },
  {
    id: "f4",
    name: "Dr. Sarah Williams",
    specialization: "Web Technologies",
    assignedStudents: 5,
    maxCapacity: 10,
    status: "active" as const,
  },
  {
    id: "f5",
    name: "Prof. Ahmed Hassan",
    specialization: "Database Systems",
    assignedStudents: 9,
    maxCapacity: 10,
    status: "active" as const,
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
    pending: { label: "Pending", variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    completed: { label: "Completed", variant: "default", className: "bg-blue-100 text-blue-800 border-blue-200" },
    full: { label: "Full Capacity", variant: "secondary", className: "bg-red-100 text-red-800 border-red-200" },
  };

  const { label, variant, className } = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={variant} className={className}>{label}</Badge>;
}

export default function DepartmentCoordinatorDashboard() {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Department Coordinator Dashboard</h1>
        <p className="text-muted-foreground mt-1">{departmentInfo.name}</p>
      </div>

      {/* Department Overview Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { 
            title: "Total Students", 
            value: departmentInfo.totalStudents, 
            icon: GraduationCap, 
            color: "text-blue-600", 
            bgColor: "bg-blue-100",
            subtitle: `${departmentInfo.activeInternships} on internship`
          },
          { 
            title: "Active Internships", 
            value: departmentInfo.activeInternships, 
            icon: Briefcase, 
            color: "text-green-600", 
            bgColor: "bg-green-100",
            subtitle: "Currently ongoing"
          },
          { 
            title: "Completion Rate", 
            value: `${departmentInfo.completionRate}%`, 
            icon: TrendingUp, 
            color: "text-purple-600", 
            bgColor: "bg-purple-100",
            subtitle: "Above target"
          },
          { 
            title: "Faculty Supervisors", 
            value: departmentInfo.facultyCount, 
            icon: Users, 
            color: "text-orange-600", 
            bgColor: "bg-orange-100",
            subtitle: "Active supervisors"
          },
        ].map((stat) => (
          <motion.div key={stat.title} variants={itemVariants}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
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
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
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
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Department Students</CardTitle>
                  <CardDescription>{filteredStudents.length} students found</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
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
            </CardHeader>
            <CardContent>
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
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {student.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{student.program}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">Sem {student.semester}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          student.cgpa >= 3.7 ? "text-green-600" :
                          student.cgpa >= 3.0 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {student.cgpa.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={student.internshipStatus} />
                      </TableCell>
                      <TableCell>
                        {student.company || (
                          <span className="text-muted-foreground text-sm">Not placed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="w-24 space-y-1">
                          <Progress value={student.progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">{student.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedStudent(student.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredStudents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No students match your search criteria.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Internships Tab */}
        <TabsContent value="internships" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Department Internships</CardTitle>
                  <CardDescription>All internships related to your department's programs</CardDescription>
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export List
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockDepartmentInternships.map((internship) => (
                  <div
                    key={internship.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <h3 className="font-semibold">{internship.title}</h3>
                          <p className="text-sm text-muted-foreground">{internship.company}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 ml-8 text-sm text-muted-foreground">
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
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{internship.progress}%</span>
                        </div>
                        <Progress value={internship.progress} className="h-2" />
                      </div>
                      <StatusBadge status={internship.status} />
                      
                      {/* Approval Actions for Coordinator */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          Review
                        </Button>
                        {internship.status === "pending" && (
                          <>
                            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive">
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Department Reports
              </h2>
              <p className="text-muted-foreground">Generate and download department-level reports</p>
            </div>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Generate New Report
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Quick Generate Cards */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-dashed">
              <CardContent className="p-6 text-center">
                <BarChart3 className="h-10 w-10 mx-auto text-primary mb-3" />
                <h3 className="font-semibold mb-1">Summary Report</h3>
                <p className="text-sm text-muted-foreground mb-4">Overall department statistics and metrics</p>
                <Button size="sm" variant="outline" onClick={() => handleExportReport("pdf")}>
                  Generate PDF
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow border-dashed">
              <CardContent className="p-6 text-center">
                <PieChart className="h-10 w-10 mx-auto text-primary mb-3" />
                <h3 className="font-semibold mb-1">Student Performance</h3>
                <p className="text-sm text-muted-foreground mb-4">Detailed performance analytics by student</p>
                <Button size="sm" variant="outline" onClick={() => handleExportReport("excel")}>
                  Generate Excel
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow border-dashed">
              <CardContent className="p-6 text-center">
                <Activity className="h-10 w-10 mx-auto text-primary mb-3" />
                <h3 className="font-semibold mb-1">Internship Status</h3>
                <p className="text-sm text-muted-foreground mb-4">Current status of all active internships</p>
                <Button size="sm" variant="outline" onClick={() => handleExportReport("pdf")}>
                  Generate PDF
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Generated Reports History */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>Previously generated reports</CardDescription>
            </CardHeader>
            <CardContent>
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
                        <Badge variant="outline" capitalize>{report.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(report.generatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{report.size}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{report.format}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="flex items-center gap-1 ml-auto">
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Faculty Coordination Tab */}
        <TabsContent value="faculty" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Faculty Workload Overview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Faculty Supervisors</CardTitle>
                    <CardDescription>Workload distribution across faculty members</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockFacultySupervisors.map((faculty) => {
                    const workloadPercentage = (faculty.assignedStudents / faculty.maxCapacity) * 100;
                    
                    return (
                      <div
                        key={faculty.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {faculty.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h4 className="font-semibold truncate">{faculty.name}</h4>
                            <p className="text-sm text-muted-foreground">{faculty.specialization}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="w-40 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Workload</span>
                              <span>
                                {faculty.assignedStudents}/{faculty.maxCapacity} students
                              </span>
                            </div>
                            <Progress
                              value={workloadPercentage}
                              className={`h-2 ${
                                workloadPercentage >= 90 ? "[&>div]:bg-red-500" :
                                workloadPercentage >= 70 ? "[&>div]:bg-yellow-500" : ""
                              }`}
                            />
                          </div>
                          
                          <StatusBadge status={faculty.status} />

                          <Button size="sm" variant="outline">
                            Manage
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Assignment Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Recommendations
                </CardTitle>
                <CardDescription>AI-powered suggestions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900 text-sm">Workload Balancing</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Dr. Robert Lee is at full capacity. Consider reassigning new students to Prof. Maria Garcia (4 slots available).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-green-900 text-sm">Optimal Match</p>
                      <p className="text-sm text-green-700 mt-1">
                        James Wilson (Software Engineering) would be a good fit for Dr. John Anderson&apos;s supervision.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-900 text-sm">Upcoming Deadlines</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        3 mid-term evaluations due this week. Ensure all supervisors are notified.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <Button variant="outline" className="w-full flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                  View All Recommendations
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
