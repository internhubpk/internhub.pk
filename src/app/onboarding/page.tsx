"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion"; 
import { 
  Shield, 
  GraduationCap, 
  Briefcase, 
  UserCheck, 
  Building2, 
  Users, 
  ClipboardCheck,
  Search,
  Loader2,
  AlertCircle,
  ArrowRight,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";

interface RoleOption {
  role: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  path: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    icon: <Shield className="h-6 w-6" />,
    description: "Full system access - manage everything",
    path: "/super-admin",
  },
  {
    role: "university_admin", 
    label: "University Admin",
    icon: <Building2 className="h-6 w-6" />,
    description: "Manage your university's internships",
    path: "/university-admin",
  },
  {
    role: "department_coordinator",
    label: "Department Coordinator",
    icon: <Users className="h-6 w-6" />,
    description: "Coordinate departments and programs",
    path: "/department-coordinator",
  },
  {
    role: "faculty_supervisor",
    label: "Faculty Supervisor",
    icon: <UserCheck className="h-6 w-6" />,
    description: "Supervise student internships",
    path: "/faculty-supervisor",
  },
  {
    role: "student",
    label: "Student",
    icon: <GraduationCap className="h-6 w-6" />,
    description: "Apply for and manage internships",
    path: "/student",
  },
  {
    role: "company_hr",
    label: "Company HR",
    icon: <Briefcase className="h-6 w-6" />,
    description: "Manage company internships",
    path: "/company-hr",
  },
  {
    role: "site_supervisor",
    label: "Site Supervisor",
    icon: <ClipboardCheck className="h-6 w-6" />,
    description: "Supervise interns at work site",
    path: "/site-supervisor",
  },
  {
    role: "external_evaluator",
    label: "External Evaluator",
    icon: <Search className="h-6 w-6" />,
    description: "Evaluate internship performance",
    path: "/external-evaluator",
  },
];

