"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Star,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface Evaluation {
  id: string;
  type: string;
  course?: string;
  company?: string;
  week?: number;
  status: "completed" | "pending" | "upcoming";
  score: number | null;
  feedback: string | null;
  date: string | null;
  evaluator: string;
}

// Default empty state - evaluations will be fetched from database
const DEFAULT_EVALUATIONS: Evaluation[] = [];

export default function StudentEvaluationsPage() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>(DEFAULT_EVALUATIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "pending" | "upcoming">("all");

  useEffect(() => {
    fetchEvaluations();
  }, [user]);

  async function fetchEvaluations() {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();
      
      // Fetch evaluations for current student
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          *,
          evaluators!inner(full_name, type),
          internships!inner(title)
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const evals: Evaluation[] = data.map((ev: any) => ({
          id: ev.id,
          type: ev.evaluation_type || 'Evaluation',
          course: ev.course_code,
          company: ev.internships?.title,
          week: ev.week_number,
          status: ev.status || 'pending',
          score: ev.overall_rating,
          feedback: ev.comments,
          date: ev.evaluated_at || ev.created_at,
          evaluator: ev.evaluators?.full_name || 'Unknown',
        }));
        setEvaluations(evals);
      }
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = evaluations.filter((e) =>
    filter === "all" ? true : e.status === filter
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "upcoming":
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Upcoming</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Evaluations</h1>
            <p className="text-muted-foreground mt-1">Loading...</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-8 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Evaluations</h1>
          <p className="text-muted-foreground mt-1">
            Track your internship evaluations and feedback
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: evaluations.length, icon: FileText },
            { label: "Completed", value: evaluations.filter(e => e.status === "completed").length, icon: CheckCircle2, color: "text-green-600" },
            { label: "Pending", value: evaluations.filter(e => e.status === "pending").length, icon: Clock, color: "text-yellow-600" },
            { label: "Upcoming", value: evaluations.filter(e => e.status === "upcoming").length, icon: AlertCircle, color: "text-blue-600" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color || "text-muted-foreground"} shrink-0`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["all", "completed", "pending", "upcoming"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="cursor-pointer capitalize"
            >
              {f}
            </Button>
          ))}
        </div>

        {/* Evaluations List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No evaluations found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Evaluations will appear here once assigned
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((eval_, idx) => (
              <motion.div
                key={eval_.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{eval_.type}</CardTitle>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {eval_.course && <span>{eval_.course}</span>}
                          {eval_.company && <span>• {eval_.company}</span>}
                          {eval_.week && <span>• Week {eval_.week}</span>}
                        </div>
                      </div>
                      {getStatusBadge(eval_.status)}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-4">
                    {/* Score */}
                    {eval_.score !== null && (
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold">{eval_.score}/100</span>
                      </div>
                    )}

                    {/* Feedback */}
                    {eval_.feedback && (
                      <div className="bg-muted/50 rounded-lg p-3 flex gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm">{eval_.feedback}</p>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t text-sm text-muted-foreground">
                      <span>Evaluator: {eval_.evaluator}</span>
                      {eval_.date && <span>{eval_.date}</span>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
