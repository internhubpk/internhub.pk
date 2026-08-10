"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  FileText,
  MessageSquare,
  Star,
  Upload,
  Plus,
  RefreshCw,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface SupervisorStats {
  assignedStudents: number;
  pendingEvaluations: number;
  completedEvaluations: number;
  weeklyLogsPending: number;
}

interface StudentSummary {
  id: string;
  name: string;
  progress: number;
  lastActivity: string;
}

export default function SiteSupervisorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<SupervisorStats | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSupervisorData();
  }, []);

  async function fetchSupervisorData() {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Fetch supervisor stats
      const [studentsRes, evalPendingRes, evalCompletedRes, logsRes] = await Promise.all([
        supabase
          .from("internships")
          .select("id, student_id, progress, updated_at")
          .eq("supervisor_id", user.id)
          .eq("status", "active"),
        supabase
          .from("evaluations")
          .select("id", { count: "exact" })
          .eq("evaluator_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("evaluations")
          .select("id", { count: "exact" })
          .eq("evaluator_id", user.id)
          .eq("status", "completed"),
        supabase
          .from("weekly_logs")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
      ]);

      // Transform student data
      const studentData = (studentsRes.data || []).map((intern: any) => ({
        id: intern.student_id,
        name: `Student ${intern.student_id.slice(0, 6)}`,
        progress: intern.progress || 0,
        lastActivity: intern.updated_at ? new Date(intern.updated_at).toLocaleDateString() : "N/A",
      }));

      setStats({
        assignedStudents: studentsRes.data?.length || 0,
        pendingEvaluations: evalPendingRes.count || 0,
        completedEvaluations: evalCompletedRes.count || 0,
        weeklyLogsPending: logsRes.count || 0,
      });
      
      setStudents(studentData);
    } catch (error) {
      console.error("Error fetching supervisor data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Assigned Students",
      value: stats?.assignedStudents.toString() || "0",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Pending Evaluations",
      value: stats?.pendingEvaluations.toString() || "0",
      icon: ClipboardList,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Completed Evaluations",
      value: stats?.completedEvaluations.toString() || "0",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Logs to Review",
      value: stats?.weeklyLogsPending.toString() || "0",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Site Supervisor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "Supervisor"}
          </p>
        </div>
        <Button variant="outline" onClick={fetchSupervisorData} disabled={isLoading}>
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

      {/* Alerts */}
      {stats?.pendingEvaluations ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                You have {stats.pendingEvaluations} evaluation(s) pending review.
              </span>
              <Badge variant="destructive" className="ml-auto">Action Required</Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Students Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Assigned Students
          </CardTitle>
          <CardDescription>Students under your supervision</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
              <p className="text-muted-foreground ml-4">Loading data...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Students Assigned</h3>
              <p className="text-muted-foreground text-center max-w-md">
                You haven't been assigned any students yet. Once students are assigned to your supervision, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {students.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">Last activity: {student.lastActivity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <Progress value={student.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{student.progress}% complete</p>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-50">
                <ClipboardList className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">Evaluations</p>
                <p className="text-sm text-muted-foreground">{stats?.pendingEvaluations || 0} pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Weekly Logs</p>
                <p className="text-sm text-muted-foreground">{stats?.weeklyLogsPending || 0} to review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Messages</p>
                <p className="text-sm text-muted-foreground">Communicate with students</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
