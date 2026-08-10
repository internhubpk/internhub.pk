"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  FileText,
  BarChart3,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  MessageSquare,
  User,
  Building2,
  TrendingUp,
  Target,
  Zap,
  ArrowRight,
  ChevronRight,
  Play,
  Star,
  Trophy,
  Sparkles,
  Timer,
  ClipboardCheck,
  BookOpen,
  Send,
  CalendarCheck,
  FileUp,
  MessageCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ============ ANIMATION VARIANTS ============
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

// ============ TYPES ============
interface StatCard {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  actionLabel: string;
  actionHref: string;
  color: string;
  bgColor: string;
}

interface DeadlineItem {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  dueText: string;
  urgency: "critical" | "high" | "medium" | "low";
  actionLabel: string;
  actionHref: string;
}

interface ActivityItem {
  id: string;
  type: "log" | "feedback" | "attendance" | "badge" | "document" | "message" | "evaluation";
  message: string;
  timeAgo: string;
  dateGroup: string;
  icon: React.ReactNode;
  iconColor: string;
}

interface WeekProgress {
  weeks: number;
  label: string;
  status: "completed" | "current" | "upcoming" | "future";
}

// ============ MOCK DATA ============
// In production, this would come from API/context

const studentData = {
  name: "Ahmed Al-Rashid",
  email: "ahmed.alrashid@university.edu",
  avatar: null, // Would be actual image URL
  initials: "AR",
  company: "TechCorp Inc.",
  role: "Software Development Intern",
  progress: 65,
  currentWeek: 8,
  totalWeeks: 12,
  remainingWeeks: 5,
  startDate: "June 3, 2024",
  endDate: "August 23, 2024",
};

