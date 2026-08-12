"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Send,
  Plus,
  Search,
  Filter,
  Bell,
  BellRing,
  Mail,
  MessageSquare,
  Users,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Trash2,
  MoreVertical,
  Loader2,
  Reply,
  Forward,
  Copy,
  RefreshCw,
  GraduationCap,
  Building2,
  Printer,
} from "lucide-react";

// Types
type NotificationPriority = "low" | "medium" | "high" | "urgent";
type NotificationTarget = "individual" | "program" | "department" | "all";
type NotificationStatus = "sent" | "delivered" | "read" | "failed";

interface StudentOption {
  id: string;
  name: string;
  email: string;
  program: string;
  avatarUrl?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  target: NotificationTarget;
  targetName: string; // Display name for who it was sent to
  recipientCount: number;
  readCount: number;
  status: NotificationStatus;
  sentAt: string;
  deliveredAt?: string;
  createdAt: string;
  senderName: string;
}

// Default empty data - will be populated from database
const DEFAULT_STUDENTS: StudentOption[] = [];
const DEFAULT_PROGRAMS: { id: string; name: string; studentCount: number }[] = [];
const DEFAULT_NOTIFICATIONS: Notification[] = [];

export default function FacultySupervisorNotificationsPage() {
  const { user } = useAuth();
  // State
  const [notifications, setNotifications] = useState<Notification[]>(DEFAULT_NOTIFICATIONS);
  const [students, setStudents] = useState<StudentOption[]>(DEFAULT_STUDENTS);
  const [programs, setPrograms] = useState(DEFAULT_PROGRAMS);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  // Dialog states
  const [isComposeDialogOpen, setIsComposeDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  
  // Compose form state
  const [composeForm, setComposeForm] = useState({
    title: "",
    message: "",
    priority: "medium" as NotificationPriority,
    target: "all" as NotificationTarget,
    selectedStudentId: "",
    selectedProgramId: "",
  });
  const [isSending, setIsSending] = useState(false);

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
            student:students(id, full_name, email, program:programs(name))
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

        // Group students by program for program selector
        const programMap = new Map<string, number>();
        studentList.forEach(s => {
          programMap.set(s.program, (programMap.get(s.program) || 0) + 1);
        });
        const programList = Array.from(programMap.entries()).map(([name, count], idx) => ({
          id: `p${idx}`,
          name,
          studentCount: count,
        }));
        setPrograms(programList);

        // Fetch notifications (when API is ready)
        // const { data: notificationData } = await supabase
        //   .from("notifications")
        //   .select("*")
        //   .eq("sender_id", supervisor.id)
        //   .order("created_at", { ascending: false });
        
        // setNotifications(notificationData || []);
      } catch (error) {
        console.error("Error fetching notification data:", error);
        // Keep empty state on error
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [user]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesSearch =
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.targetName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || notification.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || notification.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [notifications, searchTerm, statusFilter, priorityFilter]);

  // Stats
  const stats = {
    total: notifications.length,
    sentToday: notifications.filter(n => {
      const today = new Date().toDateString();
      return new Date(n.sentAt).toDateString() === today;
    }).length,
    delivered: notifications.filter(n => n.status === "delivered").length,
    read: notifications.filter(n => n.status === "read").length,
    totalRecipients: notifications.reduce((acc, n) => acc + n.recipientCount, 0),
    totalReads: notifications.reduce((acc, n) => acc + n.readCount, 0),
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case "urgent":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold animate-pulse">
            <AlertCircle className="mr-1 h-3 w-3" /> Urgent
          </Badge>
        );
      case "high":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">High</Badge>;
      case "medium":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: NotificationStatus) => {
    switch (status) {
      case "sent":
        return <Badge variant="secondary"><Send className="mr-1 h-3 w-3" /> Sent</Badge>;
      case "delivered":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          <Bell className="mr-1 h-3 w-3" /> Delivered
        </Badge>;
      case "read":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Read
        </Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTargetIcon = (target: NotificationTarget) => {
    switch (target) {
      case "individual": return <UserCheck className="h-4 w-4" />;
      case "program": return <GraduationCap className="h-4 w-4" />;
      case "department": return <Building2 className="h-4 w-4" />;
      case "all": return <Users className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getReadRate = (notification: Notification) => {
    return notification.recipientCount > 0
      ? Math.round((notification.readCount / notification.recipientCount) * 100)
      : 0;
  };

  const getStudentInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const resetComposeForm = () => {
    setComposeForm({
      title: "",
      message: "",
      priority: "medium",
      target: "all",
      selectedStudentId: "",
      selectedProgramId: "",
    });
  };

  const handleSendNotification = async () => {
    setIsSending(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newNotification: Notification = {
      id: `n${Date.now()}`,
      title: composeForm.title,
      message: composeForm.message,
      priority: composeForm.priority,
      target: composeForm.target,
      targetName: composeForm.target === "all"
        ? "All Students"
        : composeForm.target === "individual"
        ? students.find(s => s.id === composeForm.selectedStudentId)?.name || "Student"
        : programs.find(p => p.id === composeForm.selectedProgramId)?.name || "Program",
      recipientCount: composeForm.target === "all"
        ? students.length
        : composeForm.target === "individual"
        ? 1
        : programs.find(p => p.id === composeForm.selectedProgramId)?.studentCount || 0,
      readCount: 0,
      status: "sent",
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      senderName: "Dr. Smith (You)",
    };

    setNotifications(prev => [newNotification, ...prev]);
    setIsComposeDialogOpen(false);
    resetComposeForm();
    setIsSending(false);
  };

  const openViewDialog = (notification: Notification) => {
    setSelectedNotification(notification);
    setIsViewDialogOpen(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Loading notifications...</p>
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
            <p className="text-muted-foreground">Loading notification data...</p>
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Send announcements and track communication with students
          </p>
        </div>
        <Dialog open={isComposeDialogOpen} onOpenChange={setIsComposeDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={resetComposeForm}>
              <Plus className="h-4 w-4" /> New Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compose Notification</DialogTitle>
              <DialogDescription>
                Send a notification to students in your supervised programs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter notification title..."
                  value={composeForm.title}
                  onChange={(e) => setComposeForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Priority & Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select 
                    value={composeForm.priority} 
                    onValueChange={(value) => setComposeForm(prev => ({ ...prev, priority: value as NotificationPriority }))}
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
                  <Label htmlFor="target">Send To</Label>
                  <Select 
                    value={composeForm.target} 
                    onValueChange={(value) => setComposeForm(prev => ({ ...prev, target: value as NotificationTarget }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      <SelectItem value="program">Specific Program</SelectItem>
                      <SelectItem value="individual">Individual Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Target Selection */}
              {composeForm.target === "individual" && (
                <div className="space-y-2">
                  <Label>Select Student</Label>
                  <Select 
                    value={composeForm.selectedStudentId} 
                    onValueChange={(value) => setComposeForm(prev => ({ ...prev, selectedStudentId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.length === 0 ? (
                        <SelectItem value="_none" disabled>No students available</SelectItem>
                      ) : (
                        students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.program})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {composeForm.target === "program" && (
                <div className="space-y-2">
                  <Label>Select Program</Label>
                  <Select 
                    value={composeForm.selectedProgramId} 
                    onValueChange={(value) => setComposeForm(prev => ({ ...prev, selectedProgramId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.length === 0 ? (
                        <SelectItem value="_none" disabled>No programs available</SelectItem>
                      ) : (
                        programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name} ({program.studentCount} students)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Type your notification message..."
                  value={composeForm.message}
                  onChange={(e) => setComposeForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be sent to students via email and in-app notification.
                </p>
              </div>

              {/* Preview */}
              {(composeForm.title || composeForm.message) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(composeForm.priority)}
                      <span className="font-semibold">{composeForm.title || "Untitled"}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {composeForm.message || "No content..."}
                    </p>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      To: {composeForm.target === "all" 
                        ? "All Students" 
                        : composeForm.target === "individual"
                        ? students.find(s => s.id === composeForm.selectedStudentId)?.name || "Selected Student"
                        : programs.find(p => p.id === composeForm.selectedProgramId)?.name || "Selected Program"}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsComposeDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSendNotification}
                disabled={!composeForm.title || !composeForm.message || isSending}
              >
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Send Notification
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Bell className="h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Send className="h-5 w-5 text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{stats.sentToday}</p>
            <p className="text-xs text-muted-foreground">Sent Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <BellRing className="h-5 w-5 text-amber-600 mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.delivered}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.read}</p>
            <p className="text-xs text-muted-foreground">Read</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="h-5 w-5 text-purple-600 mb-1" />
            <p className="text-2xl font-bold text-purple-600">{stats.totalRecipients}</p>
            <p className="text-xs text-muted-foreground">Total Recipients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Eye className="h-5 w-5 text-teal-600 mb-1" />
            <p className="text-2xl font-bold text-teal-600">
              {stats.totalRecipients > 0 ? Math.round((stats.totalReads / stats.totalRecipients) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Read Rate</p>
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
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
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

      {/* Notifications List/Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-4">
          {filteredNotifications.map((notification) => (
            <Card key={notification.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openViewDialog(notification)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      notification.priority === "urgent" ? "bg-red-100" :
                      notification.priority === "high" ? "bg-orange-100" :
                      notification.priority === "medium" ? "bg-blue-100" : "bg-gray-100"
                    }`}>
                      {getTargetIcon(notification.target)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getPriorityBadge(notification.priority)}
                  {getStatusBadge(notification.status)}
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                  <span>To: {notification.targetName}</span>
                  <span>{formatRelativeTime(notification.sentAt)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    <span>{notification.readCount}/{notification.recipientCount} read ({getReadRate(notification)}%)</span>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1">
                    View Details
                  </Button>
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
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Sent To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Read Rate</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.map((notification) => (
                  <TableRow key={notification.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => openViewDialog(notification)}>
                      <div className="max-w-[300px]">
                        <p className="font-medium truncate">{notification.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {notification.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(notification.priority)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTargetIcon(notification.target)}
                        <span className="text-sm max-w-[120px] truncate">{notification.targetName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(notification.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              getReadRate(notification) >= 80 ? 'bg-emerald-500' :
                              getReadRate(notification) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${getReadRate(notification)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {getReadRate(notification)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(notification.sentAt)}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openViewDialog(notification)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {filteredNotifications.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No notifications found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or send a new notification.
              </p>
              <Button onClick={() => setIsComposeDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Compose Notification
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* View Notification Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedNotification && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle>{selectedNotification.title}</DialogTitle>
                    <DialogDescription className="mt-1">
                      Sent by {selectedNotification.senderName}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {getPriorityBadge(selectedNotification.priority)}
                    {getStatusBadge(selectedNotification.status)}
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Message Content */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Message Content</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap p-4 bg-muted/30 rounded-lg">
                      {selectedNotification.message}
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{selectedNotification.recipientCount}</p>
                      <p className="text-xs text-muted-foreground">Recipients</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Eye className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                      <p className="text-xl font-bold text-emerald-600">{selectedNotification.readCount}</p>
                      <p className="text-xs text-muted-foreground">Read</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Clock className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                      <p className="text-sm font-medium text-blue-600">
                        {formatDate(selectedNotification.sentAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">Sent At</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-primary" />
                      <p className="text-xl font-bold text-primary">{getReadRate(selectedNotification)}%</p>
                      <p className="text-xs text-muted-foreground">Read Rate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Target Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {getTargetIcon(selectedNotification.target)}
                      Target Audience
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <Badge variant="outline" className="capitalize">
                        {selectedNotification.target.replace("_", " ")}
                      </Badge>
                      <span className="font-medium">{selectedNotification.targetName}</span>
                      <span className="text-muted-foreground">
                        ({selectedNotification.recipientCount} student{selectedNotification.recipientCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Copy className="h-4 w-4" /> Duplicate
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Forward className="h-4 w-4" /> Resend
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Missing Printer icon import - using lucide-react
// (Printer is now imported in the main import block above)
