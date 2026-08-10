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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Building2,
  Plus,
  MoreVertical,
  Eye,
  Edit3,
  Users,
  Briefcase,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UniversityRecord {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  plan: "free" | "basic" | "professional" | "enterprise";
  status: "active" | "trial" | "expired" | "suspended";
  studentCount: number;
  adminEmail: string;
  createdAt: string;
}

const mockUniversities: UniversityRecord[] = [
  { id: "1", name: "State University", slug: "state-university", domain: "stateuniversity.edu", plan: "professional", status: "active", studentCount: 1234, adminEmail: "admin@state.edu", createdAt: "2023-01-15" },
  { id: "2", name: "Tech Institute", slug: "tech-institute", domain: "techinstitute.edu", plan: "enterprise", status: "active", studentCount: 890, adminEmail: "admin@ti.edu", createdAt: "2023-03-20" },
  { id: "3", name: "City College", slug: "city-college", plan: "basic", status: "trial", studentCount: 456, adminEmail: "admin@citycollege.edu", createdAt: "2024-01-10" },
  { id: "4", name: "Global University", slug: "global-university", plan: "free", status: "expired", studentCount: 120, adminEmail: "admin@global.edu", createdAt: "2023-06-01" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function SuperAdminUniversitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredUniversities = mockUniversities.filter((uni) => {
    const matchesSearch =
      searchQuery === "" ||
      uni.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = planFilter === "all" || uni.plan === planFilter;
    const matchesStatus = statusFilter === "all" || uni.status === statusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const planConfig = {
    free: { label: "Free", color: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300" },
    basic: { label: "Basic", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
    professional: { label: "Professional", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" },
    enterprise: { label: "Enterprise", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  };

  const statusConfig = {
    active: { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400", icon: CheckCircle2 },
    trial: { label: "Trial", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", icon: Clock },
    expired: { label: "Expired", color: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400", icon: XCircle },
    suspended: { label: "Suspended", color: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300", icon: XCircle },
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">University Management</h1>
            <p className="text-muted-foreground mt-1">Manage all universities on the platform</p>
          </div>
          <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add University</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[
          { label: "Total Universities", value: mockUniversities.length },
          { label: "Active", value: mockUniversities.filter(u => u.status === "active").length, color: "text-emerald-600" },
          { label: "In Trial", value: mockUniversities.filter(u => u.status === "trial").length, color: "text-amber-600" },
          { label: "Enterprise", value: mockUniversities.filter(u => u.plan === "enterprise").length, color: "text-purple-600" },
          { label: "Total Students", value: mockUniversities.reduce((sum, u) => sum + u.studentCount, 0).toLocaleString(), color: "text-blue-600" },
        ].map((stat) => (
          <Card key={stat.label}><CardContent className="pt-6 pb-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent></Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card><CardContent className="pt-6 pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search universities..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}><SelectTrigger className="w-full sm:w-[150px] h-11"><CreditCard className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Plan" /></SelectTrigger><SelectContent>
              <SelectItem value="all">All Plans</SelectItem><SelectItem value="free">Free</SelectItem><SelectItem value="basic">Basic</SelectItem><SelectItem value="professional">Professional</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-[140px] h-11"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>
              <SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="trial">Trial</SelectItem><SelectItem value="expired">Expired</SelectItem>
            </SelectContent></Select>
          </div>
        </CardContent></Card>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card><CardHeader><CardTitle>University Directory</CardTitle><CardDescription>{filteredUniversities.length} universit(ies)</CardDescription></CardHeader><CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>University</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Students</TableHead><TableHead>Domain</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredUniversities.map((uni) => (
                <TableRow key={uni.id}>
                  <TableCell>
                    <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-medium text-primary text-sm">{uni.name.charAt(0)}</div><div><p className="font-medium">{uni.name}</p><p className="text-xs text-muted-foreground">{uni.adminEmail}</p></div></div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={planConfig[uni.plan as keyof typeof planConfig].color}>{planConfig[uni.plan as keyof typeof planConfig].label}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={`${statusConfig[uni.status as keyof typeof statusConfig].color} text-xs`}>{statusConfig[uni.status as keyof typeof statusConfig].label}</Badge></TableCell>
                  <TableCell><span className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" />{uni.studentCount.toLocaleString()}</span></TableCell>
                  <TableCell className="text-sm">{uni.domain || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(uni.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                        <DropdownMenuItem><Edit3 className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem><Shield className="mr-2 h-4 w-4" />Impersonate Admin</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Suspend</DropdownMenuItem>
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
