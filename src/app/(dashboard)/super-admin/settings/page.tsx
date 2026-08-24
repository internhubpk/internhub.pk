"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Save,
  Globe,
  Bell,
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Server,
  RefreshCw,
  Lock,
  Users,
  Building2,
  Briefcase,
  GraduationCap,
  FileText,
  User,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { AvatarUploader } from "@/components/shared/avatar-uploader";
import { PasswordChangeCard } from "@/components/auth/password-change-card";
import { toast } from "@/components/shared/toast";

/**
 * Super Admin — Platform Settings
 *
 * This page is intentionally LEAN. It only contains controls that actually
 * do something. Demo / placeholder content from earlier prototypes has been
 * removed:
 *   - Fake "License Management" section with hardcoded tier/limits
 *   - Fake "Plan Features" comparison table (Free / Pro / Enterprise)
 *   - "Upgrade Plan" button that called alert()
 *   - "Clear Cache" button that did nothing
 *   - "Export Data" button that did nothing
 *   - Hardcoded System Health numbers (storage_usage_percent: 23,
 *     active_connections: 15) — replaced with real DB reachability check
 *
 * What's left:
 *   1. General         — platform name, support email, language, max file size
 *   2. Notifications   — email + registration alert toggles
 *   3. Security        — 2FA + session-timeout toggles
 *   4. Platform Stats  — REAL counts: universities, companies, students, interns
 *   5. System Health   — REAL database reachability + version info
 */

interface PlatformSettings {
  platform_name: string;
  support_email: string;
  default_language: string;
  email_notifications: boolean;
  registration_alerts: boolean;
  require_2fa: boolean;
  session_timeout: boolean;
  max_file_size: number;
}

interface PlatformStats {
  total_universities: number;
  total_companies: number;
  total_students: number;
  total_faculty: number;
  total_internships: number;
  total_applications: number;
}

interface SystemHealth {
  database_status: "healthy" | "degraded" | "down";
  db_latency_ms: number | null;
  version: string;
}

interface StorageStats {
  total_used_bytes: number;
  total_file_count: number;
  universities: {
    university_id: string;
    university_name: string | null;
    used_bytes: number;
    used_mb: number;
    used_gb: number;
    file_count: number;
    student_count: number;
    usage_percentage: number;
  }[];
}

interface StorageState {
  stats: StorageStats | null;
  isLoading: boolean;
  error: string | null;
}

const defaultSettings: PlatformSettings = {
  platform_name: "CareerStep",
  support_email: "support@careerstep.tech",
  default_language: "en",
  email_notifications: true,
  registration_alerts: true,
  require_2fa: false,
  session_timeout: true,
  max_file_size: 10,
};

const emptyStats: PlatformStats = {
  total_universities: 0,
  total_companies: 0,
  total_students: 0,
  total_faculty: 0,
  total_internships: 0,
  total_applications: 0,
};

const emptyHealth: SystemHealth = {
  database_status: "healthy",
  db_latency_ms: null,
  // Read the app version from package.json via next.config.ts env injection
  // (NEXT_PUBLIC_APP_VERSION is inlined at build time). Falls back to
  // "—" if the env var is somehow missing.
  version: process.env.NEXT_PUBLIC_APP_VERSION || "—",
};

