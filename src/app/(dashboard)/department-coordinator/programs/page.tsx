"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Users,
  BookOpen,
  MoreVertical,
  Filter,
  X,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";
import { createClient } from "@/utils/supabase/client";
import type { Profile } from "@/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "@/components/shared/toast";

interface Program {
  id: string;
  name: string;
  code: string;
  description: string | null;
  duration_weeks: number;
  is_active: boolean;
  university_id: string;
  department_id: string;
  default_faculty_supervisor_id: string | null;
  student_count?: number;
  created_at: string;
  updated_at: string;
  supervisor?: { full_name: string | null; email: string } | null;
}

interface ProgramFormData {
  name: string;
  code: string;
  description: string;
  duration_weeks: number;
  default_faculty_supervisor_id: string;
  is_active: boolean;
  // Cascading account creation: when a Department Coordinator creates
  // a new program, they simultaneously create the faculty_supervisor
  // account that will own it. Mirrors the university+admin and
  // department+coordinator cascading flows. Eliminates the previous
  // "no faculty supervisors found, ask your admin to create one"
  // chicken-and-egg dead-end that stranded coordinators on an empty
  // supervisor dropdown.
  supervisorEmail: string;
  supervisorPassword: string;
  supervisorName: string;
  // Specialization of the supervisor (e.g., "Software Engineering",
  // "Data Science"). Stored on the `supervisors.specialization` column
  // and shown on the Supervisors page. Optional — falls back to the
  // program name if left blank, so the column is never empty.
  supervisorSpecialization: string;
}

const emptyForm: ProgramFormData = {
  name: "",
  code: "",
  description: "",
  duration_weeks: 8,
  default_faculty_supervisor_id: "",
  is_active: true,
  supervisorEmail: "",
  supervisorPassword: "",
  supervisorName: "",
  supervisorSpecialization: "",
};

