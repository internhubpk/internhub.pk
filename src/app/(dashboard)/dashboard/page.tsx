import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ROLE_DASHBOARD_PATHS } from "@/lib/auth";
import type { UserRole } from "@/types";

// Default fallback path if role is not recognized
const DEFAULT_PATH = "/student";

/**
 * Dashboard Redirect Page
 * 
 * This server component:
 * 1. Checks if user is authenticated via Supabase Auth
 * 2. Tries to get role from multiple sources (user_metadata, then profiles table)
 * 3. Redirects to appropriate dashboard based on role
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    // Not authenticated - redirect to login
    redirect("/login");
  }

  // Try to get role from user_metadata first (most reliable, doesn't need DB access)
  let role: UserRole | null = user.user_metadata?.role || null;
  
  // If no role in metadata, try profiles table
  if (!role) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      if (!profileError && profile?.role) {
        role = profile.role as UserRole;
      }
    } catch (e) {
      // Profiles table might not be accessible - continue with fallback
      console.log("Profile fetch failed, using fallback:", e instanceof Error ? e.message : e);
    }
  }
  
  // Determine the correct dashboard path
  const dashboardPath = (role && ROLE_DASHBOARD_PATHS[role]) 
    ? ROLE_DASHBOARD_PATHS[role] 
    : DEFAULT_PATH;

  // Log for debugging
  console.log(`Redirecting user ${user.email} to ${dashboardPath} (role: ${role || 'none/default'})`);

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
