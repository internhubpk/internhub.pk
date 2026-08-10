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
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface FacultyStats {
  supervisedStudents: number;
  activeInternships: number;
  pendingReviews: number;
  evaluationsCompleted: number;
}

export default function FacultySupervisorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<FacultyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFacultyStats();
  }, []);

  async function fetchFacultyStats() {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Fetch faculty supervisor stats
      const [studentsRes, activeRes, pendingRes, completedRes] = await Promise.all([
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("faculty_supervisor_id", user.id),
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("faculty_supervisor_id", user.id)
          .eq("status", "active"),
        supabase
          .from("weekly_logs")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
        supabase
          .from("evaluations")
          .select("id", { count: "exact" })
          .eq("evaluator_id", user.id)
          .eq("status", "completed"),
      ]);

      setStats({
        supervisedStudents: studentsRes.count || 0,
        activeInternships: activeRes.count || 0,
        pendingReviews: pendingRes.count || 0,
        evaluationsCompleted: completedRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching faculty stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Supervised Students",
      value: stats?.supervisedStudents.toString() || "0",
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
      title: "Pending Reviews",
      value: stats?.pendingReviews.toString() || "0",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Evaluations Done",
      value: stats?.evaluationsCompleted.toString() || "0",
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
          <h1 className="text-3xl font-bold">Faculty Supervisor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "Supervisor"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchFacultyStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <a href="/faculty-supervisor/students">
              <Plus className="h-4 w-4 mr-2" />
              View Students
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

      {/* Alert for pending reviews */}
      {stats?.pendingReviews ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                You have {stats.pendingReviews} weekly log(s) or evaluation(s) pending review.
              </span>
              <Badge variant="destructive" className="ml-auto">Action Required</Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/faculty-supervisor/students" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">My Students</h3>
                <p className="text-sm text-muted-foreground">View supervised students</p>
              </div>
              <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground" />
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <ClipboardList className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Weekly Logs</h3>
                <p className="text-sm text-muted-foreground">{stats?.pendingReviews || 0} to review</p>
              </div>
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
                <h3 className="font-semibold">Reports</h3>
                <p className="text-sm text-muted-foreground">View analytics & reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Supervision Overview</CardTitle>
          <CardDescription>Summary of your supervision activities</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
              <p className="text-muted-foreground ml-4">Loading data...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold">{stats.supervisedStudents}</p>
                  <p className="text-sm text-muted-foreground">Students Supervised</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{stats.activeInternships}</p>
                  <p className="text-sm text-muted-foreground">Active Internships</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                  <p className="text-2xl font-bold">{stats.pendingReviews}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-2xl font-bold">{stats.evaluationsCompleted}</p>
                  <p className="text-sm text-muted-foreground">Evaluations Completed</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Import ArrowRight for the quick action card
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
