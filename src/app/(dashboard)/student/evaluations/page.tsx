"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
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
import { PageHeader } from "@/components/dashboard/page-header";

// Types
// `evaluations.status` uses the `evaluation_status` enum
// (pending, in_progress, submitted, approved, rejected).
interface Evaluation {
  id: string;
  type: string;
  company?: string;
  status: "pending" | "in_progress" | "submitted" | "approved" | "rejected";
  rating: number | null; // 0-5 (DB column `rating`)
  scores: Record<string, any> | null; // DB jsonb `scores`
  feedback: string | null;
  date: string | null; // submitted_at (or created_at fallback)
  evaluator: string;
}

// Default empty state - evaluations will be fetched from database
const DEFAULT_EVALUATIONS: Evaluation[] = [];

export default function StudentEvaluationsPage() {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>(DEFAULT_EVALUATIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "submitted" | "approved" | "rejected">("all");

  useEffect(() => {
    fetchEvaluations();
  }, [user]);

  async function fetchEvaluations() {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();
      
      // Fetch evaluations for current student. `evaluations.internship_id`
      // may be NULL (e.g. mid-program evals), so use a LEFT join on
      // `internship_id` — not `internships!inner(...)` which would drop NULLs.
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          id,
          type,
          status,
          rating,
          scores,
          comments,
          submitted_at,
          created_at,
          evaluator:profiles!evaluator_id(full_name),
          internship:internship_id(title)
        `)
        .eq('student_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        const evals: Evaluation[] = data.map((ev: any) => ({
          id: ev.id,
          type: ev.type || 'Evaluation',
          company: ev.internship?.title,
          status: ev.status || 'pending',
          rating: typeof ev.rating === 'number' ? ev.rating : null,
          scores: ev.scores || null,
          feedback: ev.comments,
          date: ev.submitted_at || ev.created_at,
          evaluator: ev.evaluator?.full_name || 'Unknown',
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
                  <Skeleton className="h-8" />
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
        <PageHeader
          title="Evaluations"
          description="Track your internship evaluations and feedback"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: evaluations.length, icon: FileText },
            { label: "Approved", value: evaluations.filter(e => e.status === "approved").length, icon: CheckCircle2, color: "text-green-600" },
            { label: "Submitted", value: evaluations.filter(e => e.status === "submitted").length, icon: Clock, color: "text-blue-600" },
            { label: "Pending", value: evaluations.filter(e => e.status === "pending" || e.status === "in_progress").length, icon: AlertCircle, color: "text-yellow-600" },
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
          {(["all", "pending", "in_progress", "submitted", "approved", "rejected"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="cursor-pointer capitalize"
            >
              {f.replace("_", " ")}
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
                        <CardTitle className="text-lg capitalize">{eval_.type?.replace("_", " ") || "Evaluation"}</CardTitle>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {eval_.company && <span>• {eval_.company}</span>}
                        </div>
                      </div>
                      <StatusBadge status={eval_.status} />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-4">
                    {/* Rating (0-5) */}
                    {eval_.rating !== null && (
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold">{eval_.rating.toFixed(1)}/5</span>
                        <div className="flex ml-1">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${
                                i < Math.round(eval_.rating!)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Score breakdown (jsonb `scores`) */}
                    {eval_.scores && typeof eval_.scores === "object" && Object.keys(eval_.scores).length > 0 && (
                      <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Score breakdown</p>
                        {Object.entries(eval_.scores).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
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
                      {eval_.date && <span>{new Date(eval_.date).toLocaleDateString()}</span>}
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
