"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  DollarSign,
  Database,
  Plus,
  Settings,
  BarChart3,
  Trash2,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Bell,
  Mail,
  FileText,
  Shield,
  TrendingUp,
  GraduationCap,
  CreditCard,
  UserPlus,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

// ============ TYPES ============
interface University {
  id: string;
  name: string;
  logo: string;
  users: number;
  plan: "Free" | "Pro" | "Enterprise";
  status: "Active" | "Trial" | "Suspended";
  createdAt: string;
}

interface ActivityItem {
  id: string;
  type: "university" | "payment" | "user" | "system" | "alert";
  message: string;
  university?: string;
  timestamp: string;
}

// ============ MOCK DATA ============
const universitiesData: University[] = [
  { id: "1", name: "IIUI", logo: "🎓", users: 2341, plan: "Pro", status: "Active", createdAt: "2023-01-15" },
  { id: "2", name: "COMSATS", logo: "🎓", users: 1892, plan: "Enterprise", status: "Active", createdAt: "2023-02-20" },
  { id: "3", name: "NUST", logo: "🎓", users: 3102, plan: "Pro", status: "Active", createdAt: "2023-03-10" },
  { id: "4", name: "FAST", logo: "🎓", users: 987, plan: "Free", status: "Trial", createdAt: "2024-01-05" },
  { id: "5", name: "LUMS", logo: "🎓", users: 1567, plan: "Enterprise", status: "Active", createdAt: "2023-06-12" },
  { id: "6", name: "UET Lahore", logo: "🎓", users: 2789, plan: "Pro", status: "Active", createdAt: "2023-04-18" },
  { id: "7", name: "AIR University", logo: "🎓", users: 654, plan: "Free", status: "Suspended", createdAt: "2024-02-28" },
  { id: "8", name: "Bahria University", logo: "🎓", users: 1234, plan: "Pro", status: "Active", createdAt: "2023-08-22" },
];

const activityData: ActivityItem[] = [
  {
    id: "1",
    type: "university",
    message: "Created 15 new student accounts",
    university: "IIUI",
    timestamp: "2 minutes ago",
  },
  {
    id: "2",
    type: "payment",
    message: "Upgraded to Enterprise plan",
    university: "COMSATS",
    timestamp: "1 hour ago",
  },
  {
    id: "3",
    type: "user",
    message: "New admin registered",
    university: "NUST",
    timestamp: "3 hours ago",
  },
  {
    id: "4",
    type: "system",
    message: "System backup completed successfully",
    timestamp: "5 hours ago",
  },
  {
    id: "5",
    type: "alert",
    message: "Storage usage exceeded 80% threshold",
    university: "FAST",
    timestamp: "1 day ago",
  },
];

const revenueData = [
  { month: "Jan", value: 18500 },
  { month: "Feb", value: 21200 },
  { month: "Mar", value: 19800 },
  { month: "Apr", value: 23400 },
  { month: "May", value: 22100 },
  { month: "Jun", value: 24500 },
];

// ============ COMPONENTS ============

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendValue,
  iconBgColor,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: "up" | "down";
  trendValue: string;
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
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <div className="flex items-baseline gap-3">
                <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                <span
                  className={`inline-flex items-center gap-1 text-sm font-medium ${
                    trend === "up"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {trend === "up" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {trendValue}
                </span>
              </div>
            </div>
            <div
              className={`rounded-xl p-3 ${iconBgColor} group-hover:scale-110 transition-transform duration-300`}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: "Active" | "Trial" | "Suspended" }) {
  const variants = {
    Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    Trial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    Suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  };

  return (
    <Badge variant="outline" className={variants[status]}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500' : status === 'Trial' ? 'bg-blue-500' : 'bg-red-500'}`} />
      {status}
    </Badge>
  );
}

function PlanBadge({ plan }: { plan: "Free" | "Pro" | "Enterprise" }) {
  const variants = {
    Free: "secondary",
    Pro: "default",
    Enterprise: "bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-transparent",
  };

  return (
    <Badge variant={variants[plan] as "default" | "secondary" | "destructive" | "outline"} className={plan === "Enterprise" ? "" : ""}>
      {plan}
    </Badge>
  );
}

