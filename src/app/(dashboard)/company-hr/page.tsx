"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Users,
  UserCheck,
  Star,
  FileText,
  Clock,
  Plus,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Eye,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface CompanyStats {
  activeInternships: number;
  totalApplications: number;
  activeInterns: number;
  pendingReviews: number;
}

export default function CompanyHRDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCompanyStats();
  }, []);

  async function fetchCompanyStats() {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Fetch company-specific stats
      const [internRes, appsRes, activeRes, pendingRes] = await Promise.all([
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("company_id", profile?.company_id || user.id)
          .eq("status", "active"),
        supabase
          .from("applications")
          .select("id", { count: "exact" }),
        supabase
          .from("internships")
          .select("id", { count: "exact" })
          .eq("status", "active"),
        supabase
          .from("applications")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
      ]);

      setStats({
        activeInternships: internRes.count || 0,
        totalApplications: appsRes.count || 0,
        activeInterns: activeRes.count || 0,
        pendingReviews: pendingRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching company stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Active Internships",
      value: stats?.activeInternships.toString() || "0",
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Applications",
      value: stats?.totalApplications.toString() || "0",
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Interns",
      value: stats?.activeInterns.toString() || "0",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Pending Reviews",
      value: stats?.pendingReviews.toString() || "0",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company HR Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "HR Manager"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCompanyStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <a href="/company-hr/internships">
              <Plus className="h-4 w-4 mr-2" />
              Post Internship
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/company-hr/internships" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Internships</h3>
                <p className="text-sm text-muted-foreground">Post and manage internship listings</p>
              </div>
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/company-hr/applications" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Review Applications</h3>
                <p className="text-sm text-muted-foreground">Review and respond to applicants</p>
              </div>
              {stats?.pendingReviews ? (
                <Badge variant="destructive" className="ml-auto">{stats.pendingReviews}</Badge>
              ) : null}
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">Analytics</h3>
                <p className="text-sm text-muted-foreground">View performance metrics</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Company Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
                <p className="text-muted-foreground">Loading company data...</p>
              </div>
            </div>
          ) : stats.activeInternships === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Get Started</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Post your first internship listing to start receiving applications from talented students.
              </p>
              <Button className="mt-4" asChild>
                <a href="/company-hr/internships">
                  <Plus className="h-4 w-4 mr-2" />
                  Post First Internship
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Active Listings</p>
                  <p className="text-2xl font-bold">{stats.activeInternships}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Applications</p>
                  <p className="text-2xl font-bold">{stats.totalApplications}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Current Interns</p>
                  <p className="text-2xl font-bold">{stats.activeInterns}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Pending Reviews</p>
                  <p className="text-2xl font-bold">{stats.pendingReviews}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
