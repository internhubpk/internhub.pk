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
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import type { Department } from "@/types";

interface Program {
  id: string;
  name: string;
  code: string;
  description: string | null;
  duration_weeks: number;
  is_active: boolean;
  university_id: string;
  department_id: string;
  student_count?: number;
  created_at: string;
  updated_at: string;
  departments?: { name: string; code: string | null }[] | null;
}

interface ProgramFormData {
  name: string;
  code: string;
  description: string;
  duration_weeks: number;
  department_id: string;
  is_active: boolean;
}

const emptyForm: ProgramFormData = {
  name: "",
  code: "",
  description: "",
  duration_weeks: 8,
  department_id: "",
  is_active: true,
};

export default function UniversityAdminProgramsPage() {
  const { profile, university } = useAuth();
  const { toast } = useToast();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);

  const universityId = profile?.university_id || university?.id;

  // ----------------------------------------------------------------
  // Fetch programs directly from Supabase (RLS-scoped to this
  // university by the profiles_select policy). We don't use the
  // /api/programs route because that route uses a different auth
  // pattern (requireAuth) that has been less reliable than direct
  // Supabase queries with the cookie-bound client.
  // ----------------------------------------------------------------
  const fetchPrograms = useCallback(async () => {
    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();

      let query = supabase
        .from("programs")
        .select(
          `id, name, code, description, duration_weeks, is_active,
           university_id, department_id, created_at, updated_at,
           departments:department_id ( name, code )`
        )
        .eq("university_id", universityId)
        .order("created_at", { ascending: false });

      if (filterActive === "true") {
        query = query.eq("is_active", true);
      } else if (filterActive === "false") {
        query = query.eq("is_active", false);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get student counts per program
      const programIds = (data || []).map((p) => p.id);
      let studentCounts: Record<string, number> = {};

      if (programIds.length > 0) {
        const { data: students } = await supabase
          .from("students")
          .select("program_id")
          .in("program_id", programIds);

        studentCounts = (students || []).reduce((acc, s) => {
          if (s.program_id) {
            acc[s.program_id] = (acc[s.program_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
      }

      let enriched = (data || []).map((p) => ({
        ...p,
        student_count: studentCounts[p.id] || 0,
      })) as Program[];

      // Apply search filter client-side
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        enriched = enriched.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q)
        );
      }

      setPrograms(enriched);
    } catch (error) {
      console.error("Error fetching programs:", error);
      toast({
        title: "Error",
        description: "Failed to load programs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [universityId, filterActive, searchQuery, toast]);

  const fetchDepartments = useCallback(async () => {
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
  }, [universityId]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // ----------------------------------------------------------------
  // Create / Update program via /api/programs (POST for new, PUT for
  // edit). The API enforces university_admin scoping server-side.
  // ----------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: "Program name is required", variant: "destructive" });
      return;
    }
    if (!formData.code.trim()) {
      toast({ title: "Program code is required", variant: "destructive" });
      return;
    }
    if (!formData.department_id) {
      toast({
        title: "Department is required",
        description: "Select which department this program belongs to.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        duration_weeks: formData.duration_weeks,
        department_id: formData.department_id,
        is_active: formData.is_active,
        ...(editingProgram ? { id: editingProgram.id } : {}),
      };

      const res = await fetch("/api/programs", {
        method: editingProgram ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast({
          title: "Error",
          description: data.error || `Request failed (${res.status})`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: editingProgram ? "Program Updated" : "Program Created",
        description: `${formData.name} has been ${editingProgram ? "updated" : "created"} successfully.`,
      });

      await fetchPrograms();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving program:", error);
      toast({
        title: "Error",
        description: "Failed to save program. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/programs?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast({
          title: "Cannot Delete",
          description:
            data.error ||
            "Only Super Admins can delete programs. You can deactivate it instead.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Program deleted" });
      setPrograms(programs.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error deleting program:", error);
      toast({
        title: "Error",
        description: "Failed to delete program",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingProgram(null);
  };

  const openEditDialog = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      code: program.code,
      description: program.description || "",
      duration_weeks: program.duration_weeks,
      department_id: program.department_id,
      is_active: program.is_active,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const deptNameFor = (program: Program) => {
    const joinName = program.departments?.[0]?.name;
    if (joinName) return joinName;
    const dept = departments.find((d) => d.id === program.department_id);
    return dept?.name || "—";
  };

  const deptCodeFor = (program: Program) => {
    const joinCode = program.departments?.[0]?.code;
    if (joinCode) return joinCode;
    const dept = departments.find((d) => d.id === program.department_id);
    return dept?.code || null;
  };

  if (!universityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Programs</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your admin account is not linked to a university yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Programs</h1>
          <p className="mt-2 text-muted-foreground">
            Manage internship programs across all departments in{" "}
            {university?.name || "your university"}
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Program
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
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
              <Badge variant="secondary" className="ml-2 self-center">
                {programs.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Programs List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No programs found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery || filterActive !== "all"
                  ? "No programs match your search criteria"
                  : "Get started by creating your first internship program"}
              </p>
              {!searchQuery && filterActive === "all" && (
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Program
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile cards */}
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
                  <Card>
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

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Building2 className="h-4 w-4" />
                        <span>{deptNameFor(program)}</span>
                        {deptCodeFor(program) && (
                          <Badge variant="outline" className="text-xs">
                            {deptCodeFor(program)}
                          </Badge>
                        )}
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

          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Department</TableHead>
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
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {program.code}
                            </code>
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
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {deptNameFor(program)}
                        </span>
                      </TableCell>
                      <TableCell>{program.duration_weeks} weeks</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {program.student_count || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={program.is_active ? "default" : "secondary"}
                          className="gap-1"
                        >
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setExpandedProgram(
                                  expandedProgram === program.id ? null : program.id
                                )
                              }
                            >
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

          <div className="text-sm text-muted-foreground px-1">
            Showing {programs.length} program{programs.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingProgram ? "Edit Program" : "Create New Program"}
              </DialogTitle>
              <DialogDescription>
                {editingProgram
                  ? "Update the program details below."
                  : "Add a new internship program to a department in your university."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
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
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.department_id || "__none__"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      department_id: value === "__none__" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select a department...</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} {dept.code && `(${dept.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departments.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No departments found. Create a department first.
                  </p>
                )}
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

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="active" className="cursor-pointer">
                    Active Status
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive programs won&apos;t accept new enrollments
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
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingProgram ? (
                  "Update Program"
                ) : (
                  "Create Program"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Program?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Students enrolled in this program will need
              to be reassigned. Note: only Super Admins can delete programs.
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