const statsCards: StatCard[] = [
  {
    id: "week",
    title: "Current Week",
    value: `Week ${studentData.currentWeek}/${studentData.totalWeeks}`,
    subtitle: "Active Internship Period",
    icon: <CalendarDays className="h-5 w-5" />,
    actionLabel: "Log Now",
    actionHref: "/student/weekly-logs",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "logs",
    title: "Logs Pending",
    value: "2 Tasks",
    subtitle: "Weekly logs to submit",
    icon: <FileText className="h-5 w-5" />,
    actionLabel: "Complete",
    actionHref: "/student/weekly-logs",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    id: "attendance",
    title: "Attendance",
    value: "92% On Time",
    subtitle: "Excellent punctuality!",
    icon: <BarChart3 className="h-5 w-5" />,
    actionLabel: "View",
    actionHref: "/student/attendance",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  {
    id: "certificate",
    title: "Certificate",
    value: "Ready in 4wks",
    subtitle: "Upon completion",
    icon: <Award className="h-5 w-5" />,
    actionLabel: "Track",
    actionHref: "/student/certificates",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
];

const deadlines: DeadlineItem[] = [
  {
    id: "weekly-log",
    title: "Weekly Log - Week 8",
    description: "Submit your weekly activities and learnings",
    dueDate: "2024-07-20T23:59:00",
    dueText: "Tomorrow, 11:59 PM",
    urgency: "critical",
    actionLabel: "Submit Now",
    actionHref: "/student/weekly-logs",
  },
  {
    id: "midterm-eval",
    title: "Mid-term Evaluation Form",
    description: "Complete self-assessment for mid-term review",
    dueDate: "2024-07-25T23:59:00",
    dueText: "In 5 days",
    urgency: "high",
    actionLabel: "Prepare",
    actionHref: "/student/internships",
  },
  {
    id: "attendance-report",
    title: "Attendance Report - July",
    description: "Review and confirm monthly attendance",
    dueDate: "2024-08-01T23:59:00",
    dueText: "In 2 weeks",
    urgency: "medium",
    actionLabel: "View Template",
    actionHref: "/student/attendance",
  },
  {
    id: "supervisor-meeting",
    title: "Supervisor Meeting #6",
    description: "Bi-weekly check-in with your supervisor",
    dueDate: "2024-07-25T14:00:00",
    dueText: "Jul 25, 2:00 PM",
    urgency: "low",
    actionLabel: "Join Meeting",
    actionHref: "#",
  },
];

const weekProgress: WeekProgress[] = [
  { weeks: 3, label: "Week 1-3", status: "completed" },
  { weeks: 6, label: "Week 4-6", status: "completed" },
  { weeks: 8, label: "Week 7-8", status: "current" },
  { weeks: 10, label: "Week 9-10", status: "upcoming" },
  { weeks: 12, label: "Week 11-12", status: "future" },
];

const recentActivities: ActivityItem[] = [
  {
    id: "1",
    type: "log",
    message: 'Submitted weekly log for Week 7',
    timeAgo: "2 hours ago",
    dateGroup: "Today",
    icon: <ClipboardCheck className="h-4 w-4" />,
    iconColor: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30",
  },
  {
    id: "2",
    type: "feedback",
    message: 'Received feedback from Dr. Sarah on your project proposal',
    timeAgo: "5 hours ago",
    dateGroup: "Today",
    icon: <MessageCircle className="h-4 w-4" />,
    iconColor: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "3",
    type: "attendance",
    message: 'Attendance marked present at TechCorp',
    timeAgo: "Yesterday",
    dateGroup: "Yesterday",
    icon: <CalendarCheck className="h-4 w-4" />,
    iconColor: "text-green-500 bg-green-100 dark:bg-green-900/30",
  },
  {
    id: "4",
    type: "badge",
    message: 'Badge earned: "Consistent Performer"',
    timeAgo: "Yesterday",
    dateGroup: "Yesterday",
    icon: <Trophy className="h-4 w-4" />,
    iconColor: "text-amber-500 bg-amber-100 dark:bg-amber-900/30",
  },
  {
    id: "5",
    type: "document",
    message: 'Uploaded offer letter to documents',
    timeAgo: "3 days ago",
    dateGroup: "3 days ago",
    icon: <FileUp className="h-4 w-4" />,
    iconColor: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
  },
];

const quickActions = [
  {
    id: "new-log",
    label: "New Log",
    icon: <FileText className="h-4 w-4" />,
    href: "/student/weekly-logs",
    color: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  {
    id: "upload-doc",
    label: "Upload Doc",
    icon: <Upload className="h-4 w-4" />,
    href: "/student/documents",
    color: "bg-emerald-500 hover:bg-emerald-600 text-white",
  },
  {
    id: "message",
    label: "Message",
    icon: <MessageSquare className="h-4 w-4" />,
    href: "#",
    color: "bg-purple-500 hover:bg-purple-600 text-white",
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: <CalendarCheck className="h-4 w-4" />,
    href: "/student/attendance",
    color: "bg-orange-500 hover:bg-orange-600 text-white",
  },
];

// ============ HELPER FUNCTIONS ============
function getEncouragingMessage(progress: number): string {
  if (progress >= 80) return "You're in the final stretch! Finish strong! 🎯";
  if (progress >= 60) return "More than halfway there! Keep pushing forward! 💪";
  if (progress >= 40) return "Great momentum! You're making solid progress! 🚀";
  if (progress >= 20) return "Good start! Every step counts toward your goal! 🌱";
  return "Your journey has begun! Make it count! ✨";
}

function getUrgencyConfig(urgency: DeadlineItem["urgency"]) {
  switch (urgency) {
    case "critical":
      return {
        dotClass: "bg-red-500",
        badgeVariant: "destructive" as const,
        badgeLabel: "Urgent",
      };
    case "high":
      return {
        dotClass: "bg-amber-500",
        badgeVariant: "secondary" as const,
        badgeLabel: "Due Soon",
      };
    case "medium":
      return {
        dotClass: "bg-green-500",
        badgeVariant: "outline" as const,
        badgeLabel: "Upcoming",
      };
    case "low":
      return {
        dotClass: "bg-blue-500",
        badgeVariant: "outline" as const,
        badgeLabel: "Scheduled",
      };
  }
}

function getWeekStatusIcon(status: WeekProgress["status"]) {
  switch (status) {
    case "completed":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
      );
    case "current":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary ring-4 ring-primary/20">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </div>
      );
    case "upcoming":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-muted-foreground/30">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
        </div>
      );
    case "future":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-muted-foreground/20">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        </div>
      );
  }
}

