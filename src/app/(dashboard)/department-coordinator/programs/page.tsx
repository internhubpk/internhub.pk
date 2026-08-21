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
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info,
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
  // duration_weeks was REMOVED from the programs table in migration 0076.
  // Programs no longer have a fixed week count.
  is_active: boolean;
  university_id: string;
  department_id: string;
  default_faculty_supervisor_id: string | null;
  default_external_evaluator_id?: string | null;
  student_count?: number;
  created_at: string;
  updated_at: string;
  supervisor?: { full_name: string | null; email: string } | null;
  external_evaluator?: { full_name: string | null; email: string } | null;
}

interface ProgramFormData {
  name: string;
  code: string;
  description: string;
  default_faculty_supervisor_id: string;
  default_external_evaluator_id: string;
  is_active: boolean;
}

const emptyForm: ProgramFormData = {
  name: "",
  code: "",
  description: "",
  default_faculty_supervisor_id: "",
  default_external_evaluator_id: "",
  is_active: true,
};

export default function ProgramsPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [externalEvaluators, setExternalEvaluators] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);

  // Fetch faculty supervisors AND external evaluators available to this
  // coordinator's department. Faculty supervisors are filtered to the
  // coordinator's own department only (no cross-department leak).
  // External evaluators are fetched university-wide because they may be
  // cross-department / industry experts.
  const fetchSupervisors = useCallback(async () => {
    if (!profile?.department_id) return;
    try {
      const supabase = createClient();
      const [facRes, extRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("department_id", profile.department_id)
          .eq("role", "faculty_supervisor")
          .eq("is_active", true)
          .order("full_name"),
        // External evaluators are cross-department; filter by university
        // (or no filter at all if university_id is missing).
        profile.university_id
          ? supabase
              .from("profiles")
              .select("*")
              .eq("university_id", profile.university_id)
              .eq("role", "external_evaluator")
              .eq("is_active", true)
              .order("full_name")
          : supabase
              .from("profiles")
              .select("*")
              .eq("role", "external_evaluator")
              .eq("is_active", true)
              .order("full_name"),
      ]);

      if (facRes.error) throw facRes.error;
      if (extRes.error) throw extRes.error;
      setSupervisors(facRes.data || []);
      setExternalEvaluators(extRes.data || []);
    } catch (error) {
      console.error("Error fetching supervisors/evaluators:", error);
    }
  }, [profile?.department_id, profile?.university_id]);

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

    try {
      // Program creation: just send the program fields to /api/programs.
      // The API auto-creates a Program Coordinator account (separate role)
      // and links it to the new program. Per InternHub spec, Department
      // Coordinators must NOT create supervisors — that's the Program
      // Coordinator's responsibility after the program exists.
      // Send the program fields to /api/programs. The API route
      // auto-creates a Program Coordinator account (separate role) and
      // links it to the new program. Department Coordinators do NOT
      // create supervisors — that's the Program Coordinator's job.
      const programPayload = { ...formData };
      // Clear supervisor defaults on CREATE (no supervisor assigned yet).
      if (!editingProgram) {
        programPayload.default_faculty_supervisor_id = "";
        programPayload.default_external_evaluator_id = "";
      }

      const url = "/api/programs";
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

      // The API auto-creates a Program Coordinator account when a new
      // program is created. Show that info in the success toast.
      if (!editingProgram) {
        toast.success("Program created", {
          description: data.message || `\"${formData.name}\" was created. A Program Coordinator account has been auto-provisioned.`,
        });
      } else {
        toast.success("Program updated", { description: `\"${formData.name}\" was updated successfully.` });
      }

      await fetchPrograms();
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
      default_faculty_supervisor_id: program.default_faculty_supervisor_id || "",
      default_external_evaluator_id: program.default_external_evaluator_id || "",
      is_active: program.is_active,
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

  // Get the external evaluator display name for a program.
  // Same lookup pattern as supervisorNameFor.
  const externalEvaluatorNameFor = (program: Program): string | null => {
    if (program.external_evaluator?.full_name) return program.external_evaluator.full_name;
    if (program.external_evaluator?.email) return program.external_evaluator.email;
    if (program.default_external_evaluator_id) {
      const ev = externalEvaluators.find(
        (s) => s.user_id === program.default_external_evaluator_id
      );
      if (ev) return ev.full_name || ev.email;
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

                {/* Duration (weeks) field REMOVED — programs no longer have
                    a fixed week count per InternHub spec (migration 0076). */}

                {editingProgram ? (
                  // EDIT mode: show dropdowns for both the default
                  // faculty supervisor AND the default external
                  // evaluator. Either can be left "None allotted".
                  <div className="space-y-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="externalEvaluator">Allot External Evaluator</Label>
                      <Select
                        value={formData.default_external_evaluator_id || "__none__"}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            default_external_evaluator_id:
                              value === "__none__" ? "" : value,
                          })
                        }
                      >
                        <SelectTrigger id="externalEvaluator">
                          <SelectValue placeholder="Select an external evaluator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None allotted</SelectItem>
                          {externalEvaluators.map((ev) => (
                            <SelectItem key={ev.user_id} value={ev.user_id}>
                              {ev.full_name || ev.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The allotted evaluator will be the default external evaluator
                        for students enrolling in this program. Leave as &quot;None
                        allotted&quot; if not applicable. You can change this later.
                      </p>
                    </div>
                  </div>
                ) : (
                  // CREATE mode: NO supervisor cascade creation.
                  // Per InternHub spec, Department Coordinators must NOT
                  // create supervisors — the Program Coordinator (auto-
                  // created by the API) is responsible for adding
                  // supervisors and assigning students to them.
                  <>
                  <div className="space-y-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-semibold">Program Coordinator Auto-Creation</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When you create this program, a Program Coordinator
                      account will be automatically provisioned (separate
                      from supervisors). The Program Coordinator is
                      responsible for adding students, supervisors, and
                      assigning students to supervisors. You can add a
                      default faculty supervisor and external evaluator
                      later via Edit once they exist.
                    </p>
                  </div>

                  {/* CREATE mode: optional external evaluator picker.
                      The evaluator must already exist (created via the
                      Supervisors page). If none exists yet, the
                      coordinator can still create the program and add
                      the evaluator later via Edit. */}
                  <div className="space-y-2">
                    <Label htmlFor="externalEvaluatorCreate">Allot External Evaluator (optional)</Label>
                    <Select
                      value={formData.default_external_evaluator_id || "__none__"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          default_external_evaluator_id:
                            value === "__none__" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger id="externalEvaluatorCreate">
                        <SelectValue placeholder="Select an external evaluator" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None allotted</SelectItem>
                        {externalEvaluators.map((ev) => (
                          <SelectItem key={ev.user_id} value={ev.user_id}>
                            {ev.full_name || ev.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Optional. The allotted evaluator will be the default external
                      evaluator for students enrolling in this program. You can
                      change this later via Edit.
                    </p>
                  </div>
                  </>
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
                          <Users className="h-4 w-4" />
                          {program.student_count || 0} students
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground mb-1 truncate">
                        <span className="font-medium">Supervisor:</span>{" "}
                        {supervisorNameFor(program) || (
                          <Badge variant="outline" className="text-xs">Not allotted</Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground mb-3 truncate">
                        <span className="font-medium">External Evaluator:</span>{" "}
                        {externalEvaluatorNameFor(program) || (
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
                        <div className="space-y-1">
                          <div>
                            {supervisorNameFor(program) ? (
                              <span className="text-sm">{supervisorNameFor(program)}</span>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Not allotted
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Eval:</span>{" "}
                            {externalEvaluatorNameFor(program) || (
                              <span className="italic">Not allotted</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {/* Duration column removed — programs no longer have a fixed week count */}
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
