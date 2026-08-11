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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
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

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuth();
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    // Try to detect role from multiple sources
    const detectRole = async () => {
      const info: Record<string, any> = {};

      // Check 1: Auth context profile
      if (profile?.role) {
        info.profileRole = profile.role;
        setDetectedRole(profile.role);
      }

      // Check 2: User metadata
      if (user?.user_metadata?.role) {
        info.userMetaRole = user.user_metadata.role;
        if (!detectedRole) setDetectedRole(user.user_metadata.role);
      }

      // Check 3: App metadata  
      if (user?.app_metadata?.role) {
        info.appMetaRole = user.app_metadata.role;
        if (!detectedRole) setDetectedRole(user.app_metadata.role);
      }

      // Check 4: Try profiles table one more time
      try {
        const supabase = createClient();
        if (supabase && user) {
          const { data: profileData, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .single();
          
          info.profilesTable = error ? `Error: ${error.message}` : profileData?.role;
          
          if (!error && profileData?.role && !detectedRole) {
            setDetectedRole(profileData.role);
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

      setDebugInfo(info);
      setIsDetecting(false);
    };

    if (!authLoading && user) {
      // Small delay to show we're working on it
      setTimeout(detectRole, 500);
    }
  }, [authLoading, user, profile, detectedRole]);

  const handleSelectRole = (path: string) => {
    router.push(path);
  };

  const handleLogout = async () => {
    const { logout } = useAuth();
    await logout();
    router.push("/login");
  };

  // Still loading auth
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
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

        {/* Role Detected - Auto Redirect Option */}
        {!isDetecting && detectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                      ✓ Role Detected: {ROLE_OPTIONS.find(r => r.role === detectedRole)?.label || detectedRole}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      We found your role in the system. Click below to go to your dashboard.
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleSelectRole(ROLE_OPTIONS.find(r => r.role === detectedRole)?.path || "/student")}
                    size="lg"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* No Role Detected - Manual Selection */}
        {!isDetecting && !detectedRole && (
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
        )}

        {/* Role Selection Grid */}
        {!isDetecting && (
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
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-primary ${
                    detectedRole === option.role ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleSelectRole(option.path)}
                >
                  <CardContent className="p-6 text-center">
                    <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                      detectedRole === option.role ? 'bg-primary text-white' : 'bg-muted'
                    }`}>
                      {option.icon}
                    </div>
                    <h3 className="font-semibold">{option.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Debug Info (Collapsible) */}
        {!isDetecting && process.env.NODE_ENV === 'development' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8"
          >
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Debug Info (Development Only)
              </summary>
              <pre className="mt-2 p-4 bg-muted rounded-lg overflow-auto max-h-60">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </motion.div>
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
