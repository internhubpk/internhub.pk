"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Briefcase,
  Users,
  UserCheck,
  Star,
  FileText,
  Clock,
  Plus,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Eye,
  ArrowRight,
  Calendar,
  Award,
  BarChart3,
  CheckCircle2,
  XCircle,
  UserPlus,
  FolderOpen,
  ClipboardCheck,
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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface CompanyStats {
  activeInternships: number;
  totalApplications: number;
  activeInterns: number;
  pendingReviews: number;
  completionRate: number;
  totalSupervisors: number;
}

interface RecentApplication {
  id: string;
  student_name: string;
  student_email: string;
  internship_title: string;
  status: "pending" | "accepted" | "rejected" | "reviewing";
  applied_at: string;
  university?: string;
}

interface ActiveProgram {
  id: string;
  title: string;
  status: string;
  applicants_count: number;
  max_applicants?: number | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface InternPerformance {
  id: string;
  name: string;
  program: string;
  attendance_rate: number;
  rating: number;
  status: "active" | "on_leave" | "completed" | "terminated";
}

// Default empty states - data will be fetched from database
const DEFAULT_STATS: CompanyStats = {
  activeInternships: 0,
  totalApplications: 0,
  activeInterns: 0,
  pendingReviews: 0,
  completionRate: 0,
  totalSupervisors: 0,
};

const DEFAULT_APPLICATIONS: RecentApplication[] = [];
const DEFAULT_PROGRAMS: ActiveProgram[] = [];
const DEFAULT_PERFORMANCE: InternPerformance[] = [];

export default function CompanyHRDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<CompanyStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>(DEFAULT_APPLICATIONS);
  const [activePrograms, setActivePrograms] = useState<ActiveProgram[]>(DEFAULT_PROGRAMS);
  const [internPerformance, setInternPerformance] = useState<InternPerformance[]>(DEFAULT_PERFORMANCE);

  useEffect(() => {
    fetchCompanyData();
  }, [user]);

