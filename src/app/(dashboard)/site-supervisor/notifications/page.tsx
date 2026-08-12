"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Users,
  User,
  Bell,
  Clock,
  CheckCircle2,
  CheckCheck,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Filter,
  Trash2,
  Eye,
  Copy,
  RefreshCw,
  Megaphone,
  AlertTriangle,
  Info,
  Calendar,
  FileText,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface AssignedStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  internshipTitle?: string;
}

interface NotificationRecord {
  id: string;
  title: string;
  content: string;
  recipientType: "individual" | "broadcast";
  recipientCount: number;
  recipients: string[];
  priority: "low" | "medium" | "high" | "urgent";
  sentAt: string;
  deliveryStatus: "sent" | "delivered" | "read" | "failed";
  readCount: number;
}

interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  icon: React.ReactNode;
}

export default function SiteSupervisorNotificationsPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"compose" | "sent" | "templates">("compose");
  
  // Compose state
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [recipientType, setRecipientType] = useState<"individual" | "broadcast">("individual");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationContent, setNotificationContent] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [isSending, setIsSending] = useState(false);
  
  // Sent notifications state
  const [sentNotifications, setSentNotifications] = useState<NotificationRecord[]>([]);
  const [isLoadingSent, setIsLoadingSent] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAssignedStudents();
    fetchSentNotifications();
  }, []);

  async function fetchAssignedStudents() {
    if (!user) return;

    try {
      const supabase = createClient();
      
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "site")
        .single();

      if (!supervisor) {
        // No supervisor record - keep empty state
        setStudents([]);
        return;
      }

      const { data: assignments } = await supabase
        .from("student_internships")
        .select(`
          student_id,
          student:students(id, full_name, email, avatar_url),
          internship:internships(title)
        `)
        .eq("site_supervisor_id", supervisor.id)
        .eq("status", "active");

      const studentList: AssignedStudent[] = (assignments || []).map((assign: any) => ({
        id: assign.student_id,
        studentId: assign.student?.id || assign.student_id,
        name: assign.student?.full_name || `Student ${assign.student_id.slice(0, 6)}`,
        email: assign.student?.email || "",
        avatarUrl: assign.student?.avatar_url,
        internshipTitle: assign.internship?.title,
      }));

      setStudents(studentList);
    } catch (error) {
      console.error("Error fetching students:", error);
      // Keep empty state on error
    }
  }

  // Note: Mock data removed - page shows empty state until real data is available
  // function setMockStudents() has been removed to prevent showing fake data
  // function setMockNotifications() has been removed to prevent showing fake data

  async function handleSendNotification() {
    if (!notificationTitle.trim() || !notificationContent.trim()) {
      alert("Please fill in both the subject and message.");
      return;
    }

    if (recipientType === "individual" && selectedStudentIds.length === 0) {
      alert("Please select at least one recipient.");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/site-supervisor/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType,
          studentIds: recipientType === "individual" ? selectedStudentIds : undefined,
          title: notificationTitle,
          content: notificationContent,
          priority,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Notification sent successfully to ${data.data.recipientCount} student(s)!`);
        
        // Reset form
        setNotificationTitle("");
        setNotificationContent("");
        setSelectedStudentIds([]);
        
        // Refresh sent list
        fetchSentNotifications();
        setActiveTab("sent");
      } else {
        const error = await response.json();
        alert(`Error: ${error.error?.message || "Failed to send notification"}`);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      alert("An error occurred while sending the notification.");
    } finally {
      setIsSending(false);
    }
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  }

  function selectAllStudents() {
    setSelectedStudentIds(students.map(s => s.id));
  }

  function clearSelection() {
    setSelectedStudentIds([]);
  }

  // Notification templates
  const templates: NotificationTemplate[] = [
    {
      id: "t1",
      name: "Weekly Log Reminder",
      subject: "Weekly Log Submission Reminder",
      content: "Hi {student_name},\n\nThis is a friendly reminder to submit your weekly log by Friday 5 PM. Please include:\n• Tasks completed during the week\n• Hours worked\n• Any challenges faced\n• Learnings and goals\n\nIf you have any questions, feel free to reach out.\n\nBest regards,\n{supervisor_name}",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: "t2",
      name: "Evaluation Notice",
      subject: "Upcoming Evaluation - Week {week_range}",
      content: "Hi {student_name},\n\nYour evaluation for Week {week_range} is scheduled for this week. Please ensure:\n✓ All weekly logs are submitted and approved\n✓ Your task list is up to date\n✓ You have documented your achievements\n\nThe evaluation will cover technical skills, professional conduct, and work quality.\n\nBest regards,\n{supervisor_name}",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      id: "t3",
      name: "Meeting Invitation",
      subject: "Meeting: {meeting_topic}",
      content: "Hi {student_name},\n\nYou are invited to attend:\n\n📅 Meeting: {meeting_topic}\n🕐 Time: {date_time}\n📍 Location: {location}\n\nAgenda:\n{agenda}\n\nPlease confirm your attendance.\n\nBest regards,\n{supervisor_name}",
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      id: "t4",
      name: "Performance Feedback",
      subject: "Feedback on Recent Work",
      content: "Hi {student_name},\n\nI wanted to share some feedback on your recent work:\n\n{feedback_points}\n\nOverall, you're doing {overall_assessment}. Keep up the good work!\n\nLet's discuss this further during our next 1-on-1.\n\nBest regards,\n{supervisor_name}",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: "t5",
      name: "Urgent Attention Required",
      subject: "URGENT: Action Required - {topic}",
      content: "Hi {student_name},\n\n⚠️ URGENT ATTENTION REQUIRED ⚠️\n\n{urgent_message}\n\nPlease address this as soon as possible. If you have any questions or concerns, contact me immediately.\n\nDeadline: {deadline}\n\nBest regards,\n{supervisor_name}",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  ];

  function applyTemplate(template: NotificationTemplate) {
    setNotificationTitle(template.subject);
    setNotificationContent(template.content);
    setActiveTab("compose");
  }

  function getPriorityBadge(priority: NotificationRecord["priority"]) {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">High</Badge>;
      case "medium":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Medium</Badge>;
      case "low":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Low</Badge>;
    }
  }

  function getDeliveryStatusIcon(status: NotificationRecord["deliveryStatus"]) {
    switch (status) {
      case "sent":
        return <Mail className="h-4 w-4 text-muted-foreground" />;
      case "delivered":
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case "read":
        return <CheckCheck className="h-4 w-4 text-green-600" />;
      case "failed":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  }

  const filteredNotifications = sentNotifications.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Send className="h-8 w-8" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Send messages and announcements to your assigned interns
          </p>
        </div>
        <Button onClick={() => setActiveTab("compose")}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Sent ({sentNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Compose Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Recipients
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant={recipientType === "individual" ? "default" : "outline"}
                      onClick={() => setRecipientType("individual")}
                      className="flex-1"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Individual Students
                    </Button>
                    <Button
                      variant={recipientType === "broadcast" ? "default" : "outline"}
                      onClick={() => setRecipientType("broadcast")}
                      className="flex-1"
                    >
                      <Megaphone className="h-4 w-4 mr-2" />
                      Broadcast to All
                    </Button>
                  </div>

                  {recipientType === "individual" && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label>
                          Selected: {selectedStudentIds.length} of {students.length}
                        </Label>
                        <div className="gap-2 flex">
                          <Button variant="ghost" size="sm" onClick={selectAllStudents}>
                            Select All
                          </Button>
                          <Button variant="ghost" size="sm" onClick={clearSelection}>
                            Clear
                          </Button>
                        </div>
                      </div>

                      <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 space-y-1">
                        {students.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No active students assigned
                          </p>
                        ) : (
                          students.map((student) => (
                            <label
                              key={student.id}
                              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                selectedStudentIds.includes(student.id)
                                  ? "bg-primary/10 border border-primary/20"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(student.id)}
                                onChange={() => toggleStudentSelection(student.id)}
                                className="rounded"
                              />
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={student.avatarUrl || undefined} alt={student.name} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{student.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {recipientType === "broadcast" && (
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Megaphone className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800">Broadcast Mode</p>
                          <p className="text-sm text-blue-700 mt-1">
                            This message will be sent to all {students.length} assigned students.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Message Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Message Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="Enter notification subject..."
                      value={notificationTitle}
                      onChange={(e) => setNotificationTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Message *</Label>
                    <Textarea
                      id="content"
                      placeholder="Write your message here... (Markdown supported)"
                      value={notificationContent}
                      onChange={(e) => setNotificationContent(e.target.value)}
                      rows={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tip: Use {"{student_name}"} to personalize with each student's name
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Priority Level</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-gray-500" /> Low Priority
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500" /> Medium Priority
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-orange-500" /> High Priority
                          </div>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> Urgent
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Send Button */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNotificationTitle("");
                    setNotificationContent("");
                    setSelectedStudentIds([]);
                  }}
                >
                  Clear Form
                </Button>
                <Button
                  size="lg"
                  onClick={handleSendNotification}
                  disabled={
                    isSending ||
                    !notificationTitle.trim() ||
                    !notificationContent.trim() ||
                    (recipientType === "individual" && selectedStudentIds.length === 0)
                  }
                  className="min-w-[160px]"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Notification
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Students</span>
                    <span className="font-semibold">{students.length}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Selected Recipients</span>
                    <span className="font-semibold">
                      {recipientType === "broadcast" 
                        ? `${students.length} (All)` 
                        : selectedStudentIds.length
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Messages Sent Today</span>
                    <span className="font-semibold">
                      {sentNotifications.filter(n => {
                        const today = new Date().toDateString();
                        return new Date(n.sentAt).toDateString() === today;
                      }).length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Templates */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Quick Templates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {templates.slice(0, 3).map((template) => (
                    <Button
                      key={template.id}
                      variant="outline"
                      className="w-full justify-start h-auto py-3"
                      onClick={() => applyTemplate(template)}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 rounded bg-muted">{template.icon}</div>
                        <div>
                          <p className="font-medium text-sm">{template.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {template.subject}
                          </p>
                        </div>
                      </div>
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setActiveTab("templates")}
                  >
                    View All Templates
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Sent Tab */}
        <TabsContent value="sent" className="space-y-6 mt-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Notifications List */}
          {isLoadingSent ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-3 text-muted-foreground">Loading notifications...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Notifications Found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery 
                    ? "Try adjusting your search query."
                    : "You haven't sent any notifications yet."
                  }
                </p>
                {!searchQuery && (
                  <Button className="mt-4" onClick={() => setActiveTab("compose")}>
                    Send Your First Notification
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-2">
                            <div className={`p-2 rounded-lg shrink-0 ${
                              notification.priority === "urgent" ? "bg-red-100" :
                              notification.priority === "high" ? "bg-orange-100" :
                              notification.priority === "medium" ? "bg-blue-100" :
                              "bg-gray-100"
                            }`}>
                              <Bell className={`h-4 w-4 ${
                                notification.priority === "urgent" ? "text-red-600" :
                                notification.priority === "high" ? "text-orange-600" :
                                notification.priority === "medium" ? "text-blue-600" :
                                "text-gray-600"
                              }`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold truncate">{notification.title}</h3>
                                {getPriorityBadge(notification.priority)}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {notification.content}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 ml-11 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {notification.recipientType === "broadcast" 
                                ? `${notification.recipientCount} students`
                                : `${notification.recipientCount} student`
                              }
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(notification.sentAt).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              {getDeliveryStatusIcon(notification.deliveryStatus)}
                              {notification.deliveryStatus}
                              {notification.deliveryStatus === "read" && (
                                <span>({notification.readCount}/{notification.recipientCount} read)</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * templates.indexOf(template) }}
              >
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {template.icon}
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription className="line-clamp-1">
                            {template.subject}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {template.content}
                    </p>
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => applyTemplate(template)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Custom Template Info */}
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Info className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-2">Create Custom Templates</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                You can save frequently used messages as templates for quick access.
                Custom template management coming soon!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
