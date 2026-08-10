"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Activity,
  Plus,
  Settings,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Database,
  CheckCircle2,
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
}

type DataState = "loading" | "ready" | "error" | "no_tables";

export default function SuperAdminDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const supabase = createClient();
      
      // Try to fetch stats - use Promise.allSettled to handle errors gracefully
      const results = await Promise.allSettled([
        supabase.from("universities").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("internships").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      
      // Extract values or defaults
      const uniRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const userRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const internRes = results[2].status === 'fulfilled' ? results[2].value : null;

      // Check if we got actual errors (table doesn't exist)
      const hasTableErrors = [uniRes, userRes, internRes].some(
        (res: any) => res?.error?.code === "42P01" || res?.error?.message?.includes("does not exist")
      );

      if (hasTableErrors) {
        setDataState("no_tables");
        setStats(null);
        return;
      }

      setStats({
        totalUniversities: uniRes?.count || 0,
        totalUsers: userRes?.count || 0,
        activeInternships: internRes?.count || 0,
      });
      
      setDataState("ready");
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      
      // Check if it's a "table does not exist" error
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        setDataState("no_tables");
      } else {
        setDataState("error");
        setErrorMessage(error?.message || "An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: "Universities",
      value: dataState === "ready" ? (stats?.totalUniversities.toString() || "0") : "-",
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Users",
      value: dataState === "ready" ? (stats?.totalUsers.toString() || "0") : "-",
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Internships",
      value: dataState === "ready" ? (stats?.activeInternships.toString() || "0") : "-",
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
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
        <Button variant="outline" onClick={fetchStats} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Database Setup Required Alert */}
      {dataState === "no_tables" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Database className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 mb-2">
                  Database Setup Required
                </h3>
                <p className="text-amber-700 text-sm mb-4">
                  The required database tables haven&apos;t been created yet. You need to run the 
                  setup SQL script in your Supabase dashboard.
                </p>
                
                <div className="bg-white rounded-lg p-4 border border-amber-200 space-y-3">
                  <p className="font-medium text-sm text-amber-800">📋 Setup Steps:</p>
                  <ol className="list-decimal list-inside text-sm text-amber-700 space-y-1 ml-2">
                    <li>Go to your Supabase project dashboard</li>
                    <li>Navigate to <strong>SQL Editor</strong> (left sidebar)</li>
                    <li>Click <strong>New Query</strong></li>
                    <li>Copy and paste the contents of <code className="bg-amber-100 px-1 rounded">supabase-schema.sql</code> file</li>
                    <li>Click <strong>Run</strong> to execute</li>
                  </ol>
                  
                  <div className="flex items-center gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.open('/supabase-schema.sql', '_blank')}
                    >
                      View Schema File
                    </Button>
                    <Button 
                      size="sm"
                      onClick={fetchStats}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry After Setup
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {dataState === "error" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">Error Loading Data</h3>
                <p className="text-red-700 text-sm">{errorMessage}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={fetchStats}>
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${dataState !== "ready" ? "opacity-50 pointer-events-none" : ""}`}>
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

        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${dataState !== "ready" ? "opacity-50 pointer-events-none" : ""}`}>
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

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Platform Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats || dataState !== "ready" ? (
            <div className="flex flex-col items-center justify-center py-12">
              {dataState === "loading" ? (
                <>
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
                  <p className="text-muted-foreground">Loading platform data...</p>
                </>
              ) : dataState === "no_tables" ? (
                <>
                  <Database className="h-12 w-12 mx-auto text-amber-500/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Awaiting Database Setup</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Run the schema SQL script to enable all features.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 mx-auto text-red-500/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Unable to Load Data</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    There was an error connecting to the database.
                  </p>
                </>
              )}
            </div>
          ) : stats.totalUniversities === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Database Ready!</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Your platform is ready! Start by adding your first university.
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
