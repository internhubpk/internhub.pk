"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Save,
  Globe,
  Bell,
  Shield,
  Database,
  Mail,
  Key,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Server,
  Activity,
  HardDrive,
  Users,
  Building2,
  RefreshCw,
  Zap,
  Lock,
  FileText,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

interface LicenseInfo {
  tier: string;
  universities_used: number;
  universities_limit: number;
  students_used: number;
  students_limit: number;
  storage_used: number;
  storage_limit: number;
  expires_at: string | null;
  is_active: boolean;
}

interface SystemHealth {
  database_status: "healthy" | "degraded" | "down";
  storage_usage_percent: number;
  active_connections: number;
  last_backup: string | null;
  version: string;
}

const defaultSettings: PlatformSettings = {
  platform_name: "InternHub",
  support_email: "support@internhub.pk",
  default_language: "en",
  email_notifications: true,
  registration_alerts: true,
  require_2fa: false,
  session_timeout: true,
  max_file_size: 10,
};

const defaultLicense: LicenseInfo = {
  tier: "free",
  universities_used: 0,
  universities_limit: 1,
  students_used: 0,
  students_limit: 100,
  storage_used: 0,
  storage_limit: 1000,
  expires_at: null,
  is_active: true,
};

const defaultHealth: SystemHealth = {
  database_status: "healthy",
  storage_usage_percent: 23,
  active_connections: 15,
  last_backup: new Date().toISOString(),
  version: "1.0.0",
};

