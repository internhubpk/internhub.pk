"use client";

import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Building2,
  BookOpen,
  Shield,
  Bell,
  Key,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "@/components/shared/toast";

export default function ProgramCoordinatorSettingsPage() {
  const { profile, user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state for editable fields
  const [displayName, setDisplayName] = useState(profile?.full_name || "");
  const [email] = useState(user?.email || profile?.email || "");
  const [notifications, setNotifications] = useState({
    email: true,
    studentUpdates: true,
    reportAlerts: true,
  });

  useEffect(() => {
    if (profile?.full_name) {
      setDisplayName(profile.full_name);
    }
  }, [profile?.full_name]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement profile update API
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      toast.success("Profile Updated", {
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      toast.error("Update Failed", {
        description: "Could not save your changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your Program Coordinator account preferences."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Full Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                <Mail className="h-4 w-4" />
                {email}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                <Shield className="h-3 w-3 mr-1" />
                Program Coordinator
              </Badge>
            </div>

            <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Program Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5" />
              Program Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Program</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {profile?.program_id ? (
                    <span>Computer Science (CS-INT2)</span>
                  ) : (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </span>
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Department ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {profile?.department_id?.slice(0, 8)}...
                </code>
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">University ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {profile?.university_id?.slice(0, 8)}...
                </code>
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">User ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {user?.id?.slice(0, 8)}...
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Choose what notifications you want to receive.
            </p>
            
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) => setNotifications(prev => ({ ...prev, email: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-sm">Email Notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receive updates via email
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={notifications.studentUpdates}
                  onChange={(e) => setNotifications(prev => ({ ...prev, studentUpdates: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-sm">Student Updates</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When students submit logs or reports
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={notifications.reportAlerts}
                  onChange={(e) => setNotifications(prev => ({ ...prev, reportAlerts: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-sm">Report Alerts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Weekly log and evaluation reminders
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Password</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last changed recently
                </p>
              </div>
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
