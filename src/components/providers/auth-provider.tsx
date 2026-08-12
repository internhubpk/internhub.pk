"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, University, UserRole } from "@/types";
import { createClient } from "@/utils/supabase/client";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  university: University | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role dashboard paths for quick lookup
const ROLE_DASHBOARDS: Record<UserRole, string> = {
  super_admin: "/super-admin",
  university_admin: "/university-admin",
  department_coordinator: "/department-coordinator",
  faculty_supervisor: "/faculty-supervisor",
  student: "/student",
  company_hr: "/company-hr",
  site_supervisor: "/site-supervisor",
  external_evaluator: "/external-evaluator",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = React.useRef(true);
  // Track if initialized to prevent duplicate calls
  const initializedRef = React.useRef(false);

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Lazy initialize Supabase client to avoid build-time issues
  const [supabase] = useState<SupabaseClient | null>(() => {
    try {
      if (typeof window !== "undefined") {
        return createClient();
      }
      return null;
    } catch {
      return null;
    }
  });

  /**
   * Create a fallback profile from user metadata
   * This ensures we ALWAYS have a profile object even if DB fails
   */
  const createFallbackProfile = useCallback((userData: User): Profile => {
    const meta = userData.user_metadata || {};
    const appMeta = userData.app_metadata || {};
    
    // Determine role from metadata — prefer app_metadata (kept in sync with
    // profiles.role by the profiles_sync_role_to_auth trigger, migration 0011)
    // over user_metadata (set once at signup, may be stale on role changes).
    let role: UserRole = 'student';
    const appRole = appMeta.role;
    if (appRole && ROLE_DASHBOARDS[appRole as UserRole]) {
      role = appRole as UserRole;
    } else {
      const metaRole = meta.role;
      if (metaRole && ROLE_DASHBOARDS[metaRole as UserRole]) {
        role = metaRole as UserRole;
      }
    }

    return {
      user_id: userData.id,
      email: userData.email || "",
      full_name: meta.full_name || meta.name || null,
      first_name: meta.first_name || null,
      last_name: meta.last_name || null,
      role: role,
      avatar_url: meta.avatar_url || meta.picture || null,
      phone: meta.phone || null,
      bio: null,
      username: meta.username || null,
      // Read tenant ids from app_metadata FIRST (system-managed, kept in
      // sync with profiles by the profiles_sync_auth_metadata trigger,
      // migration 0013), then fall back to user_metadata. Same priority
      // order as the role resolution above and the proxy / dashboard
      // server code.
      university_id: appMeta.university_id || meta.university_id || null,
      department_id: appMeta.department_id || meta.department_id || null,
      company_id: appMeta.company_id || meta.company_id || null,
      status: 'active',
      is_active: true,
      student_id: null,
      company_name: meta.company_name || null,
      job_title: meta.job_title || null,
      organization: meta.organization || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, []);

  const fetchProfile = useCallback(async (userId: string, client: SupabaseClient | null, userData?: User) => {
    if (!client || !isMountedRef.current) return;
    
    try {
      // Check if profiles table exists and is accessible
      const { data: profileData, error: profileError } = await client
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Handle case where profile doesn't exist yet (new user) or table has RLS issues
      if (profileError) {
        console.log("Profile table not accessible, using user_metadata fallback. Error:", profileError.message);
        
        // Use fallback profile from metadata
        if (userData && isMountedRef.current) {
          const fallbackProfile = createFallbackProfile(userData);
          setProfile(fallbackProfile);
        } else if (isMountedRef.current) {
          // Try to get session for user data
          try {
            const { data: { session } } = await client.auth.getSession();
            if (session?.user && isMountedRef.current) {
              const fallbackProfile = createFallbackProfile(session.user);
              setProfile(fallbackProfile);
            } else if (isMountedRef.current) {
              setProfile(null);
            }
          } catch (sessionErr) {
            console.log("Session fetch failed:", sessionErr instanceof Error ? sessionErr.message : sessionErr);
            if (isMountedRef.current) {
              setProfile(null);
            }
          }
        }
        return;
      }
      
      if (isMountedRef.current) {
        setProfile(profileData as Profile);

        // Fetch university if profile has university_id
        if (profileData?.university_id) {
          try {
            const { data: uniData, error: uniError } = await client
              .from("universities")
              .select("*")
              .eq("id", profileData.university_id)
              .single();

            if (!uniError && uniData && isMountedRef.current) {
              setUniversity(uniData as University);
            }
          } catch (uniErr) {
            // University table might not exist - that's ok
            console.log("University fetch skipped:", uniErr instanceof Error ? uniErr.message : "Unknown error");
          }
        }
      }
    } catch (error) {
      // Catch any unexpected errors gracefully - use metadata fallback
      console.log("Profile fetch error, using fallback:", error instanceof Error ? error.message : "Unknown error");
      
      if (userData && isMountedRef.current) {
        const fallbackProfile = createFallbackProfile(userData);
        setProfile(fallbackProfile);
      } else if (isMountedRef.current) {
        setProfile(null);
        setUniversity(null);
      }
    }
  }, [createFallbackProfile]);

  useEffect(() => {
    // Skip if supabase client is not available (SSR or build time)
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Prevent duplicate initializations
    if (initializedRef.current) return;

    // Get initial session
    const initializeAuth = async () => {
      initializedRef.current = true;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMountedRef.current) return;

        if (error) {
          console.error("Session error:", error.message);
          setIsLoading(false);
          return;
        }
        
        if (session?.user) {
          setUser(session.user);
          // Pass user data so fallback can be created if DB fails
          await fetchProfile(session.user.id, supabase, session.user);
        }
      } catch (error) {
        console.error("Error initializing auth:", error instanceof Error ? error.message : error);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMountedRef.current) return;
        
        try {
          if (event === "SIGNED_IN" && session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id, supabase, session.user);
          } else if (event === "SIGNED_OUT") {
            setUser(null);
            setProfile(null);
            setUniversity(null);
          }
          // Ignore TOKEN_REFRESHED and other events to avoid unnecessary re-renders
        } catch (error) {
          console.error("Auth state change error:", error instanceof Error ? error.message : error);
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user && supabase) {
      await fetchProfile(user.id, supabase, user);
    }
  }, [user, supabase, fetchProfile]);

  const logout = useCallback(async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Logout error:", error instanceof Error ? error.message : error);
      }
    }
    setUser(null);
    setProfile(null);
    setUniversity(null);
  }, [supabase]);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    // Check multiple sources for role
    if (profile?.role && roles.includes(profile.role)) return true;
    
    // Also check user metadata
    if (user?.user_metadata?.role && roles.includes(user.user_metadata.role as UserRole)) return true;
    if (user?.app_metadata?.role && roles.includes(user.app_metadata.role as UserRole)) return true;
    
    return false;
  }, [profile?.role, user?.user_metadata?.role, user?.app_metadata?.role]);

  // Determine role from multiple sources for the context value.
  // Priority:
  //   1. profile.role (DB — most accurate, but requires the profiles table
  //      to be reachable; on RLS failure we fall through)
  //   2. user.app_metadata.role (system-managed; kept in sync with
  //      profiles.role by the profiles_sync_role_to_auth trigger —
  //      migration 0011)
  //   3. user.user_metadata.role (set at signup; also synced by the
  //      trigger as of 0011, but kept last for legacy accounts)
  const getEffectiveRole = useCallback((): UserRole | null => {
    // Priority 1: From profile (DB or fallback)
    if (profile?.role) return profile.role;

    // Priority 2: From app_metadata (system-managed, kept in sync by trigger)
    if (user?.app_metadata?.role) return user.app_metadata.role as UserRole;

    // Priority 3: From user_metadata (set at signup)
    if (user?.user_metadata?.role) return user.user_metadata.role as UserRole;

    return null;
  }, [profile?.role, user?.user_metadata?.role, user?.app_metadata?.role]);

  const value: AuthContextType = {
    user,
    profile,
    university,
    isLoading,
    isAuthenticated: !!user,
    role: getEffectiveRole(),
    refreshProfile,
    logout,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
