"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  UserCog,
  Plus,
  Search,
  Edit2,
  Trash2,
  MoreVertical,
  X,
  Check,
  AlertCircle,
  Loader2,
  Mail,
  Shield,
  Building2,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import type { Profile, Department } from "@/types";

interface CoordinatorWithDetails extends Profile {
  departmentName?: string | null;
  departmentCode?: string | null;
}

interface CoordinatorFormData {
  email: string;
  full_name: string;
  password: string;
  department_id: string;
}

const emptyForm: CoordinatorFormData = {
  email: "",
  full_name: "",
  password: "",
  department_id: "",
};

export default function CoordinatorsPage() {
  const { profile, university } = useAuth();
  const { toast } = useToast();
  
  const [coordinators, setCoordinators] = useState<CoordinatorWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CoordinatorFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchCoordinators = useCallback(async () => {
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
        .from("profiles")
        .select("*")
        .eq("university_id", universityId)
        .eq("role", "department_coordinator")
        .order("created_at", { ascending: false });

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich with department info
      const coordinatorsWithDetails: CoordinatorWithDetails[] = [];
      
      for (const coord of (data || [])) {
        let deptInfo: { name: string | null; code: string | null } | null = null;
        
        if (coord.department_id) {
          const { data: dept } = await supabase
            .from("departments")
            .select("name, code")
            .eq("id", coord.department_id)
            .single();
          
          deptInfo = dept as { name: string | null; code: string | null } | null;
        }

        coordinatorsWithDetails.push({
          ...coord,
          departmentName: deptInfo?.name || null,
          departmentCode: deptInfo?.code || null,
        });
      }

      // Apply search filter client-side
      let filtered = coordinatorsWithDetails;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (coord) =>
            (coord.full_name && coord.full_name.toLowerCase().includes(query)) ||
            coord.email.toLowerCase().includes(query) ||
            (coord.departmentName && coord.departmentName.toLowerCase().includes(query))
        );
      }

      setCoordinators(filtered);
    } catch (error) {
      console.error("Error fetching coordinators:", error);
      toast({
        title: "Error",
        description: "Failed to load coordinators",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id, university?.id, searchQuery, showInactive, toast]);

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

  useEffect(() => {
    fetchCoordinators();
    fetchDepartments();
  }, [fetchCoordinators, fetchDepartments]);

  const handleCreateCoordinator = async () => {
    // Validate form
    if (!formData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email.includes("@")) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!formData.full_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Call the server-side admin route. This uses the service role key
      // to call supabase.auth.admin.createUser(), which does NOT establish
      // a session for the new user — so the currently-signed-in
      // University Admin stays signed in. Calling admin.createUser() from
      // the browser does NOT work (requires the service_role key, which
      // is never exposed to the client).
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          role: "department_coordinator",
          department_id: formData.department_id || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        if (json?.error?.toLowerCase?.().includes("already")) {
          toast({
            title: "Email Already Exists",
            description: "An account with this email already exists",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: json?.error || `Request failed (${res.status})`,
            variant: "destructive",
          });
        }
        return;
      }

      // The API may return a `warning` if the profile upsert failed
      // (e.g. university_id not saved). Show it so the admin knows the
      // coordinator might not appear in lists until the profile is fixed.
      if (json?.warning) {
        toast({
          title: "Account created (with warning)",
          description: json.warning,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Coordinator Created",
          description: `${formData.full_name}'s account has been created successfully`,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCoordinators();
    } catch (error) {
      console.error("Error creating coordinator:", error);
      toast({
        title: "Error",
        description: "Failed to create coordinator account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (coordinator: CoordinatorWithDetails) => {
    const nextActive = !coordinator.is_active;
    console.log("[coordinators.handleToggleStatus] start", {
      user_id: coordinator.user_id,
      email: coordinator.email,
      current: coordinator.is_active,
      next: nextActive,
    });

    try {
      const res = await fetch(`/api/coordinators/${coordinator.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });

      const json = await res.json().catch(() => ({ success: false, error: "Invalid JSON response" }));
      console.log("[coordinators.handleToggleStatus] response", { status: res.status, json });

      if (!res.ok || !json?.success) {
        toast({
          title: "Status change failed",
          description: json?.error || `Request failed (${res.status})`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Status Updated",
        description: `${coordinator.full_name || coordinator.email} has been ${nextActive ? "activated" : "deactivated"}`,
      });

      fetchCoordinators();
    } catch (error) {
      console.error("[coordinators.handleToggleStatus] unhandled", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDepartment = async (coordinator: CoordinatorWithDetails, departmentId: string) => {
    console.log("[coordinators.handleUpdateDepartment] start", {
      user_id: coordinator.user_id,
      email: coordinator.email,
      current_dept: coordinator.department_id,
      new_dept: departmentId || null,
    });

    try {
      const res = await fetch(`/api/coordinators/${coordinator.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_id: departmentId || null }),
      });

      const json = await res.json().catch(() => ({ success: false, error: "Invalid JSON response" }));
      console.log("[coordinators.handleUpdateDepartment] response", { status: res.status, json });

      if (!res.ok || !json?.success) {
        toast({
          title: "Assignment failed",
          description: json?.error || `Request failed (${res.status})`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Department Updated",
        description: departmentId
          ? `Coordinator assigned to ${departments.find((d) => d.id === departmentId)?.name || "department"}`
          : "Coordinator unassigned from department",
      });

      fetchCoordinators();
    } catch (error) {
      console.error("[coordinators.handleUpdateDepartment] unhandled", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update department assignment",
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setShowPassword(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Department Coordinators"
        description={`Manage coordinator accounts for ${university?.name || "your university"}`}
        actions={
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Coordinator
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
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive-coords"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive-coords" className="text-sm cursor-pointer">
                Show inactive
              </Label>
              <Badge variant="secondary" className="ml-2">
                {coordinators.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coordinators List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : coordinators.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <UserCog className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No coordinators found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery
                  ? "No coordinators match your search criteria"
                  : showInactive
                  ? "No coordinators exist yet"
                  : "Get started by creating your first department coordinator"}
              </p>
              {!searchQuery && (
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Coordinator
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {coordinators.map((coordinator, index) => (
            <motion.div
              key={coordinator.user_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`transition-all hover:shadow-md ${!coordinator.is_active ? 'opacity-70' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Coordinator Info */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarFallback className={coordinator.is_active ? 'bg-primary/10 text-primary' : 'bg-muted'}>
                          {getInitials(coordinator.full_name, coordinator.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">
                            {coordinator.full_name || "Unnamed Coordinator"}
                          </h3>
                          {!coordinator.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Shield className="h-3 w-3" />
                            Coordinator
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{coordinator.email}</span>
                        </div>
                        {coordinator.departmentName && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{coordinator.departmentName}</span>
                            {coordinator.departmentCode && (
                              <Badge variant="outline" className="text-xs ml-1">
                                {coordinator.departmentCode}
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(coordinator.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {/* Quick Department Assignment — shows full dept name,
                          wide enough to read, and refetches departments on
                          open in case the admin just created one. */}
                      <Select
                        value={coordinator.department_id || "__none__"}
                        onValueChange={(value) =>
                          handleUpdateDepartment(coordinator, value === "__none__" ? "" : value)
                        }
                        onOpenChange={(open) => {
                          if (open) fetchDepartments();
                        }}
                      >
                        <SelectTrigger className="w-[200px] h-9 text-xs">
                          <SelectValue placeholder="Assign to department">
                            {coordinator.department_id
                              ? (departments.find((d) => d.id === coordinator.department_id)?.name ||
                                 coordinator.departmentName ||
                                 "Assigned")
                              : "Unassigned"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-[320px]">
                          <SelectItem value="__none__">— Unassigned —</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}{dept.code ? ` (${dept.code})` : ""}
                            </SelectItem>
                          ))}
                          {departments.length === 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No departments yet. Create one first on the
                              Departments page.
                            </div>
                          )}
                        </SelectContent>
                      </Select>

                      {/* Status Toggle */}
                      <Button
                        variant={coordinator.is_active ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleToggleStatus(coordinator)}
                        className="text-xs"
                      >
                        {coordinator.is_active ? "Deactivate" : "Activate"}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(coordinator)}
                          >
                            {coordinator.is_active ? (
                              <>
                                <X className="mr-2 h-4 w-4" />
                                Deactivate Account
                              </>
                            ) : (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Activate Account
                              </>
                            )}
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

      {/* Create Coordinator Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Coordinator</DialogTitle>
            <DialogDescription>
              Create a new department coordinator account with username/password authentication.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coord-full-name">Full Name *</Label>
              <Input
                id="coord-full-name"
                placeholder="e.g., Dr. Sarah Johnson"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coord-email">Email Address *</Label>
              <Input
                id="coord-email"
                type="email"
                placeholder="e.g., sarah.johnson@university.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coord-password">Password *</Label>
              <div className="relative">
                <Input
                  id="coord-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters. The coordinator can change this after login.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coord-department">Assign to Department</Label>
              <Select
                value={formData.department_id || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, department_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger id="coord-department">
                  <SelectValue placeholder="Select a department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} {dept.code && `(${dept.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You can assign the coordinator to a department later.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCoordinator} 
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
