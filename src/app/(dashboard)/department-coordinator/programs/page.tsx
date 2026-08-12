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
}

interface ProgramFormData {
  name: string;
  code: string;
  description: string;
  duration_weeks: number;
  is_active: boolean;
}

const emptyForm: ProgramFormData = {
  name: "",
  code: "",
  description: "",
  duration_weeks: 8,
  is_active: true,
};

export default function ProgramsPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);

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
      const url = editingProgram ? "/api/programs" : "/api/programs";
      const method = editingProgram ? "PUT" : "POST";
      
      const body = editingProgram
        ? { ...formData, id: editingProgram.id }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        await fetchPrograms();
        setIsDialogOpen(false);
        resetForm();
      } else {
        alert(data.error || "Failed to save program");
      }
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Failed to save program");
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
      } else {
        alert(data.error || "Failed to delete program");
      }
    } catch (error) {
      console.error("Error deleting program:", error);
      alert("Failed to delete program");
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
      is_active: program.is_active,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground mt-1">
            Manage internship programs in your department
          </p>
        </div>
        
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
      </div>

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
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="h-12 w-12 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-20 bg-muted rounded-full" />
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
