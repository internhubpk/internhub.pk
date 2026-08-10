import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentProfile, ROLE_DASHBOARD_PATHS } from "@/lib/auth";
import type { UserRole } from "@/types";

// Default fallback path if role is not recognized
const DEFAULT_PATH = "/student";

/**
 * Dashboard Redirect Page
 * 
 * This server component:
 * 1. Checks if user is authenticated
 * 2. Fetches user's profile with role
 * 3. Redirects to appropriate dashboard based on role
 */
export default async function DashboardPage() {
  // Check if user is authenticated
  const user = await getCurrentUser();
  
  if (!user) {
    // Not authenticated - redirect to login
    redirect("/login");
  }

  // Get user's profile with role
  const profile = await getCurrentProfile();
  
  if (!profile || !profile.role) {
    // Profile not found or no role set - redirect to setup/onboarding
    // For now, we'll redirect to a default student dashboard
    // In production, you might want to show an onboarding flow
    redirect("/onboarding");
  }

  // Map role to dashboard path
  const dashboardPath = ROLE_DASHBOARD_PATHS[profile.role as UserRole] || DEFAULT_PATH;
  
  // Redirect to the appropriate dashboard
  redirect(dashboardPath);
}

/**
 * Metadata for SEO
 */
export const metadata = {
  title: "Dashboard | InternHub",
  description: "Redirecting to your personalized dashboard...",
};
