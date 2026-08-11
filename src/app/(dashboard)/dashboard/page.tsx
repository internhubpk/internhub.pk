import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ROLE_DASHBOARD_PATHS } from "@/lib/auth";
import type { UserRole } from "@/types";

// Default fallback path if role is not recognized
// NOTE: We use /onboarding so users can verify their role rather than assuming "student"
const DEFAULT_PATH = "/onboarding";

/**
 * Dashboard Redirect Page
 * 
 * This server component:
 * 1. Checks if user is authenticated via Supabase Auth
 * 2. Tries to get role from user_metadata first (NO DB call needed)
 * 3. Falls back to profiles table only if metadata doesn't have role
 * 4. Redirects to appropriate dashboard based on role
 * 
 * CRITICAL: Will NOT crash if profiles table returns 403
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  // Handle case where Supabase client couldn't be initialized
  if (!supabase) {
    console.error("Dashboard: Supabase client not initialized");
    redirect("/login");
  }
  
  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    // Not authenticated - redirect to login
    redirect("/login");
  }

  // ============================================================
  // GET ROLE FROM USER METADATA (PRIMARY - No DB Call)
  // ============================================================
  let role: UserRole | null = null;
  
  // Priority 1: user_metadata (most reliable for our use case)
  const metaRole = user.user_metadata?.role;
  if (metaRole && ROLE_DASHBOARD_PATHS[metaRole as UserRole]) {
    role = metaRole as UserRole;
  }
  
  // Priority 2: app_metadata (set by triggers/admin)
  if (!role) {
    const appRole = user.app_metadata?.role;
    if (appRole && ROLE_DASHBOARD_PATHS[appRole as UserRole]) {
      role = appRole as UserRole;
    }
  }
  
  // ============================================================
  // FALLBACK: Try profiles table (may fail with 403 - that's OK)
  // ============================================================
  if (!role) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      if (!profileError && profile?.role && ROLE_DASHBOARD_PATHS[profile.role as UserRole]) {
        role = profile.role as UserRole;
      }
      
      // Log profile fetch result for debugging (harmless if it fails)
      if (profileError) {
        console.log(`Dashboard: Profile fetch note for ${user.email}:`, profileError.message);
      }
    } catch (e) {
      // Profiles table might not be accessible (RLS issue, etc.)
      // This is OK - we'll use the default path below
      console.log(`Dashboard: Profile fetch failed for ${user.email}, using default path`);
    }
  }
  
  // ============================================================
  // REDIRECT based on what we know
  // ============================================================
  const dashboardPath = (role && ROLE_DASHBOARD_PATHS[role]) 
    ? ROLE_DASHBOARD_PATHS[role] 
    : DEFAULT_PATH;

  // Log for debugging (visible in Vercel logs)
  console.log(`Dashboard: Redirecting user ${user.email} → ${dashboardPath} (role: ${role || 'none/default'})`);
  console.log(`Dashboard: User metadata:`, JSON.stringify(user.user_metadata));
  console.log(`Dashboard: App metadata:`, JSON.stringify(user.app_metadata));

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
