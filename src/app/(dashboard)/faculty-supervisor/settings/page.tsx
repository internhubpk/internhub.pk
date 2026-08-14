"use client";

import React from "react";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PasswordChangeCard } from "@/components/auth/password-change-card";

export default function FacultySupervisorSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account security and password."
      />
      <div className="max-w-2xl space-y-6">
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
