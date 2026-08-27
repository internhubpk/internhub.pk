"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Search,
  Filter,
  X,
  Plus,
  UserCheck,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DialogBody,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { toast } from "@/components/shared/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface StudentRow {
  user_id: string;
  full_name: string | null;
  email: string;
  student_id_number: string | null;
  semester: number | null;
  cgpa: number | null;
  program_id: string | null;
  program_name: string | null;
  faculty_supervisor_id: string | null;
  faculty_supervisor_name: string | null;
  has_internship: boolean;
}

interface SupervisorOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface ProgramOption {
  id: string;
  name: string;
  code: string | null;
}

export default function ProgramCoordinatorStudentsPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssigned, setFilterAssigned] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Add Student dialog state
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [studentForm, setStudentForm] = useState({
    full_name: "",
    email: "",
    password: "",
    student_id_number: "",
    semester: "",
    program_id: "",
    enrollment_year: "",
    expected_graduation: "",
    cgpa: "",
  });
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  // Always filter by department_id (the PC is department-scoped) — never by a
  // single program_id, because the PC can create students in ANY program in
  // their department (the form shows a program dropdown).
  const departmentId = profile?.department_id;
  // Kept for backwards-compat with the CSV template generator which lists the
  // expected column names.
  const programId = profile?.program_id;

  // ===== Edit / Delete student state =====
  const [editTarget, setEditTarget] = useState<StudentRow | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    student_id_number: "",
    cgpa: "",
    semester: "",
    program_id: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ===== CSV Bulk Import state =====
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importCsvName, setImportCsvName] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importPhase, setImportPhase] = useState<"upload" | "preview" | "results">("upload");
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validation, setValidation] = useState<{
    total: number;
    valid: number;
    invalid: number;
    details: { row: number; email: string; name: string; valid: boolean; error?: string; created?: boolean }[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    invalid: number;
    details: { row: number; email: string; name: string; valid: boolean; error?: string; created?: boolean }[];
  } | null>(null);

  const downloadCsvTemplate = () => {
    const template =
      "first_name,last_name,email,student_id_number,semester,enrollment_year,expected_graduation,cgpa\n" +
      "Ayesha,Khan,ayesha.khan@university.edu,BSCS-2026-001,5,2026,2030-06-30,3.2\n" +
      "Bilal,Ahmed,bilal.ahmed@university.edu,BSCS-2026-002,5,2026,2030-06-30,\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "students_import_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportCsvName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportCsvText((ev.target?.result as string) || "");
      setValidation(null);
      setImportResult(null);
      setImportPhase("upload");
    };
    reader.readAsText(file);
  };

  const resetImportDialog = () => {
    setIsImportOpen(false);
    setImportCsvText("");
    setImportCsvName("");
    setImportPassword("");
    setImportPhase("upload");
    setValidation(null);
    setImportResult(null);
  };

  // Phase 1: dry-run validation (nothing is created).
  const handleValidateCsv = async () => {
    if (!importCsvText.trim()) {
      toast.error("No CSV selected", { description: "Please choose a CSV file first." });
      return;
    }
    if (importPassword.trim().length < 8) {
      toast.error("Password required", {
        description: "Enter a password of at least 8 characters. Every imported account will use it; students change it after first sign-in.",
      });
      return;
    }
    setIsValidating(true);
    try {
      const res = await fetch("/api/program-coordinator/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, password: importPassword.trim(), dry_run: true }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Validation failed", { description: data.error || data.message });
        return;
      }
      setValidation(data.data);
      setImportPhase("preview");
    } catch (err) {
      toast.error("Validation failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsValidating(false);
    }
  };

  // Phase 2: commit — creates accounts for VALID rows only.
  const handleConfirmImport = async () => {
    setIsCommitting(true);
    try {
      const res = await fetch("/api/program-coordinator/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, password: importPassword.trim(), dry_run: false }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Import failed", { description: data.error || data.message });
        return;
      }
      setImportResult(data.data);
      setImportPhase("results");
      await fetchStudents();
      toast.success("Import complete", {
        description: `Created ${data.data.created} student account(s) in your program.`,
      });
    } catch (err) {
      toast.error("Import failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsCommitting(false);
    }
  };

  const fetchStudents = useCallback(async () => {
    if (!departmentId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch students in this PC's department.
      // (some students may not have program_id assigned yet)
      const { data: studentRows, error } = await supabase
        .from("students")
        .select(`
          user_id,
          student_id_number,
          semester,
          cgpa,
          program_id,
          faculty_supervisor_id,
          department_id,
          profiles:user_id (full_name, email)
        `)
        .eq("department_id", departmentId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch supervisor names for assigned students
      const supervisorIds = (studentRows || [])
        .map((s: any) => s.faculty_supervisor_id)
        .filter(Boolean) as string[];

      let supervisorMap: Record<string, string> = {};
      if (supervisorIds.length > 0) {
        const { data: supervisorProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", supervisorIds);

        for (const p of (supervisorProfiles || []) as any[]) {
          supervisorMap[p.user_id] = p.full_name || "Unknown";
        }
      }

      // Check which students have internships
      const studentUserIds = (studentRows || []).map((s: any) => s.user_id);
      let internshipStudentIds = new Set<string>();
      if (studentUserIds.length > 0) {
        const { data: internships } = await supabase
          .from("student_internships")
          .select("student_user_id")
          .in("student_user_id", studentUserIds)
          .in("status", ["assigned", "active"]);
        for (const si of (internships || []) as any[]) {
          internshipStudentIds.add(si.student_user_id);
        }
      }

      // Fetch program names for the students' program_ids
      const programIds = (studentRows || [])
        .map((s: any) => s.program_id)
        .filter(Boolean) as string[];
      let programMap: Record<string, string> = {};
      if (programIds.length > 0) {
        const { data: programRows } = await supabase
          .from("programs")
          .select("id, name")
          .in("id", programIds);
        for (const p of (programRows || []) as any[]) {
          programMap[p.id] = p.name || "Unnamed";
        }
      }

      const enriched: StudentRow[] = (studentRows || []).map((s: any) => {
        const profileRow = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        return {
          user_id: s.user_id,
          full_name: profileRow?.full_name || null,
          email: profileRow?.email || "",
          student_id_number: s.student_id_number,
          semester: s.semester ?? null,
          cgpa: s.cgpa ?? null,
          program_id: s.program_id || null,
          program_name: s.program_id ? programMap[s.program_id] || null : null,
          faculty_supervisor_id: s.faculty_supervisor_id,
          faculty_supervisor_name: s.faculty_supervisor_id
            ? supervisorMap[s.faculty_supervisor_id] || null
            : null,
          has_internship: internshipStudentIds.has(s.user_id),
        };
      });

      setStudents(enriched);
    } catch (err) {
      console.error("Error fetching students:", err);
      toast.error("Failed to load students");
    } finally {
      setIsLoading(false);
    }
  }, [departmentId]);

  // Fetch the programs that belong to this PC's department so the Add-Student
  // dialog can show them in a dropdown (spec §8: "Program have a dropdown of
  // all the programs added by the department coordinator").
  const fetchPrograms = useCallback(async () => {
    if (!departmentId) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, code")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setPrograms((data || []) as ProgramOption[]);
    } catch (err) {
      console.error("Error fetching programs:", err);
    }
  }, [departmentId]);

  // Fetch available faculty supervisors (from the PC's university)
  const fetchSupervisors = useCallback(async () => {
    if (!profile?.university_id) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("role", "faculty_supervisor")
        .eq("university_id", profile.university_id)
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setSupervisors((data || []) as SupervisorOption[]);
    } catch (err) {
      console.error("Error fetching supervisors:", err);
    }
  }, [profile?.university_id]);

  useEffect(() => {
    fetchStudents();
    fetchSupervisors();
    fetchPrograms();
  }, [fetchStudents, fetchSupervisors, fetchPrograms]);

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.full_name?.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterAssigned === "assigned" && !s.faculty_supervisor_id) return false;
    if (filterAssigned === "unassigned" && s.faculty_supervisor_id) return false;
    return true;
  });

  const assignedCount = students.filter((s) => s.faculty_supervisor_id).length;
  const unassignedCount = students.length - assignedCount;

  // Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredStudents.map((s) => s.user_id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Bulk assign
  const handleBulkAssign = async () => {
    if (!selectedSupervisorId || selectedIds.size === 0) {
      toast.error("Select a supervisor and at least one student");
      return;
    }
    setIsAssigning(true);
    try {
      const resp = await fetch("/api/department-coordinator/students/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_user_ids: Array.from(selectedIds),
          faculty_supervisor_id: selectedSupervisorId,
          skip_if_assigned: true,
        }),
      });
      const data = await resp.json();
      if (!data.success) {
        toast.error("Failed to assign", { description: data.error });
        return;
      }
      const msg = data.data?.already_assigned > 0
        ? `Assigned ${data.data.updated} student(s). ${data.data.already_assigned} already had a supervisor (skipped).`
        : `Assigned supervisor to ${data.data.updated} student(s).`;
      toast.success("Bulk assignment complete", { description: msg });
      setIsAssignDialogOpen(false);
      setSelectedIds(new Set());
      setSelectedSupervisorId("");
      fetchStudents();
    } catch (err) {
      toast.error("Failed to assign supervisor");
    } finally {
      setIsAssigning(false);
    }
  };

  // ===== Edit student =====
  const openEditDialog = (s: StudentRow) => {
    setEditTarget(s);
    setEditForm({
      full_name: s.full_name || "",
      student_id_number: s.student_id_number || "",
      cgpa: s.cgpa != null ? String(s.cgpa) : "",
      semester: s.semester != null ? String(s.semester) : "",
      program_id: s.program_id || "",
    });
    setIsEditOpen(true);
  };

  const handleSaveStudentEdit = async () => {
    if (!editTarget) return;
    const fullName = editForm.full_name.trim();
    const rollNo = editForm.student_id_number.trim();
    if (fullName.length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }
    if (rollNo.length < 3) {
      toast.error("Roll No must be at least 3 characters");
      return;
    }
    let cgpaValue: number | null = null;
    if (editForm.cgpa.trim()) {
      cgpaValue = parseFloat(editForm.cgpa);
      if (Number.isNaN(cgpaValue) || cgpaValue < 0 || cgpaValue > 4) {
        toast.error("CGPA must be between 0 and 4");
        return;
      }
    }
    const semester = editForm.semester ? parseInt(editForm.semester, 10) : null;

    setIsSavingEdit(true);
    try {
      // Primary path: the students CRUD API (PUT /api/students/[id]).
      // Only the fields UpdateStudentSchema allows are sent.
      const payload: Record<string, unknown> = {
        full_name: fullName,
        student_id_number: rollNo,
        cgpa: cgpaValue,
        semester,
      };
      if (editForm.program_id) payload.program_id = editForm.program_id;

      const res = await fetch(`/api/students/${editTarget.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let json: Record<string, unknown> | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (res.ok && json?.success) {
        toast.success("Student updated", {
          description: `${fullName}'s record was saved.`,
        });
        setIsEditOpen(false);
        setEditTarget(null);
        fetchStudents();
        return;
      }

      let apiError = "Request failed";
      if (json?.error) {
        apiError =
          typeof json.error === "string"
            ? json.error
            : (json.error as { message?: string }).message || "Request failed";
      } else if (typeof json?.message === "string") {
        apiError = json.message;
      }

      // The route currently accepts university_admin / department_coordinator
      // (and the student themself) — program_coordinator callers get 403.
      // Fall back to the RLS-permitted direct update of the `students` table
      // (migration 0086 grants PC updates for students in their own
      // department). The profile full_name lives in `profiles`, which RLS
      // does NOT let a PC edit — that is detected and reported honestly.
      if (res.status !== 403) {
        toast.error("Failed to update student", { description: apiError });
        return;
      }

      const supabase = createClient();
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        student_id_number: rollNo,
        cgpa: cgpaValue,
        semester,
      };
      if (editForm.program_id) updates.program_id = editForm.program_id;

      const { data: updatedRows, error: updateError } = await supabase
        .from("students")
        .update(updates)
        .eq("user_id", editTarget.user_id)
        .select("user_id");

      if (updateError) {
        const code = (updateError as { code?: string }).code;
        toast.error(code === "23505" ? "Roll No already in use" : "Failed to update student", {
          description:
            code === "23505"
              ? "A student with this Roll No already exists in your university."
              : updateError.message,
        });
        return;
      }
      if (!updatedRows || updatedRows.length === 0) {
        toast.error("Failed to update student", {
          description:
            apiError !== "Request failed"
              ? apiError
              : "You can only update students in your own department.",
        });
        return;
      }

      // Try to save the name on the profile row (RLS blocks PC → 0 rows).
      let nameSaved = fullName === (editTarget.full_name || "");
      if (!nameSaved) {
        const { data: nameRows } = await supabase
          .from("profiles")
          .update({ full_name: fullName, updated_at: new Date().toISOString() })
          .eq("user_id", editTarget.user_id)
          .select("user_id");
        nameSaved = !!nameRows && nameRows.length > 0;
      }

      setIsEditOpen(false);
      setEditTarget(null);
      fetchStudents();
      if (nameSaved) {
        toast.success("Student updated", { description: "Academic record saved." });
      } else {
        toast.warning("Academic record saved — name unchanged", {
          description:
            "Roll No, CGPA, semester and program were saved. Changing the student's profile name requires a University Admin or Department Coordinator.",
        });
      }
    } catch (err) {
      toast.error("Failed to update student", { err });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ===== Delete student =====
  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/students/${deleteTarget.user_id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || json?.error || "Request failed");
      }
      toast.success("Student deleted", {
        description: `${deleteTarget.full_name || deleteTarget.email} and all their personal data were permanently removed.`,
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.user_id);
        return next;
      });
      setDeleteTarget(null);
      fetchStudents();
    } catch (err) {
      toast.error("Failed to delete student", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!departmentId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Students" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your account is not linked to a department yet. Ask your University Admin / Department Coordinator to assign you to a department.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Students in your program. Assign supervisors individually or in bulk."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setIsAddStudentOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
            <Button
              onClick={() => setIsAssignDialogOpen(true)}
              disabled={selectedIds.size === 0}
              variant="outline"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Bulk Assign ({selectedIds.size})
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Students" value={students.length} icon={GraduationCap} variant="info" />
        <StatCard label="Supervisor Assigned" value={assignedCount} icon={UserCheck} variant="success" />
        <StatCard label="Unassigned" value={unassignedCount} icon={AlertCircle} variant={unassignedCount > 0 ? "warning" : "default"} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterAssigned} onValueChange={setFilterAssigned}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterAssigned !== "all") && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setFilterAssigned("all"); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No students found</h3>
            <p className="text-muted-foreground">
              {searchQuery || filterAssigned !== "all"
                ? "No students match your filters."
                : "No students have been added to your program yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                onCheckedChange={(v) => v ? selectAll() : deselectAll()}
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${filteredStudents.length} students`}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Clear selection
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Sem.</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Internship</TableHead>
                  <TableHead className="w-[96px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(s.user_id)}
                        onCheckedChange={() => toggleSelect(s.user_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {s.student_id_number || "—"}
                      </code>
                    </TableCell>
                    <TableCell>
                      {s.program_name ? (
                        <span className="text-sm">{s.program_name}</span>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Not set
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.semester ? (
                        <span className="text-sm">Sem {s.semester}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.faculty_supervisor_name ? (
                        <span className="text-sm">{s.faculty_supervisor_name}</span>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Not assigned
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.has_internship ? (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">None</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Edit student"
                          onClick={() => openEditDialog(s)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit student</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete student"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete student</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Student Dialog */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              Create a new student in your department. The student will be assigned to the selected program.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="student-full-name">Full Name *</Label>
              <Input
                id="student-full-name"
                placeholder="e.g. Ahmed Khan"
                value={studentForm.full_name}
                onChange={(e) => setStudentForm((f) => ({ ...f, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student-email">Email *</Label>
                <Input
                  id="student-email"
                  type="email"
                  placeholder="e.g. ahmed@university.edu.pk"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-id-number">Roll No *</Label>
                <Input
                  id="student-id-number"
                  placeholder="e.g. 2022-CS-001"
                  value={studentForm.student_id_number}
                  onChange={(e) => setStudentForm((f) => ({ ...f, student_id_number: e.target.value }))}
                  required
                />
              </div>
            </div>
            <PasswordField
              id="student-password"
              label="Password"
              value={studentForm.password}
              onChange={(v) => setStudentForm((f) => ({ ...f, password: v }))}
              hint="The student will use this password to sign in. They can change it after first login."
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student-program">Program</Label>
                {/* Read-only: every student created by a Program Coordinator
                    is enrolled in the COORDINATOR'S OWN program (business
                    rule 2026-08-26) — the server forces this too, so the
                    field is informational rather than a dropdown. */}
                <div
                  id="student-program"
                  className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm"
                >
                  {(() => {
                    if (!profile?.program_id) return "No program assigned to your account";
                    const mine = programs.find((p) => p.id === profile.program_id);
                    return mine ? `${mine.name}${mine.code ? ` (${mine.code})` : ""}` : "Your assigned program";
                  })()}
                </div>
                {!profile?.program_id && (
                  <p className="text-xs text-destructive">
                    Your coordinator account has no program assigned. Ask your University Admin to link you to a program before adding students.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Students you add are automatically enrolled in your program.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-semester">Semester *</Label>
                <Select
                  value={studentForm.semester}
                  onValueChange={(v) => setStudentForm((f) => ({ ...f, semester: v }))}
                >
                  <SelectTrigger id="student-semester">
                    <SelectValue placeholder="Select semester (1–12)" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        Semester {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Optional details — collapsed-style section so the required
                fields stay above the fold. CGPA, enrollment year, and
                expected graduation are not in the product spec's required
                fields but are kept for backwards-compat with existing rows. */}
            <details className="rounded-md border bg-muted/30 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium select-none">
                Optional details
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="enrollment-year">Enrollment Year</Label>
                  <Input
                    id="enrollment-year"
                    type="number"
                    placeholder="e.g. 2022"
                    value={studentForm.enrollment_year}
                    onChange={(e) => setStudentForm((f) => ({ ...f, enrollment_year: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-cgpa">CGPA</Label>
                  <Input
                    id="student-cgpa"
                    type="number"
                    min="0"
                    max="4"
                    step="0.01"
                    placeholder="0 - 4"
                    value={studentForm.cgpa}
                    onChange={(e) => setStudentForm((f) => ({ ...f, cgpa: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label htmlFor="expected-graduation">Expected Graduation</Label>
                <Input
                  id="expected-graduation"
                  type="date"
                  value={studentForm.expected_graduation}
                  onChange={(e) => setStudentForm((f) => ({ ...f, expected_graduation: e.target.value }))}
                />
              </div>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStudentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Validate required fields per the product spec:
                // Full name, Roll No, Semester, Program, Email, Password.
                if (!studentForm.full_name.trim()) {
                  toast.error("Full name is required");
                  return;
                }
                if (!studentForm.email.trim()) {
                  toast.error("Email is required");
                  return;
                }
                if (!studentForm.password) {
                  toast.error("Password is required");
                  return;
                }
                if (studentForm.password.length < 8) {
                  toast.error("Password must be at least 8 characters");
                  return;
                }
                if (!studentForm.student_id_number.trim()) {
                  toast.error("Roll No is required");
                  return;
                }
                // Program is forced server-side to the coordinator's own
                // program; block submission early if the account has none.
                if (!profile?.program_id) {
                  toast.error("No program assigned to your account", {
                    description: "Ask your University Admin to link your coordinator account to a program first.",
                  });
                  return;
                }
                if (!studentForm.semester) {
                  toast.error("Please select a semester");
                  return;
                }
                const sem = parseInt(studentForm.semester, 10);
                if (Number.isNaN(sem) || sem < 1 || sem > 12) {
                  toast.error("Semester must be between 1 and 12");
                  return;
                }
                setIsAdding(true);
                try {
                  const resp = await fetch("/api/students", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      full_name: studentForm.full_name.trim(),
                      email: studentForm.email.trim(),
                      password: studentForm.password,
                      student_id_number: studentForm.student_id_number.trim(),
                      semester: sem,
                      // Sent for reference only — the server forces this to
                      // the coordinator's own program regardless.
                      program_id: profile?.program_id,
                      department_id: profile?.department_id,
                      university_id: profile?.university_id,
                      enrollment_year: studentForm.enrollment_year ? parseInt(studentForm.enrollment_year, 10) : null,
                      expected_graduation: studentForm.expected_graduation || null,
                      cgpa: studentForm.cgpa ? parseFloat(studentForm.cgpa) : null,
                    }),
                  });
                  const data = await resp.json();
                  if (!data.success) {
                    toast.error("Failed to create student", { description: data.error });
                    return;
                  }
                  toast.success("Student created successfully");
                  setIsAddStudentOpen(false);
                  setStudentForm({
                    full_name: "",
                    email: "",
                    password: "",
                    student_id_number: "",
                    semester: "",
                    program_id: "",
                    enrollment_year: "",
                    expected_graduation: "",
                    cgpa: "",
                  });
                  fetchStudents();
                } catch (err) {
                  toast.error("Failed to create student", { err });
                } finally {
                  setIsAdding(false);
                }
              }}
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Student"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Supervisor to {selectedIds.size} Student(s)</DialogTitle>
            <DialogDescription>
              Select a faculty supervisor. Students who already have a supervisor
              will be skipped (not overwritten).
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {supervisors.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">No supervisors available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No faculty supervisors exist in your university yet. Create
                    one first using the Supervisors page.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Faculty Supervisor</label>
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>
                        {s.full_name || s.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={isAssigning || !selectedSupervisorId || supervisors.length === 0}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Supervisor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Student Dialog ===== */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) setEditTarget(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Student
            </DialogTitle>
            <DialogDescription>
              Update the record for {editTarget?.full_name || editTarget?.email}.
              Roll No, CGPA, semester and program are saved immediately; the
              profile name may require an administrator.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-student-full-name">Full Name *</Label>
              <Input
                id="edit-student-full-name"
                placeholder="e.g. Ahmed Khan"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Requires University Admin / Department Coordinator permissions —
                you will be told if the name could not be saved.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-student-roll">Roll No *</Label>
                <Input
                  id="edit-student-roll"
                  placeholder="e.g. 2022-CS-001"
                  value={editForm.student_id_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, student_id_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-student-cgpa">CGPA</Label>
                <Input
                  id="edit-student-cgpa"
                  type="number"
                  min="0"
                  max="4"
                  step="0.01"
                  placeholder="0 - 4"
                  value={editForm.cgpa}
                  onChange={(e) => setEditForm((f) => ({ ...f, cgpa: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-student-semester">Semester</Label>
                <Select
                  value={editForm.semester}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, semester: v }))}
                >
                  <SelectTrigger id="edit-student-semester">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        Semester {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-student-program">Program</Label>
                {programs.length > 0 ? (
                  <Select
                    value={editForm.program_id}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, program_id: v }))}
                  >
                    <SelectTrigger id="edit-student-program">
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.code ? ` (${p.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div
                    id="edit-student-program"
                    className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground"
                  >
                    {editTarget?.program_name || "No programs available"}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Students stay within your department.
                </p>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveStudentEdit} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Student Confirmation ===== */}
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
              This will permanently delete <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>{" "}
              ({deleteTarget?.email}).
            </span>
            <span className="block bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              This action <strong>cannot be undone</strong>. The account, its sign-in
              credentials and all of the student&apos;s data are permanently removed:
              internship applications, weekly logs, evaluations, submissions,
              attendance, certificates and documents.
            </span>
          </span>
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete Student"}
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDeleteStudent}
      />

      {/* ===== CSV Bulk Import Dialog ===== */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); }}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Students from CSV</DialogTitle>
            <DialogDescription>
              {importPhase === "upload" && "Upload a CSV of students for your program. Everything is validated before any account is created."}
              {importPhase === "preview" && "Review the validation results, then confirm to create the valid accounts."}
              {importPhase === "results" && "Import finished. Details below."}
            </DialogDescription>
          </DialogHeader>

          {importPhase === "upload" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                <span>
                  Students are always created in <strong>your program</strong> — university,
                  department and program are taken from your account and cannot be overridden by
                  the CSV.
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadCsvTemplate}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (document.getElementById("pc-csv-input") as HTMLInputElement | null)?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV File
                </Button>
                <input
                  id="pc-csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>

              {importCsvName && (
                <p className="text-sm">
                  Selected: <span className="font-medium">{importCsvName}</span>
                </p>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Required columns: <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>student_id_number</code></p>
                <p>Optional columns: <code>semester</code> (1–12), <code>enrollment_year</code> (e.g. 2026), <code>expected_graduation</code> (YYYY-MM-DD), <code>cgpa</code> (0–4)</p>
                <p>Header row required (case-insensitive). Maximum 500 rows per import.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="pc-import-password" className="text-sm font-medium">
                  Shared initial password
                </label>
                <Input
                  id="pc-import-password"
                  type="text"
                  autoComplete="off"
                  placeholder="At least 8 characters — used for every account"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Students change this after their first sign-in.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetImportDialog}>Cancel</Button>
                <Button onClick={handleValidateCsv} disabled={isValidating || !importCsvText.trim()}>
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating…
                    </>
                  ) : (
                    "Validate CSV"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {importPhase === "preview" && validation && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-2">
                  <div className="text-lg font-semibold">{validation.total}</div>
                  <div className="text-xs text-muted-foreground">Rows</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">{validation.valid}</div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">{validation.invalid}</div>
                  <div className="text-xs text-muted-foreground">With errors</div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Confirming creates accounts for the <strong>{validation.valid}</strong> valid row(s)
                {validation.invalid > 0 && <> and skips the {validation.invalid} row(s) with errors</>}.
              </p>

              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validation.details.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{r.name || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.email || "—"}</TableCell>
                        <TableCell>
                          {r.valid ? (
                            <Badge variant="default" className="bg-green-600">Ready</Badge>
                          ) : (
                            <Badge variant="destructive" title={r.error}>{r.error || "Invalid"}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportPhase("upload")} disabled={isCommitting}>
                  Back
                </Button>
                <Button onClick={handleConfirmImport} disabled={isCommitting || validation.valid === 0}>
                  {isCommitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    `Import ${validation.valid} Student${validation.valid === 1 ? "" : "s"}`
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {importPhase === "results" && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  {importResult.created} student account(s) created in your program.
                </span>
              </div>
              {importResult.invalid > 0 && (
                <p className="text-sm text-muted-foreground">
                  {importResult.invalid} row(s) were skipped:
                </p>
              )}
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.details
                      .filter((r) => !r.created)
                      .map((r) => (
                        <TableRow key={r.row}>
                          <TableCell>{r.row}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{r.email || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" title={r.error}>{r.error || "Skipped"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button onClick={resetImportDialog}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
