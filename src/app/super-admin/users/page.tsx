"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Search,
  Users,
  MoreVertical,
  Eye,
  Edit3,
  Shield,
  Filter,
  UserCheck,
  UserX,
  Mail,
  CalendarDays,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "university_admin" | "faculty_supervisor" | "student" | "company_hr";
  university?: string;
  status: "active" | "inactive" | "suspended";
  lastLogin: string;
}

const mockUsers: UserRecord[] = [
  { id: "1", name: "System Admin", email: "admin@internhub.app", role: "super_admin", status: "active", lastLogin: "2024-02-06T10:30:00Z" },
  { id: "2", name: "Dr. Sarah Johnson", email: "sjohnson@state.edu", role: "university_admin", university: "State University", status: "active", lastLogin: "2024-02-05T14:20:00Z" },
  { id: "3", name: "John Doe (Student)", email: "jdoe@state.edu", role: "student", university: "State University", status: "active", lastLogin: "2024-02-06T09:15:00Z" },
  { id: "4", name: "Mike Chen (HR)", email: "mchen@techcorp.com", role: "company_hr", status: "active", lastLogin: "2024-02-04T16:45:00Z" },
  { id: "5", name: "Prof. Emily Davis", email: "edavis@techinstitute.edu", role: "faculty_supervisor", university: "Tech Institute", status: "active", lastLogin: "2024-02-03T11:00:00Z" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const roleConfig = {
  super_admin: { label: "Super Admin", color: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" },
  university_admin: { label: "University Admin", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
  faculty_supervisor: { label: "Faculty Supervisor", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" },
  student: { label: "Student", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  company_hr: { label: "Company HR", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
};

export default function SuperAdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">Manage all platform users</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[
          { label: "Total Users", value: mockUsers.length },
          { label: "Active", value: mockUsers.filter(u => u.status === "active").length, color: "text-emerald-600" },
          { label: "Admins", value: mockUsers.filter(u => u.role === "super_admin" || u.role === "university_admin").length, color: "text-blue-600" },
          { label: "Students", value: mockUsers.filter(u => u.role === "student").length, color: "text-purple-600" },
          { label: "Suspended", value: mockUsers.filter(u => u.status === "suspended").length, color: "text-red-600" },
        ].map((stat) => (
          <Card key={stat.label}><CardContent className="pt-6 pb-4 text-center">
            <Users className={`mx-auto h-6 w-6 text-muted-foreground/40 mb-1 ${stat.color}`} />
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent></Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card><CardContent className="pt-6 pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" /></div>
            <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="w-full sm:w-[160px] h-11"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent>
              <SelectItem value="all">All Roles</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem><SelectItem value="university_admin">University Admin</SelectItem><SelectItem value="faculty_supervisor">Faculty</SelectItem><SelectItem value="student">Student</SelectItem><SelectItem value="company_hr">Company HR</SelectItem>
            </SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-[130px] h-11"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent></Select>
          </div>
        </CardContent></Card>
      </motion.div>

      {/* Users Table */}
      <motion.div variants={itemVariants}>
        <Card><CardHeader><CardTitle>User Directory</CardTitle><CardDescription>{filteredUsers.length} user(s)</CardDescription></CardHeader><CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>University</TableHead><TableHead>Status</TableHead><TableHead>Last Login</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary text-xs">{user.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</div><div><p className="font-medium text-sm">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div></div></TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs ${roleConfig[user.role as keyof typeof roleConfig].color}`}>{roleConfig[user.role as keyof typeof roleConfig].label}</Badge></TableCell>
                  <TableCell className="text-sm">{user.university || "-"}</TableCell>
                  <TableCell><Badge variant={user.status === "active" ? "secondary" : "outline"} className="text-xs">{user.status === "active" ? <><UserCheck className="mr-1 h-3 w-3" />Active</> : <><UserX className="mr-1 h-3 w-3" />{user.status}</>}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(user.lastLogin).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                        <DropdownMenuItem><Edit3 className="mr-2 h-4 w-4" />Edit User</DropdownMenuItem>
                        <DropdownMenuItem><Mail className="mr-2 h-4 w-4" />Send Email</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Suspend User</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </motion.div>
    </motion.div>
  );
}
