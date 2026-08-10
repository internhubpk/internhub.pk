"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Users,
  UserCheck,
  Star,
  FileText,
  MessageSquare,
  Award,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Calendar,
  Plus,
  Settings,
  Download,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Building2,
  TrendingUp,
  Bell,
  Mail,
  MoreVertical,
  Copy,
  LayoutTemplate,
  CheckCircle2,
  Play,
  BarChart3,
  Trash2,
  RefreshCw,
  UserPlus,
  GraduationCap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ============ TYPES ============
interface ActiveIntern {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  role: string;
  university: string;
  program: string;
  currentWeek: number;
  totalWeeks: number;
  progress: number;
  rating: number;
  nextEvaluation: string;
  status: "active" | "ending-soon" | "certification-ready";
}

interface Application {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  position: string;
  university: string;
  appliedAt: string;
}

interface EvaluationItem {
  id: string;
  type: "mid-term" | "weekly" | "final";
  title: string;
  internName?: string;
  internCount?: number;
  dueDate: string;
  urgency: "high" | "medium" | "low";
}

interface JobPosting {
  id: string;
  title: string;
  applications: number;
  status: "active" | "closing" | "closed" | "draft";
  postedDate: string;
  views: number;
}

// ============ MOCK DATA ============
const activeInternsData: ActiveIntern[] = [
  {
    id: "1",
    name: "Ahmed Khan",
    initials: "AK",
    role: "Software Engineering Intern",
    university: "IIUI",
    program: "CS 4th Year",
    currentWeek: 8,
    totalWeeks: 12,
    progress: 75,
    rating: 4.8,
    nextEvaluation: "Jul 28",
    status: "active",
  },
  {
    id: "2",
    name: "Sara Ali",
    initials: "SA",
    role: "Data Science Intern",
    university: "COMSATS",
    program: "CS 3rd Year",
    currentWeek: 10,
    totalWeeks: 12,
    progress: 90,
    rating: 4.9,
    nextEvaluation: "Certificate ready",
    status: "certification-ready",
  },
  {
    id: "3",
    name: "Usman Malik",
    initials: "UM",
    role: "Frontend Developer Intern",
    university: "NUST",
    program: "SE 4th Year",
    currentWeek: 11,
    totalWeeks: 12,
    progress: 95,
    rating: 4.7,
    nextEvaluation: "Jul 25",
    status: "ending-soon",
  },
  {
    id: "4",
    name: "Fatima Zahra",
    initials: "FZ",
    role: "UI/UX Design Intern",
    university: "LUMS",
    program: "Design 3rd Year",
    currentWeek: 6,
    totalWeeks: 12,
    progress: 50,
    rating: 4.5,
    nextEvaluation: "Aug 5",
    status: "active",
  },
  {
    id: "5",
    name: "Hassan Raza",
    initials: "HR",
    role: "DevOps Engineer Intern",
    university: "FAST",
    program: "CS 4th Year",
    currentWeek: 4,
    totalWeeks: 12,
    progress: 33,
    rating: 4.6,
    nextEvaluation: "Aug 15",
    status: "active",
  },
];

const recentApplicationsData: Application[] = [
  {
    id: "1",
    name: "Fatima Hassan",
    initials: "FH",
    position: "Frontend Developer",
    university: "IIUI",
    appliedAt: "2 hours ago",
  },
  {
    id: "2",
    name: "Ali Raza",
    initials: "AR",
    position: "Backend Developer",
    university: "NUST",
    appliedAt: "5 hours ago",
  },
  {
    id: "3",
    name: "Ayesha Noor",
    initials: "AN",
    position: "Data Analyst",
    university: "COMSATS",
    appliedAt: "1 day ago",
  },
];

const evaluationsData: EvaluationItem[] = [
  {
    id: "1",
    type: "mid-term",
    title: "Mid-term Evaluation",
    internName: "Ahmed Khan",
    dueDate: "Tomorrow",
    urgency: "high",
  },
  {
    id: "2",
    type: "weekly",
    title: "Weekly Check-in",
    internCount: 3,
    dueDate: "Friday",
    urgency: "medium",
  },
  {
    id: "3",
    type: "final",
    title: "Final Evaluation",
    internName: "Sara Ali",
    dueDate: "In 3 days",
    urgency: "high",
  },
];

