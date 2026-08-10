"use client";

import React, { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Download, TrendingUp, Users, Briefcase, Building2, CalendarDays, FileText } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function UniversityAdminReportsPage() {
  const [reportType, setReportType] = useState("overview");
  const [timeRange, setTimeRange] = useState("this_semester");

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">View and export program reports</p>
          </div>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export Report</Button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card><CardContent className="pt-6 pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-full sm:w-[200px] h-11"><BarChart3 className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Report Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Program Overview</SelectItem>
                <SelectItem value="placements">Placement Report</SelectItem>
                <SelectItem value="company">Company Analytics</SelectItem>
                <SelectItem value="department">Department Stats</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-[180px] h-11"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_semester">This Semester</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent></Card>
      </motion.div>

      {/* Key Metrics */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Placements", value: "456", change: "+12%", positive: true, icon: Users },
          { title: "Placement Rate", value: "78%", change: "+5%", positive: true, icon: TrendingUp },
          { title: "Active Companies", value: "89", change: "+8", positive: true, icon: Building2 },
          { title: "Avg. Satisfaction", value: "4.2/5", change: "+0.3", positive: true, icon: FileText },
        ].map((metric) => (
          <Card key={metric.title}><CardContent className="pt-6 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{metric.title}</p>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{metric.value}</p>
            <Badge variant={metric.positive ? "secondary" : "destructive"} className="mt-2 text-xs">{metric.change}</Badge>
          </CardContent></Card>
        ))}
      </motion.div>

      {/* Charts Placeholder */}
      <motion.div variants={itemVariants}>
        <Card><CardHeader><CardTitle>Internship Distribution by Department</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">Chart visualization would appear here</p>
              <p className="text-xs text-muted-foreground mt-1">Connect to analytics service for real data</p>
            </div>
          </div>
        </CardContent></Card>
      </motion.div>

      {/* Report Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card><CardHeader><CardTitle>Top Performing Departments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Computer Science", placementRate: 92, students: 450 },
              { name: "Data Science", placementRate: 88, students: 180 },
              { name: "Business", placementRate: 75, students: 320 },
              { name: "Design", placementRate: 82, students: 120 },
            ].map((dept, i) => (
              <div key={dept.name} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{dept.name}</p>
                  <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${dept.placementRate}%` }} />
                  </div>
                </div>
                <span className="font-semibold text-sm w-14 text-right">{dept.placementRate}%</span>
              </div>
            ))}
          </CardContent></Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card><CardHeader><CardTitle>Top Partner Companies</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "TechCorp Inc.", interns: 24, rating: 4.8 },
              { name: "DataAnalytics Pro", interns: 18, rating: 4.7 },
              { name: "InnovateTech", interns: 15, rating: 4.6 },
              { name: "StartupXYZ", interns: 10, rating: 4.5 },
            ].map((company) => (
              <div key={company.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.interns} intern(s)</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">★ {company.rating}</Badge>
              </div>
            ))}
          </CardContent></Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
