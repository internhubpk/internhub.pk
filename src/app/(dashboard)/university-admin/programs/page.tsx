"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  BookOpen,
  Filter,
  X,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import type { Department } from "@/types";

interface Program {
  id: string;
  name: string;
  code: string;
  description: string | null;
  // duration_weeks was REMOVED from the programs table in migration 0076.
  is_active: boolean;
  university_id: string;
  department_id: string;
  default_faculty_supervisor_id: string | null;
  student_count?: number;
  created_at: string;
  updated_at: string;
  departments?: { name: string; code: string | null }[] | null;
  supervisor?: { full_name: string | null; email: string }[] | null;
}

export default function UniversityAdminProgramsPage() {
  const { profile, university } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [coordinators, setCoordinators] = useState<Record<string, { full_name: string | null; email: string }>>({});

  const universityId = profile?.university_id || university?.id;

  // ----------------------------------------------------------------
  // Fetch programs — READ ONLY.
  //
  // University Admin can VIEW programs but cannot create/edit/delete
  // them. Programs are created by Department Coordinators (who allot
  // a supervisor to each program). This page is for oversight only.
  //
  // RLS scopes the SELECT to programs where university_id matches
  // the caller's university (migration 0002, prog_select policy).
  // ----------------------------------------------------------------
  const fetchPrograms = useCallback(async () => {
    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();

      let query = supabase
        .from("programs")
        .select(
          `id, name, code, description, is_active,
           university_id, department_id, default_faculty_supervisor_id,
           created_at, updated_at,
           departments:department_id ( name, code ),
           supervisor:default_faculty_supervisor_id ( full_name, email )`
        )
        .eq("university_id", universityId)
        .order("created_at", { ascending: false });

      if (filterActive === "true") {
        query = query.eq("is_active", true);
      } else if (filterActive === "false") {
        query = query.eq("is_active", false);
      }

      if (filterDepartment !== "all") {
        query = query.eq("department_id", filterDepartment);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch Program Coordinator for each program (profiles with
      // role='program_coordinator' and program_id = this program's id).
      const programIds = (data || []).map((p) => p.id);
      let coordinatorMap: Record<string, { full_name: string | null; email: string }> = {};

      if (programIds.length > 0) {
        const { data: coordinators } = await supabase
          .from("profiles")
          .select("full_name, email, program_id")
          .eq("role", "program_coordinator")
          .in("program_id", programIds)
          .eq("is_active", true);

        for (const c of (coordinators || []) as any[]) {
          if (c.program_id) {
            coordinatorMap[c.program_id] = {
              full_name: c.full_name,
              email: c.email,
            };
          }
        }
      }

      // Get student counts per program
      let studentCounts: Record<string, number> = {};

      if (programIds.length > 0) {
        const { data: students } = await supabase
          .from("students")
          .select("program_id")
          .in("program_id", programIds);

        studentCounts = (students || []).reduce((acc, s) => {
          if (s.program_id) {
            acc[s.program_id] = (acc[s.program_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
      }

      let enriched = (data || []).map((p) => ({
        ...p,
        student_count: studentCounts[p.id] || 0,
      })) as Program[];

      // Apply search filter client-side
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        enriched = enriched.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q)
        );
      }

      setCoordinators(coordinatorMap);
      setPrograms(enriched);
    } catch (error) {
      console.error("Error fetching programs:", error);
      toast.error("Error", { description: "Failed to load programs" });
    } finally {
      setIsLoading(false);
    }
  }, [universityId, filterActive, filterDepartment, searchQuery, toast]);

  const fetchDepartments = useCallback(async () => {
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
  }, [universityId]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const deptNameFor = (program: Program) => {
    const joinName = program.departments?.[0]?.name;
    if (joinName) return joinName;
    const dept = departments.find((d) => d.id === program.department_id);
    return dept?.name || "—";
  };

  const deptCodeFor = (program: Program) => {
    const joinCode = program.departments?.[0]?.code;
    if (joinCode) return joinCode;
    const dept = departments.find((d) => d.id === program.department_id);
    return dept?.code || null;
  };

  const supervisorNameFor = (program: Program): string | null => {
    const sup = program.supervisor?.[0];
    if (sup?.full_name) return sup.full_name;
    if (sup?.email) return sup.email;
    return null;
  };

  if (!universityId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Programs" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your admin account is not linked to a university yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Programs"
        description={`View internship programs across all departments in ${university?.name || "your university"}. Programs are created and managed by department coordinators.`}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[180px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {(searchQuery || filterActive !== "all" || filterDepartment !== "all") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterActive("all");
                    setFilterDepartment("all");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Badge variant="secondary" className="ml-1 self-center">
                {programs.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Programs List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No programs found</h3>
              <p className="text-muted-foreground mb-2 max-w-md">
                {searchQuery || filterActive !== "all" || filterDepartment !== "all"
                  ? "No programs match your search criteria"
                  : "No programs have been created yet"}
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                Department coordinators create programs for their respective
                departments. Once created, they will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile cards */}
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
                  <Card>
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

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Building2 className="h-4 w-4" />
                        <span>{deptNameFor(program)}</span>
                        {deptCodeFor(program) && (
                          <Badge variant="outline" className="text-xs">
                            {deptCodeFor(program)}
                          </Badge>
                        )}
                      </div>

                      {program.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {program.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {program.student_count || 0} students
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground mt-2 truncate">
                        <span className="font-medium">Program Coordinator:</span>{" "}
                        {coordinators[program.id]?.full_name || (
                          <Badge variant="outline" className="text-xs">Not assigned</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Program</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Department</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Program Coordinator</th>
                    {/* Duration column removed — programs no longer have a fixed week count */}
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Students</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {programs.map((program) => (
                      <motion.tr
                        key={program.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedProgram(
                            expandedProgram === program.id ? null : program.id
                          )
                        }
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-primary" />
                            </div>
                            <div className="max-w-[220px]">
                              <p className="font-medium truncate">{program.name}</p>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {program.code}
                              </code>
                              {expandedProgram === program.id && program.description && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  className="text-xs text-muted-foreground mt-1"
                                >
                                  {program.description}
                                </motion.p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {deptNameFor(program)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {coordinators[program.id]?.full_name ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{coordinators[program.id].full_name}</span>
                              <span className="text-xs text-muted-foreground">{coordinators[program.id].email}</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Not assigned
                            </Badge>
                          )}
                        </td>
                        {/* Duration column removed — programs no longer have a fixed week count */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {program.student_count || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={program.is_active ? "default" : "secondary"}
                            className="gap-1"
                          >
                            {program.is_active ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {program.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>
              Showing {programs.length} program{programs.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <ChevronDown className="h-3 w-3" />
              Click a row to expand details
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
