"use client";

import React, { useState } from "react";
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

// Mock evaluation data
const mockEvaluations = [
  {
    id: "1",
    type: "Weekly Evaluation",
    course: "CS498 - Internship",
    week: 3,
    status: "completed",
    score: 85,
    feedback: "Good progress this week. Keep up the good work on the frontend tasks.",
    date: "2024-06-15",
    evaluator: "Dr. Ahmad Khan",
  },
  {
    id: "2",
    type: "Site Supervisor Review",
    company: "TechCorp Pakistan",
    week: 3,
    status: "pending",
    score: null,
    feedback: null,
    date: null,
    evaluator: "Ali Hassan (Site Supervisor)",
  },
  {
    id: "3",
    type: "Mid-term Evaluation",
    course: "CS498 - Internship",
    week: 6,
    status: "upcoming",
    score: null,
    feedback: null,
    date: "2024-07-01",
    evaluator: "Dr. Ahmad Khan",
  },
];

export default function StudentEvaluationsPage() {
  const [filter, setFilter] = useState<"all" | "completed" | "pending" | "upcoming">("all");

  const filtered = mockEvaluations.filter((e) =>
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
            { label: "Total", value: mockEvaluations.length, icon: FileText },
            { label: "Completed", value: mockEvaluations.filter(e => e.status === "completed").length, icon: CheckCircle2, color: "text-green-600" },
            { label: "Pending", value: mockEvaluations.filter(e => e.status === "pending").length, icon: Clock, color: "text-yellow-600" },
            { label: "Upcoming", value: mockEvaluations.filter(e => e.status === "upcoming").length, icon: AlertCircle, color: "text-blue-600" },
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
