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
import { PageHeader } from "@/components/dashboard/page-header";

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

  async function fetchSentNotifications() {
    try {
      setIsLoadingSent(true);
      const res = await fetch("/api/site-supervisor/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      // API may return either { data: [...] } or [...] — handle both.
      const list: NotificationRecord[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
            ? json.items
            : [];
      setSentNotifications(list);
    } catch {
      // Non-fatal — leave the list empty.
    } finally {
      setIsLoadingSent(false);
    }
  }

  async function fetchAssignedStudents() {
    if (!user) return;

    try {
      const supabase = createClient();

      // student_internships.site_supervisor_id is FK to profiles.user_id —
      // filter by the auth user's id (the supervisor's user_id), NOT the
      // supervisors table PK. RLS uses auth.uid() the same way.
      const supervisorUserId = user.id;

      const { data: assignments } = await supabase
        .from("student_internships")
        .select(`
          student_user_id,
          internship_id,
          student_profile:student_user_id(
            full_name,
            first_name,
            last_name,
            email,
            avatar_url
          ),
          internship:internships(title)
        `)
        .eq("site_supervisor_id", supervisorUserId)
        .in("status", ["active", "assigned"]);

      const studentList: AssignedStudent[] = (assignments || []).map((assign: any) => {
        const p = assign.student_profile || {};
        const studentUser = assign.student_user_id as string | undefined;
        const fullName =
          p.full_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          (p.email ? p.email.split("@")[0] : "Unknown Student");
        return {
          id: studentUser || "",
          studentId: studentUser || "",
          name: fullName,
          email: p.email || "",
          avatarUrl: p.avatar_url ?? null,
          internshipTitle: assign.internship?.title,
        };
      }).filter((s: AssignedStudent) => Boolean(s.id));

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
    // Auto-substitute the template's placeholder tokens with real values:
    //   {student_name}  → for multi-recipient notifications, "there" (a
    //                     safe greeting that works for any recipient); for
    //                     single-recipient, the selected student's name.
    //   {supervisor_name} → the site supervisor's own name (from profile).
    //
    // Other tokens ({week_range}, {meeting_topic}, {feedback_points}, etc.)
    // are left as-is — the supervisor fills them in manually before sending.
    const supervisorName =
      (profile?.full_name?.trim()) ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      profile?.email ||
      "Your Supervisor";

    let studentName = "there";
    if (selectedStudentIds.length === 1) {
      const sel = students.find(s => s.id === selectedStudentIds[0]);
      if (sel) studentName = sel.name.split(" ")[0] || sel.name;
    }

    const replaceTokens = (s: string) =>
      s
        .replaceAll("{student_name}", studentName)
        .replaceAll("{supervisor_name}", supervisorName);

    setNotificationTitle(replaceTokens(template.subject));
    setNotificationContent(replaceTokens(template.content));
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
      <PageHeader
        title="Notifications"
        description="Send messages and announcements to your assigned interns"
        actions={
          <Button onClick={() => setActiveTab("compose")}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        }
      />

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
            <div className="py-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
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

          {/* Custom Template Info — honest empty state instead of "coming soon" */}
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Info className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-2">Custom Templates</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Custom template management is not yet available. The five
                starter templates above cover the most common notifications.
                Use any of them as a starting point and edit the message
                before sending.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
