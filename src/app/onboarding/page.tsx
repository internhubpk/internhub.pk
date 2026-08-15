"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion"; 
import { 
  Shield, 
  Loader2,
  AlertCircle,
  LogOut,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Role to dashboard path mapping
const ROLE_DASHBOARD_PATHS: Record<string, string> = {
  super_admin: "/super-admin",
  university_admin: "/university-admin",
  department_coordinator: "/department-coordinator",
  faculty_supervisor: "/faculty-supervisor",
  student: "/student",
  company_hr: "/company-hr",
  site_supervisor: "/site-supervisor",
  external_evaluator: "/external-evaluator",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  university_admin: "University Admin",
  department_coordinator: "Department Coordinator",
  faculty_supervisor: "Faculty Supervisor",
  student: "Student",
  company_hr: "Company HR",
  site_supervisor: "Site Supervisor",
  external_evaluator: "External Evaluator",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading, logout } = useAuth();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  // Hold the redirect timeout id so we can clear it on unmount and avoid
  // calling router.push after the component has been torn down (which
  // throws a "Can't perform a React state update on an unmounted component"
  // warning and can cause navigation to fire on a stale route).
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending redirect when the page unmounts.
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Try to detect role and redirect
    const detectAndRedirect = async () => {
      let foundRole: string | null = null;

      // Check 1: Profile from DB
      if (profile?.role) {
        foundRole = profile.role;
      }

      // Check 2: User metadata
      if (!foundRole && user?.user_metadata?.role) {
        foundRole = user.user_metadata.role;
      }

      // Check 3: App metadata
      if (!foundRole && user?.app_metadata?.role) {
        foundRole = user.app_metadata.role;
      }

      // Check 4: Direct query to profiles table
      if (!foundRole && user) {
        try {
          const supabase = createClient();
          if (supabase) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("role")
              .eq("user_id", user.id)
              .single();
            
            if (profileData?.role) {
              foundRole = profileData.role;
            }
          }
        } catch (e) {
          console.error("Error querying profiles:", e);
        }
      }

      // If we found a role, redirect to dashboard
      if (foundRole && ROLE_DASHBOARD_PATHS[foundRole]) {
        setStatus("redirecting");
        const path = ROLE_DASHBOARD_PATHS[foundRole];
        console.log(`Redirecting to ${path} for role: ${foundRole}`);
        
        // Brief delay so user sees the success state. Store the timer id
        // so the unmount cleanup can cancel it if the user navigates away
        // (or the component is torn down for any other reason) before the
        // timeout fires.
        redirectTimerRef.current = setTimeout(() => {
          router.push(path);
        }, 800);
      } else {
        // No role found - show error
        setStatus("error");
        setErrorMessage(
          "Your account does not have a role assigned. Please contact your administrator to get your account configured."
        );
      }
    };

    if (!authLoading) {
      if (user) {
        detectAndRedirect();
      } else {
        setStatus("error");
        setErrorMessage("You are not signed in. Please log in to continue.");
      }
    }
  }, [authLoading, user, profile, router]);

  const handleLogout = async () => {
    await logout();
    // Force a full page reload to /login to ensure session cookies are
    // fully cleared before the next request hits the proxy.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    } else {
      router.push("/login");
    }
  };

  // Still loading auth
  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Setting up your workspace...</p>
          <p className="text-muted-foreground">Please wait while we configure your experience</p>
        </motion.div>
      </div>
    );
  }

  // Redirecting to dashboard
  if (status === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Shield className="h-10 w-10 text-green-600 dark:text-green-400" />
          </motion.div>
          <h1 className="text-3xl font-bold mb-3">Welcome Back!</h1>
          <p className="text-lg text-muted-foreground mb-2">
            Taking you to your dashboard...
          </p>
          <Loader2 className="h-6 w-8 animate-spin mx-auto text-primary mt-4" />
        </motion.div>
      </div>
    );
  }

  // Error state - no role or not logged in
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="border-destructive/50">
          <CardContent className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </motion.div>
            
            <h1 className="text-2xl font-bold mb-3">Setup Required</h1>
            
            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>

            {user && (
              <Badge variant="outline" className="mb-6">
                Account: {user.email}
              </Badge>
            )}

            <div className="space-y-3">
              {user ? (
                <>
                  <Button 
                    onClick={() => window.location.reload()} 
                    className="w-full"
                  >
                    <Loader2 className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleLogout}
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => router.push("/login")}
                  className="w-full"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Login
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Need help? Contact your system administrator.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
