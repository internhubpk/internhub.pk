"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Briefcase,
  TrendingUp,
  GraduationCap,
  Building2,
  FileText,
  Search,
  UserCheck,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface DepartmentStats {
  totalStudents: number;
  activeInternships: number;
  pendingApprovals: number;
  completedInternships: number;
}

export default function DepartmentCoordinatorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDepartmentStats();
  }, []);

  async function fetchDepartmentStats() {
    try {
      const supabase = createClient();
      
      // Fetch department stats
      const departmentId = profile?.department_id;
      
      const [studentsRes, activeRes, pendingRes, completedRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("role", "student")
          .eq("department_id", departmentId),
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("status", "active"),
        supabase
          .from("applications")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("status", "completed"),
      ]);

      setStats({
        totalStudents: studentsRes.count || 0,
        activeInternships: activeRes.count || 0,
        pendingApprovals: pendingRes.count || 0,
        completedInternships: completedRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching department stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Department Students",
      value: stats?.totalStudents.toString() || "0",
      icon: GraduationCap,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Active Internships",
      value: stats?.activeInternships.toString() || "0",
      icon: Briefcase,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Approvals",
      value: stats?.pendingApprovals.toString() || "0",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Completed",
      value: stats?.completedInternships.toString() || "0",
      icon: CheckCircle2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Department Coordinator Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "Coordinator"}
          </p>
        </div>
        <Button variant="outline" onClick={fetchDepartmentStats} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Students</p>
                <p className="text-sm text-muted-foreground">{stats?.totalStudents || 0} enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <Briefcase className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Internships</p>
                <p className="text-sm text-muted-foreground">{stats?.activeInternships || 0} active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-50">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">Pending</p>
                <p className="text-sm text-muted-foreground">{stats?.pendingApprovals || 0} reviews</p>
              </div>
              {stats?.pendingApprovals ? (
                <Badge variant="destructive" className="ml-auto">{stats.pendingApprovals}</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Reports</p>
                <p className="text-sm text-muted-foreground">View analytics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Department Overview</CardTitle>
          <CardDescription>Summary of your department's internship program</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
              <p className="text-muted-foreground ml-4">Loading data...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.pendingApprovals > 0 && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-amber-800">
                    You have {stats.pendingApprovals} pending approval(s) requiring attention.
                  </span>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{stats.activeInternships}</p>
                  <p className="text-sm text-muted-foreground">Active Internships</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                  <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-2xl font-bold">{stats.completedInternships}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
