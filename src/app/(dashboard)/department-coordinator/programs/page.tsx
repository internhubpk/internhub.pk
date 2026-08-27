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
  Eye,
  EyeOff,
  RefreshCw,
  UserCog,
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
  // Joined Program Coordinator info (from the API)
  program_coordinator?: { full_name: string | null; email: string } | null;
}

interface ProgramFormData {
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  // Program Coordinator credentials (CREATE mode only)
  coordinator_full_name: string;
  coordinator_email: string;
  coordinator_password: string;
  showPassword: boolean;
}

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

const emptyForm: ProgramFormData = {
  name: "",
  code: "",
  description: "",
  is_active: true,
  coordinator_full_name: "",
  coordinator_email: "",
  coordinator_password: generatePassword(),
  showPassword: false,
};

// NOTE: Supervisor and external evaluator fields were removed from the DC
// Programs page. Programs only manage basic info (name, code, description,
// is_active) and auto-provision a Program Coordinator account.
// Supervisor assignment is handled through the Students page.

export default function ProgramsPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  // Supervisor/evaluator state removed — DC no longer assigns supervisors
  // through the Programs page.
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);

  // Supervisor/evaluator fetching removed — DC no longer assigns
  // supervisors through the Programs page.

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
      // Program creation: send the program fields AND Program Coordinator
      // credentials to /api/programs. The API auto-creates a Program Coordinator
      // account (separate role) and links it to the new program.
      const programPayload: Record<string, unknown> = {
        name: formData.name,
        code: formData.code,
        description: formData.description,
        is_active: formData.is_active,
      };

      // On CREATE: include PC credentials (supervisor/evaluator removed from DC scope)
      if (!editingProgram) {
        programPayload.coordinator_full_name = formData.coordinator_full_name;
        programPayload.coordinator_email = formData.coordinator_email;
        programPayload.coordinator_password = formData.coordinator_password;
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
      is_active: program.is_active,
      coordinator_full_name: "",
      coordinator_email: "",
      coordinator_password: generatePassword(),
      showPassword: false,
    });
    setIsDialogOpen(true);
  };

  // Supervisor/evaluator display helpers removed from DC Programs page.

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
              <form className="px-8 pb-5" onSubmit={handleSubmit}>
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

                {editingProgram ? null : (
                  // CREATE mode: collect Program Coordinator credentials.
                  // Per InternHub spec, the Department Coordinator provides
                  // the PC's name, email, and password when creating a program.
                  <div className="space-y-4">
                    <div className="space-y-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-blue-600" />
                        <h4 className="text-sm font-semibold">Program Coordinator Account</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A Program Coordinator account will be created and linked
                        to this program. The PC is responsible for adding students,
                        supervisors, and assigning students to supervisors.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coordinator_name">Coordinator Full Name *</Label>
                      <Input
                        id="coordinator_name"
                        value={formData.coordinator_full_name}
                        onChange={(e) =>
                          setFormData({ ...formData, coordinator_full_name: e.target.value })
                        }
                        placeholder="e.g., Dr. Ahmad Khan"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coordinator_email">Coordinator Email *</Label>
                      <Input
                        id="coordinator_email"
                        type="email"
                        value={formData.coordinator_email}
                        onChange={(e) =>
                          setFormData({ ...formData, coordinator_email: e.target.value })
                        }
                        placeholder="e.g., ahmad.khan@university.edu.pk"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coordinator_password">Coordinator Password *</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="coordinator_password"
                            type={formData.showPassword ? "text" : "password"}
                            value={formData.coordinator_password}
                            onChange={(e) =>
                              setFormData({ ...formData, coordinator_password: e.target.value })
                            }
                            placeholder="Auto-generated or enter manually"
                            required
                            className="pr-10"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() =>
                              setFormData({ ...formData, showPassword: !formData.showPassword })
                            }
                            tabIndex={-1}
                          >
                            {formData.showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              coordinator_password: generatePassword(),
                              showPassword: true,
                            })
                          }
                          title="Generate new password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Click the refresh icon to generate a secure random password.
                        Share this password with the Program Coordinator securely.
                      </p>
                    </div>

                  {/* Supervisor/evaluator assignment removed from DC Programs.
                        Supervisors are assigned through the Students page. */}
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
                          <Users className="h-4 w-4" />
                          {program.student_count || 0} students
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground mb-1 truncate">
                        <span className="font-medium">Program Coordinator:</span>{" "}
                        {program.program_coordinator?.full_name ? (
                          <span>{program.program_coordinator.full_name}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs">Not provisioned</Badge>
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
                  <TableHead>Program Coordinator</TableHead>
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
                          <div className="flex items-center gap-1.5">
                            <UserCog className="h-3.5 w-3.5 text-blue-500" />
                            {program.program_coordinator?.full_name ? (
                              <span className="text-sm">{program.program_coordinator.full_name}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">Not provisioned</span>
                            )}
                          </div>
                          {program.program_coordinator?.email && (
                            <p className="text-xs text-muted-foreground pl-5">{program.program_coordinator.email}</p>
                          )}
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
