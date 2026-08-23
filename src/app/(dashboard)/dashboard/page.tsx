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
  // Priority: app_metadata FIRST (kept in sync with profiles.role by the
  // profiles_sync_role_to_auth trigger — migration 0011), then user_metadata
  // as a fallback. Reading app_metadata first protects us from stale
  // user_metadata on accounts whose role was changed before 0011.
  let role: UserRole | null = null;
  
  // Priority 1: app_metadata (set by triggers/admin operations — authoritative)
  const appRole = user.app_metadata?.role;
  if (appRole && ROLE_DASHBOARD_PATHS[appRole as UserRole]) {
    role = appRole as UserRole;
  }
  
  // Priority 2: user_metadata (set at signup; also synced by trigger as of 0011)
  if (!role) {
    const metaRole = user.user_metadata?.role;
    if (metaRole && ROLE_DASHBOARD_PATHS[metaRole as UserRole]) {
      role = metaRole as UserRole;
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
      // Profile fetch failures are non-fatal — we'll fall through to
      // the onboarding page below. Don't log to console: this fires on
      // every dashboard redirect and the noise looks like repeated
      // auth verification cycles in production logs.
    } catch (e) {
      // Profiles table might not be accessible (RLS issue, etc.)
      // This is OK - we'll use the default path below.
    }
  }
  
  // ============================================================
  // REDIRECT based on what we know
  // ============================================================
  const dashboardPath = (role && ROLE_DASHBOARD_PATHS[role]) 
    ? ROLE_DASHBOARD_PATHS[role] 
    : DEFAULT_PATH;

  // Redirect to the appropriate dashboard
  redirect(dashboardPath);
}

/**
 * Metadata for SEO
 */
export const metadata = {
  title: "Dashboard | CareerStep",
  description: "Redirecting to your personalized dashboard...",
};
