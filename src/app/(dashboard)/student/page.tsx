"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  FileText,
  Briefcase,
  Clock,
  CheckCircle2,
  Upload,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface StudentStats {
  activeInternship: boolean;
  applicationsCount: number;
  pendingEvaluations: number;
  documentsSubmitted: number;
}

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudentStats();
  }, []);

  async function fetchStudentStats() {
    if (!user) return;
    
    try {
      const supabase = createClient();
      
      // Fetch student-specific stats
      const [internRes, appsRes, evalRes, docsRes] = await Promise.all([
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("student_id", user.id)
          .eq("status", "active")
          .single(),
        supabase
          .from("applications")
          .select("id", { count: "exact" })
          .eq("student_id", user.id),
        supabase
          .from("evaluations")
          .select("id", { count: "exact" })
          .eq("student_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("documents")
          .select("id", { count: "exact" })
          .eq("user_id", user.id),
      ]);

      setStats({
        activeInternship: !internRes.error && !!internRes.data,
        applicationsCount: appsRes.count || 0,
        pendingEvaluations: evalRes.count || 0,
        documentsSubmitted: docsRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching student stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Applications",
      value: stats?.applicationsCount.toString() || "0",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      href: "/student/applications",
    },
    {
      title: "Active Internship",
      value: stats?.activeInternship ? "Yes" : "No",
      icon: Briefcase,
      color: stats?.activeInternship ? "text-green-600" : "text-gray-600",
      bgColor: stats?.activeInternship ? "bg-green-50" : "bg-gray-50",
      href: "/student/internships",
    },
    {
      title: "Pending Evaluations",
      value: stats?.pendingEvaluations.toString() || "0",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      href: "/student/evaluations",
    },
    {
      title: "Documents",
      value: stats?.documentsSubmitted.toString() || "0",
      icon: Upload,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      href: "/student/documents",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "Student"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStudentStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <a href="/marketplace">
              <Plus className="h-4 w-4 mr-2" />
              Browse Internships
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
            <a href={card.href} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
            </a>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/marketplace" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <Briefcase className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Find Internships</h3>
                <p className="text-sm text-muted-foreground">Browse available opportunities</p>
              </div>
              <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground" />
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/student/applications" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">My Applications</h3>
                <p className="text-sm text-muted-foreground">Track your application status</p>
              </div>
              <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground" />
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/student/documents" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <Upload className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">Documents</h3>
                <p className="text-sm text-muted-foreground">Upload required documents</p>
              </div>
              <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground" />
            </div>
          </a>
        </Card>
      </div>

      {/* Status Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
                <p className="text-muted-foreground">Loading your data...</p>
              </div>
            </div>
          ) : !stats.activeInternship ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Start Your Journey</h3>
              <p className="text-muted-foreground text-center max-w-md">
                You don't have an active internship yet. Browse the marketplace and apply for opportunities that match your interests.
              </p>
              <div className="flex gap-2 mt-4">
                <Button asChild>
                  <a href="/marketplace">
                    <Plus className="h-4 w-4 mr-2" />
                    Browse Internships
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/student/profile">Complete Profile</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">You have an active internship!</span>
                <Badge variant="secondary" className="ml-auto">In Progress</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Applications Submitted</p>
                  <p className="text-2xl font-bold">{stats.applicationsCount}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Pending Evaluations</p>
                  <p className="text-2xl font-bold">{stats.pendingEvaluations}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Documents Uploaded</p>
                  <p className="text-2xl font-bold">{stats.documentsSubmitted}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
