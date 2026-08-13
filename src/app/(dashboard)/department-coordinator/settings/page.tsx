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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

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
}

interface DepartmentInfo {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
}

interface UniversityInfo {
  id: string;
  name: string;
  slug: string | null;
}

interface NotificationPrefs {
  email_on_weekly_log: boolean;
  email_on_evaluation: boolean;
  email_on_task_submission: boolean;
  email_on_student_enrollment: boolean;
  weekly_summary: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  email_on_weekly_log: true,
  email_on_evaluation: true,
  email_on_task_submission: true,
  email_on_student_enrollment: false,
  weekly_summary: true,
};

export default function CoordinatorSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

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
          website
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (profileData) {
        setProfile(profileData as CoordinatorProfile);
        setProfileForm(profileData as CoordinatorProfile);

        if (profileData.department_id) {
          const { data: dept } = await supabase
            .from("departments")
            .select("id, name, code, description")
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

      // Notification prefs are stored in localStorage keyed by user.id.
      // (No `preferences` column on `profiles` — keeping it client-side
      // avoids a schema migration for now.)
      const stored = localStorage.getItem(`coord_prefs_${user.id}`);
      if (stored) {
        try {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        } catch {
          setPrefs(DEFAULT_PREFS);
        }
      }
    } catch (err) {
      console.error("Error loading coordinator settings:", err);
      toast({
        title: "Failed to load settings",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
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
      toast({
        title: "Profile saved",
        description: "Your coordinator profile has been updated.",
      });
    } catch (err) {
      console.error("Error saving profile:", err);
      toast({
        title: "Failed to save profile",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setIsSavingPrefs(true);
    try {
      localStorage.setItem(`coord_prefs_${user.id}`, JSON.stringify(prefs));
      await new Promise((r) => setTimeout(r, 200));
      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      });
    } catch (err) {
      toast({
        title: "Failed to save preferences",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "New password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirm password must match.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (error) throw error;

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (err) {
      console.error("Error changing password:", err);
      toast({
        title: "Failed to change password",
        description:
          err instanceof Error
            ? err.message
            : "Please make sure your new password meets the requirements.",
        variant: "destructive",
      });
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
                <Bell className="h-5 w-5" /> Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which events trigger an email notification to your registered address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  key: "email_on_weekly_log" as const,
                  title: "Weekly log submissions",
                  description:
                    "Email me when a student in my department submits a weekly log for review.",
                },
                {
                  key: "email_on_evaluation" as const,
                  title: "Evaluation submissions",
                  description:
                    "Email me when a supervisor submits an evaluation for a student in my department.",
                },
                {
                  key: "email_on_task_submission" as const,
                  title: "Task submissions",
                  description:
                    "Email me when a student submits a task assigned by a supervisor in my department.",
                },
                {
                  key: "email_on_student_enrollment" as const,
                  title: "Student enrollments",
                  description:
                    "Email me when a new student is enrolled in a program in my department.",
                },
                {
                  key: "weekly_summary" as const,
                  title: "Weekly digest",
                  description:
                    "Send me a weekly summary of activity in my department every Monday morning.",
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
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Role</span>
                <Badge variant="outline">Department Coordinator</Badge>
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