// ============ SUB-COMPONENTS ============

// Welcome Banner Component
function WelcomeBanner() {
  const encouragingMsg = getEncouragingMessage(studentData.progress);

  return (
    <motion.div
      variants={itemVariants}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 md:p-8 text-white shadow-xl shadow-primary/20"
    >
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
      
      <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Avatar */}
        <Avatar className="h-16 w-16 md:h-20 md:w-20 ring-4 ring-white/20">
          <AvatarImage src={studentData.avatar || undefined} alt={studentData.name} />
          <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
            {studentData.initials}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-300" />
            <h1 className="text-2xl md:text-3xl font-bold">
              Welcome back, {studentData.name.split(" ")[0]}!
            </h1>
          </div>
          
          <p className="text-lg text-white/90 max-w-2xl">
            Your internship at{" "}
            <span className="font-semibold text-white">{studentData.company}</span>{" "}
            is <span className="font-bold">{studentData.progress}%</span> complete.{" "}
            {encouragingMsg}
          </p>

          {/* Progress Bar */}
          <div className="flex items-center gap-4 max-w-md">
            <Progress 
              value={studentData.progress} 
              className="flex-1 h-3 bg-white/20"
            />
            <span className="text-sm font-medium text-white/90 whitespace-nowrap">
              {studentData.remainingWeeks} weeks left
            </span>
          </div>
        </div>

        {/* Action Button */}
        <Button
          variant="secondary"
          size="lg"
          className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm shrink-0"
          asChild
        >
          <a href="/student/internships" className="gap-2">
            View Full Progress
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </motion.div>
  );
}

