"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Upload,
  FileText,
  Send,
  Eye,
  Paperclip,
  CalendarDays,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Plus,
  ExternalLink,
  MessageSquare,
  FileCode,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface Task {
  id: string;
  title: string;
  description: string | null;
  course_name: string | null;
  due_date: string | null;
  status: "pending" | "assigned" | "in_progress" | "submitted" | "approved" | "rejected";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  submission?: TaskSubmission;
}

interface TaskSubmission {
  id: string;
  task_id: string;
  notes: string | null;
  url: string | null;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  feedback: string | null;
  reviewed_at: string | null;
}

export default function StudentTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  
  // Submission dialog state
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // View submission dialog
  const [viewSubmission, setViewSubmission] = useState<TaskSubmission | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Fetch tasks assigned to this student
      const { data: tasksData, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("student_id", user.id)
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Fetch submissions for these tasks
      const taskIds = (tasksData || []).map(t => t.id);
      
      let submissionsMap: Record<string, TaskSubmission> = {};
      
      if (taskIds.length > 0) {
        const { data: submissionsData } = await supabase
          .from("task_submissions")
          .select("*")
          .eq("student_id", user.id)
          .in("task_id", taskIds);

        (submissionsData || []).forEach((sub: any) => {
          submissionsMap[sub.task_id] = sub;
        });
      }

      // Combine tasks with their submissions
      const tasksWithSubmissions: Task[] = (tasksData || []).map(task => ({
        ...task,
        submission: submissionsMap[task.id],
      }));

      setTasks(tasksWithSubmissions);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filtered tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.course_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Stats calculations
  const pendingCount = tasks.filter(t => ["pending", "assigned"].includes(t.status)).length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const submittedCount = tasks.filter(t => ["submitted", "under_review"].includes(t.submission?.status || "")).length;
  const approvedCount = tasks.filter(t => t.submission?.status === "approved").length;
  const totalCount = tasks.length;
  const completionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
      case "submitted":
      case "under_review":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Eye className="mr-1 h-3 w-3" />Under Review</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case "in_progress":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">In Progress</Badge>;
      default:
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{status.replace("_", " ")}</Badge>;
    }
  };

  // Priority badge helper
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  // Due date color helper
  const getDueDateStyle = (dueDate: string | null) => {
    if (!dueDate) return "text-muted-foreground";
    
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "text-red-600 font-medium";
    if (diffDays <= 1) return "text-red-500 font-medium";
    if (diffDays <= 3) return "text-amber-500 font-medium";
    return "text-muted-foreground";
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  // Handle task submission
  const handleSubmitTask = async () => {
    if (!selectedTask || !user) return;

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      let fileUrl: string | null = null;
      let fileName: string | null = null;

      // Upload file if provided
      if (submissionFile) {
        const fileExt = submissionFile.name.split('.').pop();
        const fileNameUnique = `submission_${user.id}_${selectedTask.id}_${Date.now()}.${fileExt}`;
        const filePath = `submissions/${fileNameUnique}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, submissionFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileName = submissionFile.name;
      }

      // Create or update submission
      const submissionData = {
        task_id: selectedTask.id,
        student_id: user.id,
        notes: submissionNotes,
        url: submissionUrl || null,
        file_url: fileUrl,
        file_name: fileName,
        status: "pending",
        submitted_at: new Date().toISOString(),
      };

      const { error: submitError } = await supabase
        .from("task_submissions")
        .upsert(submissionData, {
          onConflict: "task_id,student_id",
        });

      if (submitError) throw submitError;

      // Update task status
      await supabase
        .from("tasks")
        .update({ status: "submitted" })
        .eq("id", selectedTask.id);

      // Reset form and close dialog
      setSubmitDialogOpen(false);
      setSelectedTask(null);
      setSubmissionNotes("");
      setSubmissionUrl("");
      setSubmissionFile(null);
      
      // Refresh tasks
      await fetchTasks();
    } catch (error) {
      console.error("Error submitting task:", error);
      alert("Failed to submit task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simple markdown preview (basic implementation)
  const renderMarkdownPreview = (text: string) => {
    if (!text) return <p className="text-muted-foreground italic">Nothing to preview</p>;
    
    // Basic markdown-like rendering
    let html = text
      .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold mb-2">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold mb-2">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold mb-1">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-sm">$1</code>')
      .replace(/\n/g, '<br />');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Get file icon based on type
  const getFileIcon = (fileName: string | null) => {
    if (!fileName) return <FileText className="h-4 w-4" />;
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <ImageIcon className="h-4 w-4 text-blue-500" />;
      case 'zip':
      case 'rar':
        return <FileCode className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileCode className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground mt-1">
            View assignments, submit work, and track your progress
          </p>
        </div>
        <Button variant="outline" onClick={fetchTasks} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total Tasks</p>
            <p className="text-2xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-2xl font-bold text-purple-600">{submittedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-2xl font-bold text-emerald-600">{completionRate}%</p>
            <Progress value={completionRate} className="h-1 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, description, or course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground self-center">
              {filteredTasks.length} of {tasks.length} tasks
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Content */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center">
              <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || statusFilter !== "all" || priorityFilter !== "all" 
                  ? "No Matching Tasks" 
                  : "No Tasks Assigned Yet"}
              </h3>
              <p className="text-muted-foreground max-w-md mb-4">
                {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "You don't have any tasks assigned yet. They will appear here once your supervisor assigns them."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.course_name || "-"}</span>
                        </TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                        <TableCell>
                          <span className={`text-sm ${getDueDateStyle(task.due_date)}`}>
                            {task.due_date ? formatDate(task.due_date) : "No deadline"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {task.submission 
                            ? getStatusBadge(task.submission.status)
                            : getStatusBadge(task.status)
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {task.submission && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewSubmission(task.submission!)}
                                title="View Submission"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {!task.submission && !["approved", "submitted"].includes(task.status) && (
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-1"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setSubmitDialogOpen(true);
                                }}
                              >
                                <Send className="h-3 w-3" />
                                Submit
                              </Button>
                            )}
                            {task.submission?.status === "rejected" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setSubmitDialogOpen(true);
                                }}
                              >
                                <RefreshCw className="h-3 w-3" />
                                Resubmit
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{task.title}</h3>
                          {task.course_name && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <BookOpen className="h-3 w-3" />
                              {task.course_name}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {task.submission 
                            ? getStatusBadge(task.submission.status)
                            : getPriorityBadge(task.priority)
                          }
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-1 text-sm">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span className={getDueDateStyle(task.due_date)}>
                            {task.due_date ? formatDate(task.due_date) : "No deadline"}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {task.submission && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewSubmission(task.submission!)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                          {!task.submission && !["approved", "submitted"].includes(task.status) && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTask(task);
                                setSubmitDialogOpen(true);
                              }}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Submit
                            </Button>
                          )}
                          {task.submission?.status === "rejected" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTask(task);
                                setSubmitDialogOpen(true);
                              }}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Resubmit
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Submit Task Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Submit Task
            </DialogTitle>
            <DialogDescription>
              Submit your work for: <strong>{selectedTask?.title}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Notes with Markdown Preview */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes / Description
                <span className="text-muted-foreground ml-2">(Markdown supported)</span>
              </Label>
              
              <Tabs defaultValue="write" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="write" className="flex-1">Write</TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
                </TabsList>
                
                <TabsContent value="write">
                  <Textarea
                    id="notes"
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    rows={8}
                    placeholder="Describe what you've done...&#10;&#10;You can use **bold**, *italic*, `code`, etc."
                    className="font-mono text-sm"
                  />
                </TabsContent>
                
                <TabsContent value="preview">
                  <div className="border rounded-md p-4 min-h-[200px] prose prose-sm dark:prose-invert max-w-none">
                    {renderMarkdownPreview(submissionNotes)}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* URL Field */}
            <div className="space-y-2">
              <Label htmlFor="url">
                Link (Optional)
                <span className="text-muted-foreground ml-2">GitHub repo, live demo, etc.</span>
              </Label>
              <Input
                id="url"
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
                placeholder="https://github.com/your-repo or https://your-demo.com"
                type="url"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Attachment (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate size (max 25MB)
                      if (file.size > 25 * 1024 * 1024) {
                        alert("File must be less than 25MB");
                        return;
                      }
                      setSubmissionFile(file);
                    }
                  }}
                  className="hidden"
                  id="task-file-upload"
                />
                <label htmlFor="task-file-upload" className="cursor-pointer">
                  <Paperclip className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {submissionFile ? (
                      <span className="font-medium text-foreground">{submissionFile.name}</span>
                    ) : (
                      "Click to select a file"
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Any file type up to 25MB
                  </p>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitDialogOpen(false);
                  setSelectedTask(null);
                  setSubmissionNotes("");
                  setSubmissionUrl("");
                  setSubmissionFile(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitTask}
                disabled={isSubmitting || (!submissionNotes.trim() && !submissionUrl && !submissionFile)}
                className="gap-2"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmitting ? "Submitting..." : "Submit Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Submission Dialog */}
      <Dialog open={!!viewSubmission} onOpenChange={() => setViewSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Submission Details
            </DialogTitle>
            <DialogDescription>
              Submitted on {viewSubmission?.submitted_at ? formatRelativeTime(viewSubmission.submitted_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {viewSubmission && (
            <div className="space-y-6 mt-4">
              {/* Status */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(viewSubmission.status)}
              </div>

              {/* Notes */}
              {viewSubmission.notes && (
                <div className="space-y-2">
                  <Label>Submitted Notes</Label>
                  <div className="border rounded-md p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {viewSubmission.notes}
                  </div>
                </div>
              )}

              {/* URL */}
              {viewSubmission.url && (
                <div className="space-y-2">
                  <Label>Attached Link</Label>
                  <a
                    href={viewSubmission.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary truncate">{viewSubmission.url}</span>
                  </a>
                </div>
              )}

              {/* File Attachment */}
              {viewSubmission.file_url && (
                <div className="space-y-2">
                  <Label>Attached File</Label>
                  <a
                    href={viewSubmission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    {getFileIcon(viewSubmission.file_name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{viewSubmission.file_name}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                </div>
              )}

              {/* Feedback (if reviewed) */}
              {viewSubmission.feedback && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Feedback
                  </Label>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">
                      {viewSubmission.feedback}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
