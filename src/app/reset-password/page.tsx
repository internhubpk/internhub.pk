"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, CheckCircle2, Loader2, AlertCircle, KeyRound } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/**
 * /reset-password
 *
 * The landing page of the Supabase password-recovery flow.
 *
 * Flow (Supabase Auth built-in, PKCE):
 *  1. User submits email on /forgot-password
 *     -> supabase.auth.resetPasswordForEmail(email, {
 *          redirectTo: `${origin}/api/auth/callback?redirect_to=/reset-password`
 *        })
 *  2. Supabase sends the recovery email using the project's configured
 *     Auth email delivery (built-in service; no custom SMTP required).
 *  3. User clicks the link -> Supabase verifies the one-time token and
 *     redirects to our callback with a fresh `code`.
 *  4. /api/auth/callback exchanges the code for a short-lived recovery
 *     SESSION and forwards here (redirect_to is preserved through the
 *     tenant-subdomain branch as well).
 *  5. This page calls supabase.auth.updateUser({ password }) — allowed
 *     because the recovery session is a full session. Supabase rotates
 *     the password server-side and invalidates the old one.
 *
 * Security properties:
 *  - No reset tokens are stored or exposed by the application.
 *  - Without a valid recovery session, updateUser fails — the page
 *    detects that and renders an expired-link state instead.
 *  - The recovery link is single-use and expires (mailer_otp_exp = 1h).
 */

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = createClient();
        if (!supabase) {
          if (mounted) {
            setHasSession(false);
            setCheckingSession(false);
          }
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        // A recovery exchange establishes a session; without it the user
        // cannot be here legitimately (link expired / already used / direct
        // URL visit).
        setHasSession(Boolean(data?.session));
      } catch {
        if (mounted) setHasSession(false);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const passwordsMatch = password === confirmPassword;
  const lengthOk = password.length >= 8;
  const canSubmit =
    !isLoading && !done && password.length > 0 && passwordsMatch && lengthOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    if (!lengthOk) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Configuration error. Please try again later.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        // Common: weak password rejected server-side, or the recovery
        // session expired between landing and submit.
        setError(updateError.message || "Could not update password. Please request a new reset link.");
        return;
      }

      setDone(true);
      // Sign out of the recovery session so the next login uses the NEW
      // password deliberately (and no one stays signed in from a shared
      // computer's email link).
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login?reset=success"), 2500);
    } catch (err) {
      console.error("Password update error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Set a new password</CardTitle>
            <CardDescription>
              {checkingSession
                ? "Checking your reset link..."
                : hasSession
                  ? "Choose a new password for your account."
                  : "This password reset link is invalid or has expired."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {checkingSession ? (
              <div className="flex flex-col items-center gap-3 py-8" role="status" aria-live="polite">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
              </div>
            ) : done ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-medium">Password updated successfully</p>
                <p className="text-sm text-muted-foreground">
                  Redirecting you to sign in with your new password…
                </p>
              </div>
            ) : !hasSession ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
                <AlertCircle className="h-10 w-10 text-amber-500" />
                <p className="text-sm text-muted-foreground max-w-sm">
                  Reset links can only be used once and expire after one hour.
                  If you still need to reset your password, request a fresh
                  link.
                </p>
                <Button asChild variant="outline" className="mt-2">
                  <Link href="/forgot-password">Request a new link</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    aria-invalid={password.length > 0 && !lengthOk ? true : undefined}
                    aria-describedby="password-requirements"
                  />
                  <p id="password-requirements" className="text-xs text-muted-foreground">
                    Minimum 8 characters. A mix of letters, numbers and symbols is recommended.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    aria-invalid={confirmPassword.length > 0 && !passwordsMatch ? true : undefined}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive">Passwords do not match.</p>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={!canSubmit}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
