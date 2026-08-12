"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Download,
  Filter,
  X,
  Users,
  UserCheck,
  Mail,
  Phone,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  FileSpreadsheet,
  UserPlus,
  CheckSquare,
  Square,
  Loader2,
  Eye,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";

interface Student {
  id: string;
  user_id: string;
  enrollment_number: string;
  status: string;
  semester?: number;
  cgpa?: number;
  program_id: string | null;
  university_id: string;
  department_id: string;
  created_at: string;
  // Joined data
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  programs?: {
    name: string | null;
    code: string | null;
  };
  departments?: {
    name: string | null;
    code: string | null;
  };
}

interface SupervisorOption {
  id: string;
  name: string;
  email: string;
  assigned_count: number;
}

export default function StudentsPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterSupervisor, setFilterSupervisor] = useState<string>("all");
  
  // Selection state
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  
  // Assignment dialog
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Student detail view
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterProgram !== "all") params.set("program_id", filterProgram);
      params.set("pageSize", "100");

      const res = await fetch(`/api/students?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStudents(data.data.data || []);
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus, filterProgram]);

  // Fetch supervisors for assignment dropdown
  const fetchSupervisors = useCallback(async () => {
    try {
      const res = await fetch("/api/supervisors?type=faculty&pageSize=100");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.data)) {
          const supervisorOptions = data.data.data.map((s: any) => ({
            id: s.id,
            name: `${s.profiles?.first_name || ""} ${s.profiles?.last_name || ""}`.trim() || s.title || "Unknown",
            email: s.profiles?.email || "",
            assigned_count: 0,
          }));
          setSupervisors(supervisorOptions);
        }
      }
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  // Handle select all
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedStudents(new Set());
      setIsSelectAll(false);
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
      setIsSelectAll(true);
    }
  };

  // Handle individual selection
  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
    setIsSelectAll(newSelected.size === students.length);
  };

  // Handle bulk assignment
  const handleBulkAssign = async () => {
    if (!selectedSupervisorId || selectedStudents.size === 0) return;

    setIsAssigning(true);
    try {
      let successCount = 0;
      
      for (const studentId of selectedStudents) {
        const res = await fetch("/api/department-coordinator/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: studentId,
            faculty_supervisor_id: selectedSupervisorId,
          }),
        });
        
        if (res.ok) successCount++;
      }

      alert(`Successfully assigned ${successCount} of ${selectedStudents.size} students`);
      
      await fetchStudents();
      setIsAssignDialogOpen(false);
      setSelectedSupervisorId("");
      setSelectedStudents(new Set());
      setIsSelectAll(false);
    } catch (error) {
      console.error("Error assigning students:", error);
      alert("Failed to assign some students");
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle single student assignment
  const handleSingleAssign = async (studentId: string, supervisorId: string) => {
    try {
      const res = await fetch("/api/department-coordinator/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          faculty_supervisor_id: supervisorId,
        }),
      });

      if (res.ok) {
        await fetchStudents();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to assign student");
      }
    } catch (error) {
      console.error("Error assigning student:", error);
      alert("Failed to assign student");
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Enrollment Number",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Status",
      "Program",
      "Department",
      "CGPA",
      "Semester",
      "Enrolled Date",
    ];

    const csvData = students.map((student) => [
      student.enrollment_number,
      student.profiles?.first_name || "",
      student.profiles?.last_name || "",
      student.profiles?.email || "",
      student.profiles?.phone || "",
      student.status,
      student.programs?.name || "Not Assigned",
      student.departments?.name || "",
      student.cgpa?.toString() || "",
      student.semester?.toString() || "",
      new Date(student.created_at).toLocaleDateString(),
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...csvData.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `department_students_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Get initials for avatar
  const getInitials = (student: Student) => {
    const firstName = student.profiles?.first_name || "";
    const lastName = student.profiles?.last_name || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "ST";
  };

  // Get full name
  const getFullName = (student: Student) => {
    const firstName = student.profiles?.first_name || "";
    const lastName = student.profiles?.last_name || "";
    return `${firstName} ${lastName}`.trim() || student.enrollment_number;
  };

  // Status badge variant
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "default" as const;
      case "graduated":
        return "secondary" as const;
      case "suspended":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">
            Manage and assign students in your department
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={isLoading || students.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          
          <Button
            onClick={() => setIsAssignDialogOpen(true)}
            disabled={selectedStudents.size === 0}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Assign ({selectedStudents.size})
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{students.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-xl font-bold">
                  {students.filter(s => s.status === "active").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Programs</p>
                <p className="text-xl font-bold">
                  {students.filter(s => s.program_id).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selected</p>
                <p className="text-xl font-bold">{selectedStudents.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by enrollment number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                </SelectContent>
              </Select>
              
              {(searchQuery || filterStatus !== "all") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="h-5 w-5 rounded bg-muted" />
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-20 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-10 w-10 text-muted-foreground" />}
          title="No students found"
          description={
            searchQuery || filterStatus !== "all"
              ? "Try adjusting your search or filters"
              : "No students are enrolled in this department yet"
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Cards View for Mobile */}
          <div className="md:hidden space-y-3">
            <AnimatePresence mode="popLayout">
              {students.map((student) => (
                <motion.div
                  key={student.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className={`overflow-hidden transition-colors ${
                    selectedStudents.has(student.id) ? "border-primary bg-primary/5" : ""
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Checkbox
                          checked={selectedStudents.has(student.id)}
                          onCheckedChange={() => handleSelectStudent(student.id)}
                          className="mt-1"
                        />
                        <Avatar className="h-11 w-11 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(student)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{getFullName(student)}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {student.enrollment_number}
                              </p>
                            </div>
                            <Badge variant={getStatusVariant(student.status)}>
                              {student.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3 ml-8">
                        {student.programs?.name && (
                          <Badge variant="outline">{student.programs.name}</Badge>
                        )}
                        {student.cgpa && (
                          <Badge variant="outline">CGPA: {student.cgpa}</Badge>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t ml-8">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setViewingStudent(student)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                        
                        <Select onValueChange={(val) => handleSingleAssign(student.id, val)}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assign...
                          </SelectTrigger>
                          <SelectContent>
                            {supervisors.map((sup) => (
                              <SelectItem key={sup.id} value={sup.id}>
                                {sup.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Table View for Desktop */}
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isSelectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Enrollment #</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CGPA</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {students.map((student) => (
                    <motion.tr
                      key={student.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`group hover:bg-muted/50 transition-colors ${
                        selectedStudents.has(student.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.has(student.id)}
                          onCheckedChange={() => handleSelectStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(student)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{getFullName(student)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {student.profiles?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {student.enrollment_number}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm max-w-[120px] block truncate">
                          {student.programs?.name || (
                            <span className="text-muted-foreground">Not assigned</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(student.status)}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{student.cgpa?.toFixed(2) || "-"}</TableCell>
                      <TableCell>{student.semester || "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingStudent(student)}>
                              <Eye className="h-4 w-4 mr-2" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedStudents(new Set([student.id]));
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <UserCheck className="h-4 w-4 mr-2" /> Assign Supervisor
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </Card>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>
              Showing {students.length} student{students.length !== 1 ? "s" : ""}
            </span>
            {selectedStudents.size > 0 && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSelectedStudents(new Set());
                  setIsSelectAll(false);
                }}
              >
                Clear selection ({selectedStudents.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
        setIsAssignDialogOpen(open);
        if (!open) setSelectedSupervisorId("");
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Assign Supervisor</DialogTitle>
            <DialogDescription>
              Assign a supervisor to {selectedStudents.size} selected student{selectedStudents.size > 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Select Supervisor *</Label>
              <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supervisor..." />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      <div className="flex flex-col">
                        <span>{sup.name}</span>
                        <span className="text-xs text-muted-foreground">{sup.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStudents.size <= 5 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Selected Students:</Label>
                <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                  {students
                    .filter(s => selectedStudents.has(s.id))
                    .map(student => (
                      <div key={student.id} className="text-sm py-1 px-2 rounded hover:bg-muted">
                        {getFullName(student)} - {student.enrollment_number}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={!selectedSupervisorId || isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Confirm Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Detail View Dialog */}
      <Dialog open={!!viewingStudent} onOpenChange={() => setViewingStudent(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription>Read-only view of student information</DialogDescription>
          </DialogHeader>

          {viewingStudent && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(viewingStudent)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{getFullName(viewingStudent)}</h3>
                  <p className="text-muted-foreground">{viewingStudent.enrollment_number}</p>
                  <Badge variant={getStatusVariant(viewingStudent.status)} className="mt-1">
                    {viewingStudent.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {viewingStudent.profiles?.email || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {viewingStudent.profiles?.phone || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Program</Label>
                  <p className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {viewingStudent.programs?.name || "Not assigned"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="text-sm">
                    {viewingStudent.departments?.name || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">CGPA</Label>
                  <p className="text-sm font-medium">{viewingStudent.cgpa?.toFixed(2) || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Semester</Label>
                  <p className="text-sm">{viewingStudent.semester || "-"}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Enrolled: {new Date(viewingStudent.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingStudent(null)}>
              Close
            </Button>
            {viewingStudent && (
              <Button
                onClick={() => {
                  setSelectedStudents(new Set([viewingStudent.id]));
                  setViewingStudent(null);
                  setIsAssignDialogOpen(true);
                }}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Assign Supervisor
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
