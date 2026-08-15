"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Briefcase,
  TrendingUp,
  GraduationCap,
  Building2,
  FileText,
  UserCheck,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  UserPlus,
  Settings,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { StatsCard, StatsGrid } from "@/components/dashboard/stats-card";
import { PageHeader } from "@/components/dashboard/page-header";

interface DepartmentStats {
  totalStudents: number;
  activeStudents: number;
  completedInternships: number;
  activeInternships: number;
  /** Internships that are in the active pipeline (assigned + active + paused).
   *  Provided by the API so coordinators see real participation, not just
   *  rows that have already flipped to status='active'. */
  inProgressInternships?: number;
  pendingAssignments: number;
  totalSupervisors: number;
  totalPrograms: number;
  activePrograms: number;
}

interface ProgramSummary {
  id: string;
  name: string;
  code: string;
  student_count: number;
  is_active: boolean;
}

interface RecentActivity {
  id: string;
  type: "student_enrolled" | "internship_started" | "internship_completed" | "supervisor_assigned";
  message: string;
  timestamp: string;
}

interface PendingItem {
  id: string;
  type: "no_supervisor" | "pending_evaluation" | "incomplete_profile";
  student_name: string;
  description: string;
}

interface DepartmentInfo {
  id: string;
  name: string;
  code: string;
  // NOTE: `departments` table has NO `description` column. Kept on the
  // TS interface as `null` so the JSX `department.description && …`
  // guard below type-checks, but the value is always null in practice.
  // If a description column is added later, just add it back to the
  // select() call above.
  description?: string | null;
  university_id: string;
  is_active: boolean;
  created_at: string;
}

