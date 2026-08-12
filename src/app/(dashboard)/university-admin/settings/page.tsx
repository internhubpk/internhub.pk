"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon,
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
  email_notifications: boolean;
  new_applications: boolean;
  weekly_reports: boolean;
  system_alerts: boolean;
}

const defaultNotifications: NotificationPrefs = {
  email_notifications: true,
  new_applications: true,
  weekly_reports: false,
  system_alerts: true,
};

export default function UniversityAdminSettingsPage() {
  const { profile, university, refreshProfile } = useAuth();
  const { toast } = useToast();

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

        // Load notification prefs from jsonb settings column if present
        const settings = (data.settings as Record<string, unknown> | null) ?? {};
        const notif = (settings.notifications as Partial<NotificationPrefs> | null) ?? {};
        setNotifications({
          email_notifications: notif.email_notifications ?? true,
          new_applications: notif.new_applications ?? true,
          weekly_reports: notif.weekly_reports ?? false,
          system_alerts: notif.system_alerts ?? true,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load university settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [universityId, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveGeneral = async () => {
    if (!universityId) return;

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "University name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.contact_email.trim() || !formData.contact_email.includes("@")) {
      toast({
        title: "Validation Error",
        description: "A valid contact email is required",
        variant: "destructive",
      });
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

      toast({
        title: "Saved",
        description: "University information updated successfully",
      });

      // Refresh the auth context so the sidebar / header reflect the new name
      await refreshProfile();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!universityId) return;

    try {
      setIsSaving(true);
      const supabase = createClient();

      // Merge the new notification prefs into the existing settings jsonb.
      const { error } = await supabase
        .from("universities")
        .update({
          settings: { notifications },
          updated_at: new Date().toISOString(),
        })
        .eq("id", universityId);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Notification preferences updated",
      });
    } catch (error) {
      console.error("Error saving notifications:", error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your university settings</p>
        </div>
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage settings for {university?.name || "your university"}
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
          <TabsTrigger value="general">
            <Globe className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
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
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how you receive notifications about university activity.
                Preferences are saved per-university.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates for important events
                  </p>
                </div>
                <Switch
                  checked={notifications.email_notifications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email_notifications: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Applications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when students apply for internships
                  </p>
                </div>
                <Switch
                  checked={notifications.new_applications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, new_applications: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Summary of weekly internship activity
                  </p>
                </div>
                <Switch
                  checked={notifications.weekly_reports}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, weekly_reports: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>System Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Important system notifications and security alerts
                  </p>
                </div>
                <Switch
                  checked={notifications.system_alerts}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, system_alerts: checked })
                  }
                />
              </div>

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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage your account security preferences. These settings apply
                to your admin account only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="space-y-2">
                <Label>Account Email</Label>
                <Input
                  value={profile?.email || ""}
                  disabled
                  className="bg-muted/30"
                />
                <p className="text-xs text-muted-foreground">
                  To change your account email, contact a Super Admin.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Button variant="outline" disabled>
                  Change Password
                </Button>
                <p className="text-xs text-muted-foreground">
                  Self-service password change is coming soon. For now, use the
                  &quot;Forgot Password&quot; link on the login page.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Two-Factor Authentication</Label>
                <div className="flex items-center gap-3">
                  <Switch disabled />
                  <span className="text-sm text-muted-foreground">Coming soon</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-amber-900 dark:text-amber-200">
                      Need to make bigger changes?
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                      For changes to your university slug, license tier, or to
                      deactivate the university, contact a Super Admin.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
