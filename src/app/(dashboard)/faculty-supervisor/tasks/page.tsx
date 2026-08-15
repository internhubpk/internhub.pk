"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { toast } from "@/components/shared/toast";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  FileText,
  Paperclip,
  Users,
  Send,
  ListTodo,
  BarChart3,
  X,
  ChevronDown,
  ChevronUp,
  Star,
  MoreVertical,
  Loader2,
} from "lucide-react";

// Types
type TaskStatus = "draft" | "assigned" | "in_progress" | "completed" | "overdue" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface StudentOption {
  id: string;
  name: string;
  email: string;
  program: string;
}

interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  assignedStudents: StudentOption[];
  completedBy: string[];
  attachments: TaskAttachment[];
  submissionCount: number;
  totalAssigned: number;
}

// Default empty data - will be populated from database
const DEFAULT_STUDENTS: StudentOption[] = [];
const DEFAULT_TASKS: Task[] = [];

// Map an API task row (snake_case) to the UI's Task interface (camelCase).
// The API returns tasks with `assignments` (joined task_assignments with
// student profile) and `submissions` (joined task_submissions).
function mapApiTaskToUi(apiTask: any): Task {
  const assignments: any[] = Array.isArray(apiTask.assignments) ? apiTask.assignments : [];
  const submissions: any[] = Array.isArray(apiTask.submissions) ? apiTask.submissions : [];

  const assignedStudents: StudentOption[] = assignments.map((a: any) => ({
    id: a.student_user_id || a.student?.user_id || "",
    name: a.student?.full_name || `Student ${(a.student_user_id || "").slice(0, 6)}`,
    email: a.student?.email || "",
    program: "", // program name not joined in API response; left blank
  }));

  return {
    id: apiTask.id,
    title: apiTask.title || "",
    description: apiTask.description || null,
    status: (apiTask.status as TaskStatus) || "draft",
    priority: (apiTask.priority as TaskPriority) || "medium",
    dueDate: apiTask.due_date || "",
    createdAt: apiTask.created_at || new Date().toISOString(),
    updatedAt: apiTask.updated_at || new Date().toISOString(),
    assignedStudents,
    completedBy: submissions
      .filter((s: any) => s.status === "approved")
      .map((s: any) => s.student_user_id),
    attachments: [], // attachments not yet fetched via API; left empty
    submissionCount: submissions.length,
    totalAssigned: assignments.length,
  };
}

// Interface for task form props
interface TaskFormProps {
  formData: {
    title: string;
    description: string;
    priority: TaskPriority;
    dueDate: string;
    assignedStudentIds: string[];
  };
  students: StudentOption[];
  onFormDataChange: (data: {
    title: string;
    description: string;
    priority: TaskPriority;
    dueDate: string;
    assignedStudentIds: string[];
  }) => void;
  onSelectAllStudents: () => void;
  onDeselectAllStudents: () => void;
  onToggleStudentSelection: (studentId: string) => void;
}

