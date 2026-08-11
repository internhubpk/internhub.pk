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

  // Get user's profile with role - with error handling
  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (error) {
    console.log("Profile fetch failed in dashboard:", error instanceof Error ? error.message : error);
    // Continue without profile - will use default path
  }
  
  // Determine the correct dashboard path
  let dashboardPath: string;
  
  if (profile && profile.role) {
    // User has a profile with a role - use it
    dashboardPath = ROLE_DASHBOARD_PATHS[profile.role as UserRole] || DEFAULT_PATH;
  } else {
    // No profile or no role - check for common patterns or default to student
    // In production, University Admin would assign roles via admin panel
    console.log(`No profile/role found for user ${user.id}, redirecting to student dashboard`);
    dashboardPath = DEFAULT_PATH;
  }
  
  // Log the redirection for debugging
  console.log(`Redirecting user ${user.id} to ${dashboardPath} (role: ${profile?.role || 'none'})`);

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
