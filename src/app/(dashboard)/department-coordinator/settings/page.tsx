"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  Bell,
  Shield,
  User,
  Mail,
  Phone,
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Globe,
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
import { Separator } from "@/components/ui/separator";

interface CoordinatorProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  university_id: string | null;
  department_id: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  website: string | null;
  // Account-status fields (used by the Account Status card).
  role: string | null;
  is_active: boolean | null;
  status: string | null;
}

interface DepartmentInfo {
  id: string;
  name: string;
  code: string | null;
  // `departments` table has no `description` column. Kept as optional
  // null so the JSX `department?.description && …` guard still
  // type-checks; the value is always null in practice.
  description?: string | null;
}

interface UniversityInfo {
  id: string;
  name: string;
  slug: string | null;
}

interface NotificationPrefs {
  in_app_on_application: boolean;
  in_app_on_task_submission: boolean;
  in_app_on_evaluation: boolean;
  in_app_on_weekly_log: boolean;
  in_app_on_student_enrollment: boolean;
  desktop_notifications: boolean;
  sound_enabled: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  in_app_on_application: true,
  in_app_on_task_submission: true,
  in_app_on_evaluation: true,
  in_app_on_weekly_log: true,
  in_app_on_student_enrollment: false,
  desktop_notifications: true,
  sound_enabled: false,
};

