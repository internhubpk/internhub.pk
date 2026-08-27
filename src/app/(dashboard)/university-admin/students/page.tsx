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
  EyeOff,
  Loader2,
  FileSpreadsheet,
  UserPlus,
  MoreVertical,
  Pencil,
  Ban,
  CheckCircle2,
  Trash2,
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Profile, Department } from "@/types";

interface StudentWithDetails extends Profile {
  departmentName?: string | null;
  departmentCode?: string | null;
  studentIdNumber?: string | null;
  programName?: string | null;
  // program id from the `students` table (NOT profiles.program_id).
  programId?: string | null;
  internshipStatus?: string | null;
  gpa?: number | null;
  semester?: number | null;
}

interface ProgramOption {
  id: string;
  name: string;
  department_id: string;
}

interface CreateStudentForm {
  full_name: string;
  email: string;
  password: string;
  student_id_number: string;
  department_id: string;
  program_id: string;
}

interface EditStudentForm {
  full_name: string;
  student_id_number: string;
  cgpa: string;
  department_id: string;
  program_id: string;
}

const emptyCreateForm: CreateStudentForm = {
  full_name: "",
  email: "",
  password: "",
  student_id_number: "",
  department_id: "",
  program_id: "",
};

const emptyEditForm: EditStudentForm = {
  full_name: "",
  student_id_number: "",
  cgpa: "",
  department_id: "",
  program_id: "",
};

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
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  // ── Create Student dialog state ────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createForm, setCreateForm] = useState<CreateStudentForm>(emptyCreateForm);

  // ── Edit Student dialog state ──────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentWithDetails | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditStudentForm>(emptyEditForm);

  // ── Suspend / activate confirmation state ──────────────────────
  const [statusTarget, setStatusTarget] = useState<StudentWithDetails | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // ── Delete confirmation state ──────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<StudentWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stats derived from students
  const activeStudents = students.filter(s => s.is_active).length;
  const onInternship = students.filter(s => s.internshipStatus === "active" || s.internshipStatus === "assigned").length;

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
        let studentDetails: { student_id_number: string | null; program_id: string | null; cgpa: number | null; semester: number | null } | null = null;
        try {
          const { data: details } = await supabase
            .from("students")
            .select("student_id_number, program_id, cgpa, semester")
            .eq("user_id", student.user_id)
            .maybeSingle();
          studentDetails = details as { student_id_number: string | null; program_id: string | null; cgpa: number | null; semester: number | null } | null;
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
          studentIdNumber: studentDetails?.student_id_number || null,
          semester: studentDetails?.semester ?? null,
          programName: programName,
          programId: studentDetails?.program_id || null,
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
            (s.studentIdNumber && s.studentIdNumber.toLowerCase().includes(query))
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

  // Fetch the university's programs once on mount — used by the create
  // and edit dialogs' program selects.
  const fetchPrograms = useCallback(async () => {
    const universityId = profile?.university_id || university?.id;
    if (!universityId) return;

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("programs")
        .select("id, name, department_id")
        .eq("university_id", universityId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error("Error fetching programs:", error);
    }
  }, [profile?.university_id, university?.id]);

  useEffect(() => {
    fetchStudents();
    fetchDepartments();
    fetchPrograms();
  }, [fetchStudents, fetchDepartments, fetchPrograms]);

  const exportToCSV = () => {
    if (students.length === 0) {
      toast.error("No Data", { description: "There are no students to export" });
      return;
    }

    // Create CSV content
    const headers = ["Name", "Email", "Roll No.", "Department", "Program", "Semester", "Status", "GPA", "Internship Status"];
    const rows = students.map(s => [
      s.full_name || "",
      s.email,
      s.studentIdNumber || "",
      s.departmentName || "",
      s.programName || "",
      s.semester?.toString() || "",
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

  // ── Create Student ─────────────────────────────────────────────
  const openCreateDialog = () => {
    setCreateForm(emptyCreateForm);
    setShowCreatePassword(false);
    setIsCreateOpen(true);
  };

  const handleCreateProgramChange = (value: string) => {
    const programId = value === "__none__" ? "" : value;
    const program = programs.find((p) => p.id === programId);
    // A program always belongs to a department — auto-select it so the
    // (program_id, department_id) composite FK always holds.
    setCreateForm((prev) => ({
      ...prev,
      program_id: programId,
      department_id: program ? program.department_id : prev.department_id,
    }));
  };

  const handleCreateStudent = async () => {
    const universityId = profile?.university_id || university?.id;

    if (!createForm.full_name.trim() || createForm.full_name.trim().length < 2) {
      toast.error("Validation Error", { description: "Full name must be at least 2 characters" });
      return;
    }
    if (!createForm.email.trim() || !createForm.email.includes("@")) {
      toast.error("Validation Error", { description: "Please enter a valid email address" });
      return;
    }
    if (createForm.password.length < 8) {
      toast.error("Validation Error", { description: "Password must be at least 8 characters" });
      return;
    }
    const rollNo = createForm.student_id_number.trim();
    if (rollNo && rollNo.length < 3) {
      toast.error("Validation Error", { description: "Roll number must be at least 3 characters (or leave it empty)" });
      return;
    }
    if (!universityId) {
      toast.error("Error", { description: "Your admin account is not linked to a university" });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: createForm.full_name.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          student_id_number: rollNo || undefined,
          department_id: createForm.department_id || null,
          program_id: createForm.program_id || null,
          // The route verifies this matches the caller's university and
          // forces it server-side, but it MUST be present.
          university_id: universityId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const message =
          json?.error === "Validation failed" && json?.message
            ? json.message
            : json?.error || `Request failed (${res.status})`;
        throw new Error(message);
      }

      toast.success("Student Created", {
        description: `${createForm.full_name.trim()} has been enrolled and can now sign in.`,
      });
      setIsCreateOpen(false);
      setCreateForm(emptyCreateForm);
      fetchStudents();
    } catch (error) {
      console.error("Error creating student:", error);
      toast.error("Failed to create student", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Edit Student ───────────────────────────────────────────────
  const openEditDialog = (student: StudentWithDetails) => {
    setEditTarget(student);
    setEditForm({
      full_name: student.full_name || "",
      student_id_number: student.studentIdNumber || "",
      cgpa: student.gpa != null ? String(student.gpa) : "",
      department_id: student.department_id || "",
      program_id: student.programId || "",
    });
    setIsEditOpen(true);
  };

  const handleEditDepartmentChange = (value: string) => {
    const departmentId = value === "__none__" ? "" : value;
    setEditForm((prev) => ({
      ...prev,
      department_id: departmentId,
      // Keep the program only when it belongs to the newly selected
      // department — the students table has a composite FK on
      // (program_id, department_id).
      program_id:
        departmentId &&
        prev.program_id &&
        programs.find((p) => p.id === prev.program_id)?.department_id === departmentId
          ? prev.program_id
          : "",
    }));
  };

  const handleEditProgramChange = (value: string) => {
    const programId = value === "__none__" ? "" : value;
    const program = programs.find((p) => p.id === programId);
    setEditForm((prev) => ({
      ...prev,
      program_id: programId,
      department_id: program ? program.department_id : prev.department_id,
    }));
  };

  const handleSaveStudent = async () => {
    if (!editTarget) return;

    const name = editForm.full_name.trim();
    if (name.length < 2) {
      toast.error("Validation Error", { description: "Full name must be at least 2 characters" });
      return;
    }
    const rollNo = editForm.student_id_number.trim();
    if (rollNo && rollNo.length < 3) {
      toast.error("Validation Error", { description: "Roll number must be at least 3 characters (or leave it empty)" });
      return;
    }
    let cgpa: number | null = null;
    if (editForm.cgpa.trim() !== "") {
      cgpa = parseFloat(editForm.cgpa);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 4) {
        toast.error("Validation Error", { description: "CGPA must be a number between 0.00 and 4.00" });
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      // 1. If the name changed, update the profile row directly — RLS
      //    allows university admins to update profiles of their own
      //    university (same path the suspend/activate action uses).
      if (name !== (editTarget.full_name || "")) {
        const supabase = createClient();
        const nameParts = name.split(/\s+/);
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: name,
            first_name: nameParts[0] || null,
            last_name: nameParts.slice(1).join(" ") || null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", editTarget.user_id);
        if (profileError) throw new Error(profileError.message);
      }

      // 2. Update the enrollment record via the API. Only the fields the
      //    students table actually owns are sent (full_name/email/password
      //    live on the profile + auth account, not on `students`).
      //    NOTE: student_id_number is sent as "" (not null) when cleared —
      //    UpdateStudentSchema only accepts a string or "".
      const res = await fetch(`/api/students/${editTarget.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id_number: rollNo,
          cgpa,
          department_id: editForm.department_id || null,
          program_id: editForm.program_id || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const message =
          json?.error === "Validation failed" && json?.message
            ? json.message
            : json?.error || `Request failed (${res.status})`;
        throw new Error(message);
      }

      toast.success("Student Updated", {
        description: `${name}'s details were saved successfully.`,
      });
      setIsEditOpen(false);
      setEditTarget(null);
      if (selectedStudent?.user_id === editTarget.user_id) {
        setIsDetailOpen(false);
        setSelectedStudent(null);
      }
      fetchStudents();
    } catch (error) {
      console.error("Error updating student:", error);
      toast.error("Failed to update student", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Suspend / Activate ─────────────────────────────────────────
  // There is no dedicated student-status API for university admins, so
  // the status flip is written directly to the profile row — RLS allows
  // university admins to update profiles of their own university.
  const handleConfirmToggleStatus = async () => {
    if (!statusTarget) return;
    const newStatus = statusTarget.is_active ? "suspended" : "active";

    setIsTogglingStatus(true);
    try {
      const supabase = createClient();
      const { data: updatedRows, error } = await supabase
        .from("profiles")
        .update({
          status: newStatus,
          is_active: newStatus === "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", statusTarget.user_id)
        .select("user_id");

      if (error) throw new Error(error.message);
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("No profile was updated — the student may no longer belong to your university.");
      }

      toast.success(newStatus === "suspended" ? "Student Suspended" : "Student Activated", {
        description: `${statusTarget.full_name || statusTarget.email} has been ${
          newStatus === "suspended" ? "suspended" : "reactivated"
        }.`,
      });

      if (selectedStudent?.user_id === statusTarget.user_id) {
        setSelectedStudent((prev) =>
          prev ? { ...prev, is_active: newStatus === "active", status: newStatus } : prev
        );
      }
      setStatusTarget(null);
      fetchStudents();
    } catch (error) {
      console.error("Error toggling student status:", error);
      toast.error("Failed to update status", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // ── Delete Student ─────────────────────────────────────────────
  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/students/${deleteTarget.user_id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      toast.success("Student Deleted", {
        description: `${deleteTarget.full_name || deleteTarget.email} and all their data were permanently removed.`,
      });

      if (selectedStudent?.user_id === deleteTarget.user_id) {
        setSelectedStudent(null);
        setIsDetailOpen(false);
      }
      setDeleteTarget(null);
      fetchStudents();
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("Failed to delete student", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
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
    // 'assigned' = matched to an internship but not yet started; 'active' = ongoing.
    // Both should show the green "On Internship" badge — the previous check
    // for `=== "active"` alone missed every assigned student, which is the
    // typical state right after HR accepts an application.
    if (student.internshipStatus === "active" || student.internshipStatus === "assigned") {
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
        description={`Create, edit, suspend and delete students enrolled in ${university?.name || "your university"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreateDialog} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Create Student
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={isLoading || students.length === 0}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
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
                  <TableHead className="hidden md:table-cell">Roll No.</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Sem.</TableHead>
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
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
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
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">Roll No.</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Sem.</TableHead>
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
                        <span className="font-mono text-sm">{student.studentIdNumber || "-"}</span>
                      </TableCell>
                      <TableCell>
                        {student.programName ? (
                          <span className="text-sm">{student.programName}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.semester ? (
                          <span className="text-sm">Sem {student.semester}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openStudentDetail(student)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View Details</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="More actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">More Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openStudentDetail(student)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(student)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setStatusTarget(student)}
                                className={
                                  student.is_active
                                    ? "text-amber-600 focus:text-amber-600"
                                    : "text-emerald-600 focus:text-emerald-600"
                                }
                              >
                                {student.is_active ? (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />
                                    Suspend Student
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Activate Student
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(student)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Student
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
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

                            {student.programName && (
                              <Badge variant="secondary" className="text-xs">
                                {student.programName}
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
            <>
              <DialogBody className="space-y-6">
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
                    <p className="text-xs text-muted-foreground">Roll Number</p>
                    <p className="font-medium font-mono">{selectedStudent.studentIdNumber || "N/A"}</p>
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
                    <p className="text-xs text-muted-foreground">Semester</p>
                    <p className="font-medium">{selectedStudent.semester || "N/A"}</p>
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
              </DialogBody>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(selectedStudent)}
                  title="Edit this student's details"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusTarget(selectedStudent)}
                  className={
                    selectedStudent.is_active
                      ? "text-amber-600 hover:text-amber-700"
                      : "text-emerald-600 hover:text-emerald-700"
                  }
                  title={selectedStudent.is_active ? "Suspend this student" : "Reactivate this student"}
                >
                  {selectedStudent.is_active ? (
                    <>
                      <Ban className="h-4 w-4 mr-2" />
                      Suspend
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(selectedStudent)}
                  title="Permanently delete this student"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Student Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setCreateForm(emptyCreateForm);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create New Student
            </DialogTitle>
            <DialogDescription>
              Create a student account enrolled in {university?.name || "your university"}.
              The student can sign in immediately with the email and password you set.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stu-full-name">Full Name *</Label>
              <Input
                id="stu-full-name"
                placeholder="e.g., Ayesha Khan"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stu-email">Email Address *</Label>
              <Input
                id="stu-email"
                type="email"
                placeholder="student@university.edu.pk"
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stu-password">Password *</Label>
              <div className="relative">
                <Input
                  id="stu-password"
                  type={showCreatePassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="pr-24"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    tabIndex={-1}
                    title={showCreatePassword ? "Hide password" : "Show password"}
                  >
                    {showCreatePassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        password: "Stu@" + Math.random().toString(36).substring(2, 8) + "!",
                      }))
                    }
                    tabIndex={-1}
                  >
                    Generate
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters. Share it with the student — they can change it after signing in.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stu-roll">Roll No. / Student ID</Label>
              <Input
                id="stu-roll"
                placeholder="e.g., FA21-BCS-001 (optional)"
                value={createForm.student_id_number}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, student_id_number: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Must be unique within your university (optional, min 3 characters).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={createForm.department_id || "__none__"}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    department_id: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={createForm.program_id || "__none__"}
                onValueChange={handleCreateProgramChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a program (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(createForm.department_id
                    ? programs.filter((p) => p.department_id === createForm.department_id)
                    : programs
                  ).map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecting a program automatically assigns its department.
              </p>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateStudent} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Student
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Student
            </DialogTitle>
            <DialogDescription>
              Update {editTarget?.full_name || editTarget?.email}'s enrollment details.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-stu-name">Full Name *</Label>
              <Input
                id="edit-stu-name"
                placeholder="e.g., Ayesha Khan"
                value={editForm.full_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Changing the name updates the student's profile.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-stu-roll">Roll No. / Student ID</Label>
              <Input
                id="edit-stu-roll"
                placeholder="Optional — must be unique in your university"
                value={editForm.student_id_number}
                onChange={(e) => setEditForm((prev) => ({ ...prev, student_id_number: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-stu-cgpa">CGPA</Label>
              <Input
                id="edit-stu-cgpa"
                type="number"
                step="0.01"
                min="0"
                max="4"
                placeholder="e.g., 3.45"
                value={editForm.cgpa}
                onChange={(e) => setEditForm((prev) => ({ ...prev, cgpa: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Between 0.00 and 4.00 — leave blank if unknown.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={editForm.department_id || "__none__"}
                onValueChange={handleEditDepartmentChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={editForm.program_id || "__none__"}
                onValueChange={handleEditProgramChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(editForm.department_id
                    ? programs.filter((p) => p.department_id === editForm.department_id)
                    : programs
                  ).map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveStudent} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / Activate Confirmation */}
      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={
          statusTarget?.is_active ? (
            <>
              <Ban className="h-5 w-5 shrink-0" />
              Suspend student?
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Activate student?
            </>
          )
        }
        description={
          statusTarget?.is_active ? (
            <span className="space-y-3 block">
              <span className="block">
                This will suspend <strong>{statusTarget?.full_name || statusTarget?.email}</strong>{" "}
                ({statusTarget?.email}). They will no longer be able to sign in or use their account
                until you reactivate them.
              </span>
              <span className="block bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                Nothing is deleted — their applications, weekly logs, evaluations and records are
                all kept and restored when the account is reactivated.
              </span>
            </span>
          ) : (
            <span>
              This will reactivate <strong>{statusTarget?.full_name || statusTarget?.email}</strong>
              's account so they can sign in and continue their internship activities.
            </span>
          )
        }
        confirmLabel={statusTarget?.is_active ? "Suspend Student" : "Activate Student"}
        variant={statusTarget?.is_active ? "warning" : "success"}
        loading={isTogglingStatus}
        onConfirm={handleConfirmToggleStatus}
      />

      {/* Delete Student Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          <>
            <Trash2 className="h-5 w-5 shrink-0" />
            Delete student permanently?
          </>
        }
        description={
          <span className="space-y-3 block">
            <span className="block">
              This will permanently delete{" "}
              <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong> ({deleteTarget?.email})
              and their sign-in credentials.
            </span>
            <span className="block bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              This action <strong>cannot be undone</strong>. All of the student's personal data is
              removed: internship applications, weekly logs, evaluations, attendance records,
              certificates, documents and notifications.
            </span>
          </span>
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete Student"}
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDeleteStudent}
      />
    </div>
  );
}
