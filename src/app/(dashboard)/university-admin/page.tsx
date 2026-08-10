"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  UserCheck,
  Clock,
  Briefcase,
  TrendingUp,
  Plus,
  RefreshCw,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface UniversityStats {
  totalStudents: number;
  activeInternships: number;
  pendingApplications: number;
  departments: number;
}

export default function UniversityAdminDashboard() {
  const { user, profile, university } = useAuth();
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const supabase = createClient();
      
      // Fetch stats for this university
      const universityId = profile?.university_id || university?.id;
      if (!universityId) return;

      const [studentsRes, internRes, appsRes, deptRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("university_id", universityId)
          .eq("role", "student"),
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("university_id", universityId)
          .eq("status", "active"),
        supabase
          .from("applications")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
        supabase
          .from("departments")
          .select("id", { count: "exact" })
          .eq("university_id", universityId),
      ]);

      setStats({
        totalStudents: studentsRes.count || 0,
        activeInternships: internRes.count || 0,
        pendingApplications: appsRes.count || 0,
        departments: deptRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Total Students",
      value: stats?.totalStudents.toString() || "0",
      icon: Users,
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
      title: "Pending Applications",
      value: stats?.pendingApplications.toString() || "0",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Departments",
      value: stats?.departments.toString() || "0",
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">University Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {university?.name || "University"} Management Portal
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <a href="/university-admin/students">
              <Plus className="h-4 w-4 mr-2" />
              Manage Students
            </a>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/university-admin/students" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <GraduationCap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Students</h3>
                <p className="text-sm text-muted-foreground">View and manage students</p>
              </div>
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/marketplace" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <Briefcase className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Marketplace</h3>
                <p className="text-sm text-muted-foreground">Browse internship opportunities</p>
              </div>
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">Reports</h3>
                <p className="text-sm text-muted-foreground">View analytics and reports</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            University Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
                <p className="text-muted-foreground">Loading university data...</p>
              </div>
            </div>
          ) : stats.totalStudents === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Your university portal is ready! Students can now register and start applying for internships.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Enrolled Students</p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Active Interns</p>
                  <p className="text-2xl font-bold">{stats.activeInternships}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Awaiting Review</p>
                  <p className="text-2xl font-bold">{stats.pendingApplications}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Departments</p>
                  <p className="text-2xl font-bold">{stats.departments}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