function RevenueChart() {
  const maxValue = Math.max(...revenueData.map((d) => d.value));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Revenue Overview
          </CardTitle>
          <Select defaultValue="month">
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart Area */}
        <div className="h-[180px] flex items-end justify-between gap-2 mb-4 px-1">
          {revenueData.map((item, index) => (
            <motion.div
              key={item.month}
              initial={{ height: 0 }}
              animate={{ height: `${(item.value / maxValue) * 140}px` }}
              transition={{ duration: 0.6, delay: index * 0.1 + 0.3 }}
              className="flex-1 flex flex-col items-center gap-2 group relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border shadow-lg rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                ${item.value.toLocaleString()}
              </div>
              
              {/* Bar */}
              <div
                className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-primary to-primary/70 hover:from-primary hover:to-primary/90 transition-all duration-200 cursor-pointer group-hover:shadow-lg min-h-[8px]"
                style={{
                  boxShadow: "0 -2px 8px rgba(99, 102, 241, 0.2)",
                }}
              />
              
              {/* Label */}
              <span className="text-xs text-muted-foreground font-medium">{item.month}</span>
            </motion.div>
          ))}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">$24,500</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                +23%
              </span>
              <p className="text-xs text-muted-foreground">vs last month</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityFeed() {
  const getIconConfig = (type: ActivityItem["type"]) => {
    switch (type) {
      case "university":
        return {
          icon: GraduationCap,
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
          textColor: "text-blue-600 dark:text-blue-400",
        };
      case "payment":
        return {
          icon: CreditCard,
          bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
          textColor: "text-emerald-600 dark:text-emerald-400",
        };
      case "user":
        return {
          icon: UserPlus,
          bgColor: "bg-purple-100 dark:bg-purple-900/30",
          textColor: "text-purple-600 dark:text-purple-400",
        };
      case "system":
        return {
          icon: Settings,
          bgColor: "bg-gray-100 dark:bg-gray-800",
          textColor: "text-gray-600 dark:text-gray-400",
        };
      case "alert":
        return {
          icon: AlertCircle,
          bgColor: "bg-orange-100 dark:bg-orange-900/30",
          textColor: "text-orange-600 dark:text-orange-400",
        };
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="space-y-1 max-h-[320px] overflow-y-auto">
          {activityData.map((activity, index) => {
            const config = getIconConfig(activity.type);
            const IconComponent = config.icon;

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.5 }}
                className="flex items-start gap-3 px-6 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div
                  className={`mt-0.5 rounded-full p-2 ${config.bgColor} shrink-0`}
                >
                  <IconComponent className={`h-4 w-4 ${config.textColor}`} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm leading-snug">
                    {activity.university && (
                      <span className="font-semibold">{activity.university}</span>
                    )}{" "}
                    {activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-border/50">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground">
            View All Activity
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const actions = [
    {
      icon: Plus,
      label: "Add University",
      description: "Create new tenant",
      color: "from-blue-500 to-cyan-500",
      href: "/super-admin/universities/new",
    },
    {
      icon: Mail,
      label: "Send Announcement",
      description: "Broadcast message",
      color: "from-purple-500 to-pink-500",
      href: "#",
    },
    {
      icon: FileText,
      label: "Generate Report",
      description: "Export analytics",
      color: "from-emerald-500 to-teal-500",
      href: "#",
    },
    {
      icon: Shield,
      label: "Platform Settings",
      description: "Global config",
      color: "from-orange-500 to-amber-500",
      href: "/super-admin/settings",
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-violet-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <motion.a
              key={action.label}
              href={action.href}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 + 0.6 }}
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

function UniversitiesTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredUniversities = universitiesData.filter(
    (uni) =>
      uni.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.plan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUniversities.length / itemsPerPage);
  const paginatedData = filteredUniversities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            Registered Universities
            <Badge variant="secondary" className="ml-2">
              {universitiesData.length} total
            </Badge>
          </CardTitle>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add New
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search universities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[60px] pl-6">Logo</TableHead>
              <TableHead>University</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((uni, index) => (
              <motion.tr
                key={uni.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 + 0.2 }}
                data-slot="table-row"
                className="group border-b transition-colors hover:bg-muted/50"
              >
                <TableCell className="pl-6">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-muted text-base">
                      {uni.logo}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{uni.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(uni.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono font-medium">{uni.users.toLocaleString()}</span>
                </TableCell>
                <TableCell>
                  <PlanBadge plan={uni.plan} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={uni.status} />
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Analytics"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {Math.min(currentPage * itemsPerPage, filteredUniversities.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium">{filteredUniversities.length}</span>{" "}
            universities
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ MAIN PAGE ============
export default function SuperAdminDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      {/* Page Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-primary to-primary/70 p-2.5 shadow-lg">
                  <Building2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                    Super Admin Dashboard
                  </h1>
                  <p className="text-muted-foreground">
                    Welcome back! Here&apos;s your platform overview.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{formatDate(currentTime)}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatTime(currentTime)}
                </p>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <Button variant="outline" size="sm" className="gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notifications</span>
                <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  3
                </Badge>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
          <StatCard
            icon={Building2}
            label="Universities"
            value="47"
            trend="up"
            trendValue="12%"
            iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
            delay={0.1}
          />
          <StatCard
            icon={Users}
            label="Total Users"
            value="12,458"
            trend="up"
            trendValue="8%"
            iconBgColor="bg-gradient-to-br from-violet-500 to-violet-600"
            delay={0.2}
          />
          <StatCard
            icon={DollarSign}
            label="Monthly Revenue"
            value="$24,500"
            trend="up"
            trendValue="23%"
            iconBgColor="bg-gradient-to-br from-emerald-500 to-emerald-600"
            delay={0.3}
          />
          <StatCard
            icon={Database}
            label="Storage Used"
            value="2.1 TB"
            trend="down"
            trendValue="42%"
            iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
            delay={0.4}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Universities Table (spans 2 cols on XL) */}
          <div className="xl:col-span-2">
            <UniversitiesTable />

            {/* Storage Usage Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-6"
            >
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Database className="h-5 w-5 text-orange-500" />
                    Platform Storage
                  </CardTitle>
                  <CardDescription>
                    Total storage allocation across all tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress value={42} className="h-3" />
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          Used: <span className="font-medium text-foreground">2.1 TB</span>
                        </span>
                        <span className="text-muted-foreground">
                          Available: <span className="font-medium text-foreground">2.9 TB</span>
                        </span>
                      </div>
                      <span className="font-medium">42% of 5 TB</span>
                    </div>
                    
                    {/* Storage breakdown by category */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/50">
                      {[
                        { label: "Documents", value: "850 GB", percent: 40, color: "bg-blue-500" },
                        { label: "Media", value: "620 GB", percent: 29, color: "bg-purple-500" },
                        { label: "Backups", value: "480 GB", percent: 23, color: "bg-emerald-500" },
                        { label: "Other", value: "150 GB", percent: 8, color: "bg-orange-500" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium">{item.value}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${item.color} rounded-full`}
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            <RevenueChart />
            <ActivityFeed />
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}
