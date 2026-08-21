"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Users,
  FileText,
  Briefcase,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { EnablePushNotificationsCard } from "@/components/shared/enable-push-notifications";

export default function ProgramCoordinatorDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<{
    totalStudents: number;
    totalSupervisors: number;
    activeInternships: number;
    pendingReports: number;
    totalReports: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [programName, setProgramName] = useState<string>("");

  useEffect(() => {
    if (!profile?.program_id) {
      setIsLoading(false);
      return;
    }
    fetchStats();
    fetchProgramName();
  }, [profile]);

  async function fetchStats() {
    if (!profile?.program_id) return;
    try {
      const supabase = createClient();
      const programId = profile.program_id;

      // Fetch students in this program
      const { data: students } = await supabase
        .from("students")
        .select("user_id")
        .eq("program_id", programId);

      const studentIds = (students || []).map((s) => s.user_id);

      // Supervisors are assigned to STUDENTS (not programs — migration 0076
      // dropped supervisors.program_id). We count unique supervisors via
      // student_internships where the student is in this program.
      const { data: assignedSupervisors } = await supabase
        .from("student_internships")
        .select("faculty_supervisor_id, site_supervisor_id")
        .in("student_user_id", studentIds);

      const supervisorIds = new Set<string>();
      for (const si of (assignedSupervisors || []) as any[]) {
        if (si.faculty_supervisor_id) supervisorIds.add(si.faculty_supervisor_id);
        if (si.site_supervisor_id) supervisorIds.add(si.site_supervisor_id);
      }

      const [studentsRes, internshipsRes, reportsRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("program_id", programId),
        supabase.from("internships").select("id", { count: "exact", head: true }).eq("program_id", programId).in("status", ["open", "active"]),
        studentIds.length > 0
          ? supabase.from("weekly_logs").select("id, status").in("student_user_id", studentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const reports = (reportsRes as any).data || [];
      const pendingReports = reports.filter((r: any) => r.status === "submitted").length;

      setStats({
        totalStudents: studentsRes.count || 0,
        totalSupervisors: supervisorIds.size,
        activeInternships: internshipsRes.count || 0,
        pendingReports,
        totalReports: reports.length,
      });
    } catch (err) {
      console.error("Error fetching PC stats:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchProgramName() {
    if (!profile?.program_id) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("programs")
        .select("name, code, departments:department_id(name)")
        .eq("id", profile.program_id)
        .single();
      if (data) setProgramName(`${data.name} (${(data as any).code || "—"})`);
    } catch {
      // ignore
    }
  }

  if (!profile?.program_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Program Coordinator Dashboard" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your account is not linked to a program yet. Please ask a Department
            Coordinator to assign you to a program.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Coordinator Dashboard"
        description={`Managing: ${programName || "Loading..."}`}
      />

      {/* Push notification enable prompt (shared, silent if not supported) */}
      <EnablePushNotificationsCard />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              icon={<GraduationCap className="h-5 w-5" />}
              label="Students"
              value={stats?.totalStudents ?? "—"}
              description="In your program"
              color="text-blue-500"
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Supervisors"
              value={stats?.totalSupervisors ?? "—"}
              description="Across your program's students"
              color="text-purple-500"
            />
            <StatCard
              icon={<Briefcase className="h-5 w-5" />}
              label="Active Internships"
              value={stats?.activeInternships ?? "—"}
              description="Currently running"
              color="text-green-500"
            />
            <StatCard
              icon={<FileText className="h-5 w-5" />}
              label="Weekly Reports"
              value={stats?.totalReports ?? "—"}
              description="Submitted by your students"
              color="text-orange-500"
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Students</CardTitle>
            <CardDescription>Create and manage student accounts in your program</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/program-coordinator/students">Open</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Supervisors</CardTitle>
            <CardDescription>Assign supervisors to students (bulk assign supported)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/program-coordinator/supervisors">Open</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reports</CardTitle>
            <CardDescription>View completed reports for your program</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/program-coordinator/reports">Open</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  description: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <span className={color}>{icon}</span>
          </div>
          <div className="text-3xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
