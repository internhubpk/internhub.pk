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
  Loader2,
  Users,
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
import { toast } from "@/components/shared/toast";

interface StudentRow {
  user_id: string;
  full_name: string | null;
  email: string;
  student_id_number: string | null;
  faculty_supervisor_id: string | null;
  faculty_supervisor_name: string | null;
  has_internship: boolean;
}

interface SupervisorOption {
  user_id: string;
  full_name: string | null;
  email: string;
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
    student_id_number: "",
    enrollment_year: "",
    expected_graduation: "",
    cgpa: "",
  });

  const programId = profile?.program_id;

  const fetchStudents = useCallback(async () => {
    if (!programId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch students in this program with their profiles
      const { data: studentRows, error } = await supabase
        .from("students")
        .select(`
          user_id,
          student_id_number,
          faculty_supervisor_id,
          profiles:user_id (full_name, email)
        `)
        .eq("program_id", programId)
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

      const enriched: StudentRow[] = (studentRows || []).map((s: any) => {
        const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        return {
          user_id: s.user_id,
          full_name: profile?.full_name || null,
          email: profile?.email || "",
          student_id_number: s.student_id_number,
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
  }, [programId]);

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
  }, [fetchStudents, fetchSupervisors]);

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

  if (!programId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Students" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your account is not linked to a program yet.
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
                  <TableHead>Reg. No.</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Internship</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Student Dialog */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              Create a new student in your program.
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
              <Label htmlFor="student-id-number">Student ID Number</Label>
              <Input
                id="student-id-number"
                placeholder="e.g. 2022-CS-001"
                value={studentForm.student_id_number}
                onChange={(e) => setStudentForm((f) => ({ ...f, student_id_number: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="expected-graduation">Expected Graduation</Label>
              <Input
                id="expected-graduation"
                type="date"
                value={studentForm.expected_graduation}
                onChange={(e) => setStudentForm((f) => ({ ...f, expected_graduation: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStudentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!studentForm.full_name.trim() || !studentForm.email.trim()) {
                  toast.error("Full name and email are required");
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
                      student_id_number: studentForm.student_id_number.trim() || null,
                      enrollment_year: studentForm.enrollment_year ? parseInt(studentForm.enrollment_year, 10) : null,
                      expected_graduation: studentForm.expected_graduation || null,
                      cgpa: studentForm.cgpa ? parseFloat(studentForm.cgpa) : null,
                      department_id: profile?.department_id,
                      program_id: profile?.program_id,
                      university_id: profile?.university_id,
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
                    student_id_number: "",
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
        <DialogContent className="sm:max-w-md">
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
    </div>
  );
}