// Task Form Component (defined outside to avoid re-creation on each render)
function TaskForm({ 
  formData, 
  students,
  onFormDataChange, 
  onSelectAllStudents, 
  onDeselectAllStudents,
  onToggleStudentSelection 
}: TaskFormProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="title">Task Title *</Label>
        <Input
          id="title"
          placeholder="Enter task title..."
          value={formData.title}
          onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Description{" "}
          <span className="text-muted-foreground text-xs font-normal">(Markdown supported)</span>
        </Label>
        <MarkdownEditor
          id="description"
          value={formData.description}
          onChange={(v) => onFormDataChange({ ...formData, description: v })}
          placeholder="Enter task description..."
          rows={5}
          ariaLabel="Task description (Markdown)"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select 
            value={formData.priority} 
            onValueChange={(value) => onFormDataChange({ ...formData, priority: value as TaskPriority })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date *</Label>
          <Input
            id="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={(e) => onFormDataChange({ ...formData, dueDate: e.target.value })}
          />
        </div>
      </div>

      {/* File Attachment */}
      <div className="space-y-2">
        <Label>Attachments</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer">
          <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Click to upload or drag files here
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOCX, Images (Max 10MB each)
          </p>
        </div>
      </div>

      {/* Student Assignment */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Assign to Students *</Label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onSelectAllStudents}>
              Select All
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDeselectAllStudents}>
              Deselect All
            </Button>
          </div>
        </div>
        
        <div className="border rounded-lg max-h-[180px] overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No students available. Students will appear once they are assigned to your supervision.
            </div>
          ) : (
            students.map((student) => (
            <label
              key={student.id}
              className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 ${
                formData.assignedStudentIds.includes(student.id) ? 'bg-primary/5' : ''
              }`}
            >
              <Checkbox
                checked={formData.assignedStudentIds.includes(student.id)}
                onCheckedChange={() => onToggleStudentSelection(student.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{student.name}</p>
                <p className="text-xs text-muted-foreground">{student.program}</p>
              </div>
            </label>
          ))
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">
          {formData.assignedStudentIds.length} student(s) selected
        </p>
      </div>
    </div>
  );
}

// Note: Mock data removed - page shows empty state until real data is available

export default function FacultySupervisorTasksPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS);
  const [students, setStudents] = useState<StudentOption[]>(DEFAULT_STUDENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  // Per the production brief, faculty supervisors do NOT create or assign
  // tasks — they VIEW and EVALUATE the tasks that site supervisors create
  // for their students. There is no longer a "mine" scope; this page now
  // always shows site-supervisor-created tasks assigned to this faculty
  // supervisor's students.

  // Dialog states
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Fetch data from database + API
  const fetchData = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();

      // Fetch supervised students via THREE-PATH UNION (see
      // faculty-supervisor/page.tsx for full rationale).
      const { data: directData, error: studentErr } = await supabase
        .from("student_internships")
        .select(`
          student_user_id,
          program:programs(id, name),
          student:profiles!student_internships_student_user_id_fkey(user_id, full_name, email)
        `)
        .eq("faculty_supervisor_id", user.id)
        .in("status", ["assigned", "active"]);

      if (studentErr) {
        console.error("Error fetching students:", studentErr);
      }

      const { data: preInternshipStudents } = await supabase
        .from("students")
        .select("user_id, program_id")
        .eq("faculty_supervisor_id", user.id);

      const { data: defaultPrograms } = await supabase
        .from("programs")
        .select("id, name")
        .eq("default_faculty_supervisor_id", user.id);
      const defaultProgramIds = (defaultPrograms || []).map((p) => p.id);
      let programStudentIds: string[] = [];
      if (defaultProgramIds.length > 0) {
        const { data: programStudents } = await supabase
          .from("students")
          .select("user_id")
          .in("program_id", defaultProgramIds);
        programStudentIds = (programStudents || []).map((s) => s.user_id);
      }

      const directStudentIds = new Set((directData || []).map((s: any) => s.student_user_id));
      const preInternshipOnlyIds = (preInternshipStudents || [])
        .map((s) => s.user_id)
        .filter((id) => !directStudentIds.has(id));
      const programOnlyIds = programStudentIds.filter(
        (id) => !directStudentIds.has(id) && !preInternshipOnlyIds.includes(id)
      );
      const additionalStudentIds = Array.from(new Set([...preInternshipOnlyIds, ...programOnlyIds]));

      let additionalRows: any[] = [];
      if (additionalStudentIds.length > 0) {
        const { data: extra } = await supabase
          .from("student_internships")
          .select(`
            student_user_id,
            program:programs(id, name),
            student:profiles!student_internships_student_user_id_fkey(user_id, full_name, email)
          `)
          .in("student_user_id", additionalStudentIds)
          .in("status", ["assigned", "active"]);
        const seenIds = new Set((extra || []).map((r: any) => r.student_user_id));
        const missingIds = additionalStudentIds.filter((id) => !seenIds.has(id));
        let missingProfiles: any[] = [];
        if (missingIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", missingIds);
          missingProfiles = (profiles || []).map((p) => ({
            student_user_id: p.user_id,
            student: p,
            program: null,
          }));
        }
        additionalRows = [...(extra || []), ...missingProfiles];
      }

      const studentData: any[] = [...(directData || []), ...additionalRows];

      const studentList: StudentOption[] = (studentData || []).map((s: any) => ({
        id: s.student?.user_id || s.student_user_id,
        name: s.student?.full_name || `Student ${(s.student_user_id || "").slice(0, 6)}`,
        email: s.student?.email || "",
        program: s.program?.name || "Unknown Program",
      }));

      // Deduplicate by student id (a student may have multiple internships)
      const dedupedStudents = Array.from(
        studentList.reduce((map, s) => {
          if (!map.has(s.id)) map.set(s.id, s);
          return map;
        }, new Map<string, StudentOption>()).values()
      );
      setStudents(dedupedStudents);

      // Fetch site-supervisor-created tasks assigned to this faculty
      // supervisor's students. Faculty supervisors do NOT create tasks
      // anymore — they only view and evaluate site-supervisor tasks.
      try {
        const res = await fetch(`/api/faculty-supervisor/tasks?scope=assigned`, { cache: "no-store" });
        const json = await res.json().catch(() => ({ success: false, data: [] }));
        if (res.ok && json?.success && Array.isArray(json.data)) {
          setTasks((json.data as any[]).map(mapApiTaskToUi));
        } else {
          console.error("Error fetching tasks:", json?.error || `HTTP ${res.status}`);
          setTasks([]);
        }
      } catch (taskErr) {
        console.error("Error fetching tasks:", taskErr);
        setTasks([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    dueDate: "",
    assignedStudentIds: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchTerm, statusFilter, priorityFilter]);

  // Stats
  const stats = {
    total: tasks.length,
    draft: tasks.filter(t => t.status === "draft").length,
    assigned: tasks.filter(t => t.status === "assigned").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    overdue: tasks.filter(t => t.status === "overdue").length,
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Medium</Badge>;
      case "low":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isOverdue = (dueDate: string, status: TaskStatus) => {
    return new Date(dueDate) < new Date() && !["completed", "cancelled"].includes(status);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      assignedStudentIds: [],
    });
  };

  // NOTE: handleCreateTask, handleUpdateTask, handleDeleteTask, openEditDialog,
  // and the TaskForm component were removed per the production brief —
  // faculty supervisors no longer create/edit/delete tasks. They only VIEW
  // and EVALUATE tasks that site supervisors create. The corresponding
  // /api/faculty-supervisor/tasks POST/PUT/DELETE endpoints still exist
  // for backwards compatibility but are no longer called from this page.

  const openViewDialog = (task: Task) => {
    setSelectedTask(task);
    setIsViewDialogOpen(true);
  };

  const toggleStudentSelection = (studentId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedStudentIds: prev.assignedStudentIds.includes(studentId)
        ? prev.assignedStudentIds.filter(id => id !== studentId)
        : [...prev.assignedStudentIds, studentId],
    }));
  };

  const selectAllStudents = () => {
    setFormData(prev => ({
      ...prev,
      assignedStudentIds: students.map(s => s.id),
    }));
  };

  const deselectAllStudents = () => {
    setFormData(prev => ({
      ...prev,
      assignedStudentIds: [],
    }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground mt-1">Loading tasks...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Skeleton className="h-5 w-5 mb-2" />
                <Skeleton className="h-7 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Student Tasks"
        description="Tasks assigned by the Site Supervisor to your students. View submissions and evaluate."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total" value={stats.total} icon={ListTodo} variant="default" />
        <StatCard label="Draft" value={stats.draft} icon={FileText} variant="default" />
        <StatCard label="Assigned" value={stats.assigned} icon={Send} variant="info" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} variant="warning" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} variant="success" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertCircle} variant="danger" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <Star className="h-4 w-4 mr-2" />
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List/Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{task.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <StatusBadge status={task.status} />
                      {getPriorityBadge(task.priority)}
                    </div>
                  </div>
                </div>

                {(task.description) && (
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    <MarkdownRenderer content={task.description} compact />
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Due: {formatDate(task.dueDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {task.totalAssigned} student(s)
                  </span>
                </div>

                {task.attachments.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span>{task.attachments.length} attachment(s)</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Submissions: {task.submissionCount}/{task.totalAssigned}
                    </span>
                    {task.totalAssigned > 0 && (
                      <Progress 
                        value={(task.submissionCount / task.totalAssigned) * 100} 
                        className="h-1.5 w-16"
                      />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(task)} title="View task">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Attachments</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id} className={isOverdue(task.dueDate, task.status) ? "bg-red-50/50" : ""}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className="font-medium truncate">{task.title}</p>
                        {task.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            <MarkdownRenderer content={task.description} compact />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={task.status} /></TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell>
                      <span className={`text-sm ${isOverdue(task.dueDate, task.status) ? 'text-red-600 font-medium' : ''}`}>
                        {formatDate(task.dueDate)}
                      </span>
                      {isOverdue(task.dueDate, task.status) && (
                        <AlertCircle className="inline h-3 w-3 ml-1 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{task.totalAssigned}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress 
                          value={task.totalAssigned > 0 ? (task.submissionCount / task.totalAssigned) * 100 : 0} 
                          className="h-2 flex-1"
                        />
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {task.submissionCount}/{task.totalAssigned}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.attachments.length > 0 ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          <span className="text-xs">{task.attachments.length}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(task)} title="View task">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {filteredTasks.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No site-supervisor tasks found
              </h3>
              <p className="text-muted-foreground mb-4">
                Tasks assigned by the Site Supervisor to your students will appear here. Try adjusting your search or filter criteria.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* View Task Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle>{selectedTask.title}</DialogTitle>
                    <DialogDescription className="mt-1">
                      Created on {formatDate(selectedTask.createdAt)} • Last updated {formatDate(selectedTask.updatedAt)}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <StatusBadge status={selectedTask.status} />
                    {getPriorityBadge(selectedTask.priority)}
                  </div>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-6">
                {/* Description */}
                {selectedTask.description && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MarkdownRenderer content={selectedTask.description} />
                    </CardContent>
                  </Card>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <CalendarDays className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">Due Date</p>
                      <p className={`text-lg font-bold ${isOverdue(selectedTask.dueDate, selectedTask.status) ? 'text-red-600' : ''}`}>
                        {formatDate(selectedTask.dueDate)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">Assigned</p>
                      <p className="text-lg font-bold">{selectedTask.totalAssigned} Students</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">Submissions</p>
                      <p className="text-lg font-bold">{selectedTask.submissionCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Paperclip className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">Attachments</p>
                      <p className="text-lg font-bold">{selectedTask.attachments.length}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Assigned Students */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Assigned Students</CardTitle>
                    <CardDescription>{selectedTask.assignedStudents.length} student(s) assigned to this task</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedTask.assignedStudents.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div>
                            <p className="font-medium text-sm">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{student.program}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Attachments */}
                {selectedTask.attachments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Attachments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedTask.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{attachment.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="gap-1">
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No edit/delete actions — faculty supervisors view and
                    evaluate site-supervisor tasks only; they do not modify
                    them. The site supervisor who owns the task can edit it
                    from their own dashboard. */}
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