// Safe auth hook that works with/without provider
function useSafeAuth() {
  const [authState, setAuthState] = useState({
    user: null as any,
    profile: null as any,
    isLoading: true,
    logout: async () => {},
  });

  useEffect(() => {
    async function getAuth() {
      try {
        const supabase = createClient();
        if (!supabase) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        let profile = null;
        if (user) {
          // Try to get profile from profiles table
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();
          
          profile = profileData;
          
          // DEBUG: Log what we found
          console.log("=== ONBOARDING DEBUG ===");
          console.log("User:", user);
          console.log("User metadata:", user?.user_metadata);
          console.log("App metadata:", user?.app_metadata);
          console.log("Profile from DB:", profileData);
          console.log("========================");
        }

        setAuthState({
          user,
          profile,
          isLoading: false,
          logout: async () => {
            await supabase.auth.signOut();
          },
        });
      } catch (error) {
        console.error("Auth error:", error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    }
    
    getAuth();
  }, []);

  return authState;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading, logout } = useSafeAuth();
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    // Try to detect role from multiple sources
    const detectRole = async () => {
      // Use LOCAL variable that updates immediately (not React state!)
      let foundRole: string | null = null;
      const info: Record<string, any> = {};

      // Check 1: Profile from DB (this is where role usually is!)
      console.log("Checking profile?.role:", profile?.role);
      if (profile?.role) {
        info.profileRole = profile.role;
        foundRole = profile.role;
        console.log("✅ Found role in profile:", profile.role);
      }

      // Check 2: User metadata (set during registration)
      console.log("Checking user?.user_metadata?.role:", user?.user_metadata?.role);
      if (user?.user_metadata?.role) {
        info.userMetaRole = user.user_metadata.role;
        if (!foundRole) foundRole = user.user_metadata.role;
        console.log("✅ Found role in user_metadata:", user.user_metadata.role);
      }

      // Check 3: App metadata (set by Supabase triggers)
      console.log("Checking user?.app_metadata?.role:", user?.app_metadata?.role);
      if (user?.app_metadata?.role) {
        info.appMetaRole = user.app_metadata.role;
        if (!foundRole) foundRole = user.app_metadata.role;
        console.log("✅ Found role in app_metadata:", user.app_metadata.role);
      }

      // Check 4: Try profiles table one more time (direct query)
      try {
        const supabase = createClient();
        if (supabase && user) {
          const { data: profileData, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .single();
          
          console.log("Direct profile query result:", profileData, error);
          info.profilesTable = error ? `Error: ${error.message}` : profileData?.role;
          
          if (!error && profileData?.role && !foundRole) {
            foundRole = profileData.role;
            console.log("✅ Found role in direct query:", profileData.role);
          }
        }
      } catch (e) {
        info.profilesTableError = e instanceof Error ? e.message : e;
      }

      // Gather user info for debugging
      info.email = user?.email;
      info.userId = user?.id;
      info.userMetadata = user?.user_metadata;
      info.appMetadata = user?.app_metadata;
      info.profileData = profile;
      info.finalFoundRole = foundRole;

      console.log("=== FINAL RESULT ===");
      console.log("Detected role:", foundRole);
      console.log("====================");

      setDebugInfo(info);
      
      // NOW update state once with final value
      setDetectedRole(foundRole);
      setIsDetecting(false);
    };

    if (!authLoading) {
      if (user) {
        // Small delay to show we're working on it
        setTimeout(detectRole, 300);
      } else {
        setIsDetecting(false);
      }
    }
  }, [authLoading, user, profile]);

  const handleSelectRole = (path: string) => {
    router.push(path);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Still loading auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  // No user - redirect to login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold mb-2">Not Signed In</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in to access this page.
            </p>
            <Button onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // AUTO-REDIRECT: If we found the role, redirect immediately!
  if (!isDetecting && detectedRole) {
    const roleOption = ROLE_OPTIONS.find(r => r.role === detectedRole);
    if (roleOption) {
      console.log(`🚀 Auto-redirecting to ${roleOption.path} for role: ${detectedRole}`);
      
      // Redirect after a brief moment so user sees the success message
      setTimeout(() => {
        router.push(roleOption.path);
      }, 1000);
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md mx-auto p-8"
          >
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-3">Welcome Back!</h1>
            <p className="text-lg text-muted-foreground mb-2">
              You are logged in as <strong>{roleOption.label}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Redirecting to your dashboard...
            </p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </motion.div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">IH</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to InternHub!</h1>
          <p className="text-muted-foreground text-lg">
            We need to determine your role to set up your dashboard
          </p>
          
          {/* Show user email */}
          <Badge variant="outline" className="mt-3">
            Signed in as: {user.email}
          </Badge>
        </motion.div>

        {/* Detecting Role */}
        {isDetecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Detecting your role...</p>
            <p className="text-muted-foreground">Please wait while we check your account</p>
          </motion.div>
        )}

        {/* No Role Detected - Manual Selection */}
        {!isDetecting && !detectedRole && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-amber-800 dark:text-amber-200">Role Not Automatically Detected</h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        We couldn&apos;t determine your role automatically. This might be because:
                      </p>
                      <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside space-y-1">
                        <li>Your account was just created</li>
                        <li>Database permissions need to be configured</li>
                        <li>You haven&apos;t been assigned a role yet</li>
                      </ul>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 font-medium">
                        Please select your role below to continue:
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Debug Info - Show in ALL environments temporarily for debugging */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              <details open className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-mono p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  🔍 Debug Info (Click to collapse)
                </summary>
                <pre className="mt-2 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg overflow-auto max-h-96 text-red-800 dark:text-red-200">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            </motion.div>

            {/* Role Selection Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold mb-4 text-center">Select Your Role</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROLE_OPTIONS.map((option) => (
                  <Card 
                    key={option.role}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary hover:scale-105"
                    onClick={() => handleSelectRole(option.path)}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-muted hover:bg-primary/10 transition-colors">
                        {option.icon}
                      </div>
                      <h3 className="font-semibold">{option.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </>
        )}

        {/* Footer Actions */}
        <div className="mt-8 text-center space-x-4">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Support Contact */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Need help? Contact your administrator or{" "}
          <a href="/support" className="underline hover:text-foreground">
            visit our support page
          </a>
        </p>
      </div>
    </div>
  );
}