export default function CoordinatorSettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<CoordinatorProfile | null>(null);
  const [department, setDepartment] = useState<DepartmentInfo | null>(null);
  const [university, setUniversity] = useState<UniversityInfo | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Editable profile form (mirrors `profile` once loaded)
  const [profileForm, setProfileForm] = useState<CoordinatorProfile | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();

      // Fetch profile.
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select(`
          user_id,
          email,
          full_name,
          first_name,
          last_name,
          phone,
          bio,
          avatar_url,
          university_id,
          department_id,
          linkedin_url,
          github_url,
          website,
          role,
          is_active,
          status
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (profileData) {
        setProfile(profileData as CoordinatorProfile);
        setProfileForm(profileData as CoordinatorProfile);

        if (profileData.department_id) {
          // `departments` table has no `description` column — including
          // it caused PostgREST to 400 every call. Migration 0001
          // defines only: id, university_id, name, code, head_id,
          // is_active, created_at, updated_at.
          const { data: dept } = await supabase
            .from("departments")
            .select("id, name, code")
            .eq("id", profileData.department_id)
            .maybeSingle();
          if (dept) setDepartment(dept as DepartmentInfo);
        }
        if (profileData.university_id) {
          const { data: uni } = await supabase
            .from("universities")
            .select("id, name, slug")
            .eq("id", profileData.university_id)
            .maybeSingle();
          if (uni) setUniversity(uni as UniversityInfo);
        }
      }

      // Notification prefs are persisted to `profiles.notification_prefs`
      // (migration 0043). The previous localStorage approach was
      // per-browser only and lost prefs on browser-data clear.
      // Use `user.id` (the non-null auth uid) instead of `profileData.user_id`
      // — `profileData` may be null here (the `if (profileData)` block above
      // already returned / set state, but TS can't prove the narrowing
      // holds past the block's closing brace).
      try {
        const { data: prefsRow } = await supabase
          .from("profiles")
          .select("notification_prefs")
          .eq("user_id", user.id)
          .maybeSingle();
        const stored = (prefsRow?.notification_prefs as Partial<NotificationPrefs> | null) || null;
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...stored });
        }
      } catch {
        // fall back to defaults
      }
    } catch (err) {
      console.error("Error loading coordinator settings:", err);
      toast.error("Failed to load settings", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveProfile = async () => {
    if (!user || !profileForm) return;
    setIsSavingProfile(true);
    try {
      const supabase = createClient();

      const firstName = profileForm.first_name?.trim() || "";
      const lastName = profileForm.last_name?.trim() || "";
      const fullName = `${firstName} ${lastName}`.trim() || profileForm.full_name;

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          phone: profileForm.phone?.trim() || null,
          bio: profileForm.bio?.trim() || null,
          linkedin_url: profileForm.linkedin_url?.trim() || null,
          github_url: profileForm.github_url?.trim() || null,
          website: profileForm.website?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile(profileForm);
      toast.success("Profile saved", { description: "Your coordinator profile has been updated." });
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error("Failed to save profile", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setIsSavingPrefs(true);
    try {
      // Persist to `profiles.notification_prefs` (migration 0043).
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");
      const { error: prefsErr } = await supabase
        .from("profiles")
        .update({
          // Cast through `unknown` because `NotificationPrefs` (an interface
          // with named boolean fields) doesn't structurally overlap with
          // `Record<string, unknown>` — TS2352. The jsonb column accepts any
          // JSON shape, so this is a safe persistence boundary.
          notification_prefs: prefs as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (prefsErr) throw prefsErr;
      toast.success("Preferences saved", { description: "Your notification preferences have been updated." });
    } catch (err) {
      toast.error("Failed to save preferences", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password too short", { description: "New password must be at least 8 characters." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords don't match", { description: "New password and confirm password must match." });
      return;
    }
    if (!passwordForm.currentPassword) {
      toast.error("Current password required", { description: "Please enter your current password to confirm the change." });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || `Failed (${res.status})`);
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password updated", { description: "Your password has been changed successfully." });
    } catch (err) {
      console.error("Error changing password:", err);
      toast.error("Failed to change password", { description: err instanceof Error
            ? err.message
            : "Please make sure your new password meets the requirements." });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your coordinator profile, preferences, and account security"
        />
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your coordinator profile, preferences, and account security"
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-3">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* ============================== PROFILE TAB ============================== */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Personal Information
              </CardTitle>
              <CardDescription>
                Update your contact details and social links. These are visible to your department's students and supervisors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileForm ? (
                <>
                  {/* Avatar upload */}
                  <AvatarUploader
                    userId={user?.id || ""}
                    currentUrl={profileForm.avatar_url}
                    fullName={profileForm.full_name || profileForm.first_name}
                    onUploaded={() => { refreshProfile(); fetchSettings(); }}
                    onRemoved={() => { refreshProfile(); fetchSettings(); }}
                    size="md"
                  />
                  <Separator />

                  {/* Department & University assignment banner — always visible */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">University</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{university?.name || "Not assigned"}</p>
                          {university?.slug && (
                            <Badge variant="outline" className="text-xs">{university.slug}</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Department</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{department?.name || "Not assigned"}</p>
                          {department?.code && (
                            <Badge variant="outline" className="text-xs">{department.code}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First name</Label>
                      <Input
                        id="first_name"
                        value={profileForm.first_name || ""}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, first_name: e.target.value })
                        }
                        placeholder="Your first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last name</Label>
                      <Input
                        id="last_name"
                        value={profileForm.last_name || ""}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, last_name: e.target.value })
                        }
                        placeholder="Your last name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Label>
                    <Input
                      id="email"
                      value={profileForm.email}
                      disabled
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email is managed by your university administrator. Contact them to change it.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </Label>
                    <Input
                      id="phone"
                      value={profileForm.phone || ""}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                      placeholder="+92 300 0000000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea
                      id="bio"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={profileForm.bio || ""}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, bio: e.target.value })
                      }
                      placeholder="A short professional bio (e.g., research interests, courses taught)"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="linkedin_url" className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> LinkedIn URL
                      </Label>
                      <Input
                        id="linkedin_url"
                        value={profileForm.linkedin_url || ""}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, linkedin_url: e.target.value })
                        }
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="github_url" className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> GitHub URL
                      </Label>
                      <Input
                        id="github_url"
                        value={profileForm.github_url || ""}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, github_url: e.target.value })
                        }
                        placeholder="https://github.com/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website" className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> Website
                      </Label>
                      <Input
                        id="website"
                        value={profileForm.website || ""}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, website: e.target.value })
                        }
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="gap-2"
                    >
                      {isSavingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Profile not loaded. Please refresh the page.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Department &amp; University
              </CardTitle>
              <CardDescription>
                These assignments are managed by your university administrator. Contact them if any detail is incorrect.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">University</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{university?.name || "—"}</p>
                    {university?.slug && (
                      <Badge variant="outline" className="text-xs">
                        {university.slug}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{department?.name || "—"}</p>
                    {department?.code && (
                      <Badge variant="outline" className="text-xs">
                        {department.code}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {department?.description && (
                <div className="space-y-1 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Department Description</Label>
                  <p className="text-sm">{department.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================== NOTIFICATIONS TAB =========================== */}
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
                    "Notify me when a student in my department submits, gets accepted, or is rejected from an internship application.",
                },
                {
                  key: "in_app_on_task_submission" as const,
                  title: "Task submissions",
                  description:
                    "Notify me when a student submits a task assigned by a supervisor in my department.",
                },
                {
                  key: "in_app_on_evaluation" as const,
                  title: "Evaluation submissions",
                  description:
                    "Notify me when a supervisor submits an evaluation for a student in my department.",
                },
                {
                  key: "in_app_on_weekly_log" as const,
                  title: "Weekly log submissions",
                  description:
                    "Notify me when a student in my department submits a weekly log for review.",
                },
                {
                  key: "in_app_on_student_enrollment" as const,
                  title: "Student enrollments",
                  description:
                    "Notify me when a new student is enrolled in a program in my department.",
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
                    checked={prefs[item.key]}
                    onCheckedChange={(checked) =>
                      setPrefs({ ...prefs, [item.key]: checked })
                    }
                  />
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSavePrefs}
                  disabled={isSavingPrefs}
                  className="gap-2"
                >
                  {isSavingPrefs ? (
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
                Recent notifications from your department&apos;s internship workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentNotificationsWidget userId={user?.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================== SECURITY TAB ============================== */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" /> Change Password
              </CardTitle>
              <CardDescription>
                Use a strong, unique password. Your new password must be at least 6 characters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPasswords.current ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords.current ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Supabase doesn&apos;t require the current password to set a new one when the user is already authenticated, but we recommend re-authenticating if you&apos;re on a shared device.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          confirm: !showPasswords.confirm,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-muted">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  After changing your password, you&apos;ll remain logged in on this device. Other sessions will need to log in again with the new password.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={
                    isChangingPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword
                  }
                  className="gap-2"
                >
                  {isChangingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Account Status
              </CardTitle>
              <CardDescription>Your account security overview.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Account active</span>
                {profile?.is_active !== false ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 border-red-200">
                    <AlertCircle className="mr-1 h-3 w-3" /> Inactive
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Role</span>
                <Badge variant="outline">
                  {profile?.role
                    ? profile.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                    : "—"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Profile status</span>
                <Badge variant="outline">{profile?.status || "—"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Multi-tenant isolation</span>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Enforced</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// RecentNotificationsWidget — shows latest in-app notifications
// for the coordinator inside the settings page.
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
