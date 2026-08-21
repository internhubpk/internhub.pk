"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Filter,
  X,
  Mail,
  Phone,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { toast } from "sonner";

interface SupervisorRow {
  id: string;
  user_id: string;
  type: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  specialization: string | null;
  is_active: boolean;
  assigned_students: number;
}

export default function ProgramCoordinatorSupervisorsPage() {
  const { profile } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const fetchSupervisors = useCallback(async () => {
    if (!profile?.university_id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch all faculty + site supervisors in this university
      const { data, error } = await supabase
        .from("supervisors")
        .select(`
          id, user_id, type, is_active, specialization,
          profiles:user_id (full_name, email, phone)
        `)
        .eq("university_id", profile.university_id)
        .in("type", ["faculty", "site"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each supervisor, count assigned students via student_internships
      const supervisorIds = (data || []).map((s: any) => s.id);
      let assignmentCounts: Record<string, number> = {};

      if (supervisorIds.length > 0) {
        const { data: assignments } = await supabase
          .from("student_internships")
          .select("faculty_supervisor_id, site_supervisor_id")
          .in("status", ["assigned", "active"]);

        for (const a of (assignments || []) as any[]) {
          if (a.faculty_supervisor_id && supervisorIds.includes(a.faculty_supervisor_id)) {
            assignmentCounts[a.faculty_supervisor_id] = (assignmentCounts[a.faculty_supervisor_id] || 0) + 1;
          }
          if (a.site_supervisor_id && supervisorIds.includes(a.site_supervisor_id)) {
            assignmentCounts[a.site_supervisor_id] = (assignmentCounts[a.site_supervisor_id] || 0) + 1;
          }
        }
      }

      const enriched: SupervisorRow[] = (data || []).map((s: any) => {
        const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        return {
          id: s.id,
          user_id: s.user_id,
          type: s.type,
          full_name: p?.full_name || null,
          email: p?.email || "",
          phone: p?.phone || null,
          specialization: s.specialization,
          is_active: s.is_active,
          assigned_students: assignmentCounts[s.id] || 0,
        };
      });

      setSupervisors(enriched);
    } catch (err) {
      console.error("Error fetching supervisors:", err);
      toast.error("Failed to load supervisors");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  const filteredSupervisors = supervisors.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.full_name?.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterType !== "all" && s.type !== filterType) return false;
    return true;
  });

  const facultyCount = supervisors.filter((s) => s.type === "faculty").length;
  const siteCount = supervisors.filter((s) => s.type === "site").length;
  const withStudents = supervisors.filter((s) => s.assigned_students > 0).length;

  if (!profile?.program_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisors" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your account is not linked to a program yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisors"
        description="Faculty and site supervisors at your university. Supervisors are assigned to students, not programs."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Faculty Supervisors" value={facultyCount} icon={Users} variant="info" />
        <StatCard label="Site Supervisors" value={siteCount} icon={Users} variant="default" />
        <StatCard label="With Assigned Students" value={withStudents} icon={AlertCircle} variant={withStudents > 0 ? "success" : "default"} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search supervisors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="site">Site</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterType !== "all") && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setFilterType("all"); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filteredSupervisors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No supervisors found</h3>
            <p className="text-muted-foreground">
              {searchQuery || filterType !== "all"
                ? "No supervisors match your filters."
                : "No supervisors exist in your university yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Assigned Students</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSupervisors.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.full_name || "Unknown"}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {s.email}
                          </span>
                          {s.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.type === "faculty" ? "default" : "secondary"}>
                        {s.type === "faculty" ? "Faculty" : "Site"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{s.specialization || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{s.assigned_students}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "secondary"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