export default function DepartmentCoordinatorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [department, setDepartment] = useState<DepartmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch department stats from our department-scoped API
      const statsRes = await fetch("/api/department-coordinator/reports?type=overview");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }

      // Fetch the coordinator's own department info (VIEW ONLY — the
      // coordinator cannot edit department fields, only see them).
      // RLS on `departments` allows coordinators to SELECT their own
      // department but not UPDATE it.
      //
      // NOTE: the `departments` table has NO `description` column
      // (migration 0001 defines only id, university_id, name, code,
      // head_id, is_active, created_at, updated_at). The previous
      // select included `description`, which made PostgREST 400 every
      // call and the dashboard's "Your Department" card never rendered.
      if (profile?.department_id) {
        const { data: deptData } = await supabase
          .from("departments")
          .select("id, name, code, university_id, is_active, created_at")
          .eq("id", profile.department_id)
          .maybeSingle();
        if (deptData) {
          setDepartment(deptData as DepartmentInfo);
        }
      }

      // Fetch programs
      const programsRes = await fetch("/api/programs?pageSize=5");
      if (programsRes.ok) {
        const programsData = await programsRes.json();
        if (programsData.success) {
          setPrograms(programsData.data.data || []);
        }
      }

      // Fetch students for recent activity and pending items
      if (profile?.department_id) {
        const studentsRes = await fetch(`/api/students?pageSize=10&sort_by=created_at&sort_order=desc`);
        if (studentsRes.ok) {
          const studentsData = await studentsRes.json();
          if (studentsData.success && studentsData.data?.data) {
            const students = studentsData.data.data;

            // Generate recent activities
            const activities: RecentActivity[] = students.slice(0, 5).map((s: any) => ({
              id: s.id,
              type: "student_enrolled" as const,
              message: `${s.profiles?.first_name || ""} ${s.profiles?.last_name || ""}`.trim() || s.enrollment_number,
              timestamp: s.created_at,
            }));
            setRecentActivities(activities);

            // Find students potentially needing attention
            const pending: PendingItem[] = [];
            // Students without program assignment
            const noProgramStudents = students.filter((s: any) => !s.program_id).slice(0, 3);
            noProgramStudents.forEach((s: any) => {
              pending.push({
                id: s.id,
                type: "incomplete_profile",
                student_name: `${s.profiles?.first_name || ""} ${s.profiles?.last_name || ""}`.trim() || s.enrollment_number,
                description: "Not assigned to a program",
              });
            });
            setPendingItems(pending);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.department_id, profile?.university_id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: "Total Students",
      value: stats?.totalStudents.toString() || "0",
      icon: GraduationCap,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
      trend: stats?.activeStudents && stats.totalStudents > 0 
        ? { value: Math.round((stats.activeStudents / stats.totalStudents) * 100), isPositive: true }
        : undefined,
      description: `${stats?.activeStudents || 0} active`,
    },
    {
      title: "Active Programs",
      value: stats?.activePrograms.toString() || "0",
      icon: BookOpen,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      description: `of ${stats?.totalPrograms || 0} total`,
    },
    {
      title: "Supervisors",
      value: stats?.totalSupervisors.toString() || "0",
      icon: UserCheck,
      color: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-violet-950",
    },
    {
      // Display the in-progress count (assigned + active + paused) so the
      // coordinator sees the REAL pipeline — students in 'assigned' status
      // haven't started the actual internship yet but ARE in the program.
      title: "In-Progress Internships",
      value: (stats?.inProgressInternships ?? stats?.activeInternships ?? 0).toString(),
      icon: Briefcase,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      trend: stats?.completedInternships !== undefined 
        ? { value: stats.completedInternships, isPositive: true }
        : undefined,
      description: `${stats?.completedInternships || 0} completed`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Department Coordinator"
        description={`Welcome back, ${profile?.full_name || user?.email || "Coordinator"}`}
        actions={
          <div className="flex items-center gap-2">
            {department && (
              <Badge variant="outline">
                <Building2 className="h-3 w-3 mr-1" />
                {department.name} ({department.code})
              </Badge>
            )}
            <Button variant="outline" onClick={fetchDashboardData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/department-coordinator/students">
                <UserPlus className="h-4 w-4 mr-2" />
                Manage Students
              </Link>
            </Button>
          </div>
        }
      />

      {/* Department Info Card (View-Only) */}
      {department && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    Your Department
                  </CardTitle>
                  <CardDescription>
                    You can view your department info but cannot modify it. Contact a University Admin to make changes.
                  </CardDescription>
                </div>
                <Badge variant={department.is_active ? "default" : "secondary"}>
                  {department.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Department Name</p>
                  <p className="font-medium">{department.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Department Code</p>
                  <p className="font-medium font-mono">{department.code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Students</p>
                  <p className="font-medium">{stats?.totalStudents ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Programs</p>
                  <p className="font-medium">{stats?.activePrograms ?? 0}</p>
                </div>
              </div>
              {department.description && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{department.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!department && profile && !profile.department_id && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    No Department Assigned
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Your coordinator account is not linked to a department. You cannot add students, supervisors, or programs until a University Admin assigns you to a department.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pending Items Alert */}
      {(stats?.pendingAssignments || 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Action Required
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    You have{" "}
                    <span className="font-semibold">{stats?.pendingAssignments}</span> student(s) 
                    that may need supervisor assignments or attention.
                  </p>
                  <Button variant="link" className="p-0 h-auto text-amber-700 dark:text-amber-300 mt-2" asChild>
                    <Link href="/department-coordinator/students?filter=no_supervisor">
                      Review now <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <StatsGrid columns={4}>
        {statCards.map((card, index) => (
          <StatsCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            trend={card.trend}
            description={card.description}
            index={index}
          />
        ))}
      </StatsGrid>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Programs Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Programs Overview</CardTitle>
                <CardDescription>Programs in your department</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/department-coordinator/programs">
                  View all <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : programs.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No programs yet</p>
                  <p className="text-sm text-muted-foreground/70 mb-4">
                    Create your first program to get started
                  </p>
                  <Button size="sm" asChild>
                    <Link href="/department-coordinator/programs">
                      <Plus className="h-4 w-4 mr-1" /> Create Program
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {programs.map((program) => (
                    <div
                      key={program.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{program.name}</p>
                          <p className="text-sm text-muted-foreground">{program.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium">{program.student_count}</p>
                          <p className="text-xs text-muted-foreground">students</p>
                        </div>
                        <Badge variant={program.is_active ? "default" : "secondary"}>
                          {program.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Pending Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/department-coordinator/students">
                  <GraduationCap className="h-5 w-5" />
                  <span className="text-xs">Students</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/department-coordinator/programs">
                  <BookOpen className="h-5 w-5" />
                  <span className="text-xs">Programs</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/department-coordinator/supervisors">
                  <UserCheck className="h-5 w-5" />
                  <span className="text-xs">Supervisors</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/department-coordinator/reports">
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-xs">Reports</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest in your department</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <div className="text-center py-6">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Items Preview */}
          {pendingItems.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-900">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-base">Needs Attention</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="truncate mr-2">{item.student_name}</span>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {item.type === "no_supervisor" ? "No Supervisor" : "No Program"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button variant="link" className="w-full mt-3 text-sm" asChild>
                  <Link href="/department-coordinator/students">
                    View all ({pendingItems.length}) <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Performance Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Department Performance Summary</CardTitle>
            <CardDescription>Key metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-muted/50 text-center space-y-2">
                <GraduationCap className="h-8 w-8 mx-auto text-emerald-600" />
                <p className="text-2xl font-bold">{stats?.totalStudents || 0}</p>
                <p className="text-sm text-muted-foreground">Total Enrolled</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center space-y-2">
                <Briefcase className="h-8 w-8 mx-auto text-blue-600" />
                <p className="text-2xl font-bold">{stats?.inProgressInternships ?? stats?.activeInternships ?? 0}</p>
                <p className="text-sm text-muted-foreground">In-Progress Internships</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-violet-600" />
                <p className="text-2xl font-bold">{stats?.completedInternships || 0}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center space-y-2">
                <TrendingUp className="h-8 w-8 mx-auto text-orange-600" />
                <p className="text-2xl font-bold">
                  {(stats?.inProgressInternships ?? stats?.activeInternships ?? 0) > 0 && (stats?.totalStudents ?? 0) > 0
                    ? Math.round(((stats?.inProgressInternships ?? stats?.activeInternships ?? 0) / (stats?.totalStudents ?? 1) * 100))
                    : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Participation Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
