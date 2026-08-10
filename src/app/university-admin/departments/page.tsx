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
  GraduationCap,
  Plus,
  Users,
  Edit3,
  MoreVertical,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  headName: string;
  studentCount: number;
  isActive: boolean;
}

const mockDepartments: DepartmentRecord[] = [
  { id: "1", name: "Computer Science", code: "CS", headName: "Dr. Sarah Johnson", studentCount: 450, isActive: true },
  { id: "2", name: "Data Science", code: "DS", headName: "Dr. Michael Chen", studentCount: 180, isActive: true },
  { id: "3", name: "Design", code: "DES", headName: "Prof. Emily Davis", studentCount: 120, isActive: true },
  { id: "4", name: "Business Administration", code: "BA", headName: "Dr. Robert Wilson", studentCount: 320, isActive: true },
  { id: "5", name: "Marketing", code: "MKT", headName: "Prof. Lisa Anderson", studentCount: 164, isActive: false },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function UniversityAdminDepartmentsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDepartments = mockDepartments.filter((dept) =>
    searchQuery === "" || dept.name.toLowerCase().includes(searchQuery.toLowerCase()) || dept.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Department Management</h1>
            <p className="text-muted-foreground mt-1">Manage university departments</p>
          </div>
          <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Department</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid gap-4 grid-cols-3">
        {[
          { label: "Total Departments", value: mockDepartments.length },
          { label: "Active Departments", value: mockDepartments.filter(d => d.isActive).length, color: "text-emerald-600" },
          { label: "Total Students", value: mockDepartments.reduce((sum, d) => sum + d.studentCount, 0).toLocaleString(), color: "text-blue-600" },
        ].map((stat) => (
          <Card key={stat.label}><CardContent className="pt-6 pb-4 text-center">
            <GraduationCap className={`mx-auto h-6 w-6 text-muted-foreground/40 mb-1 ${stat.color}`} />
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent></Card>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search departments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" />
        </div>
      </motion.div>

      {/* Department Cards Grid (Responsive) */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDepartments.map((dept) => (
          <Card key={dept.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">{dept.code}</div>
                  <div>
                    <h3 className="font-semibold">{dept.name}</h3>
                    <Badge variant="outline" className="text-xs mt-1">{dept.code}</Badge>
                  </div>
                </div>
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem><Edit3 className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                    <DropdownMenuItem>View Students</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Department Head</span>
                  <span>{dept.headName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Students</span>
                  <span className="font-medium flex items-center gap-1"><Users className="h-4 w-4" />{dept.studentCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={dept.isActive ? "secondary" : "outline"} className="text-xs">{dept.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </motion.div>
  );
}
