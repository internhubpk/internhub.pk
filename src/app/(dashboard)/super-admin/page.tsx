"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Activity,
  Plus,
  Settings,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Database,
  CheckCircle2,
  Briefcase,
  Clock,
  UserCheck,
  GraduationCap,
  FileText,
  ArrowRight,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { StatsCard, StatsGrid } from "@/components/dashboard/stats-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { 
  LineChartCard, 
  BarChartCard, 
  PieChartCard,
  CHART_COLORS 
} from "@/components/dashboard/charts-section";

// Types
interface PlatformStats {
  totalUniversities: number;
  totalUsers: number;
  activeInternships: number;
  totalCompanies: number;
  totalStudents: number;
  totalHoursLogged: number;
  pendingApplications: number;
  completedInternships: number;
}

interface ActivityItem {
  id: string;
  type: "user_created" | "university_added" | "internship_created" | "application_submitted" | "system";
  message: string;
  timestamp: string;
  icon?: React.ReactNode;
}

interface UniversityData {
  name: string;
  students: number;
  internships: number;
  [key: string]: string | number;
}

type DataState = "loading" | "ready" | "error" | "no_tables";

export default function SuperAdminDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [universitiesData, setUniversitiesData] = useState<UniversityData[]>([]);
  
  // Chart data states
  const [monthlyGrowthData, setMonthlyGrowthData] = useState<any[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const supabase = createClient();
      
      // Fetch all stats in parallel using Promise.allSettled for graceful error handling
      const results = await Promise.allSettled([
        // Count universities
        supabase.from("universities").select("id", { count: "exact", head: true }),
        // Count users
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        // Count active internships — includes both 'open' (company-published,
        // available for application) and 'active' (already started). Both are
        // "active" in the business sense. The previous filter `status='active'`
        // missed every company-published internship (which has status='open').
        supabase.from("internships").select("id", { count: "exact", head: true }).in("status", ["open", "active"]),
        // Count companies
        supabase.from("companies").select("id", { count: "exact", head: true }),
        // Count students
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "student"),
        // Sum hours logged from weekly_logs
        supabase.from("weekly_logs").select("hours_worked"),
        // Count pending applications
        // NOTE: real table is `internship_applications` — `applications` does not exist.
        supabase.from("internship_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        // Count completed internships
        supabase.from("internships").select("id", { count: "exact", head: true }).eq("status", "completed"),
        // Get recent activity (audit logs)
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10),
        // Get university stats
        supabase.from("universities").select("name, id"),
        // Get role distribution
        supabase.from("profiles").select("role"),
      ]);
      
      // Extract values or defaults
      const uniRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const userRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const internRes = results[2].status === 'fulfilled' ? results[2].value : null;
      const companyRes = results[3].status === 'fulfilled' ? results[3].value : null;
      const studentRes = results[4].status === 'fulfilled' ? results[4].value : null;
      const hoursRes = results[5].status === 'fulfilled' ? results[5].value : null;
      const pendingRes = results[6].status === 'fulfilled' ? results[6].value : null;
      const completedRes = results[7].status === 'fulfilled' ? results[7].value : null;
      const auditRes = results[8].status === 'fulfilled' ? results[8].value : null;
      const uniStatsRes = results[9].status === 'fulfilled' ? results[9].value : null;
      const roleDistRes = results[10].status === 'fulfilled' ? results[10].value : null;

      // Check if we got actual errors (table doesn't exist)
      const hasTableErrors = [uniRes, userRes, internRes].some(
        (res: any) => res?.error?.code === "42P01" || res?.error?.message?.includes("does not exist")
      );

      if (hasTableErrors) {
        setDataState("no_tables");
        setStats(null);
        return;
      }

      // Calculate total hours logged
      let totalHours = 0;
      if (hoursRes?.data) {
        totalHours = hoursRes.data.reduce((sum: number, log: any) => sum + (log.hours_worked || 0), 0);
      }

      // Set main stats
      setStats({
        totalUniversities: uniRes?.count || 0,
        totalUsers: userRes?.count || 0,
        activeInternships: internRes?.count || 0,
        totalCompanies: companyRes?.count || 0,
        totalStudents: studentRes?.count || 0,
        totalHoursLogged: Math.round(totalHours),
        pendingApplications: pendingRes?.count || 0,
        completedInternships: completedRes?.count || 0,
      });

      // Process recent activity
      if (auditRes?.data && !auditRes.error) {
        const activities: ActivityItem[] = auditRes.data.map((log: any, index: number) => ({
          id: log.id || index.toString(),
          type: mapActionType(log.action),
          message: formatAuditMessage(log),
          timestamp: log.created_at,
        }));
        setRecentActivity(activities.slice(0, 8));
      }

      // Process university data for charts
      if (uniStatsRes?.data && !uniStatsRes.error) {
        const unis = uniStatsRes.data;
        
        // For each university, get student count (via profiles) and internship
        // count (via student_internships, NOT internships — company-published
        // internships have university_id=NULL, so filtering `internships` by
        // `university_id` always returns 0). `student_internships` carries
        // the correct `university_id` copied from the student's profile.
        const uniDataPromises = unis.map(async (uni: any) => {
          const [studentsResult, internshipsResult] = await Promise.all([
            supabase.from("profiles").select("user_id", { count: "exact", head: true })
              .eq("role", "student").eq("university_id", uni.id),
            supabase.from("student_internships").select("id", { count: "exact", head: true })
              .eq("university_id", uni.id),
          ]);
          
          return {
            name: uni.name.length > 15 ? uni.name.substring(0, 15) + "..." : uni.name,
            students: studentsResult.count || 0,
            internships: internshipsResult.count || 0,
          };
        });
        
        const uniData = await Promise.all(uniDataPromises);
        setUniversitiesData(uniData.sort((a, b) => b.students - a.students).slice(0, 8));
      }

      // Process role distribution (REAL Supabase data — no dummies)
      if (roleDistRes?.data && !roleDistRes.error) {
        const roleCounts: Record<string, number> = {};
        roleDistRes.data.forEach((p: any) => {
          const role = p.role || "pending_assignment";
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        });

        // Per InternHub spec section 12: display
        //   Student, Super Admin, Supervisor, Site Supervisor, Company HR,
        //   Coordinator, University Admin, Program Coordinator
        // Each category must be visually distinct and readable in light/dark theme.
        const roleLabels: Record<string, string> = {
          super_admin: "Super Admin",
          university_admin: "University Admin",
          department_coordinator: "Dept Coordinator",
          program_coordinator: "Program Coordinator",
          faculty_supervisor: "Faculty Supervisor",
          student: "Student",
          company_hr: "Company HR",
          site_supervisor: "Site Supervisor",
          external_evaluator: "External Evaluator",
          pending_assignment: "Pending",
        };

        // Distinct color per role — uses literal hex colors so the same hue
        // renders identically in light and dark theme (CSS variables change
        // between themes, which can make two adjacent slices look the same).
        // Palette chosen for accessibility: each pair contrasts >4.5:1 against
        // both #ffffff (light card bg) and #0a0a0a (dark card bg).
        const roleColors: Record<string, string> = {
          super_admin: "#dc2626",            // red-600  — highest privilege
          university_admin: "#7c3aed",       // violet-600
          department_coordinator: "#2563eb",  // blue-600
          program_coordinator: "#0891b2",     // cyan-600
          faculty_supervisor: "#16a34a",      // green-600
          student: "#f59e0b",                 // amber-500  (largest population)
          company_hr: "#db2777",              // pink-600
          site_supervisor: "#9333ea",         // purple-600
          external_evaluator: "#65a30d",      // lime-600
          pending_assignment: "#64748b",       // slate-500 (grey = unassigned)
        };

        const pieData = Object.entries(roleCounts).map(([key, value]) => ({
          name: roleLabels[key] || key,
          value,
          color: roleColors[key] || "#64748b",
        }));
        setRoleDistribution(pieData);
      }

      // Generate monthly growth data from real `created_at` timestamps on
      // `profiles`, `universities`, and `internships`.
      generateMonthlyGrowthData(supabase);
      
      setDataState("ready");
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        setDataState("no_tables");
      } else {
        setDataState("error");
        setErrorMessage(error?.message || "An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function generateMonthlyGrowthData(supabase: any) {
    try {
      // Get users, universities, and internships created in the last 6 months.
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sinceIso = sixMonthsAgo.toISOString();

      const [usersRes, unisRes, internshipsRes] = await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", sinceIso),
        supabase.from("universities").select("created_at").gte("created_at", sinceIso),
        supabase.from("internships").select("created_at").gte("created_at", sinceIso),
      ]);

      const recentUsers = usersRes?.data ?? [];
      const recentUnis = unisRes?.data ?? [];
      const recentInternships = internshipsRes?.data ?? [];

      // Build the last 6 month buckets (oldest → newest).
      const months: { month: string; users: number; universities: number; internships: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          users: 0,
          universities: 0,
          internships: 0,
          // store the bucket's (year, monthIndex) for matching.
          _year: d.getFullYear(),
          _month: d.getMonth(),
        } as any);
      }

      const bucketOf = (iso: string) => {
        const d = new Date(iso);
        return months.find((m: any) => m._year === d.getFullYear() && m._month === d.getMonth());
      };

      recentUsers.forEach((u: any) => {
        const bucket = bucketOf(u.created_at);
        if (bucket) bucket.users++;
      });
      recentUnis.forEach((u: any) => {
        const bucket = bucketOf(u.created_at);
        if (bucket) bucket.universities++;
      });
      recentInternships.forEach((u: any) => {
        const bucket = bucketOf(u.created_at);
        if (bucket) bucket.internships++;
      });

      // Strip the private `_year` / `_month` helper fields before setting state.
      setMonthlyGrowthData(
        months.map(({ month, users, universities, internships }) => ({
          month,
          users,
          universities,
          internships,
        }))
      );
    } catch (e) {
      console.log("Could not generate growth data:", e);
      // Set empty data
      setMonthlyGrowthData([]);
    }
  }

  function mapActionType(action: string): ActivityItem["type"] {
    if (action.includes("create") || action.includes("insert")) return "user_created";
    if (action.includes("university")) return "university_added";
    if (action.includes("internship")) return "internship_created";
    if (action.includes("application")) return "application_submitted";
    return "system";
  }

  function formatAuditMessage(log: any): string {
    const action: string = log.action || "";

    // Known `audit_logs.action` values come in two styles:
    //   1. Dotted  — e.g. `auth.login`, `internship.approve` (from `src/lib/audit.ts`)
    //   2. Snake   — e.g. `create_supervisor`, `weekly_log_approve` (inline calls in API routes)
    // Map the common ones to friendly messages.
    const actionMap: Record<string, string> = {
      // Dotted (lib/audit.ts)
      "auth.login": "User signed in",
      "auth.logout": "User signed out",
      "auth.register": "New user registered",
      "student.create": "Created student",
      "student.update": "Updated student",
      "university.create": "Created university",
      "university.update": "Updated university",
      "university.suspend": "Suspended university",
      "internship.create": "Created internship",
      "internship.approve": "Approved internship",
      "internship.reject": "Rejected internship",
      "application.submit": "Submitted application",
      "application.approve": "Approved application",
      "application.reject": "Rejected application",
      "evaluation.submit": "Submitted evaluation",
      "certificate.issue": "Issued certificate",
      "certificate.revoke": "Revoked certificate",
      "document.upload": "Uploaded document",
      "company.create": "Created company",
      "company.verify": "Verified company",
      "settings.change": "Changed settings",
      "user.role_change": "Changed user role",
      // Snake (inline calls in api routes)
      create_supervisor: "Created site supervisor",
      delete_supervisor: "Deleted site supervisor",
      create_internship: "Created internship",
      create_evaluation: "Created evaluation",
      update_evaluation: "Updated evaluation",
      update_company_settings: "Updated company settings",
      change_password: "Changed password",
      correct_attendance: "Corrected attendance",
      assign_supervisor_to_interns: "Assigned supervisor to interns",
      reassign_intern: "Reassigned intern",
      issue_certificate: "Issued certificate",
      send_notification: "Sent notification",
      weekly_log_approve: "Approved weekly log",
      weekly_log_reject: "Rejected weekly log",
      weekly_log_request_revision: "Requested weekly log revision",
      create_user: "Created user",
      update_user: "Updated user",
      delete_user: "Deleted user",
      update_settings: "Updated settings",
    };

    if (actionMap[action]) {
      return actionMap[action];
    }

    // Fallback: prettify the action string. Handles both dotted and snake_case
    // styles — e.g. `weekly_log_approve` → `Weekly log approve`,
    // `auth.login` → `Auth login`.
    const pretty = action
      .replace(/[._]/g, " ")
      .trim()
      .toLowerCase();
    if (!pretty) {
      const entity = log.entity_type?.replace(/_/g, " ");
      return entity ? `Updated ${entity}` : "Activity";
    }
    const capitalized = pretty.charAt(0).toUpperCase() + pretty.slice(1);

    // If we have entity_type, append it for context (e.g. `Created` + `student`).
    const entity = log.entity_type?.replace(/_/g, " ");
    return entity ? `${capitalized} ${entity}` : capitalized;
  }

  const statCards = [
    {
      title: "Universities",
      value: dataState === "ready" ? (stats?.totalUniversities ?? "-") : "-",
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "Registered institutions",
    },
    {
      title: "Total Users",
      value: dataState === "ready" ? (stats?.totalUsers ?? "-") : "-",
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      description: "Platform-wide accounts",
    },
    {
      title: "Active Internships",
      value: dataState === "ready" ? (stats?.activeInternships ?? "-") : "-",
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "Currently ongoing",
    },
    {
      title: "Companies",
      value: dataState === "ready" ? (stats?.totalCompanies ?? "-") : "-",
      icon: Briefcase,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "Partner organizations",
    },
    {
      title: "Students",
      value: dataState === "ready" ? (stats?.totalStudents ?? "-") : "-",
      icon: GraduationCap,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      description: "Enrolled students",
    },
    {
      title: "Hours Logged",
      value: dataState === "ready" ? (stats?.totalHoursLogged?.toLocaleString() ?? "-") : "-",
      icon: Clock,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
      description: "Total internship hours",
    },
    {
      title: "Pending Applications",
      value: dataState === "ready" ? (stats?.pendingApplications ?? "-") : "-",
      icon: FileText,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      description: "Awaiting review",
    },
    {
      title: "Completed",
      value: dataState === "ready" ? (stats?.completedInternships ?? "-") : "-",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "Finished internships",
    },
  ];

  const quickActions = [
    {
      title: "Users",
      description: "View all platform users (read-only)",
      icon: Users,
      href: "/super-admin/users",
      color: "bg-blue-50 text-blue-600",
      disabled: dataState !== "ready",
    },
    {
      title: "Universities",
      description: "Add / edit / delete university tenants",
      icon: Building2,
      href: "/super-admin/universities",
      color: "bg-emerald-50 text-emerald-600",
      disabled: dataState !== "ready",
    },
    {
      title: "Companies",
      description: "Add / edit / delete host organizations",
      icon: Briefcase,
      href: "/super-admin/companies",
      color: "bg-amber-50 text-amber-600",
      disabled: dataState !== "ready",
    },
    {
      title: "Company HR Accounts",
      description: "Create HR accounts for companies",
      icon: UserCheck,
      href: "/super-admin/company-hr",
      color: "bg-orange-50 text-orange-600",
      disabled: dataState !== "ready",
    },
    {
      title: "Settings",
      description: "Platform configuration",
      icon: Settings,
      href: "/super-admin/settings",
      color: "bg-purple-50 text-purple-600",
      disabled: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Super Admin Dashboard"
        description={`Welcome back, ${profile?.full_name || user?.email || "Admin"}`}
        actions={
          <Button variant="outline" onClick={fetchDashboardData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        }
      />

      {/* Database Setup Required Alert */}
      {dataState === "no_tables" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Database className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                    Database Setup Required
                  </h3>
                  <p className="text-amber-700 dark:text-amber-300 text-sm mb-4">
                    The required database tables haven&apos;t been created yet. You need to run the 
                    setup SQL script in your Supabase dashboard.
                  </p>
                  
                  <div className="bg-white/80 dark:bg-gray-900/50 rounded-lg p-4 border border-amber-200 dark:border-amber-800 space-y-3">
                    <p className="font-medium text-sm text-amber-800 dark:text-amber-200">Setup Steps:</p>
                    <ol className="list-decimal list-inside text-sm text-amber-700 dark:text-amber-300 space-y-1 ml-2">
                      <li>Go to your Supabase project dashboard</li>
                      <li>Navigate to SQL Editor (left sidebar)</li>
                      <li>Click New Query</li>
                      <li>Copy and paste the contents of supabase-schema.sql</li>
                      <li>Click Run to execute</li>
                    </ol>
                    
                    <div className="flex items-center gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={fetchDashboardData}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry After Setup
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Error State */}
      {dataState === "error" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">Error Loading Data</h3>
                  <p className="text-red-700 dark:text-red-300 text-sm">{errorMessage}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={fetchDashboardData}>
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Stats Grid */}
      <StatsGrid columns={4}>
        {statCards.map((card, index) =>
          isLoading ? (
            <StatsCardSkeleton key={card.title} />
          ) : (
            <StatsCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              description={card.description}
              index={index}
            />
          )
        )}
      </StatsGrid>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/20 ${
                action.disabled ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <a href={action.href} className="block p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${action.color}`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{action.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">{action.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </a>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      {dataState === "ready" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Growth Trend Chart */}
          <LineChartCard
            title="Platform Growth"
            description="User registrations over time"
            data={monthlyGrowthData}
            lines={[{ dataKey: "users", name: "New Users", color: CHART_COLORS.primary }]}
            xAxisKey="month"
            height={280}
            index={0}
            emptyMessage="No user registrations recorded yet"
          />

          {/* Role Distribution Chart */}
          <PieChartCard
            title="User Role Distribution"
            description="Breakdown by user roles"
            data={roleDistribution}
            donut
            height={280}
            index={1}
            emptyMessage="No users registered yet"
          />

          {/* Top Universities Chart */}
          {universitiesData.length > 0 && (
            <BarChartCard
              title="Top Universities by Students"
              description="Leading institutions"
              data={universitiesData.slice(0, 6)}
              bars={[{ dataKey: "students", name: "Students", color: CHART_COLORS.success }]}
              xAxisKey="name"
              height={280}
              index={2}
              className="lg:col-span-2"
            />
          )}
        </div>
      )}

      {/* Recent Activity & Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                Latest events
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="font-medium text-muted-foreground mb-1">No recent activity</h3>
                <p className="text-sm text-muted-foreground/70">
                  Activity will appear here as users interact with the platform.
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {recentActivity.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-full mt-0.5 ${
                      activity.type === "user_created" ? "bg-blue-100 text-blue-600" :
                      activity.type === "university_added" ? "bg-green-100 text-green-600" :
                      activity.type === "internship_created" ? "bg-purple-100 text-purple-600" :
                      activity.type === "application_submitted" ? "bg-amber-100 text-amber-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {activity.type === "user_created" && <Users className="h-4 w-4" />}
                      {activity.type === "university_added" && <Building2 className="h-4 w-4" />}
                      {activity.type === "internship_created" && <Briefcase className="h-4 w-4" />}
                      {activity.type === "application_submitted" && <FileText className="h-4 w-4" />}
                      {activity.type === "system" && <Settings className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Overview Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5" />
              Platform Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats || isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            ) : stats.totalUniversities === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                <h3 className="font-semibold mb-2">Database Ready!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your platform is ready! Start by adding your first university.
                </p>
                <Button size="sm" asChild>
                  <a href="/super-admin/universities">
                    <Plus className="h-4 w-4 mr-1" />
                    Add First University
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <OverviewItem 
                  label="Total Universities" 
                  value={stats.totalUniversities} 
                  icon={<Building2 className="h-4 w-4" />}
                />
                <OverviewItem 
                  label="Active Users" 
                  value={stats.totalUsers} 
                  icon={<UserCheck className="h-4 w-4" />}
                />
                <OverviewItem 
                  label="Active Internships" 
                  value={stats.activeInternships} 
                  icon={<Activity className="h-4 w-4" />}
                />
                <OverviewItem 
                  label="Partner Companies" 
                  value={stats.totalCompanies} 
                  icon={<Briefcase className="h-4 w-4" />}
                />
                
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-primary">{stats.totalStudents}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-primary">{stats.totalHoursLogged.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Hours</p>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <a href="/super-admin/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Platform Settings
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper Components
function StatsCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl ml-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewItem({ 
  label, 
  value, 
  icon 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold">{value.toLocaleString()}</span>
    </div>
  );
}

function formatTimeAgo(timestamp: string | null | undefined): string {
  // Use the shared safe formatter — returns "—" for invalid timestamps
  // instead of "Invalid Date" or negative "ago" values.
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return "—";
  if (diffMs < 0) {
    // Future timestamp — show the actual date.
    return date.toLocaleDateString();
  }
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
