"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Shield, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PasswordChangeCard } from "@/components/auth/password-change-card";
import { AvatarUploader } from "@/components/shared/avatar-uploader";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/shared/toast";
import { createClient } from "@/utils/supabase/client";

export default function FacultySupervisorSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sync from auth profile on mount
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setIsLoading(false);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile saved", { description: "Your profile has been updated." });
      await refreshProfile();
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error("Failed to save profile", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile and account security."
      />
      <div className="max-w-2xl space-y-6">
        {/* Profile card with avatar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Profile
            </CardTitle>
            <CardDescription>
              Update your name, phone, and profile picture.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fs-fullname" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Full Name
                </Label>
                <Input
                  id="fs-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </Label>
                <Input
                  id="fs-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 0000000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fs-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="fs-email"
                value={user?.email || ""}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email is managed by your university administrator.
              </p>
            </div>
            <div className="flex justify-end">
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
          </CardContent>
        </Card>

        {/* Password change */}
        <PasswordChangeCard />

        <div className="text-xs text-muted-foreground flex items-start gap-2">
          <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Your password is stored securely by Supabase Auth and never appears in any
            database table. We verify your current password before accepting a change.
          </p>
        </div>
      </div>
    </div>
  );
}
