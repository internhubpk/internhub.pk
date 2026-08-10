"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface UserProfile {
  id?: string;           // New surrogate key (may not exist in older schemas)
  user_id: string;       // Primary key - references auth.users
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

const roleConfig: Record<string, { label: string; icon: any; color: string }> = {
  super_admin: { label: "Super Admin", icon: Shield, color: "bg-purple-100 text-purple-700" },
  university_admin: { label: "University Admin", icon: Shield, color: "bg-blue-100 text-blue-700" },
  department_coordinator: { label: "Dept. Coordinator", icon: ClipboardCheck, color: "bg-indigo-100 text-indigo-700" },
  faculty_supervisor: { label: "Faculty Supervisor", icon: UserCheck, color: "bg-teal-100 text-teal-700" },
  student: { label: "Student", icon: GraduationCap, color: "bg-green-100 text-green-700" },
  company_hr: { label: "Company HR", icon: Briefcase, color: "bg-orange-100 text-orange-700" },
  site_supervisor: { label: "Site Supervisor", icon: HardHat, color: "bg-amber-100 text-amber-700" },
  external_evaluator: { label: "External Evaluator", icon: Award, color: "bg-pink-100 text-pink-700" },
};

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tablesExist, setTablesExist] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const supabase = createClient();

      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply filters server-side if needed
      if (roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }

      const { data, error } = await query;

      // Check if table doesn't exist
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
      
      // Check if it's a "table does not exist" error
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

  async function handleToggleUserStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    
    if (!confirm(`Are you sure you want to ${newStatus === "suspended" ? "suspend" : "activate"} this user?`)) {
      return;
    }

    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from("profiles")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;

      setMessage({ 
        type: "success", 
        text: `User ${newStatus === "suspended" ? "suspended" : "activated"} successfully!` 
      });
      
      fetchUsers();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update user status" });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700"><UserCheck className="h-3 w-3 mr-1" />Active</Badge>;
      case "suspended":
        return <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Suspended</Badge>;
      case "pending_setup":
        return <Badge className="bg-amber-100 text-amber-700"><RefreshCw className="h-3 w-3 mr-1" />Pending Setup</Badge>;
      default:
        return <Badge variant="secondary"><UserX className="h-3 w-3 mr-1" />Inactive</Badge>;
    }
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
      <div>
        <h1 className="text-3xl font-bold">Platform Users</h1>
        <p className="text-muted-foreground mt-1">
          View and manage all registered users across universities
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          💡 Note: University Admins are responsible for adding users to their institutions.
        </p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          message.type === "success" 
            ? "bg-green-50 border-green-200 text-green-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <Ban className="h-5 w-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto">
            ×
          </button>
        </div>
      )}

      {/* Database Setup Required */}
      {!tablesExist && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Database className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 mb-2">
                  ⚠️ Database Tables Not Found
                </h3>
                <p className="text-amber-700 text-sm">
                  The <code className="bg-amber-100 px-1 rounded">profiles</code> table doesn&apos;t exist yet.
                  Run the setup SQL script in Supabase to create all required tables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">{totalUsers}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{activeUsers}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Students</p>
              <p className="text-2xl font-bold">{usersByRole.student || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Admins</p>
              <p className="text-2xl font-bold">
                {(usersByRole.super_admin || 0) + (usersByRole.university_admin || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
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
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading users...</span>
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
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
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
                {filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {(user.full_name || user.email || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unnamed"}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.university_name ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3.5 w-3.5" />
                          {user.university_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleUserStatus(user.user_id, user.status)}
                          title={user.status === "active" ? "Suspend user" : "Activate user"}
                        >
                          {user.status === "active" ? (
                            <Ban className="h-4 w-4 text-red-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
