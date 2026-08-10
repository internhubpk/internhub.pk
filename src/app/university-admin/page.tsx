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
  Users,
  Building2,
  Briefcase,
  FileText,
  GraduationCap,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  Settings,
} from "lucide-react";

// Mock data for university admin dashboard
const mockStats = {
  totalStudents: 1234,
  activeInternships: 456,
  partnerCompanies: 89,
  pendingApprovals: 23,
};

const recentActivity = [
  { id: 1, type: "student", action: "New student registered", user: "Alice Brown", time: "5 min ago" },
  { id: 2, type: "company", action: "Company verification request", user: "StartupXYZ Inc.", time: "15 min ago" },
  { id: 3, type: "internship", action: "New internship posted", user: "TechCorp - SWE Intern", time: "1 hour ago" },
  { id: 4, type: "evaluation", action: "Evaluation completed", user: "Dr. Smith to John Doe", time: "2 hours ago" },
];

const quickLinks = [
  { title: "Manage Students", href: "/university-admin/students", icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  { title: "Partner Companies", href: "/university-admin/companies", icon: Building2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  { title: "Departments", href: "/university-admin/departments", icon: GraduationCap, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
  { title: "Reports & Analytics", href: "/university-admin/reports", icon: BarChart3, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function UniversityAdminDashboard() {
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
              University Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Overview of your university&apos;s internship program
            </p>
          </div>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/university-admin/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={itemVariants}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: "Total Students", value: mockStats.totalStudents.toLocaleString(), icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
          { label: "Active Internships", value: mockStats.activeInternships, icon: Briefcase, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
          { label: "Partner Companies", value: mockStats.partnerCompanies, icon: Building2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Pending Approvals", value: mockStats.pendingApprovals, icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
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
        {/* Recent Activity */}
        <motion.div variants={itemVariants} className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions across your platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`mt-0.5 p-1.5 rounded-md ${
                      activity.type === "student" ? "bg-blue-100 text-blue-600" :
                      activity.type === "company" ? "bg-emerald-100 text-emerald-600" :
                      activity.type === "internship" ? "bg-purple-100 text-purple-600" :
                      "bg-amber-100 text-amber-600"
                    }`}>
                      {activity.type === "student" ? <Users className="h-4 w-4" /> :
                       activity.type === "company" ? <Building2 className="h-4 w-4" /> :
                       activity.type === "internship" ? <Briefcase className="h-4 w-4" /> :
                       <FileText className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm"><span className="font-medium">{activity.action}</span></p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4" size="sm">View All Activity</Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Links & Alerts */}
        <motion.div variants={itemVariants} className="lg:col-span-3 space-y-6">
          {/* Pending Approvals Alert */}
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900 dark:text-amber-100">Pending Approvals</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    You have {mockStats.pendingApprovals} items requiring your attention.
                  </p>
                  <Button size="sm" variant="outline" className="mt-3">Review Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickLinks.map((link) => (
                <Button key={link.title} variant="outline" className="w-full justify-start gap-3 h-auto py-3" asChild>
                  <Link href={link.href}>
                    <div className={`p-2 rounded-md ${link.color}`}>
                      <link.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{link.title}</span>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Program Health Overview */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Program Health Overview</CardTitle>
            <CardDescription>Key metrics for this semester</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { metric: "Placement Rate", value: "78%", trend: "+5%", positive: true },
                { metric: "Student Satisfaction", value: "4.2/5", trend: "+0.3", positive: true },
                { metric: "Company Retention", value: "92%", trend: "-2%", positive: false },
                { metric: "Avg. Completion Rate", value: "85%", trend: "+8%", positive: true },
              ].map((item) => (
                <div key={item.metric} className="p-4 rounded-lg border text-center">
                  <p className="text-sm text-muted-foreground mb-1">{item.metric}</p>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <Badge variant={item.positive ? "secondary" : "destructive"} className="mt-2 text-xs">
                    {item.trend}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
