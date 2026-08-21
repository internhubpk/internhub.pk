"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  UserCog,
  Mail,
  BookOpen,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { createClient } from "@/utils/supabase/client";
import { toast } from "@/components/shared/toast";

interface ProgramCoordinator {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  department_id: string | null;
  program_id: string | null;
  created_at: string;
  programs?: { id: string; name: string; code: string } | null;
}

export default function CoordinatorsPage() {
  const { profile } = useAuth();
  const [coordinators, setCoordinators] = useState<ProgramCoordinator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchCoordinators = useCallback(async () => {
    if (!profile?.department_id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = await createClient();

      let query = supabase
        .from("profiles")
        .select(
          `user_id, first_name, last_name, email, avatar_url, phone, is_active, department_id, program_id, created_at, programs:program_id(id, name, code)`
        )
        .eq("role", "program_coordinator")
        .eq("department_id", profile.department_id);

      if (filterStatus === "active") {
        query = query.eq("is_active", true);
      } else if (filterStatus === "inactive") {
        query = query.eq("is_active", false);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching program coordinators:", error);
        toast.error("Error", { description: "Failed to load program coordinators." });
        return;
      }

      const rawData = data || [];
      let results: ProgramCoordinator[] = rawData.map((row: any) => ({
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        avatar_url: row.avatar_url,
        phone: row.phone,
        is_active: row.is_active,
        department_id: row.department_id,
        program_id: row.program_id,
        created_at: row.created_at,
        programs: row.programs?.[0] || null,
      }));

      // Client-side search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        results = results.filter(
          (pc) =>
            `${pc.first_name || ""} ${pc.last_name || ""}`.toLowerCase().includes(q) ||
            pc.email.toLowerCase().includes(q) ||
            (pc.programs && pc.programs.name.toLowerCase().includes(q))
        );
      }

      setCoordinators(results);
    } catch (error) {
      console.error("Error fetching program coordinators:", error);
      toast.error("Error", { description: "Failed to load program coordinators." });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.department_id, filterStatus, searchQuery]);

  useEffect(() => {
    fetchCoordinators();
  }, [fetchCoordinators]);

  const getInitials = (pc: ProgramCoordinator) => {
    const first = pc.first_name || "";
    const last = pc.last_name || "";
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    return initials || "PC";
  };

  const getFullName = (pc: ProgramCoordinator) => {
    const fullName = `${pc.first_name || ""} ${pc.last_name || ""}`.trim();
    return fullName || "Unnamed Coordinator";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const activeCount = coordinators.filter((pc) => pc.is_active).length;
  const inactiveCount = coordinators.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Program Coordinators"
        description="Program coordinators in your department"
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Coordinators"
          value={coordinators.length}
          icon={UserCog}
          variant="default"
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={BookOpen}
          variant="success"
        />
        <StatCard
          label="Inactive"
          value={inactiveCount}
          icon={Filter}
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
                placeholder="Search by name, email, or program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coordinators Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : coordinators.length === 0 ? (
            <EmptyState
              icon={<UserCog className="h-10 w-10 text-muted-foreground" />}
              title="No program coordinators found"
              description={
                searchQuery || filterStatus !== "all"
                  ? "Try adjusting your search or filter."
                  : "Program Coordinators are automatically created when you create a Program. Go to Programs to create one."
              }
              action={
                !searchQuery && filterStatus === "all"
                  ? { label: "Create Program", href: "/department-coordinator/programs" }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coordinator</TableHead>
                  <TableHead>Linked Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {coordinators.map((pc, index) => (
                    <motion.tr
                      key={pc.user_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {getInitials(pc)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{getFullName(pc)}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {pc.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {pc.programs ? (
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {pc.programs.name}
                            </span>
                            {pc.programs.code && (
                              <Badge variant="outline" className="text-xs">
                                {pc.programs.code}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pc.is_active ? "default" : "secondary"}>
                          {pc.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(pc.created_at)}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
