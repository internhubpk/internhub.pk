import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { UserRole, Profile, University } from "@/types";

// Role-based dashboard paths mapping
export const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  super_admin: "/super-admin",
  university_admin: "/university-admin",
  department_coordinator: "/department-coordinator",
  program_coordinator: "/program-coordinator",
  faculty_supervisor: "/faculty-supervisor",
  student: "/student",
  company_hr: "/company-hr",
  site_supervisor: "/site-supervisor",
  external_evaluator: "/external-evaluator",
};

/**
 * Get the current authenticated user from Supabase
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    
    // Handle case where Supabase client couldn't be initialized
    if (!supabase) {
      console.warn("Supabase client not initialized - check environment variables");
      return null;
    }
    
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Get the current user's profile with role information
 * Queries the profiles table to get user profile data
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return null;
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    if (!supabase) {
      return null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !profile) {
      return null;
    }

    return profile as Profile;
  } catch (error) {
    console.error("Error getting current profile:", error);
    return null;
  }
}

/**
 * Get the user's university information
 */
export async function getCurrentUniversity(): Promise<University | null> {
  try {
    const profile = await getCurrentProfile();
    
    if (!profile?.university_id) {
      return null;
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    if (!supabase) {
      return null;
    }

    const { data: university, error } = await supabase
      .from("universities")
      .select("*")
      .eq("id", profile.university_id)
      .single();

    if (error || !university) {
      return null;
    }

    return university as University;
  } catch (error) {
    console.error("Error getting university:", error);
    return null;
  }
}

/**
 * Protect server components - redirects to login if not authenticated
 * Returns the user object if authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }
  
  return user;
}

/**
 * Role-based access control for server components
 * Redirects to dashboard if user doesn't have required role
 * @param roles - Array of allowed roles
 * Returns the profile if authorized
 */
export async function requireRole(roles: UserRole | UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  
  if (!profile) {
    redirect("/login");
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  if (!allowedRoles.includes(profile.role)) {
    // Redirect to their actual dashboard instead of showing error
    redirectByRole(profile.role);
  }
  
  return profile;
}

/**
 * Redirect user to appropriate dashboard based on role
 * Call this when you need to route users after login or from /dashboard
 */
export function redirectByRole(role: UserRole): never {
  const path = ROLE_DASHBOARD_PATHS[role];
  redirect(path);
}

/**
 * Check if a user has a specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile ? roles.includes(profile.role) : false;
}

/**
 * Get session data including user, profile, and university
 */
export async function getSession() {
  const user = await getCurrentUser();
  
  if (!user) {
    return { user: null, profile: null, university: null };
  }

  const [profile, university] = await Promise.all([
    getCurrentProfile(),
    getCurrentUniversity(),
  ]);

  return { user, profile, university };
}

/**
 * Set a cookie on a NextResponse that tells the proxy (src/proxy.ts) to
 * force a refreshSession() on the next navigation. Role-mutating API
 * routes (coordinators/[id], supervisors, super-admin/update-admin-account,
 * admin/create-user) call this on their response so that the affected
 * user's next page load picks up their new app_metadata.role.
 *
 * This works together with the proxy's BUG-5 fix: the proxy reads this
 * cookie, calls refreshSession(), then deletes the cookie so it only
 * fires once.
 *
 * Note: the API route itself doesn't know which user's session to
 * refresh — but the cookie is set on the *response* to the admin who
 * made the call, AND if the admin is editing their own account, the
 * cookie fires on their next navigation. For cross-user mutations
 * (admin edits someone else's role), the target user's JWT is still
 * stale until natural expiry OR until they re-login. The cookie
 * approach only fully fixes the self-edit case; cross-user staleness
 * is mitigated by the natural 1-hour JWT expiry. That's an acceptable
 * tradeoff — the alternative (DB lookup on every protected route)
 * would defeat the proxy's "JWT-only, no DB" design.
 */
export function setForceSessionRefreshCookie(
  response: import("next/server").NextResponse
): void {
  response.cookies.set("internhub_force_refresh", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60, // short-lived — only needs to survive one navigation
  });
}