export default function ProgramsPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);

  // Fetch faculty supervisors available to this coordinator's department.
  // Faculty supervisors are profiles with role='faculty_supervisor' in
  // the same university (and optionally same department). They're the
  // pool the coordinator can allot to a program.
  // Filter by `department_id` (NOT `university_id`) — a coordinator should
  // only see and assign faculty supervisors from THEIR OWN department, not
  // every supervisor in the university. The previous `university_id` filter
  // was a cross-department data leak: a coordinator could see and assign
  // supervisors from sibling departments in the same university.
  const fetchSupervisors = useCallback(async () => {
    if (!profile?.department_id) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("department_id", profile.department_id)
        .eq("role", "faculty_supervisor")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      setSupervisors(data || []);
    } catch (error) {
      console.error("Error fetching faculty supervisors:", error);
    }
  }, [profile?.department_id]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  // Fetch programs
  const fetchPrograms = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterActive !== "all") params.set("is_active", filterActive);

      const res = await fetch(`/api/programs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPrograms(data.data.data || []);
        }
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterActive]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // When CREATING a new program, the supervisor account fields are
    // required (cascading creation flow). When editing, they're hidden
    // and the existing supervisor dropdown is used instead.
    if (!editingProgram) {
      if (!formData.supervisorEmail.trim() || !formData.supervisorEmail.includes("@")) {
        toast.error("Validation error", { description: "A valid supervisor email is required." });
        setIsSubmitting(false);
        return;
      }
      if (!formData.supervisorPassword || formData.supervisorPassword.length < 8) {
        toast.error("Validation error", { description: "Supervisor password must be at least 8 characters." });
        setIsSubmitting(false);
        return;
      }
      if (!formData.supervisorName.trim()) {
        toast.error("Validation error", { description: "Supervisor name is required." });
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // Strip the cascading-account-creation fields from the payload
      // sent to /api/programs — that route only knows about program
      // columns. When creating, we also leave default_faculty_supervisor_id
      // empty: the supervisor auth account doesn't exist yet. After
      // the program is created and the supervisor account is created,
      // we PUT /api/programs again to link them.
      const {
        supervisorEmail: _se,
        supervisorPassword: _sp,
        supervisorName: _sn,
        supervisorSpecialization: _ss,
        ...programPayload
      } = formData;

      if (!editingProgram) {
        // CREATE: clear default_faculty_supervisor_id — we'll set it
        // after the supervisor account exists.
        programPayload.default_faculty_supervisor_id = "";
      }

      const url = editingProgram ? "/api/programs" : "/api/programs";
      const method = editingProgram ? "PUT" : "POST";

      const body = editingProgram
        ? { ...programPayload, id: editingProgram.id }
        : programPayload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error("Failed to save program", { description: data.error || data.message || "Unknown error" });
        setIsSubmitting(false);
        return;
      }

      // CREATING: now create the faculty_supervisor auth account via
      // /api/admin/create-user. The route's COORD_TARGET_ROLES list
      // allows department_coordinator callers to create faculty_supervisor
      // accounts, and force-sets university_id and department_id from
      // the caller's own profile (defense-in-depth — the body values
      // are ignored). The new supervisor can sign in immediately.
      if (!editingProgram && data.data?.id) {
        const programId = data.data.id;
        let supervisorUserId: string | null = null;
        let supervisorWarning: string | null = null;

        try {
          const createRes = await fetch("/api/admin/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.supervisorEmail.trim(),
              password: formData.supervisorPassword,
              full_name: formData.supervisorName.trim(),
              role: "faculty_supervisor",
              // These are force-set by the route from the caller's
              // profile, but we pass them anyway for clarity.
              university_id: profile?.university_id,
              department_id: profile?.department_id,
              job_title: `Faculty Supervisor — ${formData.name.trim()}`,
              // Specialization is stored on supervisors.specialization
              // and shown on the Supervisors page. If the coordinator
              // did not enter one, fall back to the program name so
              // the column is never blank.
              specialization:
                formData.supervisorSpecialization.trim() ||
                formData.name.trim(),
            }),
          });

          const createJson = await createRes.json();

          if (!createRes.ok || !createJson?.success) {
            console.error("Supervisor creation error:", createJson?.error);
            supervisorWarning =
              createJson?.error || `Request failed (${createRes.status})`;
          } else {
            supervisorUserId = createJson?.data?.id ?? null;
            if (createJson?.warning) {
              supervisorWarning = createJson.warning;
            }
          }
        } catch (adminError: any) {
          console.error("Supervisor creation error:", adminError);
          supervisorWarning = adminError?.message || "Unknown error";
        }

        // If the supervisor account was created successfully, link it
        // to the program via PUT /api/programs. This sets
        // default_faculty_supervisor_id, which is what the program
        // card and detail pages display.
        if (supervisorUserId) {
          const linkRes = await fetch("/api/programs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: programId,
              name: programPayload.name,
              code: programPayload.code,
              description: programPayload.description,
              duration_weeks: programPayload.duration_weeks,
              default_faculty_supervisor_id: supervisorUserId,
              is_active: programPayload.is_active,
            }),
          });

          const linkJson = await linkRes.json();
          if (!linkRes.ok || !linkJson?.success) {
            console.error("Failed to link supervisor to program:", linkJson?.error);
            supervisorWarning =
              (supervisorWarning ? supervisorWarning + " " : "") +
              `Supervisor account created but failed to link to program: ${linkJson?.error || linkRes.status}. You can link them manually via Edit.`;
          }
        }

        if (supervisorWarning) {
          toast.error("Program created (with warning)", { description: supervisorWarning });
        } else {
          toast.success("Program created", { description: `\"${formData.name}\" and its supervisor account were created successfully.` });
        }
      }

      await fetchPrograms();
      // Refresh the supervisors list so the newly-created supervisor
      // appears in the edit-mode dropdown if the coordinator edits
      // the program later.
      await fetchSupervisors();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving program:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to save program" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/programs?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setPrograms(programs.filter((p) => p.id !== id));
        setDeleteConfirmId(null);
        toast.success("Program deleted");
      } else {
        toast.error("Failed to delete program", { description: data.error || "Unknown error" });
      }
    } catch (error) {
      console.error("Error deleting program:", error);
      toast.error("Error", { description: "Failed to delete program" });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData(emptyForm);
    setEditingProgram(null);
  };

  // Open edit dialog
  const openEditDialog = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      code: program.code,
      description: program.description || "",
      duration_weeks: program.duration_weeks,
      default_faculty_supervisor_id: program.default_faculty_supervisor_id || "",
      is_active: program.is_active,
      // Cascading-account-creation fields are CREATE-mode only. They're
      // initialized to empty so the form state is well-typed; the
      // dialog hides them when editing.
      supervisorEmail: "",
      supervisorPassword: "",
      supervisorName: "",
      supervisorSpecialization: "",
    });
    setIsDialogOpen(true);
  };

  // Get the supervisor display name for a program.
  // Tries the joined `supervisor` object first (from the API), then
  // falls back to looking up the supervisors list we fetched.
  const supervisorNameFor = (program: Program): string | null => {
    if (program.supervisor?.full_name) return program.supervisor.full_name;
    if (program.supervisor?.email) return program.supervisor.email;
    if (program.default_faculty_supervisor_id) {
      const sup = supervisors.find(
        (s) => s.user_id === program.default_faculty_supervisor_id
      );
      if (sup) return sup.full_name || sup.email;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Programs"
        description="Manage internship programs in your department"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Program
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingProgram ? "Edit Program" : "Create New Program"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProgram
                      ? "Update the program details below."
                      : "Add a new internship program to your department."}
                  </DialogDescription>
                </DialogHeader>

              <div className="grid gap-4 px-6 py-4 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Program Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Computer Science Internship"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Program Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g., CS-INT"
                      required
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of the program..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (Weeks) *</Label>
                  <Select
                    value={formData.duration_weeks.toString()}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        duration_weeks: parseInt(val),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 6, 8, 12, 16, 24].map((weeks) => (
                        <SelectItem key={weeks} value={weeks.toString()}>
                          {weeks} weeks
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editingProgram ? (
                  // EDIT mode: show the existing supervisor dropdown
                  // so the coordinator can reassign to any existing
                  // faculty supervisor in the department.
                  <div className="space-y-2">
                    <Label htmlFor="supervisor">Allot Faculty Supervisor</Label>
                    <Select
                      value={formData.default_faculty_supervisor_id || "__none__"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          default_faculty_supervisor_id:
                            value === "__none__" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger id="supervisor">
                        <SelectValue placeholder="Select a faculty supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None allotted</SelectItem>
                        {supervisors.map((sup) => (
                          <SelectItem key={sup.user_id} value={sup.user_id}>
                            {sup.full_name || sup.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The allotted supervisor will be the default faculty supervisor
                      for students enrolling in this program. You can change this later.
                    </p>
                  </div>
                ) : (
                  // CREATE mode: cascading account creation. The
                  // coordinator fills in the new faculty_supervisor's
                  // credentials here. On submit, the program is created
                  // AND the supervisor auth account is created and
                  // auto-linked as the default supervisor.
                  <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">Faculty Supervisor Account</h4>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-2">
                      This supervisor will be created automatically and assigned as the default supervisor for this program. They can sign in immediately with the email and password below, and can then assign students to the program.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="supervisorName">Supervisor Name *</Label>
                      <Input
                        id="supervisorName"
                        placeholder="e.g., Prof. Ahmed Raza"
                        value={formData.supervisorName}
                        onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supervisorSpecialization">Specialization</Label>
                      <Input
                        id="supervisorSpecialization"
                        placeholder="e.g., Software Engineering, Data Science"
                        value={formData.supervisorSpecialization}
                        onChange={(e) => setFormData({ ...formData, supervisorSpecialization: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Shown on the Supervisors page. If left blank, the program name is used.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supervisorEmail">Supervisor Email *</Label>
                      <Input
                        id="supervisorEmail"
                        type="email"
                        placeholder="supervisor@university.edu"
                        value={formData.supervisorEmail}
                        onChange={(e) => setFormData({ ...formData, supervisorEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supervisorPassword">Supervisor Password *</Label>
                      <Input
                        id="supervisorPassword"
                        type="text"
                        placeholder="At least 8 characters"
                        value={formData.supervisorPassword}
                        onChange={(e) => setFormData({ ...formData, supervisorPassword: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Share this password with the supervisor. They can change it after first sign-in.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="cursor-pointer">
                      Active Status
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Inactive programs won't accept new enrollments
                    </p>
                  </div>
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingProgram ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || filterActive !== "all") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterActive("all");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Programs List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : programs.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10 text-muted-foreground" />}
          title="No programs found"
          description={
            searchQuery || filterActive !== "all"
              ? "Try adjusting your search or filters"
              : "Get started by creating your first program"
          }
          action={
            !searchQuery && filterActive === "all"
              ? { label: "Create Program", onClick: () => setIsDialogOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Cards View for Mobile */}
          <div className="md:hidden space-y-3">
            <AnimatePresence mode="popLayout">
              {programs.map((program) => (
                <motion.div
                  key={program.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{program.name}</p>
                            <p className="text-sm text-muted-foreground">{program.code}</p>
                          </div>
                        </div>
                        <Badge variant={program.is_active ? "default" : "secondary"}>
                          {program.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      {program.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {program.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {program.duration_weeks} weeks
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {program.student_count || 0} students
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground mb-3 truncate">
                        <span className="font-medium">Supervisor:</span>{" "}
                        {supervisorNameFor(program) || (
                          <Badge variant="outline" className="text-xs">Not allotted</Badge>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditDialog(program)}
                        >
                          <Edit3 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(program.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
                  <TableHead>Program</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {programs.map((program) => (
                    <motion.tr
                      key={program.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div className="max-w-[200px]">
                            <p className="font-medium truncate">{program.name}</p>
                            {expandedProgram === program.id && program.description && (
                              <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="text-xs text-muted-foreground mt-1 line-clamp-2"
                              >
                                {program.description}
                              </motion.p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {program.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        {supervisorNameFor(program) ? (
                          <span className="text-sm">{supervisorNameFor(program)}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Not allotted
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{program.duration_weeks} weeks</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {program.student_count || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={program.is_active ? "default" : "secondary"} className="gap-1">
                          {program.is_active ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {program.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setExpandedProgram(
                              expandedProgram === program.id ? null : program.id
                            )}>
                              {expandedProgram === program.id ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-2" /> Show Less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-2" /> View Details
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(program)}>
                              <Edit3 className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteConfirmId(program.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
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
          <div className="text-sm text-muted-foreground px-1">
            Showing {programs.length} program{programs.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Program?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The program will be permanently removed.
              Students enrolled in this program will need to be reassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
