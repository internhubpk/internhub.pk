"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
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
  Copy,
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
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Enter task description... (Markdown supported)"
          value={formData.description}
          onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
          rows={5}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Markdown formatting is supported. Use **bold**, *italic*, # headings, etc.
        </p>
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
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Fetch data from database
  useEffect(() => {
    async function fetchData() {
      if (!user) { setIsLoading(false); return; }
      
      try {
        const supabase = createClient();
        
        // Get supervisor record
        const { data: supervisor } = await supabase
          .from("supervisors")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "faculty")
          .single();

        if (!supervisor) {
          setIsLoading(false);
          return;
        }

        // Fetch supervised students. NOTE: the FK column is student_user_id,
        // not student_id.
        const { data: studentData } = await supabase
          .from("student_internships")
          .select(`
            student_user_id,
            student:students(
              id,
              full_name,
              email,
              program:programs(id, name)
            )
          `)
          .eq("faculty_supervisor_id", user.id)
          .in("status", ["active", "in_progress"]);

        const studentList: StudentOption[] = (studentData || []).map((s: any) => ({
          id: s.student?.id || s.student_user_id,
          name: s.student?.full_name || `Student ${s.student_user_id?.slice(0, 6)}`,
          email: s.student?.email || "",
          program: s.student?.program?.name || "Unknown Program",
        }));

        setStudents(studentList);

        // Fetch tasks (when API is ready)
        // const { data: taskData } = await supabase
        //   .from("tasks")
        //   .select("*")
        //   .eq("supervisor_id", supervisor.id);
        
        // setTasks(taskData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        // Keep empty state on error
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [user]);

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

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "assigned":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Assigned</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">
          <Clock className="mr-1 h-3 w-3" /> In Progress
        </Badge>;
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
        </Badge>;
      case "overdue":
        return <Badge variant="destructive">
          <AlertCircle className="mr-1 h-3 w-3" /> Overdue
        </Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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

  const handleCreateTask = async () => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newTask: Task = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description,
      status: "draft",
      priority: formData.priority,
      dueDate: formData.dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedStudents: students.filter(s => formData.assignedStudentIds.includes(s.id)),
      completedBy: [],
      attachments: [],
      submissionCount: 0,
      totalAssigned: formData.assignedStudentIds.length,
    };

    setTasks(prev => [newTask, ...prev]);
    setIsCreateDialogOpen(false);
    resetForm();
    setIsSubmitting(false);
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    setTasks(prev => prev.map(task => 
      task.id === selectedTask.id 
        ? {
            ...task,
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            dueDate: formData.dueDate,
            assignedStudents: students.filter(s => formData.assignedStudentIds.includes(s.id)),
            totalAssigned: formData.assignedStudentIds.length,
            updatedAt: new Date().toISOString(),
          }
        : task
    ));

    setIsEditDialogOpen(false);
    setSelectedTask(null);
    resetForm();
    setIsSubmitting(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      dueDate: task.dueDate,
      assignedStudentIds: task.assignedStudents.map(s => s.id),
    });
    setIsEditDialogOpen(true);
  };

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
              <CardContent className="p-4 flex flex-col items-center text-center animate-pulse">
                <div className="h-5 w-5 bg-muted rounded mb-2"></div>
                <div className="h-7 w-12 bg-muted rounded mb-1"></div>
                <div className="h-3 w-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading tasks...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage tasks for your supervised students
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Copy className="h-4 w-4" /> Bulk Create
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="h-4 w-4" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Assign a new task to one or more students in your programs.
                </DialogDescription>
              </DialogHeader>
              <TaskForm 
                formData={formData}
                students={students}
                onFormDataChange={setFormData}
                onSelectAllStudents={selectAllStudents}
                onDeselectAllStudents={deselectAllStudents}
                onToggleStudentSelection={toggleStudentSelection}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateTask}
                  disabled={!formData.title || !formData.dueDate || formData.assignedStudentIds.length === 0 || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <ListTodo className="h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <FileText className="h-5 w-5 text-gray-500 mb-1" />
            <p className="text-2xl font-bold">{stats.draft}</p>
            <p className="text-xs text-muted-foreground">Draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Send className="h-5 w-5 text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Clock className="h-5 w-5 text-amber-600 mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <AlertCircle className="h-5 w-5 text-red-600 mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
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
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                  </div>
                </div>

                {(task.description) && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description.replace(/[#*`]/g, '')}
                  </p>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(task)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(task)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &ldquo;{task.title}&rdquo;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTask(task.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {task.description.substring(0, 60)}...
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(task)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(task)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &ldquo;{task.title}&rdquo;? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTask(task.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
              <h3 className="text-lg font-medium mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filter criteria, or create a new task.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Create New Task
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the task details below.
            </DialogDescription>
          </DialogHeader>
          <TaskForm 
            formData={formData}
            students={students}
            onFormDataChange={setFormData}
            onSelectAllStudents={selectAllStudents}
            onDeselectAllStudents={deselectAllStudents}
            onToggleStudentSelection={toggleStudentSelection}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTask}
              disabled={!formData.title || !formData.dueDate || formData.assignedStudentIds.length === 0 || isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                    {getStatusBadge(selectedTask.status)}
                    {getPriorityBadge(selectedTask.priority)}
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Description */}
                {selectedTask.description && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {selectedTask.description}
                      </div>
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

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button variant="outline" className="gap-2" onClick={() => openEditDialog(selectedTask)}>
                    <Edit className="h-4 w-4" /> Edit Task
                  </Button>
                  <Button className="gap-2">
                    <Eye className="h-4 w-4" /> View Submissions
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
