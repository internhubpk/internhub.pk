"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  Bell,
  Shield,
  Globe,
  Mail,
  Phone,
  MapPin,
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

interface CompanyForm {
  name: string;
  industry: string;
  website: string;
  size: string;
  description: string;
  address: string;
  city: string;
  country: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  logo_url: string;
  is_verified: boolean;
  is_active: boolean;
}

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url: string;
}

interface NotificationPrefs {
  in_app_on_application: boolean;
  in_app_on_task_submission: boolean;
  in_app_on_evaluation: boolean;
  in_app_on_weekly_log: boolean;
  desktop_notifications: boolean;
  sound_enabled: boolean;
}

const defaultCompany: CompanyForm = {
  name: "",
  industry: "",
  website: "",
  size: "",
  description: "",
  address: "",
  city: "",
  country: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  logo_url: "",
  is_verified: false,
  is_active: true,
};

const defaultProfile: ProfileForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  avatar_url: "",
};

const defaultNotifs: NotificationPrefs = {
  in_app_on_application: true,
  in_app_on_task_submission: true,
  in_app_on_evaluation: true,
  in_app_on_weekly_log: true,
  desktop_notifications: true,
  sound_enabled: false,
};

export default function CompanyHRSettingsPage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [companyForm, setCompanyForm] = useState<CompanyForm>(defaultCompany);
  const [profileForm, setProfileForm] = useState<ProfileForm>(defaultProfile);
  const [notifs, setNotifs] = useState<NotificationPrefs>(defaultNotifs);
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company-hr/settings", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      const c = j.data?.company;
      const p = j.data?.profile;
      if (c) {
        setCompanyForm({
          name: c.name || "",
          industry: c.industry || "",
          website: c.website || "",
          size: c.size || "",
          description: c.description || "",
          address: c.address || "",
          city: c.city || "",
          country: c.country || "",
          contact_person: c.contact_person || "",
          contact_email: c.contact_email || "",
          contact_phone: c.contact_phone || "",
          logo_url: c.logo_url || "",
          is_verified: c.is_verified ?? false,
          is_active: c.is_active ?? true,
        });
      }
      if (p) {
        setProfileForm({
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          email: p.email || "",
          phone: p.phone || "",
          avatar_url: p.avatar_url || "",
        });
      }
    } catch (e: any) {
      toast({
        title: "Error loading settings",
        description: e.message || "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Load in-app notification prefs from `profiles.notification_prefs`
  // (migration 0043). Previously stored in localStorage per-browser —
  // now persisted to DB so prefs sync across devices/browsers.
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
        if (stored) setNotifs({ ...defaultNotifs, ...stored });
      } catch {
        // ignore — fall back to defaults
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleSaveCompany = async () => {
    if (!companyForm.name.trim()) {
      toast({ title: "Validation error", description: "Company name is required", variant: "destructive" });
      return;
    }
    if (!companyForm.contact_email.trim() || !companyForm.contact_email.includes("@")) {
      toast({ title: "Validation error", description: "A valid contact email is required", variant: "destructive" });
      return;
    }
    setSavingCompany(true);
    try {
      const res = await fetch("/api/company-hr/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companyForm }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      toast({ title: "Saved", description: "Company profile updated successfully" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/company-hr/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: profileForm }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      toast({ title: "Saved", description: "Your profile was updated" });
      refreshProfile?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifs = async () => {
    if (!user) return;
    setSavingNotifs(true);
    try {
      // Persist to `profiles.notification_prefs` (migration 0043) so
      // prefs sync across devices/browsers.
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");
      const { error: prefsErr } = await supabase
        .from("profiles")
        .update({
          notification_prefs: notifs as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (prefsErr) throw prefsErr;
      toast({ title: "Saved", description: "Notification preferences updated" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSavingNotifs(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPwd.length < 8) {
      toast({ title: "Validation error", description: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: "Validation error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/company-hr/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `Failed (${res.status})`);
      toast({ title: "Password changed", description: "Your password was updated successfully" });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e: any) {
      toast({ title: "Password change failed", description: e.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your company profile, your personal details, notifications, and password."
      />

      <Tabs defaultValue="company">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-6">
          <TabsTrigger value="company"><Building2 className="h-4 w-4 mr-2" /> Company</TabsTrigger>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-2" /> Profile</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-2" /> Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 mr-2" /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Profile</CardTitle>
              <CardDescription>This information is shown to students viewing your internship listings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input id="name" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Acme Corporation" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" value={companyForm.industry} onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })} placeholder="Technology" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="website" value={companyForm.website} onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })} placeholder="https://acme.example.com" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size">Company Size</Label>
                  <Input id="size" value={companyForm.size} onChange={(e) => setCompanyForm({ ...companyForm, size: e.target.value })} placeholder="50-200" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">About the Company</Label>
                  <Textarea id="description" value={companyForm.description} onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })} placeholder="A short description of what your company does..." rows={4} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>How students and universities can reach you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input id="contact_person" value={companyForm.contact_person} onChange={(e) => setCompanyForm({ ...companyForm, contact_person: e.target.value })} placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="contact_email" type="email" value={companyForm.contact_email} onChange={(e) => setCompanyForm({ ...companyForm, contact_email: e.target.value })} placeholder="careers@acme.example.com" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <div className="relative">
                    <Phone className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="contact_phone" value={companyForm.contact_phone} onChange={(e) => setCompanyForm({ ...companyForm, contact_phone: e.target.value })} placeholder="+92 300 0000000" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input id="logo_url" value={companyForm.logo_url} onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>Where your office is located.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <div className="relative">
                  <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="address" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} placeholder="123 Main Street" className="pl-9" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} placeholder="Karachi" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={companyForm.country} onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })} placeholder="Pakistan" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Badge variant={companyForm.is_active ? "default" : "secondary"}>
              {companyForm.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge variant={companyForm.is_verified ? "default" : "outline"}>
              {companyForm.is_verified ? "Verified" : "Unverified"}
            </Badge>
            <Button onClick={handleSaveCompany} disabled={savingCompany}>
              {savingCompany ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Update your personal contact details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input id="first_name" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input id="last_name" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (read-only)</Label>
                  <Input id="email" value={profileForm.email} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact your administrator if needed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="+92 300 0000000" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> In-App Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which events trigger an in-app notification (shown in the bell icon at the top of every page). Notifications are stored in your inbox and can be reviewed anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  key: "in_app_on_application" as const,
                  title: "Application updates",
                  description:
                    "Notify me when a student applies to, is accepted for, or is rejected from one of my internships.",
                },
                {
                  key: "in_app_on_task_submission" as const,
                  title: "Task submissions",
                  description:
                    "Notify me when an intern submits a task assigned to them at my company.",
                },
                {
                  key: "in_app_on_evaluation" as const,
                  title: "Evaluation submissions",
                  description:
                    "Notify me when a site supervisor submits an evaluation for one of my interns.",
                },
                {
                  key: "in_app_on_weekly_log" as const,
                  title: "Weekly log submissions",
                  description:
                    "Notify me when an intern submits a weekly log for review.",
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
                    checked={notifs[item.key]}
                    onCheckedChange={(v) => setNotifs({ ...notifs, [item.key]: v })}
                  />
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveNotifs} disabled={savingNotifs} className="gap-2">
                  {savingNotifs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Preferences
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
                Recent notifications from your company&apos;s internship workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentNotificationsWidget userId={user?.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Use a strong password of at least 8 characters. Mix letters, numbers, and symbols.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <div className="relative">
                  <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="current_password" type={showCurrent ? "text" : "password"} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••" className="pl-9 pr-9" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <div className="relative">
                  <Input id="new_password" type={showNew ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••" className="pr-9" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input id="confirm_password" type={showNew ? "text" : "password"} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="••••••••" />
              </div>
              {newPwd && confirmPwd && newPwd !== confirmPwd && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> Passwords do not match
                </div>
              )}
              <Button onClick={handleChangePassword} disabled={changingPassword || !currentPwd || !newPwd}>
                {changingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Update Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// RecentNotificationsWidget — shows latest in-app notifications
// for the company HR user inside the settings page.
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
