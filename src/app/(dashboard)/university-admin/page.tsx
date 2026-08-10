"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Plus,
  FileText,
  Award,
  Settings,
  GraduationCap,
  TrendingUp,
  Eye,
  ThumbsUp,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Star,
  Mail,
  Bell,
  CalendarDays,
  ClipboardList,
  UserPlus,
  Briefcase,
  ChevronRight,
  Filter,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// ============ TYPES ============
interface MetricData {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ElementType;
  color: string;
}

interface DepartmentStats {
  name: string;
  total: number;
  active: number;
  completed: number;
  pending: number;
  color: string;
}

interface PendingApproval {
  id: string;
  studentName: string;
  company: string;
  program: string;
  year: string;
  dueDate: string;
  isUrgent: boolean;
  avatar?: string;
}

interface ActivityItem {
  id: string;
  type: "approval" | "certificate" | "company" | "student" | "report" | "system";
  message: string;
  timestamp: string;
  icon?: React.ElementType;
}

interface CompanyPartner {
  id: string;
  name: string;
  logo: string;
  isActive: boolean;
  internsCount: number;
  isFeatured?: boolean;
}

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  href: string;
}

// ============ MOCK DATA ============
const metricsData: MetricData[] = [
  {
    label: "Total Students",
    value: "2,341",
    change: "+156 this semester",
    trend: "up",
    icon: GraduationCap,
    color: "from-blue-500 to-blue-600",
  },
  {
    label: "Partner Companies",
    value: "45",
    change: "+3 new",
    trend: "up",
    icon: Building2,
    color: "from-emerald-500 to-emerald-600",
  },
  {
    label: "Active Internships",
    value: "312",
    change: "+24 this week",
    trend: "up",
    icon: UserCheck,
    color: "from-violet-500 to-violet-600",
  },
  {
    label: "Pending Approvals",
    value: "23",
    change: "-5 from yesterday",
    trend: "down",
    icon: Clock,
    color: "from-amber-500 to-orange-500",
  },
  {
    label: "Completion Rate",
    value: "87%",
    change: "▲ 3%",
    trend: "up",
    icon: BarChart3,
    color: "from-cyan-500 to-teal-500",
  },
];

const departmentStats: DepartmentStats[] = [
  { name: "Computer Science", total: 456, active: 234, completed: 189, pending: 33, color: "#3B82F6" },
  { name: "Engineering", total: 389, active: 198, completed: 167, pending: 24, color: "#10B981" },
  { name: "Business Admin", total: 278, active: 145, completed: 118, pending: 15, color: "#8B5CF6" },
  { name: "Physics", total: 134, active: 67, completed: 56, pending: 11, color: "#F59E0B" },
  { name: "Mathematics", total: 98, active: 52, completed: 41, pending: 5, color: "#EF4444" },
  { name: "Economics", total: 87, active: 43, completed: 38, pending: 6, color: "#06B6D4" },
];

const pendingApprovals: PendingApproval[] = [
  {
    id: "1",
    studentName: "Ahmed Khan",
    company: "TechCorp Pakistan",
    program: "CS",
    year: "4th Year",
    dueDate: "Due today",
    isUrgent: true,
  },
  {
    id: "2",
    studentName: "Sara Ali",
    company: "Systems Ltd",
    program: "EE",
    year: "3rd Year",
    dueDate: "Due tomorrow",
    isUrgent: true,
  },
  {
    id: "3",
    studentName: "Usman Malik",
    company: "NetSol Technologies",
    program: "CS",
    year: "4th Year",
    dueDate: "Due in 2 days",
    isUrgent: false,
  },
  {
    id: "4",
    studentName: "Fatima Zahra",
    company: "Software House Inc.",
    program: "BBA",
    year: "3rd Year",
    dueDate: "Due in 3 days",
    isUrgent: false,
  },
];

const recentActivity: ActivityItem[] = [
  {
    id: "1",
    type: "approval",
    message: "Approved 5 internship applications for CS department",
    timestamp: "10 minutes ago",
    icon: CheckCircle2,
  },
  {
    id: "2",
    type: "certificate",
    message: "Generated 12 completion certificates (Batch Fall 2024)",
    timestamp: "1 hour ago",
    icon: Award,
  },
  {
    id: "3",
    type: "company",
    message: "New company registered: NetSol Technologies",
    timestamp: "2 hours ago",
    icon: Building2,
  },
  {
    id: "4",
    type: "student",
    message: "Added 25 new students to Computer Science program",
    timestamp: "3 hours ago",
    icon: UserPlus,
  },
  {
    id: "5",
    type: "report",
    message: "HEC compliance report generated successfully",
    timestamp: "5 hours ago",
    icon: FileText,
  },
  {
    id: "6",
    type: "system",
    message: "System backup completed - All data secured",
    timestamp: "8 hours ago",
    icon: Settings,
  },
];

