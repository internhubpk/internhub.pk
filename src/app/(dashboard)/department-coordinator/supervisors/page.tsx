"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  UserCheck,
  Filter,
  X,
  Mail,
  Phone,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

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

export default function SupervisorsPage() {
  const { profile } = useAuth();
  const [supervisors, setSupervisors] = useState<(Supervisor & { workload?: SupervisorWorkload })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
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
      {/* Header — read-only, no creation button */}
      <PageHeader
        title="Supervisors"
        description="Faculty supervisors in your department"
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Supervisors" value={supervisors.length} icon={UserCheck} variant="default" />
        <StatCard
          label="Total Assigned Students"
          value={supervisors.reduce((acc, s) => acc + (s.workload?.assigned_students || 0), 0)}
          icon={Users}
          variant="success"
        />
        <StatCard
          label="Avg. Workload"
          value={
            supervisors.length > 0
              ? Math.round(supervisors.reduce((acc, s) => acc + (s.workload?.assigned_students || 0), 0) / supervisors.length)
              : 0
          }
          icon={Award}
          variant="default"
        />
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
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supervisors Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : supervisors.length === 0 ? (
            <EmptyState
              icon={<UserCheck className="h-10 w-10 text-muted-foreground" />}
              title="No supervisors found"
              description={
                searchQuery || filterActive !== "all"
                  ? "Try adjusting your filters."
                  : "Faculty Supervisors are created by the Program Coordinator of each program. They will appear here once assigned."
              }
              action={
                !searchQuery && filterActive === "all"
                  ? { label: "Create Program", href: "/department-coordinator/programs" }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead className="text-center">Assigned Students</TableHead>
                  <TableHead className="text-center">Active Supervisions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisors.map((supervisor) => {
                  const isExpanded = expandedSupervisor === supervisor.id;
                  return (
                    <React.Fragment key={supervisor.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedSupervisor(isExpanded ? null : supervisor.id)
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {getInitials(supervisor)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{getFullName(supervisor)}</p>
                              <p className="text-xs text-muted-foreground">
                                {supervisor.profiles?.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {supervisor.specialization || (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {supervisor.workload?.assigned_students ?? 0}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {supervisor.workload?.active_supervisions ?? 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant={supervisor.is_active ? "default" : "secondary"}>
                            {supervisor.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-b"
                          >
                            <TableCell colSpan={5} className="bg-muted/30 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4">
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                                    Contact
                                  </p>
                                  {supervisor.profiles?.email && (
                                    <p className="text-sm flex items-center gap-2">
                                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                      {supervisor.profiles.email}
                                    </p>
                                  )}
                                  {supervisor.profiles?.phone && (
                                    <p className="text-sm flex items-center gap-2">
                                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                      {supervisor.profiles.phone}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                                    Workload
                                  </p>
                                  <p className="text-sm">
                                    Assigned: {supervisor.workload?.assigned_students ?? 0} students
                                  </p>
                                  <p className="text-sm">
                                    Active supervisions: {supervisor.workload?.active_supervisions ?? 0}
                                  </p>
                                  <p className="text-sm">
                                    Completed: {supervisor.workload?.completed_supervisions ?? 0}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
