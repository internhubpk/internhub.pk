"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Users,
  UserCheck,
  MoreVertical,
  Filter,
  X,
  Mail,
  Phone,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";

interface Supervisor {
  id: string;
  user_id: string;
  title: string | null;
  specialization: string | null;
  type: string;
  is_active: boolean;
  university_id: string;
  department_id: string;
  created_at: string;
  // Joined data
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
  };
  departments?: {
    name: string | null;
    code: string | null;
  };
}

interface SupervisorWorkload {
  assigned_students: number;
  active_supervisions: number;
  completed_supervisions: number;
}

interface SupervisorFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title: string;
  specialization: string;
  is_active: boolean;
}

const emptyForm: SupervisorFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  title: "",
  specialization: "",
  is_active: true,
};

const titleOptions = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Lecturer",
  "Senior Lecturer",
  "Instructor",
  "Dr.",
  "Mr.",
  "Ms.",
];

export default function SupervisorsPage() {
  const { profile } = useAuth();
  const [supervisors, setSupervisors] = useState<(Supervisor & { workload?: SupervisorWorkload })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<SupervisorFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedSupervisor, setExpandedSupervisor] = useState<string | null>(null);

  // Fetch supervisors
  const fetchSupervisors = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterActive !== "all") params.set("is_active", filterActive);
      params.set("type", "faculty");
      params.set("pageSize", "50");

      const res = await fetch(`/api/supervisors?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const supervisorsList: Supervisor[] = data.data.data || [];

          // Fetch workload for all supervisors in a single request
          let workloadData: any[] = [];
          try {
            const workRes = await fetch(`/api/department-coordinator/reports?type=supervisors`);
            if (workRes.ok) {
              const workJson = await workRes.json();
              if (workJson.success && Array.isArray(workJson.data)) {
                workloadData = workJson.data;
              }
            }
          } catch (e) {
            console.error("Error fetching workload:", e);
          }

          const enrichedSupervisors = supervisorsList.map((sup) => {
            const workloadInfo = workloadData.find((w) => w.supervisor_id === sup.id);
            return {
              ...sup,
              workload: workloadInfo || {
                assigned_students: 0,
                active_supervisions: 0,
                completed_supervisions: 0,
              },
            };
          });

          setSupervisors(enrichedSupervisors);
        }
      }
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterActive]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  // Handle form submission - create new supervisor account
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // First create auth user via API
      const createRes = await fetch("/api/supervisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // For department coordinators, we'll need to handle this differently
          // since they can't directly create users in Supabase Auth
          // This would typically be done through an admin endpoint or invitation system
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          title: formData.title,
          specialization: formData.specialization,
          type: "faculty",
          university_id: profile?.university_id,
          department_id: profile?.department_id,
          is_active: formData.is_active,
        }),
      });

      const data = await createRes.json();

      if (data.success) {
        await fetchSupervisors();
        setIsDialogOpen(false);
        resetForm();
      } else {
        alert(data.error || "Failed to create supervisor");
      }
    } catch (error) {
      console.error("Error creating supervisor:", error);
      alert("Failed to create supervisor");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData(emptyForm);
  };

  // Get initials for avatar
  const getInitials = (supervisor: Supervisor) => {
    const firstName = supervisor.profiles?.first_name || "";
    const lastName = supervisor.profiles?.last_name || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "SU";
  };

  // Get full name
  const getFullName = (supervisor: Supervisor) => {
    const firstName = supervisor.profiles?.first_name || "";
    const lastName = supervisor.profiles?.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || supervisor.title || "Unnamed Supervisor";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Supervisors</h1>
          <p className="text-muted-foreground mt-1">
            Manage faculty supervisors in your department
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Supervisor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add New Supervisor</DialogTitle>
                <DialogDescription>
                  Create a new faculty supervisor account. They will receive login credentials via email.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData({ ...formData, first_name: e.target.value })
                      }
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData({ ...formData, last_name: e.target.value })
                      }
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="john.doe@university.edu"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+92 XXX XXXXXXX"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Select
                      value={formData.title}
                      onValueChange={(val) =>
                        setFormData({ ...formData, title: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select title" />
                      </SelectTrigger>
                      <SelectContent>
                        {titleOptions.map((title) => (
                          <SelectItem key={title} value={title}>
                            {title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
                      id="specialization"
                      value={formData.specialization}
                      onChange={(e) =>
                        setFormData({ ...formData, specialization: e.target.value })
                      }
                      placeholder="e.g., Software Engineering"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="cursor-pointer">
                      Active Status
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Inactive supervisors cannot be assigned students
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
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Supervisors</p>
                <p className="text-2xl font-bold">{supervisors.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Assigned Students</p>
                <p className="text-2xl font-bold">
                  {supervisors.reduce((acc, s) => acc + (s.workload?.assigned_students || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
                <Award className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Workload</p>
                <p className="text-2xl font-bold">
                  {supervisors.length > 0
                    ? Math.round(supervisors.reduce((acc, s) => acc + (s.workload?.assigned_students || 0), 0) / supervisors.length)
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or specialization..."
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

      {/* Supervisors List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-20 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : supervisors.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-10 w-10 text-muted-foreground" />}
          title="No supervisors found"
          description={
            searchQuery || filterActive !== "all"
              ? "Try adjusting your search or filters"
              : "Add faculty members as supervisors to manage student internships"
          }
          action={
            !searchQuery && filterActive === "all"
              ? { label: "Add Supervisor", onClick: () => setIsDialogOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Cards View for Mobile */}
          <div className="md:hidden space-y-3">
            <AnimatePresence mode="popLayout">
              {supervisors.map((supervisor) => (
                <motion.div
                  key={supervisor.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="h-11 w-11">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(supervisor)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{getFullName(supervisor)}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {supervisor.profiles?.email}
                              </p>
                            </div>
                            <Badge variant={supervisor.is_active ? "default" : "secondary"}>
                              {supervisor.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {(supervisor.title || supervisor.specialization) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {supervisor.title && (
                            <Badge variant="outline">{supervisor.title}</Badge>
                          )}
                          {supervisor.specialization && (
                            <Badge variant="outline">{supervisor.specialization}</Badge>
                          )}
                        </div>
                      )}

                      {/* Workload Info */}
                      <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg mb-3">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-emerald-600">
                            {supervisor.workload?.active_supervisions || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                        <div className="text-center border-x">
                          <p className="text-lg font-semibold text-blue-600">
                            {supervisor.workload?.completed_supervisions || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">
                            {supervisor.workload?.assigned_students || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          asChild
                        >
                          <a href={`/department-coordinator/students?supervisor=${supervisor.user_id}`}>
                            <Users className="h-3 w-3 mr-1" /> View Students
                          </a>
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
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Title / Specialization</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {supervisors.map((supervisor) => (
                    <motion.tr
                      key={supervisor.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(supervisor)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-[180px]">
                            <p className="font-medium truncate">{getFullName(supervisor)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {supervisor.profiles?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[160px]">
                          {supervisor.title && (
                            <p className="text-sm">{supervisor.title}</p>
                          )}
                          {supervisor.specialization && (
                            <p className="text-xs text-muted-foreground truncate">
                              {supervisor.specialization}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {supervisor.departments?.name || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={supervisor.is_active ? "default" : "secondary"}
                          className="mx-auto"
                        >
                          {supervisor.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center items-center gap-3">
                          <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-md bg-muted text-sm font-medium">
                            {supervisor.workload?.assigned_students || 0}
                          </span>
                          {expandedSupervisor === supervisor.id && (
                            <div className="flex gap-1 text-xs text-muted-foreground">
                              <span className="text-emerald-600">
                                {supervisor.workload?.active_supervisions || 0} active
                              </span>
                              <span className="text-blue-600">
                                {supervisor.workload?.completed_supervisions || 0} done
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setExpandedSupervisor(
                              expandedSupervisor === supervisor.id ? null : supervisor.id
                            )}>
                              {expandedSupervisor === supervisor.id ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-2" /> Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-2" /> Show Details
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/department-coordinator/students?supervisor=${supervisor.user_id}`}>
                                <Users className="h-4 w-4 mr-2" /> View Students
                              </a>
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
            Showing {supervisors.length} supervisor{supervisors.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
