"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Search,
  Download,
  Filter,
  Users,
  Mail,
  Building2,
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Profile, Department } from "@/types";

interface StudentWithDetails extends Profile {
  departmentName?: string | null;
  departmentCode?: string | null;
  enrollmentNumber?: string | null;
  programName?: string | null;
  internshipStatus?: string | null;
  gpa?: number | null;
}

interface StudentFilters {
  search: string;
  department_id: string;
  status: string;
  program: string;
}

const emptyFilters: StudentFilters = {
  search: "",
  department_id: "",
  status: "",
  program: "",
};

export default function UniversityAdminStudentsPage() {
  const { profile, university } = useAuth();
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<StudentFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [totalCount, setTotalCount] = useState(0);

  // Stats derived from students
  const activeStudents = students.filter(s => s.is_active).length;
  const onInternship = students.filter(s => s.internshipStatus === "active").length;

  const fetchStudents = useCallback(async () => {
    const universityId = profile?.university_id || university?.id;

    // No university assigned yet — clear loading state so the page can
    // render an empty state instead of a perpetual spinner.
    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();

      // Build base query for student profiles
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .eq("university_id", universityId)
        .eq("role", "student")
        .order("created_at", { ascending: false });

      // Apply status filter
      if (filters.status === "active") {
        query = query.eq("is_active", true);
      } else if (filters.status === "inactive") {
        query = query.eq("is_active", false);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Enrich with department info
      const studentsWithDetails: StudentWithDetails[] = [];
      
      for (const student of (data || [])) {
        let deptInfo: { name: string | null; code: string | null } | null = null;
        
        if (student.department_id) {
          const { data: dept } = await supabase
            .from("departments")
            .select("name, code")
            .eq("id", student.department_id)
            .single();
          
          deptInfo = dept as { name: string | null; code: string | null } | null;
        }

        // Get student-specific details if available
        let studentDetails: { enrollment_number: string | null; program_id: string | null; cgpa: number | null; status: string | null } | null = null;
        try {
          const { data: details } = await supabase
            .from("students")
            .select("enrollment_number, program_id, cgpa, status")
            .eq("user_id", student.user_id)
            .single();
          studentDetails = details as { enrollment_number: string | null; program_id: string | null; cgpa: number | null; status: string | null } | null;
        } catch (e) {
          // Students table might not have this user yet
        }

        // Get program name if available
        let programName: string | null = null;
        if (studentDetails?.program_id) {
          const { data: program } = await supabase
            .from("programs")
            .select("name")
            .eq("id", studentDetails.program_id)
            .single();
          programName = program?.name || null;
        }

        // Check for active internships. NOTE: `internships` has no
        // `student_id` column — the student <-> internship link lives in
        // the `student_internships` junction table, keyed by
        // `student_user_id`, with its own status enum (assigned/active/
        // paused/completed/terminated).
        let internshipStatus: string | null = null;
        try {
          const { data: internship } = await supabase
            .from("student_internships")
            .select("status")
            .eq("student_user_id", student.user_id)
            .in("status", ["assigned", "active"])
            .limit(1)
            .single();
          internshipStatus = internship?.status || null;
        } catch (e) {
          // No active internships
        }

        studentsWithDetails.push({
          ...student,
          departmentName: deptInfo?.name || null,
          departmentCode: deptInfo?.code || null,
          enrollmentNumber: studentDetails?.enrollment_number || null,
          programName: programName,
          internshipStatus: internshipStatus,
          gpa: studentDetails?.cgpa || null,
        });
      }

      // Apply filters client-side
      let filtered = studentsWithDetails;

      // Search filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            (s.full_name && s.full_name.toLowerCase().includes(query)) ||
            s.email.toLowerCase().includes(query) ||
            (s.enrollmentNumber && s.enrollmentNumber.toLowerCase().includes(query))
        );
      }

      // Department filter
      if (filters.department_id) {
        filtered = filtered.filter(s => s.department_id === filters.department_id);
      }

      // Program filter (basic - would need more data for proper filtering)
      if (filters.program) {
        filtered = filtered.filter(s => 
          s.programName?.toLowerCase().includes(filters.program.toLowerCase())
        );
      }

      setStudents(filtered);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Error", { description: "Failed to load students" });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id, university?.id, filters, toast]);

  const fetchDepartments = useCallback(async () => {
    const universityId = profile?.university_id || university?.id;
    if (!universityId) return;

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("university_id", universityId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }, [profile?.university_id, university?.id]);

  useEffect(() => {
    fetchStudents();
    fetchDepartments();
  }, [fetchStudents, fetchDepartments]);

  const exportToCSV = () => {
    if (students.length === 0) {
      toast.error("No Data", { description: "There are no students to export" });
      return;
    }

    // Create CSV content
    const headers = ["Name", "Email", "Enrollment #", "Department", "Program", "Status", "GPA", "Internship Status"];
    const rows = students.map(s => [
      s.full_name || "",
      s.email,
      s.enrollmentNumber || "",
      s.departmentName || "",
      s.programName || "",
      s.is_active ? "Active" : "Inactive",
      s.gpa?.toString() || "",
      s.internshipStatus || "None",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Export Complete", { description: `${students.length} students exported to CSV` });
  };

  const openStudentDetail = (student: StudentWithDetails) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getStatusBadge = (student: StudentWithDetails) => {
    if (student.internshipStatus === "active") {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">On Internship</Badge>;
    }
    if (!student.is_active) {
      return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
    }
    return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Students Overview"
        description={`View all enrolled students in ${university?.name || "your university"}`}
        actions={
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={isLoading || students.length === 0}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Students"
          value={totalCount}
          icon={Users}
          variant="default"
        />
        <StatCard
          label="Active Students"
          value={activeStudents}
          icon={GraduationCap}
          variant="success"
        />
        <StatCard
          label="On Internship"
          value={onInternship}
          icon={Briefcase}
          variant="info"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Filters & Search</CardTitle>
              {(filters.search || filters.department_id || filters.status) && (
                <Badge variant="secondary" className="text-xs">
                  {[filters.search, filters.department_id, filters.status].filter(Boolean).length} active
                </Badge>
              )}
            </div>
            {showFilters ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>

              <Select
                value={filters.department_id || "__none__"}
                onValueChange={(value) =>
                  setFilters({ ...filters, department_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status || "__none__"}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(emptyFilters)}
                className="gap-2"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* View Toggle */}
      <div className="flex justify-end gap-2">
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
        >
          Table View
        </Button>
        <Button
          variant={viewMode === "grid" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("grid")}
        >
          Grid View
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        viewMode === "table" ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Enrollment #</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">GPA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-6 w-20 rounded-full mt-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Empty State */}
      {!isLoading && students.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <GraduationCap className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No students found</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                {filters.search || filters.department_id || filters.status
                  ? "No students match your current filters. Try adjusting your search criteria."
                  : "No students are currently enrolled in your university."}
              </p>
              {(filters.search || filters.department_id || filters.status) && (
                <Button variant="outline" onClick={() => setFilters(emptyFilters)}>
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Views */}
      {!isLoading && students.length > 0 && (
        <>
          {viewMode === "table" ? (
            /* Table View */
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">Enrollment #</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">GPA</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(student.full_name, student.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{student.full_name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="font-mono text-sm">{student.enrollmentNumber || "-"}</span>
                      </TableCell>
                      <TableCell>
                        {student.departmentName ? (
                          <span className="text-sm">{student.departmentName}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(student)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {student.gpa ? (
                          <span className="font-medium">{student.gpa.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openStudentDetail(student)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Details</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            /* Grid View */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {students.map((student, index) => (
                <motion.div
                  key={student.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card 
                    className="hover:shadow-md transition-all cursor-pointer h-full"
                    onClick={() => openStudentDetail(student)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(student.full_name, student.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate">{student.full_name || "Unnamed Student"}</h3>
                          <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                          
                          <div className="flex flex-wrap gap-2 mt-3">
                            {getStatusBadge(student)}
                            
                            {student.departmentName && (
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="h-3 w-3 mr-1" />
                                {student.departmentCode || student.departmentName.slice(0, 3)}
                              </Badge>
                            )}

                            {student.enrollmentNumber && (
                              <Badge variant="secondary" className="text-xs font-mono">
                                #{student.enrollmentNumber}
                              </Badge>
                            )}
                          </div>

                          {student.gpa && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">GPA</span>
                                <span className="font-medium">{student.gpa.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Student Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription>
              Detailed information about this student
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-6 px-6 py-4 overflow-y-auto max-h-[60vh]">
              {/* Header Info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {getInitials(selectedStudent.full_name, selectedStudent.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedStudent.full_name || "Unnamed"}</h3>
                  <p className="text-muted-foreground">{selectedStudent.email}</p>
                  <div className="mt-1">{getStatusBadge(selectedStudent)}</div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Enrollment Number</p>
                  <p className="font-medium font-mono">{selectedStudent.enrollmentNumber || "N/A"}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">GPA</p>
                  <p className="font-medium">{selectedStudent.gpa ? selectedStudent.gpa.toFixed(2) : "N/A"}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedStudent.departmentName || "Unassigned"}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Program</p>
                  <p className="font-medium">{selectedStudent.programName || "N/A"}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Internship Status</p>
                  <p className="font-medium capitalize">{selectedStudent.internshipStatus || "None"}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="font-medium">{new Date(selectedStudent.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Read-only Notice */}
              <div className="bg-muted/30 border rounded-lg p-4">
                <p className="text-sm text-muted-foreground text-center">
                  University admins have read-only access to student profiles.
                  Contact the system administrator or the student's department coordinator for modifications.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
