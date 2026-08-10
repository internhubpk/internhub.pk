"use client";

import React from "react";
import { motion } from "framer-motion";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Briefcase,
  FileText,
  Award,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  GraduationCap,
} from "lucide-react";

// Mock stats data
const mockStats = [
  {
    title: "Total Students",
    value: "1,234",
    change: "+12%",
    icon: Users,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    title: "Active Internships",
    value: "456",
    change: "+8%",
    icon: Briefcase,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    title: "Pending Evaluations",
    value: "89",
    change: "-5%",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    title: "Certificates Issued",
    value: "789",
    change: "+15%",
    icon: Award,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
  },
];

const recentActivities = [
  {
    id: 1,
    user: "John Smith",
    action: "submitted weekly log for Week 8",
    time: "2 minutes ago",
    type: "log" as const,
  },
  {
    id: 2,
    user: "Sarah Johnson",
    action: "completed internship evaluation",
    time: "15 minutes ago",
    type: "evaluation" as const,
  },
  {
    id: 3,
    user: "Mike Chen",
    action: "applied to Software Engineering Internship",
    time: "1 hour ago",
    type: "application" as const,
  },
  {
    id: 4,
    user: "Emily Davis",
    action: "certificate generated and sent",
    time: "2 hours ago",
    type: "certificate" as const,
  },
];

function DashboardContent() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header />

        {/* Dashboard Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Welcome back! 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                Here&apos;s what&apos;s happening with your internship program today.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {mockStats.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <Card className="card-hover">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className={stat.change.startsWith("+") ? "text-emerald-600" : "text-red-600"}>
                          {stat.change}
                        </span>{" "}
                        from last month
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Content Grid */}
            <div className="grid gap-6 lg:grid-cols-7">
              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="lg:col-span-4"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>
                      Latest actions across your internship program
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="mt-0.5">
                            {activity.type === "log" && (
                              <FileText className="h-4 w-4 text-blue-500" />
                            )}
                            {activity.type === "evaluation" && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                            {activity.type === "application" && (
                              <Briefcase className="h-4 w-4 text-purple-500" />
                            )}
                            {activity.type === "certificate" && (
                              <Award className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{activity.user}</span>{" "}
                              {activity.action}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {activity.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" className="w-full mt-4">
                      View All Activity
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Actions & Info */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="lg:col-span-3 space-y-6"
              >
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                      <GraduationCap className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Add Student</span>
                    </Button>
                    <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                      <Briefcase className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">New Internship</span>
                    </Button>
                    <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                      <Building2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm">Add Company</span>
                    </Button>
                    <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Generate Report</span>
                    </Button>
                  </CardContent>
                </Card>

                {/* System Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      System Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Storage Used
                      </span>
                      <span className="text-sm font-medium">45.2 GB / 100 GB</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-[45%] bg-gradient-to-r from-primary to-accent-purple rounded-full" />
                    </div>
                    
                    <div className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm">System Status</span>
                        </div>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Operational
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">Active Users</span>
                        </div>
                        <span className="text-sm font-medium">247 online</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm">Pending Tasks</span>
                        </div>
                        <span className="text-sm font-medium">12 tasks</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="border-t py-4 px-6 mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} InternHub. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
