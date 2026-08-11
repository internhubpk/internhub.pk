"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldX, ArrowLeft, Home, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";

export default function UnauthorizedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, profile } = useAuth();
  
  const attemptedPath = searchParams.get("from") || "Unknown page";

  useEffect(() => {
    // Log unauthorized access attempt for security auditing
    console.warn(`[SECURITY] Unauthorized access attempt:`, {
      user: profile?.user_id,
      role: profile?.role,
      attemptedPath,
      timestamp: new Date().toISOString(),
    });
  }, [profile, attemptedPath]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-destructive/20">
          <CardContent className="p-8 text-center">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6"
            >
              <ShieldX className="h-8 w-8 text-destructive" />
            </motion.div>

            {/* Title */}
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            
            {/* Description */}
            <p className="text-muted-foreground mb-4">
              You don&apos;t have permission to access this resource.
            </p>

            {/* Security Notice */}
            <div className="bg-muted rounded-lg p-3 mb-6 text-sm">
              <p className="text-muted-foreground">
                <strong>Security Notice:</strong> This access attempt has been logged.
                If you believe this is an error, please contact your administrator.
              </p>
            </div>

            {/* Attempted Path (for debugging) */}
            {attemptedPath !== "Unknown page" && (
              <div className="text-xs text-muted-foreground mb-6 font-mono bg-muted p-2 rounded">
                Attempted: {attemptedPath}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="default"
                onClick={() => router.push("/dashboard")}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
              
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>

              <Button
                variant="ghost"
                onClick={handleLogout}
                className="gap-2 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-muted-foreground mt-6">
              Need help?{" "}
              <Link href="/support" className="underline hover:text-foreground">
                Contact Support
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
