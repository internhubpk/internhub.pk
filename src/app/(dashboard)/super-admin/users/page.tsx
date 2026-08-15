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

  // View user detail state
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Suspend/activate confirmation dialog state
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    userId: string;
    currentStatus: string;
    newStatus: string;
  }>({ open: false, userId: "", currentStatus: "", newStatus: "" });

  useEffect(() => {
    fetchUsers();
    fetchUniversitiesAndCompanies();
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
      console.log("Could not fetch universities/companies:", e);
    }
  }

  // Open the confirmation dialog instead of using native confirm().
  function handleToggleUserStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    setStatusDialog({ open: true, userId, currentStatus, newStatus });
  }

  // Actually perform the suspend/activate after the user confirms.
  async function confirmToggleUserStatus() {
    const { userId, newStatus } = statusDialog;
    setStatusDialog({ open: false, userId: "", currentStatus: "", newStatus: "" });

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("profiles")
        .update({
          status: newStatus,
          is_active: newStatus === "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;

      setMessage({
        type: "success",
        text: `User ${newStatus === "suspended" ? "suspended" : "activated"} successfully!`,
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
      {/* Read-only view — super admin can browse users but not create them.
          New users join via the public /register page; their role is assigned
          by their university admin (or via the dedicated Companies → Company HR
          management page for company_hr accounts). */}
      <PageHeader
        title="Platform Users"
        description="View and manage all registered users across universities"
        actions={
          <Badge variant="outline" className="text-sm px-3 py-1">
            Read-only
          </Badge>
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
                  : "Once universities register their admins, users will appear here."
                }
              </p>
              {/* Read-only — no "Create First User" button. New users self-register
                  via /register and are assigned a role by their university admin. */}
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

      {/* (Create User dialog removed — page is read-only. New users join via /register. */}
      {false && (
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new admin or staff account. The user will receive access credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4 overflow-y-auto max-h-[60vh]">
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
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                />
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
          </div>

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
      )}

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
            <div className="space-y-4 px-6 py-4 overflow-y-auto max-h-[60vh]">
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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend/Activate Confirmation Dialog */}
      <AlertDialog
        open={statusDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setStatusDialog({ open: false, userId: "", currentStatus: "", newStatus: "" });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialog.newStatus === "suspended" ? "Suspend User" : "Activate User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to{" "}
              {statusDialog.newStatus === "suspended" ? "suspend" : "activate"} this user?
              {statusDialog.newStatus === "suspended" &&
                " They will lose access to their dashboard immediately."}
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
