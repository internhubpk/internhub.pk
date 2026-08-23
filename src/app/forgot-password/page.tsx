"use client";

import React, { useState } from "react";
import Link from "next/link";
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
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Configuration error. Please try again later.");
        return;
      }

      // Determine the redirect URL for the password reset landing page.
      // This must be a route on the same origin that Supabase will redirect
      // the user back to after they click the link in the email.
      // Route recovery links through the PKCE callback, which exchanges
      // the code for a recovery session and then forwards the user to
      // /reset-password (redirect_to survives the tenant-subdomain branch
      // too). The target origin must be in the Supabase URL allow-list
      // (configured in the project's auth settings).
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/api/auth/callback?redirect_to=/reset-password`
          : undefined;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        redirectTo ? { redirectTo } : undefined
      );

      if (resetError) {
        // For security, Supabase does not leak whether an email exists.
        // Common errors: rate-limit, network, malformed email.
        if (
          resetError.message.toLowerCase().includes("rate limit") ||
          resetError.message.toLowerCase().includes("too many")
        ) {
          setError("Too many reset attempts. Please wait a few minutes before trying again.");
          return;
        }
        // Supabase rejects recovery requests for existing accounts whose
        // email domain cannot receive mail (no MX record). Surfacing this
        // is NOT a fake success and does not meaningfully leak account
        // existence beyond what the API already returns — and hiding it
        // would show "check your email" for an email that can never arrive.
        if (
          resetError.code === "email_address_invalid" ||
          (resetError.message.toLowerCase().includes("invalid") &&
            resetError.message.toLowerCase().includes("email"))
        ) {
          setError(
            "This email address cannot receive messages (its domain has no mail server). " +
            "If this is your account, contact your administrator to update your email address."
          );
          return;
        }
        // Any other error: fall through to the generic success screen to
        // avoid leaking account existence.
        setIsSubmitted(true);
        return;
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error("Password reset error:", err);
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
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password?</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            No worries! Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <Card className="shadow-lg border-0">
          {!isSubmitted ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl">Reset Password</CardTitle>
                <CardDescription>
                  Enter the email associated with your account
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@university.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </CardContent>
                
                <CardFooter className="flex flex-col gap-4 pt-0">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !email}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Remember your password?{" "}
                    <Link
                      href="/login"
                      className="text-primary hover:underline font-medium"
                    >
                      Sign in
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </>
          ) : (
            <CardContent className="pt-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Check Your Email</h3>
                  <p className="text-muted-foreground text-sm">
                    We&apos;ve sent a password reset link to:
                  </p>
                  <p className="font-medium text-foreground">{email}</p>
                </div>
                
                <div className="space-y-3 pt-4">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">Return to Login</Link>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail("");
                    }}
                    className="text-muted-foreground"
                  >
                    Didn&apos;t receive? Try again
                  </Button>
                </div>
              </motion.div>
            </CardContent>
          )}
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-8 px-4">
          If you don&apos;t receive an email within a few minutes, check your spam folder or{" "}
          <Link href="/support" className="underline hover:text-foreground">
            contact support
          </Link>.
        </p>
      </motion.div>
    </div>
  );
}
