"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon,
  Save,
  Bell,
  Shield,
  Globe,
  Phone,
  MapPin,
  Building2,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { AvatarUploader } from "@/components/shared/avatar-uploader";
import { PasswordChangeCard } from "@/components/auth/password-change-card";
import { Separator } from "@/components/ui/separator";

interface UniversitySettings {
  name: string;
  slug: string;
  domain: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  is_active: boolean;
}

interface NotificationPrefs {
  in_app_on_application: boolean;
  in_app_on_task_submission: boolean;
  in_app_on_evaluation: boolean;
  in_app_on_weekly_log: boolean;
  desktop_notifications: boolean;
  sound_enabled: boolean;
}

const defaultNotifications: NotificationPrefs = {
  in_app_on_application: true,
  in_app_on_task_submission: true,
  in_app_on_evaluation: true,
  in_app_on_weekly_log: true,
  desktop_notifications: true,
  sound_enabled: false,
};

export default function UniversityAdminSettingsPage() {
  const { user, profile, university, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<UniversitySettings>({
    name: "",
    slug: "",
    domain: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    is_active: true,
  });
  const [notifications, setNotifications] = useState<NotificationPrefs>(defaultNotifications);
  const [notFound, setNotFound] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const universityId = profile?.university_id || university?.id;

  const loadSettings = useCallback(async () => {
    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .eq("id", universityId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned — university not found
          setNotFound(true);
        } else {
          throw error;
        }
        return;
      }

      if (data) {
        setFormData({
          name: data.name || "",
          slug: data.slug || "",
          domain: data.domain || "",
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          country: data.country || "",
          is_active: data.is_active ?? true,
        });
        // Notification prefs are now stored in localStorage keyed by
        // user.id (see the dedicated useEffect below) to match the
        // coordinator pattern — no longer coupled to universities.settings.
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Error", { description: "Failed to load university settings" });
    } finally {
      setIsLoading(false);
    }
  }, [universityId, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load in-app notification prefs from the `profiles.notification_prefs`
  // jsonb column (migration 0043). Previously these were stored in
  // localStorage keyed by user.id — that meant prefs didn't sync across
  // devices/browsers and were silently lost when the user cleared
  // browser data. The DB column is the source of truth now.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        if (!supabase) return;
        const { data } = await supabase
          .from("profiles")
          .select("notification_prefs")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const stored = (data?.notification_prefs as Partial<NotificationPrefs> | null) || null;
        if (stored) {
          setNotifications({ ...defaultNotifications, ...stored });
        }
      } catch {
        // ignore — fall back to defaults
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleSaveGeneral = async () => {
    if (!universityId) return;

    if (!formData.name.trim()) {
      toast.error("Validation Error", { description: "University name is required" });
      return;
    }

    if (!formData.contact_email.trim() || !formData.contact_email.includes("@")) {
      toast.error("Validation Error", { description: "A valid contact email is required" });
      return;
    }

    try {
      setIsSaving(true);
      const supabase = createClient();

      const { error } = await supabase
        .from("universities")
        .update({
          name: formData.name.trim(),
          domain: formData.domain.trim() || null,
          contact_email: formData.contact_email.trim(),
          contact_phone: formData.contact_phone.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          country: formData.country.trim() || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", universityId);

      if (error) throw error;

      toast.success("Saved", { description: "University information updated successfully" });

      // Refresh the auth context so the sidebar / header reflect the new name
      await refreshProfile();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error", { description: "Failed to save settings. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    try {
      setIsSaving(true);
      // Persist to `profiles.notification_prefs` (migration 0043) so
      // prefs sync across devices/browsers. The previous localStorage
      // approach was per-browser only.
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");
      const { error: prefsErr } = await supabase
        .from("profiles")
        .update({
          // Cast through `unknown` because `NotificationPrefs` (an interface
          // with named boolean fields) doesn't structurally overlap with
          // `Record<string, unknown>` — TS2352. The jsonb column accepts any
          // JSON shape, so this is a safe persistence boundary.
          notification_prefs: notifications as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (prefsErr) throw prefsErr;
      toast.success("Saved", { description: "Notification preferences updated" });
    } catch (error) {
      console.error("Error saving notifications:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to save notification preferences" });
    } finally {
      setIsSaving(false);
    }
  };

  // Sync admin name from profile
  useEffect(() => {
    if (profile?.full_name) {
      setAdminName(profile.full_name);
    }
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound || !universityId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Manage your university settings" />
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No university assigned</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your admin account is not linked to a university yet. Please ask
                a Super Admin to assign you to a university before you can manage
                university settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Settings"
        description={`Manage settings for ${university?.name || "your university"}`}
      />

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="general">
            <Globe className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                University Information
              </CardTitle>
              <CardDescription>
                Update your university&apos;s basic contact information. Changes
                are visible across the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">University Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter university name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    placeholder="university-name"
                    value={formData.slug}
                    disabled
                    className="font-mono text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    The slug is system-managed and cannot be edited.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    placeholder="university.edu.pk"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    placeholder="contact@university.edu.pk"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    placeholder="+92 XXXXXXXXXX"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Karachi"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Province / State</Label>
                  <Input
                    id="state"
                    placeholder="Sindh"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="Pakistan"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Full street address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Badge variant={formData.is_active ? "default" : "secondary"}>
                  {formData.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Contact a Super Admin to change the active status of your university.
                </span>
              </div>

              <Button onClick={handleSaveGeneral} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> In-App Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which events trigger an in-app notification (shown in the bell icon at the top of every page). Notifications are stored in your inbox and can be reviewed anytime. Preferences are saved to your account and sync across devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  key: "in_app_on_application" as const,
                  title: "Application updates",
                  description:
                    "Notify me when a student applies to, is accepted for, or is rejected from an internship at my university.",
                },
                {
                  key: "in_app_on_task_submission" as const,
                  title: "Task submissions",
                  description:
                    "Notify me when a student submits a task assigned by a supervisor.",
                },
                {
                  key: "in_app_on_evaluation" as const,
                  title: "Evaluation submissions",
                  description:
                    "Notify me when a supervisor submits an evaluation for a student at my university.",
                },
                {
                  key: "in_app_on_weekly_log" as const,
                  title: "Weekly log submissions",
                  description:
                    "Notify me when a student submits a weekly log for review.",
                },
                {
                  key: "desktop_notifications" as const,
                  title: "Browser desktop notifications",
                  description:
                    "Show browser-level desktop notifications (requires permission) when new notifications arrive.",
                },
                {
                  key: "sound_enabled" as const,
                  title: "Notification sound",
                  description:
                    "Play a subtle sound when a new notification arrives while you have the dashboard open.",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b last:border-b-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{item.title}</Label>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key]}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, [item.key]: checked })
                    }
                  />
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveNotifications} disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> Notification Activity
              </CardTitle>
              <CardDescription>
                Recent notifications from your university&apos;s internship workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentNotificationsWidget userId={user?.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab — personal info + avatar */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Update your personal name and profile picture. These are visible to
                coordinators and students at your university.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                <Label htmlFor="ua-name">Full Name</Label>
                <Input
                  id="ua-name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ua-email">Account Email</Label>
                <Input
                  id="ua-email"
                  value={profile?.email || ""}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">
                  To change your account email, contact a Super Admin.
                </p>
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
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border p-4 bg-muted/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Account Status: Active</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your university admin account is active and in good standing.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <PasswordChangeCard />
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm text-amber-900 dark:text-amber-200">
                  Need bigger changes?
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                  For changes to your university slug, license tier, or to
                  deactivate the university, contact a Super Admin.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// RecentNotificationsWidget — shows latest in-app notifications
// for the university admin inside the settings page.
// ============================================================
function RecentNotificationsWidget({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications/inbox?limit=8");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.data)) {
          setNotifications(data.data);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No notifications yet</p>
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex gap-3 p-3 rounded-lg border ${
            !n.is_read ? "bg-primary/5 border-primary/20" : "bg-muted/30"
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{n.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {n.message}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {formatTime(n.created_at)}
              {n.metadata?.sender_name && ` · ${n.metadata.sender_name}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
