"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface WeeklyLog {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  status: "approved" | "rejected" | "pending" | "draft";
  tasksCompleted: string[];
  challenges: string;
  nextWeekGoals: string[];
  supervisorFeedback: string | null;
  hoursWorked: number;
  submittedAt: string | null;
  reviewedAt: string | null;
}

// Default empty state - logs will be fetched from database
const DEFAULT_LOGS: WeeklyLog[] = [];

export default function StudentWeeklyLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WeeklyLog[]>(DEFAULT_LOGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    tasksCompleted: "",
    challenges: "",
    nextWeekGoals: "",
    hoursWorked: "",
  });

  useEffect(() => {
    fetchWeeklyLogs();
  }, [user]);

  async function fetchWeeklyLogs() {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();
      
      // Fetch weekly logs for current student
      const { data, error } = await supabase
        .from('weekly_logs')
        .select('*')
        .eq('student_user_id', user.id)
        .order('week_start_date', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const logList: WeeklyLog[] = data.map((log: any) => ({
          id: log.id,
          weekNumber: log.week_number || 0,
          startDate: log.week_start_date || '',
          endDate: log.week_end_date || '',
          status: log.status || 'draft',
          tasksCompleted: log.tasks_completed || [],
          challenges: log.challenges || '',
          nextWeekGoals: log.next_week_goals || [],
          supervisorFeedback: log.supervisor_feedback,
          hoursWorked: log.hours_worked || 0,
          submittedAt: log.submitted_at,
          reviewedAt: log.reviewed_at,
        }));
        setLogs(logList);
      }
    } catch (error) {
      console.error("Error fetching weekly logs:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending Review</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSubmitLog = async () => {
    // In real app, this would submit to Supabase
    try {
      const supabase = createClient();
      // Submit logic here
      alert("Weekly log submitted successfully!");
      setIsDialogOpen(false);
      setFormData({ tasksCompleted: "", challenges: "", nextWeekGoals: "", hoursWorked: "" });
      // Refresh logs
      fetchWeeklyLogs();
    } catch (error) {
      console.error("Error submitting log:", error);
      alert("Failed to submit log. Please try again.");
    }
  };

  const pendingWeeks = logs.filter(log => log.status === "pending" || log.status === "draft");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6 lg:px-8">
            <div className="h-8 bg-muted animate-pulse rounded w-48" />
            <div className="h-4 bg-muted animate-pulse rounded w-64 mt-2" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-12 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                Weekly Logs
              </h1>
              <p className="mt-2 text-muted-foreground">
                Track your weekly internship activities and progress
              </p>
            </div>
            
            {pendingWeeks.length > 0 && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Submit Log
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Submit Weekly Log</DialogTitle>
                    <DialogDescription>
                      Week {pendingWeeks[0]?.weekNumber} ({pendingWeeks[0]?.startDate} - {pendingWeeks[0]?.endDate})
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Tasks Completed</label>
                      <Textarea
                        placeholder="List the tasks you completed this week..."
                        value={formData.tasksCompleted}
                        onChange={(e) => setFormData({ ...formData, tasksCompleted: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Challenges Faced</label>
                      <Textarea
                        placeholder="Any obstacles or challenges you encountered..."
                        value={formData.challenges}
                        onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Next Week Goals</label>
                      <Textarea
                        placeholder="What do you plan to accomplish next week..."
                        value={formData.nextWeekGoals}
                        onChange={(e) => setFormData({ ...formData, nextWeekGoals: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Hours Worked</label>
                      <Input
                        type="number"
                        placeholder="Total hours worked this week"
                        value={formData.hoursWorked}
                        onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSubmitLog} className="gap-2">
                        <Send className="h-4 w-4" />
                        Submit Log
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6"
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Submitted</p>
                <p className="text-2xl font-bold">{logs.filter(l => l.submittedAt).length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{logs.filter(l => l.status === "approved").length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingWeeks.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{logs.reduce((acc, log) => acc + (log.hoursWorked || 0), 0)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Weekly Logs List */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No weekly logs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your weekly logs will appear here once you start your internship
                </p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card className="transition-all hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Week {log.weekNumber}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {log.startDate} - {log.endDate}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.status)}
                        {log.submittedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.submittedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {log.tasksCompleted.length > 0 && (
                    <CardContent className="pt-0 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Tasks Completed:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {log.tasksCompleted.map((task, i) => (
                            <li key={i}>{task}</li>
                          ))}
                        </ul>
                      </div>

                      {log.challenges && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Challenges:</h4>
                          <p className="text-sm text-muted-foreground">{log.challenges}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground border-t">
                        <span>Hours: <strong>{log.hoursWorked}</strong></span>
                        {log.supervisorFeedback && (
                          <span>Feedback: <strong className="text-emerald-600">Received</strong></span>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
