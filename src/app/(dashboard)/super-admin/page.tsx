"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  Plus,
  Settings,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface PlatformStats {
  totalUniversities: number;
  totalUsers: number;
  activeInternships: number;
  revenue: number;
}

export default function SuperAdminDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const supabase = createClient();
      
      // Fetch real stats from database
      const [uniRes, userRes, internRes] = await Promise.all([
        supabase.from("universities").select("id", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("internships").select("id", { count: "exact" }).eq("status", "active"),
      ]);

      setStats({
        totalUniversities: uniRes.count || 0,
        totalUsers: userRes.count || 0,
        activeInternships: internRes.count || 0,
        revenue: 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Universities",
      value: stats?.totalUniversities.toString() || "0",
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Users",
      value: stats?.totalUsers.toString() || "0",
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Internships",
      value: stats?.activeInternships.toString() || "0",
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Revenue",
      value: `$${stats?.revenue.toLocaleString() || "0"}`,
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name || user?.email || "Admin"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <a href="/super-admin/universities">
              <Plus className="h-4 w-4 mr-2" />
              Add University
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
          <a href="/super-admin/users" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Users</h3>
                <p className="text-sm text-muted-foreground">View and manage all platform users</p>
              </div>
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/super-admin/universities" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Universities</h3>
                <p className="text-sm text-muted-foreground">Manage university tenants</p>
              </div>
            </div>
          </a>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <a href="/super-admin/settings" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <Settings className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">Settings</h3>
                <p className="text-sm text-muted-foreground">Platform configuration</p>
              </div>
            </div>
          </a>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Platform Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Loading platform data...</p>
              </div>
            </div>
          ) : stats.totalUniversities === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Your platform is ready! Start by adding your first university to begin managing internships.
              </p>
              <Button className="mt-4" asChild>
                <a href="/super-admin/universities">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First University
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Universities</p>
                  <p className="text-2xl font-bold">{stats.totalUniversities}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Registered Users</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Active Internships</p>
                  <p className="text-2xl font-bold">{stats.activeInternships}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
