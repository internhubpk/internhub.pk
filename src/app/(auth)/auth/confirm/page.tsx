"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Inner component that uses useSearchParams (must be wrapped in Suspense)
 */
function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your email...");

  useEffect(() => {
    confirmEmail();
  }, []);

  async function confirmEmail() {
    try {
      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      if (!token_hash || type !== "email") {
        setStatus("error");
        setMessage("Invalid confirmation link.");
        return;
      }

      const supabase = createClient();

      // Verify the OTP
      const { error, data } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message || "Confirmation failed.");
        return;
      }

      // Email confirmed - now get user's role for redirect
      setStatus("success");
      setMessage("Email confirmed! Redirecting to your dashboard...");

      if (data?.user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", data.user.id)
            .single();

          const rolePaths: Record<string, string> = {
            super_admin: "/super-admin",
            university_admin: "/university-admin",
            department_coordinator: "/department-coordinator",
            faculty_supervisor: "/faculty-supervisor",
            student: "/student",
            company_hr: "/company-hr",
            site_supervisor: "/site-supervisor",
            external_evaluator: "/external-evaluator",
          };

          const redirectPath = profile?.role && rolePaths[profile.role]
            ? rolePaths[profile.role]
            : "/student";

          // Redirect after a brief delay to show success message
          setTimeout(() => {
            router.push(redirectPath);
            router.refresh();
          }, 1500);
        } catch (profileError) {
          console.error("Profile fetch error:", profileError);
          setTimeout(() => {
            router.push("/student");
            router.refresh();
          }, 1500);
        }
      }
    } catch (error) {
      console.error("Confirmation error:", error);
      setStatus("error");
      setMessage("Something went wrong. Please try logging in.");
      
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 p-8 bg-card rounded-xl shadow-lg border text-center">
        <div className="flex justify-center mb-4">
          {status === "loading" && (
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          )}
          {status === "error" && (
            <AlertCircle className="h-12 w-12 text-red-500" />
          )}
        </div>
        
        <h1 className="text-2xl font-bold mb-2">
          {status === "loading" ? "Confirming Email..." : 
           status === "success" ? "Email Confirmed!" : 
           "Confirmation Failed"}
        </h1>
        
        <p className="text-muted-foreground mb-6">{message}</p>
        
        {status === "error" && (
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </button>
        )}
        
        {status === "loading" && (
          <p className="text-sm text-muted-foreground">
            Please wait while we confirm your email...
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Fallback Email Confirmation Page
 * 
 * This handles the case when Supabase redirects to /auth/confirm
 * instead of /api/auth/confirm (e.g., if vercel.json rewrites aren't working)
 */
export default function AuthConfirmFallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4 p-8 bg-card rounded-xl shadow-lg border text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ConfirmEmailContent />
    </Suspense>
  );
}
