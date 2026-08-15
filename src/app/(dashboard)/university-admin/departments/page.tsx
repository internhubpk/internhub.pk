"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  UserCheck,
  MoreVertical,
  X,
  Check,
  AlertCircle,
  Loader2,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import type { Department, Profile } from "@/types";

interface DepartmentWithCounts extends Department {
  studentCount?: number;
  coordinatorCount?: number;
  headName?: string | null;
}

interface DepartmentFormData {
  name: string;
  code: string;
  head_id: string;
  is_active: boolean;
  // Cascading account creation: when a University Admin creates a new
  // department, they simultaneously create the department_coordinator
  // account that will own it. This mirrors the existing
  // "create university + admin account" and "create company + hr account"
  // flows, eliminating the previous chicken-and-egg problem where
  // coordinators had to be created separately and then assigned via the
  // Department Head dropdown (which only listed existing coordinators).
  coordinatorEmail: string;
  coordinatorPassword: string;
  coordinatorName: string;
}

const emptyForm: DepartmentFormData = {
  name: "",
  code: "",
  head_id: "",
  is_active: true,
  coordinatorEmail: "",
  coordinatorPassword: "",
  coordinatorName: "",
};

export default function DepartmentsPage() {
  const { profile, university } = useAuth();
  const [departments, setDepartments] = useState<DepartmentWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentWithCounts | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<DepartmentWithCounts | null>(null);
  const [formData, setFormData] = useState<DepartmentFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [potentialHeads, setPotentialHeads] = useState<Profile[]>([]);

  const fetchDepartments = useCallback(async () => {
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

      // Build query
      let query = supabase
        .from("departments")
        .select("*")
        .eq("university_id", universityId)
        .order("name", { ascending: true });

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get counts for each department
      const departmentsWithCounts: DepartmentWithCounts[] = [];
      
      for (const dept of (data || [])) {
        const [studentCountRes, coordinatorCountRes, headProfile] = await Promise.all([
          // profiles uses user_id (no `id` column) — use head:true for count-only
          supabase
            .from("profiles")
            .select("user_id", { count: "exact", head: true })
            .eq("department_id", dept.id)
            .eq("role", "student"),
          supabase
            .from("profiles")
            .select("user_id", { count: "exact", head: true })
            .eq("department_id", dept.id)
            .eq("role", "department_coordinator"),
          dept.head_id
            ? supabase
                .from("profiles")
                .select("full_name")
                .eq("user_id", dept.head_id)
                .single()
            : Promise.resolve({ data: null }),
        ]);

        departmentsWithCounts.push({
          ...dept,
          studentCount: studentCountRes.count || 0,
          coordinatorCount: coordinatorCountRes.count || 0,
          headName: headProfile.data?.full_name || null,
        });
      }

      // Apply search filter client-side
      let filtered = departmentsWithCounts;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (dept) =>
            dept.name.toLowerCase().includes(query) ||
            (dept.code && dept.code.toLowerCase().includes(query))
        );
      }

      setDepartments(filtered);
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Error", { description: "Failed to load departments" });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id, university?.id, searchQuery, showInactive, toast]);

  const fetchPotentialHeads = useCallback(async () => {
    const universityId = profile?.university_id || university?.id;
    if (!universityId) return;

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("university_id", universityId)
        .in("role", ["faculty_supervisor", "department_coordinator"])
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setPotentialHeads(data || []);
    } catch (error) {
      console.error("Error fetching potential heads:", error);
    }
  }, [profile?.university_id, university?.id]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    if (isDialogOpen) {
      fetchPotentialHeads();
    }
  }, [isDialogOpen, fetchPotentialHeads]);

  const handleCreateOrUpdate = async () => {
    // Validate form
    if (!formData.name.trim()) {
      toast.error("Validation Error", { description: "Department name is required" });
      return;
    }

    if (!formData.code.trim()) {
      toast.error("Validation Error", { description: "Department code is required" });
      return;
    }

    // When CREATING a new department, the coordinator account fields are
    // required (cascading creation flow). When editing, they're hidden
    // and the existing Department Head dropdown is used instead.
    if (!editingDepartment) {
      if (!formData.coordinatorEmail.trim() || !formData.coordinatorEmail.includes("@")) {
        toast.error("Validation Error", { description: "A valid coordinator email is required" });
        return;
      }
      if (!formData.coordinatorPassword || formData.coordinatorPassword.length < 8) {
        toast.error("Validation Error", { description: "Coordinator password must be at least 8 characters" });
        return;
      }
      if (!formData.coordinatorName.trim()) {
        toast.error("Validation Error", { description: "Coordinator name is required" });
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const supabase = createClient();
      const universityId = profile?.university_id || university?.id;

      if (editingDepartment) {
        // Update existing department
        const { error } = await supabase
          .from("departments")
          .update({
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            head_id: formData.head_id || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingDepartment.id);

        if (error) throw error;

        toast.success("Success", { description: `Department "${formData.name}" updated successfully` });
      } else {
        // Create new department — initially without head_id (the
        // coordinator account doesn't exist yet). We'll set head_id
        // after the coordinator auth account is created.
        const { data, error } = await supabase
          .from("departments")
          .insert({
            university_id: universityId,
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            head_id: null,
            is_active: formData.is_active,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            toast.error("Duplicate Entry", { description: "A department with this code already exists in your university" });
            return;
          }
          throw error;
        }

        // Now create the department_coordinator auth account via the
        // server-side admin route. This uses the service role key
        // (server-only) to call supabase.auth.admin.createUser(),
        // which does NOT establish a session for the new user — the
        // calling University Admin stays signed in. The route also
        // force-sets university_id and department_id from the caller's
        // own profile (defense-in-depth against tampering).
        let coordinatorUserId: string | null = null;
        let coordinatorWarning: string | null = null;

        try {
          const res = await fetch("/api/admin/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.coordinatorEmail.trim(),
              password: formData.coordinatorPassword,
              full_name: formData.coordinatorName.trim(),
              role: "department_coordinator",
              university_id: universityId,
              department_id: data.id,
              job_title: `Department Coordinator — ${formData.name.trim()}`,
            }),
          });

          const json = await res.json();

          if (!res.ok || !json?.success) {
            console.error("Coordinator creation error:", json?.error);
            coordinatorWarning =
              json?.error || `Request failed (${res.status})`;
          } else {
            coordinatorUserId = json?.data?.id ?? null;
            if (json?.warning) {
              coordinatorWarning = json.warning;
            }
          }
        } catch (adminError: any) {
          console.error("Coordinator creation error:", adminError);
          coordinatorWarning = adminError?.message || "Unknown error";
        }

        // If the coordinator account was created successfully, link it
        // to the department as its head_id. This is what makes the
        // coordinator visible in the department's "Coordinators" count
        // and what shows their name as "Head: ..." in the card list.
        if (coordinatorUserId) {
          const { error: linkError } = await supabase
            .from("departments")
            .update({ head_id: coordinatorUserId, updated_at: new Date().toISOString() })
            .eq("id", data.id);

          if (linkError) {
            console.error("Failed to link coordinator as head:", linkError);
            // Non-fatal — the coordinator exists, just isn't linked as
            // head. Surface it as a warning instead of failing.
            coordinatorWarning =
              (coordinatorWarning ? coordinatorWarning + " " : "") +
              `Coordinator account created but failed to link as department head: ${linkError.message}. You can link them manually via Edit.`;
          }
        }

        if (coordinatorWarning) {
          toast.error("Department created (with warnings)", { description: `Department "${formData.name}" was created, but: ${coordinatorWarning}` });
        } else {
          toast.success("Success", { description: `Department "${formData.name}" created with coordinator account for ${formData.coordinatorEmail}. Default password: ${formData.coordinatorPassword}` });
        }
      }

      setIsDialogOpen(false);
      resetForm();
      fetchDepartments();
    } catch (error) {
      console.error("Error saving department:", error);
      toast.error("Error", { description: "Failed to save department. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDepartment) return;

    try {
      setIsSubmitting(true);
      const supabase = createClient();

      // Check if department has students or coordinators
      if ((deletingDepartment.studentCount || 0) > 0 || (deletingDepartment.coordinatorCount || 0) > 0) {
        toast.error("Cannot Delete", { description: "Please reassign all students and coordinators before deleting this department." });
        setIsDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", deletingDepartment.id);

      if (error) throw error;

      toast.success("Deleted", { description: `Department "${deletingDepartment.name}" has been deleted` });

      setIsDeleteDialogOpen(false);
      setDeletingDepartment(null);
      fetchDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      toast.error("Error", { description: "Failed to delete department" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (department: DepartmentWithCounts) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      code: department.code || "",
      head_id: department.head_id || "",
      is_active: department.is_active,
      // Cascading-account-creation fields are CREATE-mode only. They're
      // initialized to empty so the form state is well-typed; the
      // dialog hides them when editing.
      coordinatorEmail: "",
      coordinatorPassword: "",
      coordinatorName: "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingDepartment(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (department: DepartmentWithCounts) => {
    setDeletingDepartment(department);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setEditingDepartment(null);
    setFormData(emptyForm);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Departments"
        description={`Manage departments within ${university?.name || "your university"}`}
        actions={
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Department
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Show inactive
              </Label>
              <Badge variant="secondary" className="ml-2">
                {departments.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Departments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : departments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Building2 className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No departments found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery
                  ? "No departments match your search criteria"
                  : showInactive
                  ? "No departments exist yet"
                  : "Get started by creating your first department"}
              </p>
              {!searchQuery && (
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Department
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {departments.map((department, index) => (
            <motion.div
              key={department.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`transition-all hover:shadow-md ${!department.is_active ? 'opacity-70' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Department Info */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className={`p-3 rounded-lg ${department.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Building2 className={`h-5 w-5 ${department.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg truncate">{department.name}</h3>
                          {!department.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {department.code && (
                            <span className="font-mono">{department.code}</span>
                          )}
                          {department.headName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                Head: {department.headName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-semibold">{department.studentCount || 0}</p>
                          <p className="text-xs text-muted-foreground">Students</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{department.coordinatorCount || 0}</p>
                          <p className="text-xs text-muted-foreground">Coordinators</p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(department)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(department)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Edit Department" : "Create New Department"}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment
                ? `Editing "${editingDepartment.name}"`
                : "Add a new department to your university"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <Label htmlFor="name">Department Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Computer Science"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Department Code *</Label>
              <Input
                id="code"
                placeholder="e.g., CS"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                maxLength={10}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Uppercase letters and numbers only
              </p>
            </div>

            {editingDepartment ? (
              // EDIT mode: show the Department Head dropdown so the
              // admin can reassign the head to any existing
              // coordinator / faculty supervisor in the university.
              <div className="space-y-2">
                <Label htmlFor="head">Department Head</Label>
                <Select
                  value={formData.head_id || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, head_id: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger id="head">
                    <SelectValue placeholder="Select a department head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None assigned</SelectItem>
                    {potentialHeads.map((head) => (
                      <SelectItem key={head.user_id} value={head.user_id}>
                        {head.full_name || head.email} ({head.role.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // CREATE mode: cascading account creation. Instead of
              // picking an existing coordinator (which requires a
              // separate create-account step), the admin fills in the
              // new department_coordinator's credentials here. On
              // submit, the department is created AND the coordinator
              // auth account is created and auto-linked as the head.
              <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Department Coordinator Account</h4>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  This coordinator will be created automatically and assigned as the head of this department. They can sign in immediately with the email and password below.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="coordinatorName">Coordinator Name *</Label>
                  <Input
                    id="coordinatorName"
                    placeholder="e.g., Dr. Sarah Khan"
                    value={formData.coordinatorName}
                    onChange={(e) => setFormData({ ...formData, coordinatorName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coordinatorEmail">Coordinator Email *</Label>
                  <Input
                    id="coordinatorEmail"
                    type="email"
                    placeholder="coordinator@university.edu"
                    value={formData.coordinatorEmail}
                    onChange={(e) => setFormData({ ...formData, coordinatorEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coordinatorPassword">Coordinator Password *</Label>
                  <Input
                    id="coordinatorPassword"
                    type="text"
                    placeholder="At least 8 characters"
                    value={formData.coordinatorPassword}
                    onChange={(e) => setFormData({ ...formData, coordinatorPassword: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Share this password with the coordinator. They can change it after first sign-in.
                  </p>
                </div>
              </div>
            )}

            {editingDepartment && (
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="is-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is-active">Active</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingDepartment ? (
                "Update Department"
              ) : (
                "Create Department"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete Department
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingDepartment?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {(deletingDepartment?.studentCount ?? 0) > 0 || (deletingDepartment?.coordinatorCount ?? 0) > 0 ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">
                This department cannot be deleted because it has:
              </p>
              <ul className="mt-2 text-sm text-destructive list-disc list-inside">
                {(deletingDepartment?.studentCount ?? 0) > 0 && (
                  <li>{deletingDepartment?.studentCount} student(s)</li>
                )}
                {(deletingDepartment?.coordinatorCount ?? 0) > 0 && (
                  <li>{deletingDepartment?.coordinatorCount} coordinator(s)</li>
                )}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                Please reassign them before deleting.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                isSubmitting ||
                ((deletingDepartment?.studentCount ?? 0) > 0) ||
                ((deletingDepartment?.coordinatorCount ?? 0) > 0)
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Department"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
