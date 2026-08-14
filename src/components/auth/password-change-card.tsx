"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Key, Loader2, Shield, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/**
 * Reusable password-change card.
 *
 * Uses the universal /api/auth/change-password endpoint which works for
 * every authenticated dashboard role (super_admin, university_admin,
 * department_coordinator, faculty_supervisor, site_supervisor,
 * company_hr, external_evaluator, student).
 *
 * Security notes:
 *   - The current password is verified server-side via
 *     supabase.auth.signInWithPassword before updateUser() is called, so a
 *     hijacked session alone is not enough to change the password.
 *   - We never store passwords in DB tables — Supabase Auth handles all
 *     hashing/salting.
 *   - On success the form is cleared and a success toast appears.
 *   - On failure a clear, actionable error toast appears (no internals
 *     leaked).
 */
export function PasswordChangeCard() {
  const { toast } = useToast();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation — server still re-validates.
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast({
        title: "Missing fields",
        description: "Please fill in all three password fields.",
        variant: "destructive",
      });
      return;
    }
    if (newPwd.length < 8) {
      toast({
        title: "Password too short",
        description: "New password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must be identical.",
        variant: "destructive",
      });
      return;
    }
    if (currentPwd === newPwd) {
      toast({
        title: "Choose a different password",
        description: "New password must be different from your current password.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPwd,
          new_password: newPwd,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        const msg =
          json?.error?.message ||
          json?.error ||
          `Password change failed (${res.status})`;
        toast({ title: "Password change failed", description: msg, variant: "destructive" });
        return;
      }

      toast({
        title: "Password changed",
        description: "Use your new password the next time you sign in.",
      });

      // Clear sensitive fields immediately.
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err?.message || "Could not reach the server. Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" /> Change Password
        </CardTitle>
        <CardDescription>
          Use a strong password of at least 8 characters. Mix letters, numbers, and symbols.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="current_password">Current Password</Label>
            <div className="relative">
              <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="current_password"
                type={showCurrent ? "text" : "password"}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pl-9 pr-9"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <div className="relative">
              <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new_password"
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="pl-9 pr-9"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <div className="relative">
              <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm_password"
                type={showConfirm ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="pl-9 pr-9"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPwd && newPwd && confirmPwd !== newPwd && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
            {confirmPwd && newPwd && confirmPwd === newPwd && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Passwords match.
              </p>
            )}
          </div>

          <Button type="submit" disabled={saving || !currentPwd || !newPwd || !confirmPwd}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" /> Update Password
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
