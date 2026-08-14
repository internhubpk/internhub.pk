"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
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
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
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
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

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
  const { toast } = useToast();
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

        // Fetch supervised students. faculty_supervisor_id references
        // profiles.user_id; student_internships has no FK to `students`,
        // so we join profiles via student_user_id. We also fetch the
        // `students` rows separately for program_id → program name.
        const { data: studentData } = await supabase
          .from("student_internships")
          .select(`
            student_user_id,
            status,
            student_profile:student_user_id(full_name, email, avatar_url)
          `)
          .eq("faculty_supervisor_id", user.id)
          .in("status", ["active"]); // student_internship_status has no "in_progress"

        const studentUserIds = Array.from(
          new Set((studentData || []).map((s: any) => s.student_user_id))
        );

        let programMap: Record<string, string> = {};
        if (studentUserIds.length > 0) {
          const { data: records } = await supabase
            .from("students")
            .select("user_id, program_id")
            .in("user_id", studentUserIds);
          const programIds = Array.from(
            new Set((records || []).map((r: any) => r.program_id).filter(Boolean))
          );
          if (programIds.length > 0) {
            const { data: programs } = await supabase
              .from("programs")
              .select("id, name")
              .in("id", programIds);
            (programs || []).forEach((p: any) => {
              programMap[p.id] = p.name;
            });
          }
        }

        const studentList: StudentOption[] = (studentData || []).map((s: any) => ({
          id: s.student_user_id,
          name: s.student_profile?.full_name || `Student ${s.student_user_id?.slice(0, 6)}`,
          email: s.student_profile?.email || "",
          program: "", // populated below if we have a program lookup
          avatarUrl: s.student_profile?.avatar_url,
        }));

        // Populate program names per student if we have them.
        if (studentUserIds.length > 0) {
          const { data: records } = await supabase
            .from("students")
            .select("user_id, program_id")
            .in("user_id", studentUserIds);
          const recByUser = new Map<string, any>();
          (records || []).forEach((r: any) => recByUser.set(r.user_id, r));
          studentList.forEach((s) => {
            const rec = recByUser.get(s.id);
            if (rec?.program_id) s.program = programMap[rec.program_id] || "Unknown Program";
          });
        }

        setStudents(studentList);

        // Group students by program for program selector
        const programMapCount = new Map<string, number>();
        studentList.forEach(s => {
          if (s.program) {
            programMapCount.set(s.program, (programMapCount.get(s.program) || 0) + 1);
          }
        });
        const programList = Array.from(programMapCount.entries()).map(([name, count], idx) => ({
          id: `p${idx}`,
          name,
          studentCount: count,
        }));
        setPrograms(programList);

        // Fetch notifications sent by this supervisor.
        const { data: notificationData } = await supabase
          .from("notifications")
          .select(`
            id,
            title,
            message,
            category,
            priority,
            is_read,
            action_url,
            metadata,
            created_at,
            user_id
          `)
          .eq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        const recipientNameById = new Map<string, string>();
        studentList.forEach(s => recipientNameById.set(s.id, s.name));

        const notificationList: Notification[] = (notificationData || []).map((n: any) => {
          const meta = (n.metadata && typeof n.metadata === "object") ? n.metadata : {};
          const target = (meta.target as NotificationTarget) || "all";
          const recipientCount = (meta.recipient_count as number) || 1;
          const readCount = n.is_read ? 1 : 0;
          return {
            id: n.id,
            title: n.title,
            message: n.message,
            priority: (n.priority as NotificationPriority) || "medium",
            target,
            targetName: target === "all"
              ? "All Students"
              : target === "individual"
              ? recipientNameById.get(n.user_id) || "Student"
              : "Program",
            recipientCount,
            readCount,
            status: n.is_read ? "read" : "sent",
            sentAt: n.created_at,
            createdAt: n.created_at,
            senderName: "You",
          };
        });
        setNotifications(notificationList);
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
    if (!user) return;
    setIsSending(true);

    try {
      const supabase = createClient();

      // Determine recipients based on the compose form.
      let recipientIds: string[] = [];
      if (composeForm.target === "all") {
        recipientIds = students.map(s => s.id);
      } else if (composeForm.target === "individual") {
        if (composeForm.selectedStudentId) {
          recipientIds = [composeForm.selectedStudentId];
        }
      } else if (composeForm.target === "program") {
        // Programs use index IDs (p0, p1, ...) created client-side; map back
        // to the program name and then look up students in that program.
        const selectedProgram = programs.find(p => p.id === composeForm.selectedProgramId);
        if (selectedProgram) {
          recipientIds = students.filter(s => s.program === selectedProgram.name).map(s => s.id);
        }
      }

      if (recipientIds.length === 0) {
        toast({ title: "Action required", description: "Please select at least one recipient.", variant: "destructive" });
        setIsSending(false);
        return;
      }

      // notification_priority enum is low/medium/high/urgent.
      const priority = composeForm.priority;
      // notification_category enum has no "faculty"; use "announcement".
      const category = "announcement";

      // Insert one notifications row per recipient. notifications.user_id is
      // NOT NULL and references the recipient.
      const rows = recipientIds.map((rid) => ({
        user_id: rid,
        sender_id: user.id,
        title: composeForm.title,
        message: composeForm.message,
        category,
        priority,
        is_read: false,
        metadata: {
          target: composeForm.target,
          recipient_count: recipientIds.length,
        },
      }));

      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;

      // Add a local notification row so the UI updates immediately.
      const targetName = composeForm.target === "all"
        ? "All Students"
        : composeForm.target === "individual"
        ? students.find(s => s.id === composeForm.selectedStudentId)?.name || "Student"
        : programs.find(p => p.id === composeForm.selectedProgramId)?.name || "Program";
      const newNotification: Notification = {
        id: `n${Date.now()}`,
        title: composeForm.title,
        message: composeForm.message,
        priority: composeForm.priority,
        target: composeForm.target,
        targetName,
        recipientCount: recipientIds.length,
        readCount: 0,
        status: "sent",
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        senderName: "You",
      };

      setNotifications(prev => [newNotification, ...prev]);
      setIsComposeDialogOpen(false);
      resetComposeForm();
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({ title: "Failed", description: "Failed to send notification. Please try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
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
        title="Notifications"
        description="Send announcements and track communication with students"
        actions={
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
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Sent" value={stats.total} icon={Bell} variant="default" />
        <StatCard label="Sent Today" value={stats.sentToday} icon={Send} variant="info" />
        <StatCard label="Delivered" value={stats.delivered} icon={BellRing} variant="warning" />
        <StatCard label="Read" value={stats.read} icon={CheckCircle2} variant="success" />
        <StatCard label="Total Recipients" value={stats.totalRecipients} icon={Users} variant="default" />
        <StatCard
          label="Read Rate"
          value={stats.totalRecipients > 0 ? Math.round((stats.totalReads / stats.totalRecipients) * 100) : 0}
          icon={Eye}
          variant="info"
        />
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
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <MarkdownRenderer content={selectedNotification.message} />
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (!selectedNotification) return;
                      // Pre-fill the compose form with this notification's
                      // content so the user can quickly send a similar one.
                      setComposeForm({
                        title: selectedNotification.title,
                        message: selectedNotification.message,
                        priority: selectedNotification.priority,
                        target: "all",
                        selectedStudentId: "",
                        selectedProgramId: "",
                      });
                      setIsViewDialogOpen(false);
                      setIsComposeDialogOpen(true);
                    }}
                  >
                    <Copy className="h-4 w-4" /> Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (!selectedNotification) return;
                      setComposeForm({
                        title: selectedNotification.title,
                        message: selectedNotification.message,
                        priority: selectedNotification.priority,
                        target: "all",
                        selectedStudentId: "",
                        selectedProgramId: "",
                      });
                      setIsViewDialogOpen(false);
                      setIsComposeDialogOpen(true);
                    }}
                  >
                    <Forward className="h-4 w-4" /> Resend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.print()}
                  >
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
