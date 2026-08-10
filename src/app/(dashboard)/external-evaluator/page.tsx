"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Building2,
  Award,
  ClipboardCheck,
  Clock,
  Star,
  CheckCircle2,
  AlertCircle,
  Send,
  FileText,
  TrendingUp,
  Calendar,
  ExternalLink,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface EvaluatorStats {
  pendingEvaluations: number;
  completedEvaluations: number;
  totalAssigned: number;
  averageRating: number;
}

interface PendingEvaluation {
  id: string;
  studentName: string;
  university: string;
  company: string;
  dueDate: string;
}

export default function ExternalEvaluatorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<EvaluatorStats | null>(null);
  const [pendingEvaluations, setPendingEvaluations] = useState<PendingEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvaluatorData();
  }, []);

  async function fetchEvaluatorData() {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Fetch evaluator stats
      const [pendingRes, completedRes, assignedRes] = await Promise.all([
        supabase
          .from("evaluations")
          .select("id, student_id, university_id, company_id, due_date")
          .eq("evaluator_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("evaluations")
          .select("id", { count: "exact" })
          .eq("evaluator_id", user.id)
          .eq("status", "completed"),
        supabase
          .from("evaluations")
          .select("id", { count: "exact" })
          .eq("evaluator_id", user.id),
      ]);

      // Transform pending evaluations
      const pendingData = (pendingRes.data || []).map((eval_: any) => ({
        id: eval_.id,
        studentName: `Student ${eval_.student_id?.slice(0, 6) || 'N/A'}`,
        university: `University ${eval_.university_id?.slice(0, 4) || ''}`,
        company: `Company ${eval_.company_id?.slice(0, 4) || ''}`,
        dueDate: eval_.due_date ? new Date(eval_.due_date).toLocaleDateString() : 'N/A',
      }));

      setStats({
        pendingEvaluations: pendingRes.data?.length || 0,
        completedEvaluations: completedRes.count || 0,
        totalAssigned: assignedRes.count || 0,
        averageRating: 0, // Would need to calculate from completed evaluations
      });
      
      setPendingEvaluations(pendingData);
    } catch (error) {
      console.error("Error fetching evaluator data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Pending Evaluations",
      value: stats?.pendingEvaluations.toString() || "0",
      icon: ClipboardCheck,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Completed",
      value: stats?.completedEvaluations.toString() || "0",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Assigned",
      value: stats?.totalAssigned.toString() || "0",
      icon: Award,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Avg Rating Given",
      value: stats?.averageRating.toFixed(1) || "0.0",
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">External Evaluator Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "Evaluator"}
          </p>
        </div>
        <Button variant="outline" onClick={fetchEvaluatorData} disabled={isLoading}>
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

      {/* Alert for pending evaluations */}
      {stats?.pendingEvaluations ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                You have {stats.pendingEvaluations} evaluation(s) that require your attention.
              </span>
              <Badge variant="destructive" className="ml-auto">Action Required</Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Pending Evaluations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pending Evaluations
          </CardTitle>
          <CardDescription>Evaluations awaiting your review</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
              <p className="text-muted-foreground ml-4">Loading data...</p>
            </div>
          ) : pendingEvaluations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground text-center max-w-md">
                You don't have any pending evaluations. New assignments will appear here once they're allocated to you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingEvaluations.map((evaluation) => (
                <div key={evaluation.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{evaluation.studentName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{evaluation.university}</span>
                        <span>•</span>
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>{evaluation.company}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Due: {evaluation.dueDate}
                      </p>
                    </div>
                    <Button size="sm">
                      Start Evaluation
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Completion Rate</p>
                <p className="text-2xl font-bold">
                  {stats?.totalAssigned 
                    ? Math.round((stats.completedEvaluations / stats.totalAssigned) * 100) 
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <Star className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Performance</p>
                <p className="text-sm text-muted-foreground">Excellent evaluator rating</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Guidelines</p>
                <p className="text-sm text-muted-foreground">View evaluation criteria</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