  async function fetchCompanyData() {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();
      
      // Fetch real data from Supabase - using Promise.allSettled for resilience
      const results = await Promise.allSettled([
        // Fetch internships count
        supabase
          .from('internships')
          .select('id', { count: 'exact' })
          .eq('company_id', user.id)
          .in('status', ['active', 'open']),
        
        // Fetch applications count
        supabase
          .from('applications')
          .select('id', { count: 'exact' }),
          
        // Fetch recent applications with details
        supabase
          .from('applications')
          .select(`
            id,
            students!inner(student_name, email, university),
            internships!inner(title)
          `)
          .order('created_at', { ascending: false })
          .limit(5),
        
        // Fetch active programs
        supabase
          .from('internships')
          .select('*')
          .eq('company_id', user.id)
          .in('status', ['active', 'open'])
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // Process results safely
      const [internshipsResult, applicationsResult, recentAppsResult, programsResult] = results;
      
      // Update stats from actual data
      const newStats: CompanyStats = { ...DEFAULT_STATS };
      
      if (internshipsResult.status === 'fulfilled' && internshipsResult.value.data) {
        newStats.activeInternships = internshipsResult.value.count || 0;
      }
      if (applicationsResult.status === 'fulfilled' && applicationsResult.value.data) {
        newStats.totalApplications = applicationsResult.value.count || 0;
      }
      
      // Set stats
      setStats(newStats);
      
      // Set recent applications if available
      if (recentAppsResult.status === 'fulfilled' && recentAppsResult.value.data) {
        const apps: RecentApplication[] = recentAppsResult.value.data.map((app: any) => ({
          id: app.id,
          student_name: app.students?.student_name || 'Unknown',
          student_email: app.students?.email || '',
          internship_title: app.internships?.title || 'Unknown Program',
          status: app.status || 'pending',
          applied_at: app.created_at,
          university: app.students?.university,
        }));
        setRecentApplications(apps);
      }
      
      // Set active programs if available
      if (programsResult.status === 'fulfilled' && programsResult.value.data) {
        const programs: ActiveProgram[] = programsResult.value.data.map((prog: any) => ({
          id: prog.id,
          title: prog.title,
          status: prog.status,
          applicants_count: prog.current_applicants || 0,
          max_applicants: prog.max_applicants || 0,
          start_date: prog.start_date,
          end_date: prog.end_date,
        }));
        setActivePrograms(programs);
      }
      
    } catch (error) {
      console.error("Error fetching company data:", error);
      // Keep default empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
      case "accepted":
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "reviewing":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Reviewing</Badge>;
      case "open":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Open</Badge>;
      case "on_leave":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">On Leave</Badge>;
      case "completed":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const statCards = [
    {
      title: "Active Programs",
      value: stats?.activeInternships.toString() || "0",
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "Currently running internships",
    },
    {
      title: "Total Applications",
      value: stats?.totalApplications.toString() || "0",
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "All time applications received",
    },
    {
      title: "Active Interns",
      value: stats?.activeInterns.toString() || "0",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "Currently interning at your company",
    },
    {
      title: "Pending Reviews",
      value: stats?.pendingReviews.toString() || "0",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      description: "Awaiting your decision",
    },
  ];

  const quickActions = [
    {
      title: "Post New Internship",
      description: "Create a new internship listing",
      icon: Plus,
      href: "/company-hr/internships",
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Review Applications",
      description: `${stats?.pendingReviews || 0} pending reviews`,
      icon: FileText,
      href: "/company-hr/applications",
      color: "bg-green-50 text-green-600",
      badge: stats?.pendingReviews ? stats.pendingReviews : undefined,
    },
    {
      title: "Manage Supervisors",
      description: `${stats?.totalSupervisors || 0} site supervisors`,
      icon: UserPlus,
      href: "/company-hr/supervisors",
      color: "bg-purple-50 text-purple-600",
    },
    {
      title: "View Documents",
      description: "Letters and certificates",
      icon: FolderOpen,
      href: "/company-hr/documents",
      color: "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "HR Manager"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCompanyData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/company-hr/internships">
              <Plus className="h-4 w-4 mr-2" />
              Post Internship
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                  </div>
                  <div className={`p-3 rounded-full ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
          >
            <Link href={action.href}>
              <Card className="cursor-pointer hover:shadow-md transition-all hover:border-primary/20 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${action.color}`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    {action.badge && action.badge > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mt-4">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Programs Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Active Internship Programs
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/company-hr/internships" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activePrograms.map((program) => (
                  <div
                    key={program.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{program.title}</h4>
                        {getStatusBadge(program.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {program.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(program.start_date).toLocaleDateString()} -{" "}
                            {program.end_date ? new Date(program.end_date).toLocaleDateString() : "Ongoing"}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress 
                          value={program.max_applicants ? (program.applicants_count / program.max_applicants) * 100 : 50} 
                          className="h-2 w-32" 
                        />
                        <span className="text-xs text-muted-foreground">
                          {program.applicants_count}/{program.max_applicants || "∞"} applicants
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {activePrograms.length === 0 && (
                  <div className="text-center py-8">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">No active programs yet</p>
                    <Button variant="link" asChild className="mt-2">
                      <Link href="/company-hr/internships">Create your first program</Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Completion Rate & Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Completion Rate Circle */}
              <div className="flex flex-col items-center py-4">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-muted/20"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(stats?.completionRate || 0) * 3.39} 339`}
                      className="text-emerald-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{stats?.completionRate || 0}%</span>
                    <span className="text-xs text-muted-foreground">Completion Rate</span>
                  </div>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Site Supervisors</span>
                  </div>
                  <span className="font-semibold">{stats?.totalSupervisors || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">Avg. Rating</span>
                  </div>
                  <span className="font-semibold">4.6 / 5.0</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Avg. Attendance</span>
                  </div>
                  <span className="font-semibold">94%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Grid: Recent Applications + Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications Queue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Recent Applications
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/company-hr/applications" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {recentApplications.slice(0, 5).map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(app.student_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{app.student_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {app.internship_title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {getStatusBadge(app.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Performing Interns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Intern Performance
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/company-hr/interns" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {internPerformance.slice(0, 4).map((intern) => (
                    <TableRow key={intern.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {getInitials(intern.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{intern.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={intern.attendance_rate} className="h-2 w-16" />
                          <span className="text-xs text-muted-foreground">{intern.attendance_rate}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium">{intern.rating}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(intern.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Empty State (shown when no data) */}
      {!isLoading && stats && stats.activeInternships === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <Briefcase className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Welcome to Your HR Dashboard!</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  Get started by posting your first internship program to attract talented students from partner universities.
                </p>
                <div className="flex gap-3">
                  <Button asChild size="lg">
                    <Link href="/company-hr/internships">
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Program
                    </Link>
                  </Button>
                  <Button variant="outline" asChild size="lg">
                    <Link href="/company-hr/supervisors">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Supervisor
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
