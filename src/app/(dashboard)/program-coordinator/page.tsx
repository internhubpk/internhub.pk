"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Users,
  FileText,
  Briefcase,
  BarChart3,
  UserCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  const push = usePushNotifications();

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

      const [studentsRes, supervisorsRes, internshipsRes, reportsRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("program_id", programId),
        supabase.from("supervisors").select("id", { count: "exact", head: true }).eq("program_id", programId),
        supabase.from("internships").select("id", { count: "exact", head: true }).eq("program_id", programId).in("status", ["open", "active"]),
        studentIds.length > 0
          ? supabase.from("weekly_logs").select("id, status").in("student_id", studentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const reports = (reportsRes as any).data || [];
      const pendingReports = reports.filter((r: any) => r.status === "submitted").length;

      setStats({
        totalStudents: studentsRes.count || 0,
        totalSupervisors: supervisorsRes.count || 0,
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

  const handleSubscribe = async () => {
    const result = await push.subscribe();
    if (result.success) {
      toast.success("Notifications enabled", {
        description: "You'll receive push notifications for workflow events.",
      });
    } else {
      toast.error("Failed to enable notifications", { description: result.error });
    }
  };

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

      {/* Push notification enable prompt */}
      {push.isSupported && push.isConfigured && !push.isSubscribed && (push.permission as string) !== "denied" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Enable push notifications</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when students submit weekly logs, evaluations are completed, and more.
                </p>
              </div>
            </div>
            <Button onClick={handleSubscribe} disabled={(push.permission as string) === "denied"}>
              Enable
            </Button>
          </CardContent>
        </Card>
      )}

      {(push.permission as string) === "denied" && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <BellOff className="h-5 w-5 text-orange-500" />
            <p className="text-sm">
              Notifications are blocked. Enable them in your browser settings to receive push alerts.
            </p>
          </CardContent>
        </Card>
      )}

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
              value={stats?.totalStudents || 0}
              description="In your program"
              color="text-blue-500"
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Supervisors"
              value={stats?.totalSupervisors || 0}
              description="Assigned to your program"
              color="text-purple-500"
            />
            <StatCard
              icon={<Briefcase className="h-5 w-5" />}
              label="Active Internships"
              value={stats?.activeInternships || 0}
              description="Currently running"
              color="text-green-500"
            />
            <StatCard
              icon={<FileText className="h-5 w-5" />}
              label="Weekly Reports"
              value={stats?.totalReports || 0}
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
  value: number;
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
