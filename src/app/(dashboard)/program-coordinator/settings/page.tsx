"use client";

import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Building2,
  BookOpen,
  Shield,
  Bell,
  Save,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "@/components/shared/toast";
import { PasswordChangeCard } from "@/components/auth/password-change-card";

// Interface for fetched names
interface EntityNames {
  programName: string | null;
  departmentName: string | null;
  universityName: string | null;
}

export default function ProgramCoordinatorSettingsPage() {
  const { profile, user } = useAuth();
  
  // Use state to prevent hydration mismatch - initialize with empty values
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEntities, setIsLoadingEntities] = useState(true);
  const [entityNames, setEntityNames] = useState<EntityNames>({
    programName: null,
    departmentName: null,
    universityName: null,
  });
  
  // Notification preferences
  const [notifications, setNotifications] = useState({
    email: true,
    studentUpdates: true,
    reportAlerts: true,
  });

  // Only set values on client side (after mount) to prevent hydration mismatch
  useEffect(() => {
    if (profile?.full_name) {
      setDisplayName(profile.full_name);
    }
    if (user?.email || profile?.email) {
      setEmail(user?.email || profile?.email || "");
    }
  }, [profile?.full_name, user?.email, profile?.email]);

  // Fetch actual entity names (not raw UUIDs)
  useEffect(() => {
    async function fetchEntityNames() {
      if (!profile?.university_id) {
        setIsLoadingEntities(false);
        return;
      }

      try {
        const supabase = createClient();
        
        // Fetch university name
        let uniName: string | null = null;
        if (profile.university_id) {
          const { data: uni } = await supabase
            .from("universities")
            .select("name")
            .eq("id", profile.university_id)
            .single();
          uniName = uni?.name || null;
        }

        // Fetch department name
        let deptName: string | null = null;
        if (profile.department_id) {
          const { data: dept } = await supabase
            .from("departments")
            .select("name")
            .eq("id", profile.department_id)
            .single();
          deptName = dept?.name || null;
        }

        // Fetch program name
        let progName: string | null = null;
        if (profile.program_id) {
          const { data: prog } = await supabase
            .from("programs")
            .select("name, code")
            .eq("id", profile.program_id)
            .single();
          progName = prog ? `${prog.name} (${prog.code})` : null;
        }

        setEntityNames({
          programName: progName,
          departmentName: deptName,
          universityName: uniName,
        });
      } catch (error) {
        console.error("Error fetching entity names:", error);
      } finally {
        setIsLoadingEntities(false);
      }
    }

    fetchEntityNames();
  }, [
    profile?.university_id,
    profile?.department_id,
    profile?.program_id,
  ]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      // Persist the display name to the user's own profiles row (RLS
      // restricts the update to the caller's row). The previous
      // implementation was a fake setTimeout + success toast — the edit was
      // silently discarded (2026-08-23 production audit).
      const supabase = createClient();
      const trimmed = displayName.trim();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmed || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", profile.user_id);

      if (error) throw error;

      toast.success("Profile Updated", {
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
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
                {email || <Skeleton className="h-4 w-32" />}
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

        {/* Program Information - Shows real names now */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5" />
              Program Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingEntities ? (
              // Show skeletons while loading to prevent hydration issues
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Program</span>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {entityNames.programName || "Not assigned"}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Department</span>
                  <span className="text-sm font-medium">
                    {entityNames.departmentName || "—"}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">University</span>
                  <span className="text-sm font-medium">
                    {entityNames.universityName || "—"}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">User ID</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {user?.id ? `${user.id.slice(0, 8)}...` : "—"}
                  </code>
                </div>
              </>
            )}
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
                  onChange={(e) =>
                    setNotifications((prev) => ({ ...prev, email: e.target.checked }))
                  }
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
                  onChange={(e) =>
                    setNotifications((prev) => ({
                      ...prev,
                      studentUpdates: e.target.checked,
                    }))
                  }
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
                  onChange={(e) =>
                    setNotifications((prev) => ({
                      ...prev,
                      reportAlerts: e.target.checked,
                    }))
                  }
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

        {/* Security Section - Working Change Password */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordChangeCard />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