export default function SuperAdminSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [adminName, setAdminName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync admin name from profile
  useEffect(() => {
    if (profile?.full_name) setAdminName(profile.full_name);
  }, [profile?.full_name]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: adminName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile saved", { description: "Your name has been updated." });
      await refreshProfile();
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error("Failed to save profile", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsSavingProfile(false);
    }
  };
  const [stats, setStats] = useState<PlatformStats>(emptyStats);
  const [health, setHealth] = useState<SystemHealth>(emptyHealth);
  const [storage, setStorage] = useState<StorageState>({ stats: null, isLoading: false, error: null });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "global")
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found. That's fine — fall back to defaults.
      }

      if (data?.value) {
        try {
          // `platform_settings.value` is `jsonb`. PostgREST already returns
          // it as a parsed JS object/array/primitive. Older rows may have been
          // stored as a JSON-encoded *string* (a bug in the previous save
          // path), so guard against both shapes.
          const v =
            typeof data.value === "string"
              ? JSON.parse(data.value)
              : data.value;
          if (v && typeof v === "object") {
            setSettings({ ...defaultSettings, ...v });
          }
        } catch {
          // Bad JSON in DB — keep defaults
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  }, []);

  const fetchPlatformStats = useCallback(async () => {
    setIsRefreshingStats(true);
    try {
      const supabase = createClient();

      const [
        uniRes,
        coRes,
        studentsRes,
        facultyRes,
        internshipsRes,
        appsRes,
      ] = await Promise.all([
        supabase.from("universities").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "student"),
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "faculty_supervisor"),
        supabase.from("internships").select("id", { count: "exact", head: true }),
        // NOTE: real table is `internship_applications` — `applications` does not exist.
        supabase.from("internship_applications").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        total_universities: uniRes.count || 0,
        total_companies: coRes.count || 0,
        total_students: studentsRes.count || 0,
        total_faculty: facultyRes.count || 0,
        total_internships: internshipsRes.count || 0,
        total_applications: appsRes.count || 0,
      });
    } catch (e) {
      // Stats are non-critical; silently continue with zeros
    } finally {
      setIsRefreshingStats(false);
    }
  }, []);

  const fetchStorageStats = useCallback(async () => {
    setStorage((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch("/api/storage/stats");
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error || "Failed to load storage stats");
      }
      setStorage({ stats: result.data, isLoading: false, error: null });
    } catch (e: any) {
      setStorage({ stats: null, isLoading: false, error: e.message });
    }
  }, []);

  const fetchSystemHealth = useCallback(async () => {
    try {
      const supabase = createClient();

      // Measure DB latency with a tiny count query
      const started = Date.now();
      const { error } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .limit(1);
      const latency = Date.now() - started;

      if (error) {
        if (error.code === "42P01") {
          setHealth((prev) => ({
            ...prev,
            database_status: "degraded",
            db_latency_ms: latency,
          }));
        } else {
          setHealth((prev) => ({
            ...prev,
            database_status: "degraded",
            db_latency_ms: latency,
          }));
        }
      } else {
        setHealth((prev) => ({
          ...prev,
          database_status: "healthy",
          db_latency_ms: latency,
        }));
      }
    } catch (e) {
      setHealth((prev) => ({ ...prev, database_status: "down", db_latency_ms: null }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchSettings(), fetchPlatformStats(), fetchSystemHealth(), fetchStorageStats()]);
      setIsLoading(false);
    })();
  }, [fetchSettings, fetchPlatformStats, fetchSystemHealth, fetchStorageStats]);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();

      // Send `value` as a plain object — PostgREST will serialize it to jsonb.
      // Do NOT JSON.stringify it; storing a JSON string in a jsonb column
      // breaks the round-trip (the read path would receive a string, not an object).
      const { error } = await supabase.from("platform_settings").upsert(
        {
          key: "global",
          value: settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

      if (error) throw error;

      setMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: error.message || "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground mt-1">Configure global platform settings</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Loading...</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Platform Settings"
        description="Configure global platform settings and monitor system health"
        actions={
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        }
      />

      {/* Message Banner */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </motion.div>
      )}

      {/* Main Settings Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                General
              </CardTitle>
              <CardDescription>Basic platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform_name">Platform Name</Label>
                <Input
                  id="platform_name"
                  value={settings.platform_name}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, platform_name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="support_email">Support Email</Label>
                <Input
                  id="support_email"
                  type="email"
                  value={settings.support_email}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, support_email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Default Language</Label>
                <Select
                  value={settings.default_language}
                  onValueChange={(value) =>
                    setSettings((prev) => ({ ...prev, default_language: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ur">اردو (Urdu)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_file_size">Max File Size (MB)</Label>
                <Input
                  id="max_file_size"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.max_file_size}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      max_file_size: parseInt(e.target.value) || 10,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Email notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Send email alerts to users</p>
                </div>
                <Switch
                  checked={settings.email_notifications}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, email_notifications: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">New Registration Alerts</p>
                  <p className="text-sm text-muted-foreground">Notify admins of new signups</p>
                </div>
                <Switch
                  checked={settings.registration_alerts}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, registration_alerts: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Security and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
                </div>
                <Switch
                  checked={settings.require_2fa}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, require_2fa: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Session Timeout</p>
                  <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                </div>
                <Switch
                  checked={settings.session_timeout}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, session_timeout: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                      Security Tip
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Enable 2FA for all admin accounts to enhance security. Toggles here are
                      stored as platform policy; per-account 2FA enforcement is configured
                      in your Supabase Auth settings.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Health
              </CardTitle>
              <CardDescription>Live database reachability and platform info</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Database Status */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  health.database_status === "healthy"
                    ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                    : health.database_status === "degraded"
                    ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                    : "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800"
                }`}
              >
                <Server
                  className={`h-5 w-5 flex-shrink-0 ${
                    health.database_status === "healthy"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : health.database_status === "degraded"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={`font-medium text-sm capitalize ${
                      health.database_status === "healthy"
                        ? "text-emerald-800 dark:text-emerald-200"
                        : health.database_status === "degraded"
                        ? "text-amber-800 dark:text-amber-200"
                        : "text-red-800 dark:text-red-200"
                    }`}
                  >
                    Database: {health.database_status}
                  </span>
                  {health.db_latency_ms !== null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Query latency: {health.db_latency_ms} ms
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    health.database_status === "healthy"
                      ? "default"
                      : health.database_status === "degraded"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {health.database_status}
                </Badge>
              </div>

              {/* Version Info */}
              <div className="pt-2 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App Version</span>
                  <span className="font-mono">{health.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auth Provider</span>
                  <span className="font-medium">Supabase Auth</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database</span>
                  <span className="font-medium">PostgreSQL (Supabase)</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  fetchSystemHealth();
                  setMessage({ type: "success", text: "System health refreshed!" });
                  setTimeout(() => setMessage(null), 2000);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Storage Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Storage Statistics
                  </CardTitle>
                  <CardDescription>
                    Real storage usage aggregated from the documents table.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStorageStats}
                  disabled={storage.isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${storage.isLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {storage.isLoading && !storage.stats && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-3" />
                  <span className="text-muted-foreground">Loading storage stats…</span>
                </div>
              )}


              {storage.error && !storage.stats && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-300">{storage.error}</span>
                </div>
              )}

              {storage.stats && (
                <>
                  {/* Summary row */}
                  <div className="grid gap-4 sm:grid-cols-3 mb-6">
                    <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-sm font-medium text-muted-foreground">Total Files</p>
                      <p className="text-2xl font-bold mt-1">{storage.stats.total_file_count.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-muted-foreground">Total Used</p>
                      <p className="text-2xl font-bold mt-1">
                        {storage.stats.total_used_bytes >= 1024 * 1024 * 1024
                          ? `${storage.stats.universities.reduce((a, u) => a + u.used_gb, 0).toFixed(2)} GB`
                          : `${storage.stats.universities.reduce((a, u) => a + u.used_mb, 0)} MB`}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-medium text-muted-foreground">Universities</p>
                      <p className="text-2xl font-bold mt-1">{storage.stats.universities.length}</p>
                    </div>
                  </div>

                  {/* Per-university breakdown */}
                  {storage.stats.universities.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th className="text-left p-3 font-medium">University</th>
                            <th className="text-right p-3 font-medium">Students</th>
                            <th className="text-right p-3 font-medium">Files</th>
                            <th className="text-right p-3 font-medium">Used</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {storage.stats.universities
                            .filter((u) => u.file_count > 0)
                            .map((u) => (
                              <tr key={u.university_id} className="hover:bg-muted/50">
                                <td className="p-3 font-medium">{u.university_name || "Unknown"}</td>
                                <td className="p-3 text-right text-muted-foreground">{u.student_count}</td>
                                <td className="p-3 text-right text-muted-foreground">{u.file_count}</td>
                                <td className="p-3 text-right font-mono">
                                  {u.used_gb >= 1 ? `${u.used_gb} GB` : `${u.used_mb} MB`}
                                </td>
                              </tr>
                            ))}
                          {storage.stats.universities.every((u) => u.file_count === 0) && (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-muted-foreground">
                                No documents uploaded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No universities found.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Personal Profile + Password */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Profile
            </CardTitle>
            <CardDescription>Update your name and profile picture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AvatarUploader
              userId={user?.id || ""}
              currentUrl={profile?.avatar_url}
              fullName={profile?.full_name}
              onUploaded={() => refreshProfile()}
              onRemoved={() => refreshProfile()}
              size="md"
            />
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="sa-name" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Full Name
              </Label>
              <Input
                id="sa-name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="sa-email"
                value={user?.email || ""}
                disabled
                className="bg-muted/50"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="gap-2">
                {isSavingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
        <PasswordChangeCard />
      </div>

      {/* Platform Statistics — real counts from the DB */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Platform Statistics
                </CardTitle>
                <CardDescription>
                  Live counts pulled from the database. Click refresh to update.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPlatformStats}
                disabled={isRefreshingStats}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isRefreshingStats ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile
                label="Universities"
                value={stats.total_universities}
                icon={<Building2 className="h-5 w-5 text-blue-500" />}
                accent="bg-blue-50 dark:bg-blue-950/30"
              />
              <StatTile
                label="Companies"
                value={stats.total_companies}
                icon={<Briefcase className="h-5 w-5 text-orange-500" />}
                accent="bg-orange-50 dark:bg-orange-950/30"
              />
              <StatTile
                label="Students"
                value={stats.total_students}
                icon={<GraduationCap className="h-5 w-5 text-emerald-500" />}
                accent="bg-emerald-50 dark:bg-emerald-950/30"
              />
              <StatTile
                label="Faculty Supervisors"
                value={stats.total_faculty}
                icon={<Users className="h-5 w-5 text-teal-500" />}
                accent="bg-teal-50 dark:bg-teal-950/30"
              />
              <StatTile
                label="Internships"
                value={stats.total_internships}
                icon={<FileText className="h-5 w-5 text-purple-500" />}
                accent="bg-purple-50 dark:bg-purple-950/30"
              />
              <StatTile
                label="Applications"
                value={stats.total_applications}
                icon={<FileText className="h-5 w-5 text-amber-500" />}
                accent="bg-amber-50 dark:bg-amber-950/30"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/**
 * Small tile component for displaying a single stat.
 */
function StatTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`p-4 rounded-lg ${accent} border border-border/50`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
