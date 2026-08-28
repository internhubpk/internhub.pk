"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  Shield,
  UserCheck,
  UserX,
  MoreVertical,
  Eye,
  EyeOff,
  Ban,
  CheckCircle2,
  Building2,
  GraduationCap,
  Briefcase,
  ClipboardCheck,
  HardHat,
  Award,
  Database,
  Plus,
  X,
  AlertCircle,
  Key,
  UserPlus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { UserRole } from "@/types";

interface UserProfile {
  id?: string;
  user_id: string;
  email?: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  university_id: string | null;
  university_name?: string;
  status: "active" | "inactive" | "suspended" | "pending_setup";
  created_at: string;
  last_login?: string;
}

interface CreateUserForm {
  email: string;
  password: string;
  full_name: string;
  role: "university_admin" | "department_coordinator" | "faculty_supervisor" | "company_hr" | "site_supervisor" | "external_evaluator";
  university_id: string;
  company_id: string;
}

interface AssignRoleForm {
  user_id: string;
  role: UserRole;
  university_id: string;
  department_id: string;
  program_id: string;
  company_id: string;
}

interface EditUserForm {
  full_name: string;
  email: string;
  phone: string;
  password: string;
}

const roleConfig: Record<string, { label: string; icon: any; color: string; description: string }> = {
  super_admin: { label: "Super Admin", icon: Shield, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", description: "Platform administrator" },
  university_admin: { label: "University Admin", icon: Shield, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", description: "University management" },
  department_coordinator: { label: "Dept. Coordinator", icon: ClipboardCheck, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", description: "Department oversight" },
  faculty_supervisor: { label: "Faculty Supervisor", icon: UserCheck, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", description: "Student supervision" },
  student: { label: "Student", icon: GraduationCap, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", description: "Internship student" },
  company_hr: { label: "Company HR", icon: Briefcase, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", description: "Company HR manager" },
  site_supervisor: { label: "Site Supervisor", icon: HardHat, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", description: "On-site supervision" },
  external_evaluator: { label: "External Evaluator", icon: Award, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", description: "External evaluation" },
};

export default function SuperAdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tablesExist, setTablesExist] = useState(true);

  // Create user dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: "",
    password: "",
    full_name: "",
    role: "university_admin",
    university_id: "",
    company_id: "",
  });
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  // Assign-role dialog state
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [assignRoleTarget, setAssignRoleTarget] = useState<UserProfile | null>(null);
  const [assignRoleForm, setAssignRoleForm] = useState<AssignRoleForm>({
    user_id: "",
    role: "university_admin",
    university_id: "",
    department_id: "",
    program_id: "",
    company_id: "",
  });
  const [departments, setDepartments] = useState<{ id: string; name: string; university_id: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string; department_id: string }[]>([]);

  // View user detail state
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Suspend/activate confirmation dialog state
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    userId: string;
    currentStatus: string;
    newStatus: string;
    cascadeLabel: string;
  }>({ open: false, userId: "", currentStatus: "", newStatus: "", cascadeLabel: "" });

  // Edit user dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editForm, setEditForm] = useState<EditUserForm>({ full_name: "", email: "", phone: "", password: "" });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Delete user confirmation state
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchUniversitiesAndCompanies();
    fetchDepartmentsAndPrograms();
  }, []);

  async function fetchUsers() {
    try {
      const supabase = createClient();

      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }

      const { data, error } = await query;

      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        setTablesExist(false);
        setUsers([]);
        setMessage({ type: "error", text: "Database tables not found. Please run the setup script." });
        setIsLoading(false);
        return;
      }

      if (error) throw error;

      setTablesExist(true);

      // Enrich with university names
      const enrichedData = await Promise.all(
        (data || []).map(async (profile: UserProfile) => {
          let universityName = undefined;
          if (profile.university_id) {
            const { data: uni } = await supabase
              .from("universities")
              .select("name")
              .eq("id", profile.university_id)
              .single();
            universityName = uni?.name;
          }
          
          return { ...profile, university_name: universityName };
        })
      );

      setUsers(enrichedData);
    } catch (error) {
      console.error("Error fetching users:", error);
      
      const err = error as any;
      if (err?.code === "42P01" || err?.message?.includes("does not exist")) {
        setTablesExist(false);
        setMessage({ type: "error", text: "Database tables not found. Run the SQL setup script first." });
      } else {
        setMessage({ type: "error", text: "Failed to load users" });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUniversitiesAndCompanies() {
    try {
      const supabase = createClient();

      const [uniRes, compRes] = await Promise.all([
        supabase.from("universities").select("id, name").order("name"),
        supabase.from("companies").select("id, name").order("name"),
      ]);

      if (uniRes.data && !uniRes.error) {
        setUniversities(uniRes.data);
      }
      if (compRes.data && !compRes.error) {
        setCompanies(compRes.data);
      }
    } catch (e) {
      // Universities/companies data is non-critical
    }
  }

  // Fetch all departments + programs once on mount. Super Admin can read all
  // rows via RLS, so we don't need to refetch when the selected university /
  // department changes — we just filter the in-memory list.
  async function fetchDepartmentsAndPrograms() {
    try {
      const supabase = createClient();
      const [deptRes, progRes] = await Promise.all([
        supabase.from("departments").select("id, name, university_id").order("name"),
        supabase.from("programs").select("id, name, department_id").order("name"),
      ]);
      if (deptRes.data && !deptRes.error) setDepartments(deptRes.data);
      if (progRes.data && !progRes.error) setPrograms(progRes.data);
    } catch (e) {
      // Departments/programs data is non-critical
    }
  }

  function openAssignRoleDialog(targetUser: UserProfile) {
    setAssignRoleTarget(targetUser);
    // Pre-fill the form with the user's current role + scopes so the admin
    // can see the existing state and tweak it.
    setAssignRoleForm({
      user_id: targetUser.user_id,
      role: (targetUser.role as UserRole) || "university_admin",
      university_id: targetUser.university_id || "",
      department_id: "",
      program_id: "",
      company_id: "",
    });
    setIsAssignRoleOpen(true);
  }

  async function handleAssignRole() {
    if (!assignRoleForm.user_id) {
      setMessage({ type: "error", text: "No target user selected" });
      return;
    }

    const role = assignRoleForm.role;

    // Role-specific validation — mirrors the server-side check in
    // /api/admin/assign-role/route.ts.
    const needsUniversity = ["university_admin", "department_coordinator", "faculty_supervisor", "student"].includes(role);
    const needsDepartment = ["department_coordinator", "faculty_supervisor"].includes(role);
    const needsCompany = ["company_hr", "site_supervisor"].includes(role);

    if (needsUniversity && !assignRoleForm.university_id) {
      setMessage({ type: "error", text: `A university is required for role '${role}'` });
      return;
    }
    if (needsDepartment && !assignRoleForm.department_id) {
      setMessage({ type: "error", text: `A department is required for role '${role}'` });
      return;
    }
    if (needsCompany && !assignRoleForm.company_id) {
      setMessage({ type: "error", text: `A company is required for role '${role}'` });
      return;
    }

    setIsAssigningRole(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: assignRoleForm.user_id,
          role: assignRoleForm.role,
          university_id: assignRoleForm.university_id || undefined,
          department_id: assignRoleForm.department_id || undefined,
          program_id: assignRoleForm.program_id || undefined,
          company_id: assignRoleForm.company_id || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setMessage({
        type: "success",
        text: `Role updated to '${role}' for ${assignRoleTarget?.email || "user"}`,
      });
      setIsAssignRoleOpen(false);
      setAssignRoleTarget(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error assigning role:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to assign role",
      });
    } finally {
      setIsAssigningRole(false);
    }
  }

  // Open the confirmation dialog instead of using native confirm().
  // The dialog explains the CASCADE: suspending a university admin suspends
  // every account under that university; suspending a company HR admin
  // suspends every account of that company; other accounts suspend alone.
  function handleToggleUserStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    const target = users.find(u => u.user_id === userId);
    let cascadeLabel = "Only this account will be affected.";
    if (newStatus === "suspended") {
      if (target?.role === "university_admin") {
        cascadeLabel =
          "This is a UNIVERSITY ADMIN — suspending them will also suspend ALL accounts under their university (coordinators, supervisors, students). None of them will be able to sign in.";
      } else if (target?.role === "company_hr") {
        cascadeLabel =
          "This is a COMPANY ADMIN (HR) — suspending them will also suspend ALL accounts of their company (site supervisors, evaluators). None of them will be able to sign in.";
      }
    } else {
      if (target?.role === "university_admin") {
        cascadeLabel =
          "Reactivating this university admin will also reactivate ALL accounts under their university.";
      } else if (target?.role === "company_hr") {
        cascadeLabel =
          "Reactivating this company admin will also reactivate ALL accounts of their company.";
      }
    }
    setStatusDialog({ open: true, userId, currentStatus, newStatus, cascadeLabel });
  }

  // Actually perform the suspend/activate after the user confirms.
  // Goes through the super-admin API which CASCADES:
  //   - suspending a UNIVERSITY ADMIN suspends every account under that
  //     university (coordinators, supervisors, students…)
  //   - suspending a COMPANY HR admin suspends every account of that company
  //   - any other account: only that account
  // Suspended users are also banned at the auth layer (cannot sign in).
  async function confirmToggleUserStatus() {
    const { userId, newStatus } = statusDialog;
    setStatusDialog({ open: false, userId: "", currentStatus: "", newStatus: "", cascadeLabel: "" });

    try {
      const res = await fetch(`/api/super-admin/users/${userId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      setMessage({
        type: "success",
        text: json.message || `User ${newStatus === "suspended" ? "suspended" : "activated"} successfully!`,
      });

      fetchUsers();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update user status" });
    }
  }

  async function handleCreateUser() {
    // Validation
    if (!createForm.email.trim()) {
      setMessage({ type: "error", text: "Email is required" });
      return;
    }
    if (!createForm.email.includes("@")) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }
    if (!createForm.password || createForm.password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    if (!createForm.full_name.trim()) {
      setMessage({ type: "error", text: "Full name is required" });
      return;
    }

    // Role-specific validation
    if ((createForm.role === "university_admin" || createForm.role === "department_coordinator" || createForm.role === "faculty_supervisor") && !createForm.university_id) {
      setMessage({ type: "error", text: "Please select a university for this role" });
      return;
    }
    if (createForm.role === "company_hr" && !createForm.company_id) {
      setMessage({ type: "error", text: "Please select a company for this role" });
      return;
    }

    setIsCreatingUser(true);
    setMessage(null);

    try {
      const supabase = createClient();

      // Check if email exists
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", createForm.email.trim())
        .single();

      if (existingUser) {
        setMessage({ type: "error", text: "A user with this email already exists" });
        setIsCreatingUser(false);
        return;
      }

      // Call the server-side admin route. This uses the service role key
      // to create the auth user via supabase.auth.admin.createUser(),
      // which does NOT establish a session for the new user — so the
      // currently-signed-in Super Admin stays signed in.
      // (Previous flow called supabase.auth.signUp() from the browser,
      //  which logged the Super Admin IN as the new account. Bad.)
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createForm.email.trim(),
          password: createForm.password,
          full_name: createForm.full_name.trim(),
          role: createForm.role,
          university_id: createForm.university_id || undefined,
          company_id: createForm.company_id || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      setMessage({
        type: "success",
        text: `User created successfully! Email: ${createForm.email}`,
      });

      setIsCreateDialogOpen(false);
      resetCreateForm();
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to create user",
      });
    } finally {
      setIsCreatingUser(false);
    }
  }

  function resetCreateForm() {
    setCreateForm({
      email: "",
      password: "",
      full_name: "",
      role: "university_admin",
      university_id: "",
      company_id: "",
    });
  }

  function openViewDialog(user: UserProfile) {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  }

  function openEditDialog(targetUser: UserProfile) {
    setEditTarget(targetUser);
    setEditForm({
      full_name: targetUser.full_name || "",
      email: targetUser.email || "",
      phone: (targetUser as UserProfile & { phone?: string }).phone || "",
      password: "",
    });
    setIsEditDialogOpen(true);
  }

  async function handleSaveUser() {
    if (!editTarget) return;
    if (!editForm.full_name.trim() || editForm.full_name.trim().length < 2) {
      setMessage({ type: "error", text: "Full name must be at least 2 characters" });
      return;
    }
    if (!editForm.email.trim() || !editForm.email.includes("@")) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }
    if (editForm.password && editForm.password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters (or leave it blank to keep the current one)" });
      return;
    }

    setIsSavingUser(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/super-admin/users/${editTarget.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editForm.full_name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          password: editForm.password || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setMessage({ type: "success", text: `${editForm.full_name.trim()} updated successfully` });
      setIsEditDialogOpen(false);
      setEditTarget(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      setMessage({ type: "error", text: error.message || "Failed to update user" });
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`/api/super-admin/users/${deleteTarget.user_id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setMessage({
        type: "success",
        text: `${deleteTarget.full_name || deleteTarget.email} permanently deleted`,
      });
      setDeleteTarget(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      setMessage({ type: "error", text: error.message || "Failed to delete user" });
    } finally {
      setIsDeletingUser(false);
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      `${user.full_name} ${user.first_name} ${user.last_name} ${user.email}`.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (user.university_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: string) => {
    const config = roleConfig[role];
    if (!config) return <Badge variant="secondary">{role}</Badge>;
    
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Stats
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === "active").length;
  const usersByRole = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Platform Users"
        description="Create, edit, suspend and delete users across universities"
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        }
      />

      {/* Message Banner */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            message.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Database Setup Required */}
      {!tablesExist && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Database className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  Database Tables Not Found
                </h3>
                <p className="text-amber-700 dark:text-amber-300 text-sm">
                  The <code className="bg-amber-100 px-1 rounded dark:bg-amber-900/50">profiles</code> table doesn&apos;t exist yet.
                  Run the setup SQL script in Supabase to create all required tables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={totalUsers}
          icon={Users}
          variant="info"
        />
        <StatCard
          label="Active"
          value={activeUsers}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          label="Students"
          value={usersByRole.student || 0}
          icon={GraduationCap}
          variant="default"
        />
        <StatCard
          label="Admins"
          value={(usersByRole.super_admin || 0) + (usersByRole.university_admin || 0)}
          icon={Shield}
          variant="warning"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or university..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="university_admin">University Admin</SelectItem>
                <SelectItem value="department_coordinator">Department Coordinator</SelectItem>
                <SelectItem value="faculty_supervisor">Faculty Supervisor</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="company_hr">Company HR</SelectItem>
                <SelectItem value="site_supervisor">Site Supervisor</SelectItem>
                <SelectItem value="external_evaluator">External Evaluator</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending_setup">Pending Setup</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || roleFilter !== "all" || statusFilter !== "all" 
                  ? "No matching users" 
                  : "No users yet"}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {searchTerm || roleFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Create your first user or wait for universities to register."
                }
              </p>
              {!(searchTerm || roleFilter !== "all" || statusFilter !== "all") && (
                <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">University</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userItem) => (
                  <TableRow key={userItem.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {(userItem.full_name || userItem.email || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {userItem.full_name || `${userItem.first_name || ""} ${userItem.last_name || ""}`.trim() || "Unnamed"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{userItem.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(userItem.role)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {userItem.university_name ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{userItem.university_name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={userItem.status} /></TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {new Date(userItem.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewDialog(userItem)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(userItem)}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAssignRoleDialog(userItem)}>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Assign Role
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleUserStatus(userItem.user_id, userItem.status)}
                            className={
                              userItem.status === "active" 
                                ? "text-red-600 focus:text-red-600" 
                                : "text-emerald-600 focus:text-emerald-600"
                            }
                          >
                            {userItem.status === "active" ? (
                              <>
                                <Ban className="h-4 w-4 mr-2" />
                                Suspend User
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Activate User
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(userItem)}
                            disabled={userItem.user_id === user?.id}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create User dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new admin or staff account. The user will receive access credentials.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Account Information */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Key className="h-4 w-4" />
                Account Information
              </h4>
              
              <div className="space-y-2">
                <Label htmlFor="create-email">Email Address *</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="admin@university.edu.pk"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password">Password *</Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    className="pr-24"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const newPass = "User@" + Math.random().toString(36).substring(2, 8);
                        setCreateForm(prev => ({ ...prev, password: newPass }));
                      }}
                      tabIndex={-1}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-name">Full Name *</Label>
                <Input
                  id="create-name"
                  placeholder="John Doe"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
            </div>

            {/* Role Assignment */}
            <div className="space-y-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role Assignment
              </h4>
              
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select 
                  value={createForm.role} 
                  onValueChange={(value: any) => setCreateForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university_admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        University Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="department_coordinator">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4" />
                        Department Coordinator
                      </div>
                    </SelectItem>
                    <SelectItem value="faculty_supervisor">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Faculty Supervisor
                      </div>
                    </SelectItem>
                    <SelectItem value="company_hr">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Company HR
                      </div>
                    </SelectItem>
                    <SelectItem value="site_supervisor">
                      <div className="flex items-center gap-2">
                        <HardHat className="h-4 w-4" />
                        Site Supervisor
                      </div>
                    </SelectItem>
                    <SelectItem value="external_evaluator">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        External Evaluator
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {roleConfig[createForm.role] && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {roleConfig[createForm.role].description}
                  </p>
                )}
              </div>
            </div>

            {/* University/Company Assignment */}
            {(createForm.role === "university_admin" || createForm.role === "department_coordinator" || createForm.role === "faculty_supervisor") && (
              <div className="space-y-2">
                <Label>University *</Label>
                <Select 
                  value={createForm.university_id}
                  onValueChange={(value) => setCreateForm(prev => ({ ...prev, university_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a university" />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((uni) => (
                      <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {createForm.role === "company_hr" && (
              <div className="space-y-2">
                <Label>Company *</Label>
                <Select 
                  value={createForm.company_id}
                  onValueChange={(value) => setCreateForm(prev => ({ ...prev, company_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isCreatingUser}>
              {isCreatingUser ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditTarget(null);
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update account details for {editTarget?.full_name || editTarget?.email}.
              Leave the password blank to keep the current one.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full Name *</Label>
              <Input
                id="edit-full-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Changing the email updates the sign-in address immediately.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+92 300 0000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (optional)</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave blank to keep current password"
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  tabIndex={-1}
                >
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            {editTarget?.role && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <span className="text-muted-foreground">Role:</span>{" "}
                {roleConfig[editTarget.role]?.label || editTarget.role}
                <span className="text-muted-foreground"> — change it via “Assign Role”.</span>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSavingUser}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          <>
            <Trash2 className="h-5 w-5 shrink-0" />
            Delete user permanently?
          </>
        }
        description={
          <span className="space-y-3 block">
            <span className="block">
              This will permanently delete <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>{" "}
              ({deleteTarget?.email}).
            </span>
            <span className="block bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              This action <strong>cannot be undone</strong>. The account, its sign-in credentials and all
              personal data are removed: applications, weekly logs, evaluations, submissions,
              attendance, certificates, documents and notifications.
            </span>
            {deleteTarget?.role === "university_admin" && (
              <span className="block bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                This is a university admin — the university itself and its other accounts are NOT
                deleted. Use Universities → Delete if you want to remove the whole university with
                every account under it.
              </span>
            )}
          </span>
        }
        confirmLabel={isDeletingUser ? "Deleting..." : "Delete User"}
        variant="danger"
        loading={isDeletingUser}
        onConfirm={handleDeleteUser}
      />

      {/* View User Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Complete information about this user account.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <DialogBody className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {(selectedUser.full_name || selectedUser.email || "U")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedUser.full_name || "Unnamed User"}
                  </h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1"><StatusBadge status={selectedUser.status} /></div>
                </div>
              </div>

              <div className="space-y-3">
                <InfoRow 
                  label="University" 
                  value={selectedUser.university_name || "Not assigned"} 
                />
                <InfoRow 
                  label="User ID" 
                  value={selectedUser.user_id.substring(0, 8) + "..."} 
                />
                <InfoRow 
                  label="Joined" 
                  value={new Date(selectedUser.created_at).toLocaleDateString()} 
                />
                {selectedUser.last_login && (
                  <InfoRow 
                    label="Last Login" 
                    value={new Date(selectedUser.last_login).toLocaleString()} 
                  />
                )}
              </div>
            </DialogBody>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog
        open={isAssignRoleOpen}
        onOpenChange={(open) => {
          setIsAssignRoleOpen(open);
          if (!open) setAssignRoleTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[560px] p-0">
          {/* Header — accent strip to signal "this is an admin action" */}
          <div className="shrink-0 px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent">
            <DialogHeader className="p-0 space-y-0 text-center sm:text-center">
              <DialogTitle className="flex items-center justify-center gap-2 text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                Assign Role
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Body — sectioned for clear visual hierarchy */}
          <div className="px-6 py-5 space-y-6 flex-1 min-h-0 overflow-y-auto">

            {/* SECTION 1: Current state */}
            {assignRoleTarget && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Current State
                </h4>
                <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-muted/40 border border-border/60">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Current role
                    </p>
                    <div>{getRoleBadge(assignRoleTarget.role)}</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Current university
                    </p>
                    <p className="text-sm font-medium truncate" title={assignRoleTarget.university_name || ""}>
                      {assignRoleTarget.university_name || "—"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* SECTION 2: New role */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New Role
              </h4>
              <div className="space-y-2">
                <Label>
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={assignRoleForm.role}
                  onValueChange={(value: UserRole) =>
                    setAssignRoleForm((prev) => ({
                      ...prev,
                      role: value,
                      // Clear scope selectors that don't apply to the new role.
                      // The user can re-select if they want to keep them.
                      department_id:
                        value === "department_coordinator" || value === "faculty_supervisor"
                          ? prev.department_id
                          : "",
                      program_id:
                        value === "student" ? prev.program_id : "",
                      company_id:
                        value === "company_hr" || value === "site_supervisor"
                          ? prev.company_id
                          : "",
                    }))
                  }
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university_admin" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        University Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="department_coordinator" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4" />
                        Department Coordinator
                      </div>
                    </SelectItem>
                    <SelectItem value="faculty_supervisor" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Faculty Supervisor
                      </div>
                    </SelectItem>
                    <SelectItem value="student" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Student
                      </div>
                    </SelectItem>
                    <SelectItem value="company_hr" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Company HR
                      </div>
                    </SelectItem>
                    <SelectItem value="site_supervisor" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <HardHat className="h-4 w-4" />
                        Site Supervisor
                      </div>
                    </SelectItem>
                    <SelectItem value="external_evaluator" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        External Evaluator
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {roleConfig[assignRoleForm.role] && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/60" />
                    {roleConfig[assignRoleForm.role].description}
                  </p>
                )}
              </div>
            </section>

            {/* SECTION 3: Scope (conditional — shown only when role is selected) */}
            {assignRoleForm.role && (
              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Scope Associations
                </h4>

                {/* University selector — for university-scoped roles */}
                {["university_admin", "department_coordinator", "faculty_supervisor", "student"].includes(
                  assignRoleForm.role
                ) && (
                  <div className="space-y-2">
                    <Label>
                      University <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={assignRoleForm.university_id}
                      onValueChange={(value) =>
                        setAssignRoleForm((prev) => ({
                          ...prev,
                          university_id: value,
                          // Clear department/program when university changes —
                          // they may not belong to the new university.
                          department_id: "",
                          program_id: "",
                        }))
                      }
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Select a university" />
                      </SelectTrigger>
                      <SelectContent>
                        {universities.map((uni) => (
                          <SelectItem key={uni.id} value={uni.id} className="cursor-pointer">
                            {uni.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Department selector — for department-scoped roles */}
                {["department_coordinator", "faculty_supervisor"].includes(assignRoleForm.role) && (
                  <div className="space-y-2">
                    <Label>
                      Department <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={assignRoleForm.department_id}
                      onValueChange={(value) =>
                        setAssignRoleForm((prev) => ({
                          ...prev,
                          department_id: value,
                          program_id: "",
                        }))
                      }
                      disabled={!assignRoleForm.university_id}
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue
                          placeholder={
                            assignRoleForm.university_id
                              ? "Select a department"
                              : "Select a university first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {departments
                          .filter(
                            (d) => d.university_id === assignRoleForm.university_id
                          )
                          .map((dept) => (
                            <SelectItem key={dept.id} value={dept.id} className="cursor-pointer">
                              {dept.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Program selector — optional for students */}
                {assignRoleForm.role === "student" && (
                  <div className="space-y-2">
                    <Label>Program (optional)</Label>
                    <Select
                      value={assignRoleForm.program_id}
                      onValueChange={(value) =>
                        setAssignRoleForm((prev) => ({ ...prev, program_id: value }))
                      }
                      disabled={!assignRoleForm.university_id}
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue
                          placeholder={
                            assignRoleForm.university_id
                              ? "Select a program (optional)"
                              : "Select a university first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {programs
                          .filter((p) => {
                            // Show only programs whose department belongs to the
                            // selected university.
                            const dept = departments.find(
                              (d) => d.id === p.department_id
                            );
                            return dept?.university_id === assignRoleForm.university_id;
                          })
                          .map((prog) => (
                            <SelectItem key={prog.id} value={prog.id} className="cursor-pointer">
                              {prog.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The student will be enrolled in this program. Leave blank to
                      assign without a program.
                    </p>
                  </div>
                )}

                {/* Company selector — for company-scoped roles */}
                {["company_hr", "site_supervisor"].includes(assignRoleForm.role) && (
                  <div className="space-y-2">
                    <Label>
                      Company <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={assignRoleForm.company_id}
                      onValueChange={(value) =>
                        setAssignRoleForm((prev) => ({ ...prev, company_id: value }))
                      }
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id} className="cursor-pointer">
                            {comp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </section>
            )}

            {/* SECTION 4: JWT warning — pinned at the bottom of the body */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs leading-relaxed">
                The user&apos;s JWT will be updated to reflect the new role on
                their next sign-in. If they&apos;re currently signed in, they
                may need to log out and back in for the change to take effect
                everywhere.
              </p>
            </div>
          </div>

          {/* Footer — sticky, bordered, well-padded */}
          <DialogFooter className="shrink-0 px-8 py-4 border-t bg-muted/20 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAssignRoleOpen(false)}
              disabled={isAssigningRole}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={isAssigningRole}
              className="cursor-pointer"
            >
              {isAssigningRole ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Assign Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend/Activate Confirmation Dialog */}
      <AlertDialog
        open={statusDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setStatusDialog({ open: false, userId: "", currentStatus: "", newStatus: "", cascadeLabel: "" });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialog.newStatus === "suspended" ? "Suspend User" : "Activate User"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span>
                Are you sure you want to{" "}
                {statusDialog.newStatus === "suspended" ? "suspend" : "activate"} this user?
                {statusDialog.newStatus === "suspended" &&
                  " They will lose access to their dashboard immediately."}
              </span>
              {statusDialog.cascadeLabel && statusDialog.cascadeLabel !== "Only this account will be affected." && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">{statusDialog.cascadeLabel}</span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleUserStatus}
              className={statusDialog.newStatus === "suspended" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {statusDialog.newStatus === "suspended" ? "Suspend" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper component for info rows in view dialog
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[200px] truncate">{value}</span>
    </div>
  );
}