const companyPartners: CompanyPartner[] = [
  { id: "1", name: "TechCorp", logo: "TC", isActive: true, internsCount: 45, isFeatured: true },
  { id: "2", name: "Systems Ltd", logo: "SL", isActive: true, internsCount: 32 },
  { id: "3", name: "NetSol", logo: "NS", isActive: true, internsCount: 28 },
  { id: "4", name: "Software House", logo: "SH", isActive: true, internsCount: 22 },
  { id: "5", name: "DevStudio", logo: "DS", isActive: true, internsCount: 18 },
  { id: "6", name: "IT Solutions", logo: "IS", isActive: true, internsCount: 15 },
];

const quickActions: QuickAction[] = [
  {
    label: "Add Student",
    description: "Register new student",
    icon: UserPlus,
    color: "from-blue-500 to-blue-600",
    href: "/university-admin/students/new",
  },
  {
    label: "Add Company",
    description: "Register partner org",
    icon: Building2,
    color: "from-emerald-500 to-emerald-600",
    href: "#",
  },
  {
    label: "Assign Supervisor",
    description: "Link faculty member",
    icon: Users,
    color: "from-violet-500 to-violet-600",
    href: "#",
  },
  {
    label: "Generate Report",
    description: "Export analytics",
    icon: BarChart3,
    color: "from-amber-500 to-orange-500",
    href: "#",
  },
  {
    label: "Issue Certificate",
    description: "Create completion doc",
    icon: Award,
    color: "from-pink-500 to-rose-500",
    href: "#",
  },
  {
    label: "Settings",
    description: "System configuration",
    icon: Settings,
    color: "from-gray-500 to-slate-600",
    href: "#",
  },
];

// ============ SUB-COMPONENTS ============

function UniversityHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 md:p-8"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>
      
      {/* Islamic Pattern Border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
      
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* University Logo */}
          <div className="relative">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-black/20">
              <GraduationCap className="w-10 h-10 md:w-12 md:h-12 text-blue-900" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-md flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-blue-900" fill="currentColor" />
            </div>
          </div>
          
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              IIUI - International Islamic University
            </h1>
            <p className="text-blue-200 mt-1 text-lg font-medium">
              Internship Administration Panel
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                Academic Year 2024
              </Badge>
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 hover:bg-emerald-500/30">
                Semester: Fall
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
            <span className="ml-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">5</span>
          </Button>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-blue-900 font-semibold">
            <FileText className="w-4 h-4 mr-2" />
            HEC Report
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ metric, delay }: { metric: MetricData; delay: number }) {
  const IconComponent = metric.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="group"
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden relative">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <IconComponent className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
              </div>
              <div className="flex items-baseline gap-3">
                <h3 className="text-3xl font-bold tracking-tight">{metric.value}</h3>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    metric.trend === "up"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : metric.trend === "down"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {metric.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                  {metric.trend === "down" && <ArrowDownRight className="h-3 w-3" />}
                  {metric.change}
                </span>
              </div>
            </div>
            <div
              className={`rounded-xl p-3 bg-gradient-to-br ${metric.color} group-hover:scale-110 transition-transform duration-300 shadow-lg`}
            >
              <IconComponent className="h-6 w-6 text-white" />
            </div>
          </div>
          
          {/* Progress indicator for completion rate */}
          {metric.label === "Completion Rate" && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Progress value={87} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">Target: 85% | Current: 87%</p>
            </div>
          )}
        </CardContent>
        
        {/* Accent line at bottom */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${metric.color}`} />
      </Card>
    </motion.div>
  );
}

function DepartmentBarChart({ stats }: { stats: DepartmentStats[] }) {
  const maxTotal = Math.max(...stats.map((s) => s.total));
  
  return (
    <div className="space-y-4 mt-6">
      {stats.map((dept, index) => (
        <motion.div
          key={dept.name}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 + 0.3 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{dept.name}</span>
            <span className="text-muted-foreground">{dept.total} total</span>
          </div>
          <div className="relative h-7 bg-muted rounded-lg overflow-hidden flex">
            {/* Completed */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(dept.completed / dept.total) * 100}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 + 0.5 }}
              className="bg-emerald-500 flex items-center justify-center text-xs text-white font-medium min-w-[40px]"
              style={{ backgroundColor: "#10B981" }}
            >
              {(dept.completed / dept.total * 100).toFixed(0)}%
            </motion.div>
            {/* Active */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(dept.active / dept.total) * 100}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 + 0.6 }}
              className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium min-w-[30px]"
              style={{ backgroundColor: "#3B82F6" }}
            >
              {(dept.active / dept.total * 100).toFixed(0)}%
            </motion.div>
            {/* Pending */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(dept.pending / dept.total) * 100}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 + 0.7 }}
              className="bg-amber-500 flex items-center justify-center text-xs text-white font-medium"
              style={{ backgroundColor: "#F59E0B" }}
            >
              {dept.pending > 0 && `${dept.pending}`}
            </motion.div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Completed: {dept.completed}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Active: {dept.active}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Pending: {dept.pending}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function InternshipOverviewTable() {
  return (
    <div className="mt-6 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Department</TableHead>
            <TableHead className="text-center">Total</TableHead>
            <TableHead className="text-center">Active</TableHead>
            <TableHead className="text-center">Completed</TableHead>
            <TableHead className="text-center">Pending</TableHead>
            <TableHead className="text-right">Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departmentStats.map((dept) => (
            <TableRow key={dept.name}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: dept.color }}
                  />
                  {dept.name}
                </div>
              </TableCell>
              <TableCell className="text-center font-semibold">{dept.total}</TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {dept.active}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {dept.completed}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={dept.pending > 20 ? "destructive" : "outline"} className={
                  dept.pending > 20 
                    ? "" 
                    : "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                }>
                  {dept.pending}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Progress 
                    value={(dept.completed / dept.total) * 100} 
                    className="w-20 h-2" 
                  />
                  <span className="text-xs text-muted-foreground w-10">
                    {Math.round((dept.completed / dept.total) * 100)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PendingApprovalsWidget() {
  return (
    <Card className="border-border/50 h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Pending Approvals
            <Badge variant="destructive" className="ml-2 text-xs">
              {pendingApprovals.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs">
            View All
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="h-[340px]">
          <div className="space-y-1">
            {pendingApprovals.map((approval, index) => (
              <motion.div
                key={approval.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.3 }}
                className={`px-6 py-4 hover:bg-muted/50 transition-colors ${
                  index !== pendingApprovals.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={
                      approval.isUrgent 
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }>
                      {approval.studentName.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm leading-tight">{approval.studentName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          {approval.company}
                        </p>
                      </div>
                      {approval.isUrgent && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {approval.program}-{approval.year}
                      </Badge>
                      <span className={approval.isUrgent ? "text-red-500 font-medium" : ""}>
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {approval.dueDate}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <ThumbsUp className="w-3 h-3" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Eye className="w-3 h-3" />
                        Review
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20">
                        <XCircle className="w-3 h-3" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="px-6 py-4 border-t border-border/50">
          <Button variant="outline" size="sm" className="w-full">
            View All Pending Approvals
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivityWidget() {
  const getActivityConfig = (type: ActivityItem["type"]) => {
    switch (type) {
      case "approval":
        return {
          bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
          textColor: "text-emerald-600 dark:text-emerald-400",
          icon: CheckCircle2,
        };
      case "certificate":
        return {
          bgColor: "bg-purple-100 dark:bg-purple-900/30",
          textColor: "text-purple-600 dark:text-purple-400",
          icon: Award,
        };
      case "company":
        return {
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
          textColor: "text-blue-600 dark:text-blue-400",
          icon: Building2,
        };
      case "student":
        return {
          bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
          textColor: "text-cyan-600 dark:text-cyan-400",
          icon: UserPlus,
        };
      case "report":
        return {
          bgColor: "bg-amber-100 dark:bg-amber-900/30",
          textColor: "text-amber-600 dark:text-amber-400",
          icon: FileText,
        };
      case "system":
        return {
          bgColor: "bg-gray-100 dark:bg-gray-800",
          textColor: "text-gray-600 dark:text-gray-400",
          icon: Settings,
        };
      default:
        return {
          bgColor: "bg-gray-100 dark:bg-gray-800",
          textColor: "text-gray-600 dark:text-gray-400",
          icon: Bell,
        };
    }
  };

  return (
    <Card className="border-border/50 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="h-[280px]">
          <div className="space-y-1">
            {recentActivity.map((activity, index) => {
              const config = getActivityConfig(activity.type);
              const IconComponent = config.icon;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.08 + 0.4 }}
                  className="flex items-start gap-3 px-6 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className={`mt-0.5 rounded-full p-2 ${config.bgColor} shrink-0`}>
                    <IconComponent className={`h-4 w-4 ${config.textColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm leading-snug group-hover:text-primary transition-colors">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function QuickActionsWidget() {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ZapIcon className="h-5 w-5 text-violet-500" />
          Management Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, index) => (
            <motion.a
              key={action.label}
              href={action.href}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.08 + 0.5 }}
              className="group relative overflow-hidden rounded-xl border border-border/50 p-4 hover:border-primary/30 hover:shadow-md transition-all duration-300 cursor-pointer"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
              />
              <div className="relative">
                <div
                  className={`mb-3 inline-flex rounded-lg bg-gradient-to-br ${action.color} p-2.5 shadow-lg`}
                >
                  <action.icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-medium leading-none mb-1">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Custom Zap icon component
function ZapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

function CompanyPartnersRow() {
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
              <Building2 className="h-5 w-5 text-emerald-500" />
              Partner Companies
              <Badge variant="secondary" className="ml-2">
                {companyPartners.length} active
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                Manage Partners
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-3.5 h-3.5" />
                Invite New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {companyPartners.map((company, index) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.08 + 0.7 }}
                className="group"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300 cursor-pointer">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {company.logo}
                    </div>
                    {company.isFeatured && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                        <Star className="w-2.5 h-2.5 text-amber-900" fill="currentColor" />
                      </div>
                    )}
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                      company.isActive ? "bg-emerald-500" : "bg-gray-400"
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      {company.name}
                      {company.isFeatured && <Star className="w-3 h-3 text-amber-500" fill="currentColor" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {company.internsCount} intern{company.internsCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 1.2 }}
            >
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm text-muted-foreground">+12 more</p>
                  <p className="text-xs text-muted-foreground">View all partners</p>
                </div>
              </div>
            </motion.div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              45 active partners
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              12 pending applications
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              160 total internship positions
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ MAIN COMPONENT ============
export default function UniversityAdminDashboard() {
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState("all");

  return (
    <div className="min-h-screen space-y-6 p-4 md:p-6 lg:p-8">
      {/* University Header */}
      <UniversityHeader />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricsData.map((metric, index) => (
          <StatCard key={metric.label} metric={metric} delay={index * 0.1} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Internship Overview */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Internship Status Overview
                </CardTitle>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-[150px] h-9 text-xs">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="cs">Computer Science</SelectItem>
                      <SelectItem value="eng">Engineering</SelectItem>
                      <SelectItem value="bus">Business Admin</SelectItem>
                      <SelectItem value="phy">Physics</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger className="w-[130px] h-9 text-xs">
                      <SelectValue placeholder="Program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      <SelectItem value="bscs">BSCS</SelectItem>
                      <SelectItem value="mscs">MSCS</SelectItem>
                      <SelectItem value="bba">BBA</SelectItem>
                      <SelectItem value="mba">MBA</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400">
                    This Semester
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <InternshipOverviewTable />
              
              {/* Visual Chart Section */}
              <div className="mt-8 pt-6 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                  Department-wise Distribution
                </h4>
                <DepartmentBarChart stats={departmentStats} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          {/* Pending Approvals Widget */}
          <PendingApprovalsWidget />

          {/* Recent Activity Widget */}
          <RecentActivityWidget />

          {/* Quick Actions Widget */}
          <QuickActionsWidget />
        </div>
      </div>

      {/* Bottom Section - Company Partners */}
      <CompanyPartnersRow />

      {/* Footer Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="text-center text-xs text-muted-foreground pb-4"
      >
        <p>
          InternHub © 2024 | HEC Compliant Internship Management System | Last synced: Just now
        </p>
        <p className="mt-1">
          For technical support, contact IT Helpdesk or email{" "}
          <a href="mailto:support@internhub.edu.pk" className="text-primary hover:underline">
            support@internhub.edu.pk
          </a>
        </p>
      </motion.div>
    </div>
  );
}
