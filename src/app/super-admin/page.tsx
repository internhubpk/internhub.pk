"use client";

import React from "react";
import Link from "next/link";
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
import {
  Building2,
  Users,
  Briefcase,
  Activity,
  TrendingUp,
  ArrowRight,
  Settings,
  Shield,
  Database,
  CreditCard,
  BarChart3,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

// Mock data for super admin
const mockStats = {
  totalUniversities: 45,
  activeUsers: 12500,
  totalInternships: 2340,
  monthlyRevenue: 45000,
};

const recentActivity = [
  { id: 1, type: "university", action: "New university registered", entity: "Tech University", time: "10 min ago" },
  { id: 2, type: "payment", action: "Subscription payment received", entity: "State University - Pro Plan", time: "25 min ago" },
  { id: 3, type: "user", action: "New admin user created", entity: "admin@newuni.edu", time: "1 hour ago" },
  { id: 4, type: "system", action: "Database backup completed", entity: "Automatic", time: "3 hours ago" },
];

const systemHealth = [
  { name: "API Server", status: "operational", uptime: "99.9%" },
  { name: "Database", status: "operational", latency: "12ms" },
  { name: "Storage", status: "warning", usage: "78%" },
  { name: "CDN", status: "operational", latency: "45ms" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function SuperAdminDashboard() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Super Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Platform-wide overview and management
            </p>
          </div>
          <Badge variant="secondary" className="py-1.5 px-3 self-start sm:self-auto">
            <Shield className="mr-1.5 h-4 w-4" />
            Super Admin
          </Badge>
        </div>
      </motion.div>

      {/* Platform Stats */}
      <motion.div
        variants={itemVariants}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: "Total Universities", value: mockStats.totalUniversities, icon: Building2, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
          { label: "Active Users", value: mockStats.activeUsers.toLocaleString(), icon: Users, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
          { label: "Active Internships", value: mockStats.totalInternships.toLocaleString(), icon: Briefcase, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Monthly Revenue", value: `$${(mockStats.monthlyRevenue / 1000).toFixed(1)}k`, icon: CreditCard, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* System Health & Recent Activity */}
        <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Platform status and performance</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                All Systems Operational
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {systemHealth.map((service) => (
                  <div key={service.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {service.status === "operational" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
                      <span className="font-medium text-sm">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {service.status === "operational" ? service.uptime : service.usage}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Platform Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest platform events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={`mt-0.5 p-1.5 rounded-md ${
                      activity.type === "university"
                        ? "bg-blue-100 text-blue-600"
                        : activity.type === "payment"
                        ? "bg-emerald-100 text-emerald-600"
                        : activity.type === "user"
                        ? "bg-purple-100 text-purple-600"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {activity.type === "university" ? (
                        <Building2 className="h-4 w-4" />
                      ) : activity.type === "payment" ? (
                        <CreditCard className="h-4 w-4" />
                      ) : activity.type === "user" ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        <Activity className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.action}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.entity}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Quick Links */}
        <motion.div variants={itemVariants} className="lg:col-span-3 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                <Link href="/super-admin/universities">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Universities</span>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                <Link href="/super-admin/users">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">User Management</span>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                <Link href="/super-admin/settings">
                  <Settings className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Platform Settings</span>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                <Link href="#">
                  <BarChart3 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm">Analytics</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Storage Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Storage Used</span>
                  <span className="font-medium">2.4 TB / 10 TB</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-[24%] bg-primary rounded-full" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Database className="mx-auto h-5 w-5 text-primary mb-1" />
                  <p className="text-lg font-bold">1.8 TB</p>
                  <p className="text-xs text-muted-foreground">Documents</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Globe className="mx-auto h-5 w-5 text-blue-500 mb-1" />
                  <p className="text-lg font-bold">600 GB</p>
                  <p className="text-xs text-muted-foreground">Media</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900 dark:text-amber-100">Storage Warning</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Storage usage is approaching threshold. Consider upgrading plan.
                  </p>
                  <Button size="sm" variant="outline" className="mt-3">
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