const jobPostingsData: JobPosting[] = [
  {
    id: "1",
    title: "Frontend Developer Intern",
    applications: 45,
    status: "active",
    postedDate: "2 weeks ago",
    views: 234,
  },
  {
    id: "2",
    title: "Backend Developer Intern",
    applications: 32,
    status: "active",
    postedDate: "3 weeks ago",
    views: 189,
  },
  {
    id: "3",
    title: "Data Science Intern",
    applications: 28,
    status: "closing",
    postedDate: "1 month ago",
    views: 156,
  },
  {
    id: "4",
    title: "DevOps Engineer Intern",
    applications: 15,
    status: "closed",
    postedDate: "2 months ago",
    views: 98,
  },
  {
    id: "5",
    title: "UI/UX Design Intern",
    applications: 36,
    status: "active",
    postedDate: "1 week ago",
    views: 145,
  },
];

// ============ ANIMATION VARIANTS ============
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
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

// ============ SUB-COMPONENTS ============

// Stat Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendValue,
  iconBgColor,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle: string;
  trend: "up" | "down" | "neutral";
  trendValue?: string;
  iconBgColor: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2.5">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
              <div className="flex items-center gap-2">
                {trend !== "neutral" && trendValue && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                      trend === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {trend === "up" ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {trendValue}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              </div>
            </div>
            <div
              className={`rounded-xl p-2.5 ${iconBgColor} group-hover:scale-110 transition-transform duration-300`}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Status Badge for Jobs
function JobStatusBadge({ status }: { status: JobPosting["status"] }) {
  const variants = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    closing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    draft: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  };

  const icons = {
    active: <CheckCircle2 className="h-3 w-3 mr-1" />,
    closing: <Clock className="h-3 w-3 mr-1" />,
    closed: <AlertCircle className="h-3 w-3 mr-1" />,
    draft: <FileText className="h-3 w-3 mr-1" />,
  };

  return (
    <Badge variant="outline" className={variants[status]}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// Intern Status Badge
function InternStatusBadge({ status }: { status: ActiveIntern["status"] }) {
  const variants = {
    active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "ending-soon": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "certification-ready": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  const labels = {
    active: "Active",
    "ending-soon": "Ending Soon",
    "certification-ready": "Cert Ready",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// Urgency Indicator
function UrgencyIndicator({ urgency }: { urgency: EvaluationItem["urgency"] }) {
  const colors = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-green-500",
  };

  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[urgency]} animate-pulse`}
    />
  );
}

// Intern Card Component
function InternCard({ intern, index }: { intern: ActiveIntern; index: number }) {
  const getProgressColor = () => {
    if (intern.progress >= 80) return "[&>div]:bg-emerald-500";
    if (intern.progress >= 50) return "[&>div]:bg-blue-500";
    return "[&>div]:bg-amber-500";
  };

  return (
    <motion.div
      key={intern.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 + 0.3 }}
      className="group"
    >
      <Card className="hover:shadow-md transition-all duration-300 border-border/50 hover:border-primary/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Avatar & Info */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar className="h-12 w-12 shrink-0 ring-2 ring-background shadow-sm">
                <AvatarImage src={intern.avatar} alt={intern.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-sm">
                  {intern.initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-base truncate">{intern.name}</h4>
                    <p className="text-sm text-muted-foreground truncate">{intern.role}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <InternStatusBadge status={intern.status} />
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Week {intern.currentWeek}/{intern.totalWeeks}
                    </span>
                  </div>
                </div>

                {/* University Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>{intern.university} • {intern.program}</span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{intern.progress}%</span>
                  </div>
                  <Progress value={intern.progress} className={`h-2 ${getProgressColor()}`} />
                </div>

                {/* Rating & Next Eval */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-2">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-sm">{intern.rating}</span>
                    <span className="text-xs text-muted-foreground">rating</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{intern.nextEvaluation}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex sm:flex-col items-center justify-end gap-2 sm:border-l sm:border-border/50 sm:pl-4">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Eye className="h-3.5 w-3.5" />
                Profile
              </Button>
              {intern.status === "certification-ready" ? (
                <Button size="sm" className="gap-1.5 h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                  <Award className="h-3.5 w-3.5" />
                  Certify
                </Button>
              ) : (
                <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Evaluate
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MessageSquare className="h-4 w-4" />
              </Button>
              {intern.status === "certification-ready" && (
                <Button size="sm" className="gap-1.5 h-8 text-xs bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600">
                  <UserPlus className="h-3.5 w-3.5" />
                  Hire
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Recent Applications Widget
function RecentApplicationsWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-border/50 h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              New Applications
              <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                12
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {recentApplicationsData.map((app, index) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors group"
              >
                <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background">
                  <AvatarImage src={app.avatar} alt={app.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xs font-medium">
                    {app.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-sm truncate">{app.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Applied for: <span className="font-medium text-foreground">{app.position}</span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GraduationCap className="h-3 w-3" />
                    <span>{app.university}</span>
                    <span className="text-border">•</span>
                    <span>{app.appliedAt}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons for each application - shown on hover or always visible */}
          <div className="px-5 py-3 space-y-2 border-t border-border/50">
            {recentApplicationsData.slice(0, 2).map((app) => (
              <div key={app.id} className="flex items-center justify-between py-1.5 group/app">
                <span className="text-sm font-medium truncate pr-2">{app.name}</span>
                <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover/app:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                    <Eye className="h-3 w-3" />
                    View
                  </Button>
                  <Button size="sm" className="h-7 text-xs gap-1 px-2 bg-emerald-600 hover:bg-emerald-700">
                    <ThumbsUp className="h-3 w-3" />
                    Accept
                  </Button>
                  <Button variant="destructive" size="sm" className="h-7 text-xs gap-1 px-2">
                    <ThumbsDown className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground">
              View All Applications
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Evaluations Widget
function EvaluationsWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              Evaluations Due
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {evaluationsData.length}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {evaluationsData.map((evalItem, index) => (
            <motion.div
              key={evalItem.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 + 0.5 }}
              className={`rounded-lg border p-3.5 transition-colors hover:bg-muted/30 ${
                evalItem.urgency === "high"
                  ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                  : evalItem.urgency === "medium"
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                  : "border-border/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <UrgencyIndicator urgency={evalItem.urgency} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-sm">{evalItem.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {evalItem.internName || `${evalItem.internCount} interns`}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Due: {evalItem.dueDate}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={evalItem.urgency === "high" ? "default" : "outline"}
                  className="h-7 text-xs gap-1 shrink-0"
                >
                  <Play className="h-3 w-3" />
                  {evalItem.urgency === "high" ? "Start" : "View"}
                </Button>
              </div>
            </motion.div>
          ))}

          <div className="pt-2">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground">
              View All Evaluations
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Quick Post Widget
function QuickPostWidget() {
  const quickActions = [
    {
      icon: FileText,
      label: "Create Job Posting",
      description: "Post a new internship",
      color: "from-blue-500 to-cyan-500",
      href: "/company-hr/internships/new",
    },
    {
      icon: Copy,
      label: "Copy from Previous",
      description: "Use existing template",
      color: "from-purple-500 to-pink-500",
      href: "#",
    },
    {
      icon: LayoutTemplate,
      label: "Template Library",
      description: "Browse templates",
      color: "from-emerald-500 to-teal-500",
      href: "#",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-500" />
            Quick Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {quickActions.map((action, index) => (
              <motion.a
                key={action.label}
                href={action.href}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.6 }}
                className="group relative overflow-hidden rounded-xl border border-border/50 p-3.5 hover:border-primary/30 hover:shadow-md transition-all duration-300 cursor-pointer flex items-center gap-3"
              >
                <div
                  className={`rounded-lg bg-gradient-to-br ${action.color} p-2.5 shadow-md`}
                >
                  <action.icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Active Interns Section
function ActiveInternsSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              Active Interns
              <Badge variant="secondary" className="ml-2">
                {activeInternsData.length} of 18
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Manage Teams
              </Button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search interns by name, role, or university..."
                className="pl-9 h-9"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeInternsData.map((intern, index) => (
            <InternCard key={intern.id} intern={intern} index={index} />
          ))}

          {/* Pagination Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium">1-{activeInternsData.length}</span>{" "}
              of{" "}
              <span className="font-medium">18</span>{" "}
              active interns
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="default" size="icon" className="h-8 w-8">
                1
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8">
                2
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-">
                3
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Job Postings Table
function JobPostingsTable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-cyan-500" />
              Your Job Postings
              <Badge variant="secondary" className="ml-2">
                {jobPostingsData.length} total
              </Badge>
            </CardTitle>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Post New Job
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Position Title</TableHead>
                <TableHead className="text-center">Applications</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobPostingsData.map((job, index) => (
                <motion.tr
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 + 0.7 }}
                  data-slot="table-row"
                  className="group border-b transition-colors hover:bg-muted/50"
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-2">
                        <Briefcase className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.views} views</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center h-7 min-w-[40px] rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {job.applications}
                    </span>
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{job.postedDate}</span>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Edit Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="View Analytics"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      {job.status !== "closed" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Close Posting"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-600"
                          title="Repost"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 group-hover:hidden"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Showing all {jobPostingsData.length} job postings
            </p>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ MAIN PAGE ============
export default function CompanyHRDashboard() {
  const [currentTime] = useState(new Date());

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Company Header - Branded */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-5 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            {/* Company Branding */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-3 shadow-xl ring-1 ring-white/10">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-background" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
                    TechCorp Inc.
                  </h1>
                  <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white border-transparent text-[10px] px-2 py-0">
                    Enterprise
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  HR Internship Management Portal
                </p>
              </div>
            </div>

            {/* Stats & Actions */}
            <div className="flex items-center gap-4 md:gap-6">
              {/* Quick Stats */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium">20</span>
                  <span className="text-muted-foreground text-xs">Active</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">8</span>
                  <span className="text-muted-foreground text-xs">Open</span>
                </div>
              </div>

              <div className="h-8 w-px bg-border hidden md:block" />

              {/* Time Display */}
              <div className="text-right hidden lg:block">
                <p className="text-sm font-medium">{formatDate(currentTime)}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatTime(currentTime)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2 relative">
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notifications</span>
                  <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 hover:bg-red-500">
                    5
                  </Badge>
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Contact Support</span>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
          <MetricCard
            icon={Briefcase}
            label="Open Positions"
            value={8}
            subtitle="3 urgent"
            trend="up"
            trendValue="+2 this week"
            iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
            delay={0.1}
          />
          <MetricCard
            icon={Users}
            label="Total Applicants"
            value={156}
            subtitle="+24 new this week"
            trend="up"
            trendValue="+18%"
            iconBgColor="bg-gradient-to-br from-violet-500 to-violet-600"
            delay={0.2}
          />
          <MetricCard
            icon={UserCheck}
            label="Active Interns"
            value={18}
            subtitle="2 ending soon"
            trend="neutral"
            iconBgColor="bg-gradient-to-br from-emerald-500 to-emerald-600"
            delay={0.3}
          />
          <MetricCard
            icon={Star}
            label="Avg Rating This Month"
            value={
              <span className="flex items-center gap-1.5">
                4.6
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </span>
            }
            subtitle="out of 5.0"
            trend="up"
            trendValue="+0.3"
            iconBgColor="bg-gradient-to-br from-amber-500 to-orange-500"
            delay={0.4}
          />
        </div>

        {/* Main Grid - Active Interns + Widgets */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Active Interns (spans 2 cols on XL) */}
          <div className="xl:col-span-2">
            <ActiveInternsSection />
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            <RecentApplicationsWidget />
            <EvaluationsWidget />
            <QuickPostWidget />
          </div>
        </div>

        {/* Bottom Section - Job Postings Table */}
        <JobPostingsTable />
      </div>
    </div>
  );
}