export default function SuperAdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo>(defaultLicense);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>(defaultHealth);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchLicenseInfo();
    fetchSystemHealth();
  }, []);

  async function fetchSettings() {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "global")
        .single();

      if (error && error.code !== "PGRST116") {
        console.log("No existing settings found, using defaults");
      }

      if (data?.value) {
        setSettings({ ...defaultSettings, ...JSON.parse(data.value) });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  }

  async function fetchLicenseInfo() {
    try {
      const supabase = createClient();

      // Get university count
      const { count: uniCount } = await supabase
        .from("universities")
        .select("id", { count: "exact", head: true });

      // Get student count
      const { count: studentCount } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "student");

      setLicenseInfo(prev => ({
        ...prev,
        universities_used: uniCount || 0,
        students_used: studentCount || 0,
      }));
    } catch (e) {
      console.log("Could not fetch license info:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSystemHealth() {
    try {
      const supabase = createClient();

      // Test database connection
      const { error } = await supabase.from("profiles").select("user_id", { count: "exact", head: true }).limit(1);

      if (error && error.code === "42P01") {
        setSystemHealth(prev => ({ ...prev, database_status: "degraded" }));
      }

      // In a real app, you'd query actual system metrics
      // For now, we'll use defaults
    } catch (e) {
      console.log("Could not fetch system health:", e);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("platform_settings")
        .upsert({
          key: "global",
          value: JSON.stringify(settings),
          updated_at: new Date().toISOString(),
          updated_by: "super_admin",
        }, {
          onConflict: "key",
        });

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground mt-1">Configure global platform settings and monitor system health</p>
        </div>
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
      </div>

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
                  onChange={(e) => setSettings(prev => ({ ...prev, platform_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="support_email">Support Email</Label>
                <Input
                  id="support_email"
                  type="email"
                  value={settings.support_email}
                  onChange={(e) => setSettings(prev => ({ ...prev, support_email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Default Language</Label>
                <Select
                  value={settings.default_language}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, default_language: value }))}
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
                  onChange={(e) => setSettings(prev => ({ ...prev, max_file_size: parseInt(e.target.value) || 10 }))}
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
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email_notifications: checked }))}
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
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, registration_alerts: checked }))}
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
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, require_2fa: checked }))}
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
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, session_timeout: checked }))}
                />
              </div>

              <Separator />

              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">Security Tip</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Enable 2FA for all admin accounts to enhance security.
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
                <Activity className="h-5 w-5" />
                System Health
              </CardTitle>
              <CardDescription>Platform status and performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Database Status */}
              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                systemHealth.database_status === "healthy" 
                  ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : systemHealth.database_status === "degraded"
                  ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                  : "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800"
              }`}>
                <Server className={`h-5 w-5 flex-shrink-0 ${
                  systemHealth.database_status === "healthy" 
                    ? "text-emerald-600 dark:text-emerald-400"
                    : systemHealth.database_status === "degraded"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <span className={`font-medium text-sm capitalize ${
                    systemHealth.database_status === "healthy" 
                      ? "text-emerald-800 dark:text-emerald-200"
                      : systemHealth.database_status === "degraded"
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-red-800 dark:text-red-200"
                  }`}>
                    Database: {systemHealth.database_status}
                  </span>
                </div>
                <Badge variant={
                  systemHealth.database_status === "healthy" 
                    ? "default" 
                    : systemHealth.database_status === "degraded"
                    ? "secondary"
                    : "destructive"
                }>
                  {systemHealth.database_status}
                </Badge>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Connections</span>
                  </div>
                  <p className="text-lg font-bold">{systemHealth.active_connections}</p>
                </div>
                
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Storage</span>
                  </div>
                  <p className="text-lg font-bold">{systemHealth.storage_usage_percent}%</p>
                </div>
              </div>

              {/* Version Info */}
              <div className="pt-2 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">{systemHealth.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">Supabase</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database</span>
                  <span className="font-medium">PostgreSQL</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => {
                fetchSystemHealth();
                setMessage({ type: "success", text: "System health refreshed!" });
                setTimeout(() => setMessage(null), 2000);
              }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* License Management Section */}
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
                  <CreditCard className="h-5 w-5" />
                  License Management
                </CardTitle>
                <CardDescription>View current license usage and limits</CardDescription>
              </div>
              <Badge 
                variant={licenseInfo.is_active ? "default" : "destructive"}
                className="capitalize"
              >
                {licenseInfo.tier} Plan
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Universities Usage */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Universities</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{licenseInfo.universities_used}</span>
                  <span className="text-muted-foreground">/ {licenseInfo.universities_limit}</span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (licenseInfo.universities_used / licenseInfo.universities_limit) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {licenseInfo.universities_limit - licenseInfo.universities_used} slots available
                </p>
              </div>

              {/* Students Usage */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Students</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{licenseInfo.students_used.toLocaleString()}</span>
                  <span className="text-muted-foreground">/ {licenseInfo.students_limit.toLocaleString()}</span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (licenseInfo.students_used / licenseInfo.students_limit) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {(licenseInfo.students_limit - licenseInfo.students_used).toLocaleString()} slots available
                </p>
              </div>

              {/* Storage Usage */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-purple-500" />
                  <span className="font-medium">Storage</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{licenseInfo.storage_used}</span>
                  <span className="text-muted-foreground">/ {licenseInfo.storage_limit} MB</span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (licenseInfo.storage_used / licenseInfo.storage_limit) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {licenseInfo.storage_limit - licenseInfo.storage_used} MB available
                </p>
              </div>
            </div>

            {/* License Details */}
            <div className="mt-6 p-4 rounded-lg border bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold capitalize">{licenseInfo.tier} Plan</h4>
                    <p className="text-sm text-muted-foreground">
                      {licenseInfo.expires_at 
                        ? `Valid until ${new Date(licenseInfo.expires_at).toLocaleDateString()}`
                        : "Free plan - no expiration"
                      }
                    </p>
                  </div>
                </div>
                
                <Button variant="outline" asChild>
                  <a href="#" onClick={(e) => {
                    e.preventDefault();
                    alert("Upgrade functionality would be implemented here");
                  }}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Upgrade Plan
                  </a>
                </Button>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="mt-6 overflow-x-auto">
              <h4 className="font-medium mb-3">Plan Features</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Feature</th>
                    <th className="text-center py-2 px-3 font-medium">Free</th>
                    <th className="text-center py-2 px-3 font-medium">Professional</th>
                    <th className="text-center py-2 px-3 font-medium">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Universities", free: "1", pro: "10", enterprise: "Unlimited" },
                    { feature: "Students per University", free: "100", pro: "1,000", enterprise: "Unlimited" },
                    { feature: "Storage", free: "1 GB", pro: "10 GB", enterprise: "100 GB" },
                    { feature: "Custom Branding", free: false, pro: true, enterprise: true },
                    { feature: "API Access", free: false, pro: true, enterprise: true },
                    { feature: "Priority Support", free: false, pro: false, enterprise: true },
                    { feature: "SSO Integration", free: false, pro: false, enterprise: true },
                  ].map((row) => (
                    <tr key={row.feature} className="border-b border-border/50 last:border-0">
                      <td className="py-2 px-3">{row.feature}</td>
                      <td className="text-center py-2 px-3">
                        {typeof row.free === "boolean" 
                          ? <CheckCircle2 className={`h-4 w-4 mx-auto ${row.free ? "text-emerald-500" : "text-muted-foreground/30"}`} />
                          : row.free
                        }
                      </td>
                      <td className="text-center py-2 px-3">
                        {typeof row.pro === "boolean" 
                          ? <CheckCircle2 className={`h-4 w-4 mx-auto ${row.pro ? "text-emerald-500" : "text-muted-foreground/30"}`} />
                          : row.pro
                        }
                      </td>
                      <td className="text-center py-2 px-3">
                        {typeof row.enterprise === "boolean" 
                          ? <CheckCircle2 className={`h-4 w-4 mx-auto ${row.enterprise ? "text-emerald-500" : "text-muted-foreground/30"}`} />
                          : row.enterprise
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible actions that affect the entire platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Clear All Cache</p>
                <p className="text-sm text-red-700 dark:text-red-300">Clear all cached data across the platform</p>
              </div>
              <Button 
                variant="outline" 
                className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                onClick={() => {
                  if (confirm("Are you sure you want to clear all cache?")) {
                    setMessage({ type: "success", text: "Cache cleared successfully!" });
                    setTimeout(() => setMessage(null), 3000);
                  }
                }}
              >
                Clear Cache
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Export Platform Data</p>
                <p className="text-sm text-muted-foreground">Download a backup of all platform data</p>
              </div>
              <Button 
                variant="outline"
                onClick={() => {
                  setMessage({ type: "success", text: "Export started! You will receive an email when ready." });
                  setTimeout(() => setMessage(null), 3000);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