// Stat Card Component
function StatCardComponent({ stat }: { stat: StatCard }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${stat.bgColor} ${stat.color}`}>
              {stat.icon}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
              asChild
            >
              <a href={stat.actionHref}>
                {stat.actionLabel}
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </Button>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{stat.title}</p>
            <p className="text-xl font-bold tracking-tight">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-between group/btn h-auto py-2"
            asChild
          >
            <a href={stat.actionHref}>
              <span>{stat.actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Internship Progress Component
function InternshipProgress() {
  return (
    <motion.div variants={itemVariants}>
      <Card className="h-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Internship Progress
            </CardTitle>
            <Badge variant="secondary" className="gap-1.5">
              <Building2 className="h-3 w-3" />
              {studentData.company}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Main Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Completion</span>
              <span className="text-primary font-bold">{studentData.progress}%</span>
            </div>
            <Progress value={studentData.progress} className="h-3" />
          </div>

          {/* Timeline */}
          <div className="space-y-1">
            {weekProgress.map((week, index) => (
              <div key={week.label} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                {getWeekStatusIcon(week.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      week.status === "completed" ? "text-muted-foreground line-through" :
                      week.status === "current" ? "text-primary font-semibold" :
                      "text-muted-foreground"
                    }`}>
                      {week.label}
                    </span>
                    {week.status === "current" && (
                      <Badge variant="default" className="text-xs gap-1">
                        <Play className="h-3 w-3" fill="currentColor" />
                        Active
                      </Badge>
                    )}
                  </div>
                  {week.status === "completed" && (
                    <span className="text-xs text-muted-foreground">Completed</span>
                  )}
                  {week.status === "current" && (
                    <span className="text-xs text-primary">Currently in progress</span>
                  )}
                  {week.status === "upcoming" && (
                    <span className="text-xs text-muted-foreground">Starting soon</span>
                  )}
                  {week.status === "future" && (
                    <span className="text-xs text-muted-foreground">Final phase</span>
                  )}
                </div>
                
                {/* Connector line (except last item) */}
                {index < weekProgress.length - 1 && (
                  <div className="absolute left-[27px] top-full h-6 w-px bg-border ml-[-12px]" style={{ display: 'none' }} />
                )}
              </div>
            ))}
          </div>

          {/* Next Milestone */}
          <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/30 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Next Milestone
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  Mid-term Evaluation
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Due in 5 days
                </p>
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full" asChild>
            <a href="/student/internships" className="gap-2">
              View Detailed Timeline
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Deadlines Component
function DeadlinesCard() {
  return (
    <motion.div variants={itemVariants}>
      <Card className="h-full">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-destructive" />
            Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {deadlines.map((deadline) => {
            const urgencyConfig = getUrgencyConfig(deadline.urgency);
            
            return (
              <div
                key={deadline.id}
                className={`group relative rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                  deadline.urgency === "critical"
                    ? "border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-950/20"
                    : deadline.urgency === "high"
                    ? "border-amber-200 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20"
                    : "border-border hover:border-border/80 bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Urgency Indicator */}
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full ${urgencyConfig.dotClass} shrink-0`} />
                  
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm leading-tight">
                        {deadline.title}
                      </h4>
                      <Badge
                        variant={urgencyConfig.badgeVariant}
                        className={`shrink-0 text-[10px] px-1.5 py-0 ${
                          deadline.urgency === "critical"
                            ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                            : ""
                        }`}
                      >
                        {urgencyConfig.badgeLabel}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {deadline.description}
                    </p>
                    
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {deadline.dueText}
                      </span>
                      
                      <Button
                        size="sm"
                        variant={
                          deadline.urgency === "critical" ? "default" : "outline"
                        }
                        className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        asChild
                      >
                        <a href={deadline.actionHref}>{deadline.actionLabel}</a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <Button variant="outline" className="w-full mt-4" asChild>
            <a href="#" className="gap-2">
              View All Deadlines
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Recent Activity Component
function RecentActivity() {
  // Group activities by date
  const groupedActivities = recentActivities.reduce(
    (groups, activity) => {
      const group = activity.dateGroup;
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(activity);
      return groups;
    },
    {} as Record<string, ActivityItem[]>
  );

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([dateGroup, activities]) => (
              <div key={dateGroup}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  {dateGroup}
                </h4>
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 group"
                    >
                      <div className={`p-2 rounded-lg ${activity.iconColor} shrink-0`}>
                        {activity.icon}
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="text-sm text-foreground group-hover:text-primary transition-colors">
                          {activity.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activity.timeAgo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Quick Actions Component
function QuickActionsBar() {
  return (
    <motion.div variants={itemVariants}>
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Quick Actions</h3>
                <p className="text-xs text-muted-foreground">
                  Common tasks at your fingertips
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  className={`${action.color} shadow-md hover:shadow-lg transition-all`}
                  asChild
                >
                  <a href={action.href} className="gap-2">
                    {action.icon}
                    {action.label}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ MAIN DASHBOARD COMPONENT ============
export default function StudentDashboardPage() {
  return (
    <div className="min-h-screen space-y-6 p-4 md:p-6 lg:p-8">
      {/* Page Header - Hidden, welcome banner serves this purpose */}
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Welcome Banner */}
        <WelcomeBanner />

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat) => (
            <StatCardComponent key={stat.id} stat={stat} />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InternshipProgress />
          <DeadlinesCard />
        </div>

        {/* Bottom Section */}
        <div className="space-y-6">
          <RecentActivity />
          <QuickActionsBar />
        </div>
      </motion.div>
    </div>
  );
}
