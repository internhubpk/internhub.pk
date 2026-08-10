"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  CreditCard,
  DollarSign,
  HardDrive,
  Users,
  Activity,
  Plus,
  Settings,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Pencil,
  Ban,
  Trash2,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  ExternalLink,
  FileText,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

// Dashboard components
import { StatsCard, StatsGrid } from "@/components/dashboard/stats-card";
import { DataTable, RowActions, ViewAction, EditAction, DeleteAction, SuspendAction } from "@/components/dashboard/data-table";
import { StatusBadge, PlanBadge, HealthStatus } from "@/components/dashboard/status-badge";
import { LineChartCard, BarChartCard, PieChartCard, AreaChartCard } from "@/components/dashboard/charts-section";

// Types
import type { University, Subscription, ColumnDef } from "@/types";

// ============ MOCK DATA ============

const mockUniversities: (University & { students_count: number; subscription: Subscription })[] = [
  {
    id: "1",
    name: "Stanford University",
    slug: "stanford",
    logo_url: "",
    domain: "stanford.edu",
    address: "450 Serra Mall, Stanford, CA 94305",
    phone: "+1-650-723-2300",
    email: "admin@stanford.edu",
    description: "A leading research university in Silicon Valley.",
    is_active: true,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-12-01T08:30:00Z",
    students_count: 17250,
    subscription: {
      id: "sub1",
      university_id: "1",
      plan: "enterprise",
      status: "active",
      start_date: "2024-01-01T00:00:00Z",
      end_date: "2025-12-31T23:59:59Z",
      student_limit: 25000,
      storage_limit_mb: 500000,
      price: 9999,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  },
  {
    id: "2",
    name: "MIT",
    slug: "mit",
    logo_url: "",
    domain: "mit.edu",
    address: "77 Massachusetts Ave, Cambridge, MA 02139",
    phone: "+1-617-253-1000",
    email: "admin@mit.edu",
    description: "Massachusetts Institute of Technology.",
    is_active: true,
    created_at: "2024-02-20T10:00:00Z",
    updated_at: "2024-11-28T14:20:00Z",
    students_count: 11850,
    subscription: {
      id: "sub2",
      university_id: "2",
      plan: "enterprise",
      status: "active",
      start_date: "2024-02-01T00:00:00Z",
      end_date: "2025-01-31T23:59:59Z",
      student_limit: 15000,
      storage_limit_mb: 300000,
      price: 7999,
      created_at: "2024-02-01T00:00:00Z",
      updated_at: "2024-02-01T00:00:00Z",
    },
  },
  {
    id: "3",
    name: "Harvard University",
    slug: "harvard",
    logo_url: "",
    domain: "harvard.edu",
    address: "Cambridge, MA 02138",
    phone: "+1-617-495-1000",
    email: "admin@harvard.edu",
    description: "A prestigious Ivy League institution.",
    is_active: true,
    created_at: "2024-03-10T10:00:00Z",
    updated_at: "2024-11-25T09:45:00Z",
    students_count: 23500,
    subscription: {
      id: "sub3",
      university_id: "3",
      plan: "professional",
      status: "active",
      start_date: "2024-03-01T00:00:00Z",
      end_date: "2025-02-28T23:59:59Z",
      student_limit: 30000,
      storage_limit_mb: 200000,
      price: 4999,
      created_at: "2024-03-01T00:00:00Z",
      updated_at: "2024-03-01T00:00:00Z",
    },
  },
  {
    id: "4",
    name: "UC Berkeley",
    slug: "uc-berkeley",
    logo_url: "",
    domain: "berkeley.edu",
    address: "Berkeley, CA 94720",
    phone: "+1-510-642-6000",
    email: "admin@berkeley.edu",
    description: "University of California, Berkeley.",
    is_active: true,
    created_at: "2024-04-05T10:00:00Z",
    updated_at: "2024-12-02T11:15:00Z",
    students_count: 45000,
    subscription: {
      id: "sub4",
      university_id: "4",
      plan: "professional",
      status: "active",
      start_date: "2024-04-01T00:00:00Z",
      end_date: "2025-03-31T23:59:59Z",
      student_limit: 50000,
      storage_limit_mb: 250000,
      price: 4999,
      created_at: "2024-04-01T00:00:00Z",
      updated_at: "2024-04-01T00:00:00Z",
    },
  },
  {
    id: "5",
    name: "Carnegie Mellon",
    slug: "carnegie-mellon",
    logo_url: "",
    domain: "cmu.edu",
    address: "5000 Forbes Ave, Pittsburgh, PA 15213",
    phone: "+1-412-268-2000",
    email: "admin@cmu.edu",
    description: "A global research university.",
    is_active: false,
    created_at: "2024-05-12T10:00:00Z",
    updated_at: "2024-10-15T16:30:00Z",
    students_count: 15800,
    subscription: {
      id: "sub5",
      university_id: "5",
      plan: "basic",
      status: "expired",
      start_date: "2024-05-01T00:00:00Z",
      end_date: "2024-11-30T23:59:59Z",
      student_limit: 20000,
      storage_limit_mb: 50000,
      price: 1999,
      created_at: "2024-05-01T00:00:00Z",
      updated_at: "2024-05-01T00:00:00Z",
    },
  },
  {
    id: "6",
    name: "Georgia Tech",
    slug: "georgia-tech",
    logo_url: "",
    domain: "gatech.edu",
    address: "North Ave NW, Atlanta, GA 30332",
    phone: "+1-404-894-2000",
    email: "admin@gatech.edu",
    description: "Georgia Institute of Technology.",
    is_active: true,
    created_at: "2024-06-18T10:00:00Z",
    updated_at: "2024-11-30T13:00:00Z",
    students_count: 40000,
    subscription: {
      id: "sub6",
      university_id: "6",
      plan: "professional",
      status: "trial",
      start_date: "2024-06-01T00:00:00Z",
      end_date: "2024-09-01T23:59:59Z",
      student_limit: 45000,
      storage_limit_mb: 180000,
      price: 0,
      created_at: "2024-06-01T00:00:00Z",
      updated_at: "2024-06-01T00:00:00Z",
    },
  },
];

// Chart data
const universityGrowthData = [
  { month: "Jan", universities: 8, newSignups: 2 },
  { month: "Feb", universities: 12, newSignups: 4 },
  { month: "Mar", universities: 18, newSignups: 6 },
  { month: "Apr", universities: 25, newSignups: 7 },
  { month: "May", universities: 34, newSignups: 9 },
  { month: "Jun", universities: 42, newSignups: 8 },
  { month: "Jul", universities: 48, newSignups: 6 },
  { month: "Aug", universities: 55, newSignups: 7 },
  { month: "Sep", universities: 65, newSignups: 10 },
  { month: "Oct", universities: 72, newSignups: 7 },
  { month: "Nov", universities: 78, newSignups: 6 },
  { month: "Dec", universities: 85, newSignups: 7 },
];

const revenueData = [
  { month: "Jan", revenue: 28000, mrr: 24000 },
  { month: "Feb", revenue: 35000, mrr: 32000 },
  { month: "Mar", revenue: 42000, mrr: 40000 },
  { month: "Apr", revenue: 48000, mrr: 45000 },
  { month: "May", revenue: 55000, mrr: 52000 },
  { month: "Jun", revenue: 62000, mrr: 58000 },
  { month: "Jul", revenue: 58000, mrr: 55000 },
  { month: "Aug", revenue: 72000, mrr: 68000 },
  { month: "Sep", revenue: 85000, mrr: 80000 },
  { month: "Oct", revenue: 92000, mrr: 88000 },
  { month: "Nov", revenue: 98000, mrr: 94000 },
  { month: "Dec", revenue: 105000, mrr: 99000 },
];

const subscriptionDistribution = [
  { name: "Enterprise", value: 12, color: "#f59e0b" },
  { name: "Professional", value: 35, color: "#8b5cf6" },
  { name: "Basic", value: 28, color: "#2563eb" },
  { name: "Free/Trial", value: 10, color: "#94a3b8" },
];

const recentActivityData = [
  {
    id: "1",
    action: "New university registered",
    entity: "Boston University",
    time: "2 minutes ago",
    icon: Building2,
    type: "success" as const,
  },
  {
    id: "2",
    action: "Subscription upgraded",
    entity: "MIT → Enterprise Plan",
    time: "15 minutes ago",
    icon: CreditCard,
    type: "info" as const,
  },
  {
    id: "3",
    action: "Payment received",
    entity: "$9,999.00 from Stanford",
    time: "1 hour ago",
    icon: DollarSign,
    type: "success" as const,
  },
  {
    id: "4",
    action: "Storage warning triggered",
    entity: "Harvard at 85% capacity",
    time: "2 hours ago",
    icon: HardDrive,
    type: "warning" as const,
  },
  {
    id: "5",
    action: "University suspended",
    entity: "Carnegie Mellon (payment overdue)",
    time: "3 hours ago",
    icon: Ban,
    type: "error" as const,
  },
  {
    id: "6",
    action: "Bulk import completed",
    entity: "2,500 students at UC Berkeley",
    time: "5 hours ago",
    icon: Users,
    type: "info" as const,
  },
  {
    id: "7",
    action: "System health check passed",
    entity: "All services operational",
    time: "6 hours ago",
    icon: Activity,
    type: "success" as const,
  },
];

// ============ MAIN COMPONENT ============

export default function SuperAdminDashboard() {
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedUniversity, setSelectedUniversity] = useState<typeof mockUniversities[0] | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [universityToDelete, setUniversityToDelete] = useState<string | null>(null);

  // Computed stats
  const totalUniversities = mockUniversities.length;
  const activeSubscriptions = mockUniversities.filter(u => u.subscription.status === "active").length;
  const monthlyRevenue = mockUniversities.reduce((acc, u) => acc + u.subscription.price, 0);
  const totalStudents = mockUniversities.reduce((acc, u) => acc + u.students_count, 0);
  const totalStorageUsed = 125; // GB
  const systemUptime = 99.97;

  // Filtered data for table
  // Note: React Compiler will auto-memoize this computation
  /* eslint-disable react-hooks/preserve-manual-memoization -- React Compiler handles this */
  const filteredUniversities = useMemo(() => {
    return mockUniversities.filter(university => {
      const matchesSearch = searchQuery === "" || 
        university.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        university.slug.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && university.is_active) ||
        (statusFilter === "inactive" && !university.is_active);
      
      const matchesPlan = planFilter === "all" || 
        university.subscription.plan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [searchQuery, statusFilter, planFilter]);
  /* eslint-enable react-hooks/preserve-manual-memoization */

  // Table columns definition
  const columns: ColumnDef<(typeof mockUniversities)[0]>[] = [
    {
      accessorKey: "name",
      header: "University",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={row.original.logo_url} alt={row.original.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {row.original.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.slug}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.is_active ? "active" : "suspended"} />
      ),
    },
    {
      accessorKey: "students_count",
      header: "Students",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.students_count.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "subscription.plan",
      header: "Plan",
      cell: ({ row }) => (
        <PlanBadge plan={row.original.subscription.plan} />
      ),
    },
    {
      accessorKey: "subscription.status",
      header: "Subscription",
      cell: ({ row }) => (
        <StatusBadge status={row.original.subscription.status} />
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions>
          <ViewAction onClick={() => setSelectedUniversity(row.original)} />
          <EditAction onClick={() => console.log("Edit:", row.original.id)} />
          <SuspendAction onClick={() => console.log("Suspend:", row.original.id)} />
          <DeleteAction onClick={() => {
            setUniversityToDelete(row.original.id);
            setIsDeleteDialogOpen(true);
          }} />
        </RowActions>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and management</p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add University
          </Button>
          <Button variant="outline">
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Plans
          </Button>
          <Button variant="outline">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <StatsGrid columns={6}>
        <StatsCard
          title="Total Universities"
          value={totalUniversities}
          icon={Building2}
          trend={{ value: 12.5, isPositive: true }}
          description="vs last month"
          index={0}
        />
        <StatsCard
          title="Active Subscriptions"
          value={activeSubscriptions}
          icon={CreditCard}
          trend={{ value: 8.3, isPositive: true }}
          description="of total"
          index={1}
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${(monthlyRevenue / 1000).toFixed(1)}k`}
          icon={DollarSign}
          trend={{ value: 15.2, isPositive: true }}
          description="MRR"
          index={2}
        />
        <StatsCard
          title="Total Students"
          value={totalStudents.toLocaleString()}
          icon={Users}
          trend={{ value: 22.1, isPositive: true }}
          description="across all unis"
          index={3}
        />
        <StatsCard
          title="Storage Used"
          value={`${totalStorageUsed} GB`}
          icon={HardDrive}
          trend={{ value: 5.4, isPositive: false }}
          description="of 500 GB"
          index={4}
        />
        <StatsCard
          title="System Health"
          value={<HealthStatus status="healthy" uptime={systemUptime} />}
          icon={Activity}
          index={5}
        />
      </StatsGrid>

      {/* Main Content Grid */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="universities">Universities</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <LineChartCard
              title="University Growth"
              description="New registrations over time"
              data={universityGrowthData}
              lines={[
                { dataKey: "universities", name: "Total Universities", color: "#2563eb" },
                { dataKey: "newSignups", name: "New Signups", color: "#10b981", strokeWidth: 2, dot: true },
              ]}
              height={280}
              index={0}
            />

            <PieChartCard
              title="Subscription Distribution"
              description="By plan type"
              data={subscriptionDistribution}
              donut
              innerRadius={60}
              outerRadius={100}
              height={280}
              index={1}
            />

            <BarChartCard
              title="Revenue Overview"
              description="Monthly vs MRR"
              data={revenueData.slice(-6)}
              bars={[
                { dataKey: "revenue", name: "Revenue", color: "#2563eb" },
                { dataKey: "mrr", name: "MRR", color: "#10b981" },
              ]}
              height={280}
              index={2}
              className="xl:col-span-1"
            />
          </div>

          {/* Revenue Area Chart */}
          <AreaChartCard
            title="Revenue Trends"
            description="12-month overview"
            data={revenueData}
            areas={[
              { dataKey: "revenue", name: "Total Revenue", color: "#2563eb" },
              { dataKey: "mrr", name: "Monthly Recurring", color: "#10b981" },
            ]}
            height={300}
            index={3}
          />

          {/* Quick Stats Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Students/Uni</p>
                  <p className="text-2xl font-bold">{Math.round(totalStudents / totalUniversities).toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-primary/20" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enterprise Clients</p>
                  <p className="text-2xl font-bold">{mockUniversities.filter(u => u.subscription.plan === "enterprise").length}</p>
                </div>
                <Building2 className="h-8 w-8 text-amber-500/20" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Trial Conversions</p>
                  <p className="text-2xl font-bold">68%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500/20" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Churn Rate</p>
                  <p className="text-2xl font-bold">2.4%</p>
                </div>
                <ArrowDownRight className="h-8 w-8 text-red-500/20" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Universities Tab */}
        <TabsContent value="universities" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-1 max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search universities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={filteredUniversities}
            searchPlaceholder="Search by name or slug..."
            pageSize={10}
            emptyMessage="No universities found"
            emptyDescription="Try adjusting your search or filters"
          />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Active Subscriptions */}
            <Card>
              <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
                <CardDescription>Current active subscriptions by plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { plan: "enterprise", count: 12, revenue: 119988, color: "bg-amber-500" },
                    { plan: "professional", count: 35, revenue: 174965, color: "bg-purple-500" },
                    { plan: "basic", count: 28, revenue: 55972, color: "bg-blue-500" },
                  ].map((item) => (
                    <div key={item.plan} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <div>
                          <p className="font-medium capitalize">{item.plan}</p>
                          <p className="text-xs text-muted-foreground">{item.count} universities</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${item.revenue.toLocaleString()}/mo</p>
                        <p className="text-xs text-muted-foreground">recurring</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Latest payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[340px]">
                  <div className="space-y-3">
                    {[
                      { uni: "Stanford University", amount: 9999, date: "Dec 1, 2024", status: "completed" },
                      { uni: "MIT", amount: 7999, date: "Nov 28, 2024", status: "completed" },
                      { uni: "Harvard University", amount: 4999, date: "Nov 25, 2024", status: "completed" },
                      { uni: "UC Berkeley", amount: 4999, date: "Nov 24, 2024", status: "pending" },
                      { uni: "Georgia Tech", amount: 0, date: "Nov 20, 2024", status: "trial" },
                      { uni: "Caltech", amount: 7999, date: "Nov 15, 2024", status: "completed" },
                      { uni: "Yale University", amount: 4999, date: "Nov 10, 2024", status: "failed" },
                      { uni: "Princeton", amount: 7999, date: "Nov 5, 2024", status: "completed" },
                    ].map((payment, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            payment.status === "completed" ? "bg-emerald-500" :
                            payment.status === "pending" ? "bg-amber-500" :
                            payment.status === "trial" ? "bg-blue-500" :
                            "bg-red-500"
                          }`} />
                          <div>
                            <p className="font-medium text-sm">{payment.uni}</p>
                            <p className="text-xs text-muted-foreground">{payment.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            {payment.amount > 0 ? `$${payment.amount.toLocaleString()}` : "Trial"}
                          </p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Plan Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Comparison</CardTitle>
              <CardDescription>Feature comparison across plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Feature</th>
                      <th className="text-center p-4 font-semibold">Free</th>
                      <th className="text-center p-4 font-semibold">Basic</th>
                      <th className="text-center p-4 font-semibold">Professional</th>
                      <th className="text-center p-4 font-semibold">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: "Student Limit", values: ["100", "1,000", "10,000", "Unlimited"] },
                      { feature: "Storage", values: ["1 GB", "50 GB", "200 GB", "500 GB"] },
                      { feature: "Custom Domain", values: ["✗", "✗", "✓", "✓"] },
                      { feature: "API Access", values: ["✗", "✗", "✓", "✓"] },
                      { feature: "SSO / SAML", values: ["✗", "✗", "✗", "✓"] },
                      { feature: "Priority Support", values: ["✗", "✗", "✓", "✓"] },
                      { feature: "Custom Integrations", values: ["✗", "✗", "✗", "✓"] },
                      { feature: "SLA Guarantee", values: ["✗", "✗", "✗", "99.9%"] },
                      { feature: "Price/Month", values: ["$0", "$199", "$499", "$999+"] },
                    ].map((row, i) => (
                      <tr key={i} className={`border-b ${i % 2 === 0 ? "bg-muted/30" : ""}`}>
                        <td className="p-4 text-sm">{row.feature}</td>
                        {row.values.map((val, j) => (
                          <td key={j} className="p-4 text-center text-sm">
                            {j === 3 ? (
                              <span className="text-amber-600 font-semibold">{val}</span>
                            ) : val === "✓" ? (
                              <CheckCircle2 className="inline h-5 w-5 text-emerald-500" />
                            ) : val === "✗" ? (
                              <span className="text-muted-foreground">×</span>
                            ) : (
                              val
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest platform activities and events</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {recentActivityData.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        activity.type === "success" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        activity.type === "warning" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                        activity.type === "error" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        <activity.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-sm text-muted-foreground truncate">{activity.entity}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {activity.time}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add University Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New University</DialogTitle>
            <DialogDescription>
              Register a new university on the InternHub platform.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">University Name *</label>
                <Input id="name" placeholder="e.g., Stanford University" />
              </div>
              <div className="space-y-2">
                <label htmlFor="slug" className="text-sm font-medium">Slug *</label>
                <Input id="slug" placeholder="e.g., stanford" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Admin Email *</label>
                <Input id="email" type="email" placeholder="admin@university.edu" />
              </div>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">Phone</label>
                <Input id="phone" placeholder="+1-xxx-xxx-xxxx" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="domain" className="text-sm font-medium">Domain</label>
              <Input id="domain" placeholder="university.edu" />
            </div>

            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">Address</label>
              <textarea
                id="address"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Full physical address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subscription Plan *</label>
                <Select defaultValue="professional">
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic - $199/mo</SelectItem>
                    <SelectItem value="professional">Professional - $499/mo</SelectItem>
                    <SelectItem value="enterprise">Enterprise - Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Status</label>
                <Select defaultValue="trial">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial (30 days)</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsAddDialogOpen(false)}>
              Create University
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the university
              and all associated data including students, internships, and documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                console.log("Deleting university:", universityToDelete);
                setIsDeleteDialogOpen(false);
                setUniversityToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* University Detail Sheet/Modal could go here */}
      <AnimatePresence>
        {selectedUniversity && (
          <Dialog open={!!selectedUniversity} onOpenChange={() => setSelectedUniversity(null)}>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedUniversity.logo_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {selectedUniversity.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-xl">{selectedUniversity.name}</DialogTitle>
                    <DialogDescription>{selectedUniversity.slug}.internhub.com</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Separator />

              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{selectedUniversity.students_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold capitalize">{selectedUniversity.subscription.plan}</p>
                    <p className="text-xs text-muted-foreground">Plan</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <StatusBadge status={selectedUniversity.is_active ? "active" : "inactive"} size="md" />
                    <p className="text-xs text-muted-foreground mt-1">Status</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">
                      {Math.round((selectedUniversity.students_count / selectedUniversity.subscription.student_limit) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Capacity</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedUniversity.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedUniversity.phone || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Domain</p>
                      <p className="font-medium">{selectedUniversity.domain || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {new Date(selectedUniversity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {selectedUniversity.address && (
                    <div>
                      <p className="text-muted-foreground text-sm">Address</p>
                      <p className="font-medium text-sm">{selectedUniversity.address}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Subscription Details</h4>
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <PlanBadge plan={selectedUniversity.subscription.plan} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={selectedUniversity.subscription.status} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Period</span>
                      <span>
                        {new Date(selectedUniversity.subscription.start_date).toLocaleDateString()} - {" "}
                        {new Date(selectedUniversity.subscription.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Student Limit</span>
                      <span>{selectedUniversity.subscription.student_limit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Storage Limit</span>
                      <span>{(selectedUniversity.subscription.storage_limit_mb / 1024).toFixed(0)} GB</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Price</span>
                      <span>${selectedUniversity.subscription.price.toLocaleString()}/mo</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Storage Usage</h4>
                  <div className="space-y-2">
                    <Progress value={65} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>32.5 GB used</span>
                      <span>50 GB limit</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedUniversity(null)}>
                  Close
                </Button>
                <Button variant="outline">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Full Details
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
