"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
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
  program_coordinator: "/program-coordinator",
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
      // Fetch the profile with joined university and department data.
      // PostgREST relationship syntax: `departments:department_id` means
      // "join the departments table on the department_id FK column".
      // This populates profile.departments and profile.universities so
      // the UI can display the actual names instead of raw UUIDs.
      const { data: profileData, error: profileError } = await client
        .from("profiles")
        .select(
          `*,
          departments:department_id ( id, name, code ),
          universities:university_id ( id, name, slug, logo_url, domain ),
          programs:program_id ( id, name, code )`
        )
        .eq("user_id", userId)
        .single();

      // Handle case where profile doesn't exist yet (new user) or table has RLS issues
      if (profileError) {
        // Don't log the full error to console — it can be noisy and may leak
        // RLS details in production. The fallback below is the expected
        // path for new users whose profile row hasn't been created yet.
        
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
            // Silent — fall through to setProfile(null)
            if (isMountedRef.current) {
              setProfile(null);
            }
          }
        }
        return;
      }
      
      if (isMountedRef.current) {
        setProfile(profileData as Profile);

        // The joined query above already populated `universities` on the
        // profile object. Set it on the separate `university` state so
        // existing consumers (sidebar, header) that read `university` from
        // the context still work.
        const joinedUni = (profileData as any)?.universities;
        if (joinedUni) {
          // Fetch the full university record (with all fields like
          // settings, license_tier, etc.) for the sidebar/header branding.
          // The joined query only selected a subset of fields for display.
          try {
            const { data: uniData } = await client
              .from("universities")
              .select("*")
              .eq("id", profileData.university_id)
              .single();
            if (uniData && isMountedRef.current) {
              setUniversity(uniData as University);
            } else if (isMountedRef.current) {
              // Use the partial data from the join as a fallback
              setUniversity(joinedUni as University);
            }
          } catch {
            // University table might not exist - use joined data
            if (isMountedRef.current) {
              setUniversity(joinedUni as University);
            }
          }
        }
      }
    } catch (error) {
      // Catch any unexpected errors gracefully - use metadata fallback.
      // Don't log to console — this is the expected path when the
      // profiles table isn't reachable (RLS, network blip, etc.) and
      // logging it on every auth state change creates noise that looks
      // like repeated verification cycles.
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
          // DETERMINISTIC AUTH STATE: on session error, mark as
          // unauthenticated and stop loading. Previously we left
          // isLoading=true briefly, which caused race conditions
          // where RouteGuard would render the dashboard shell before
          // auth state was resolved.
          setUser(null);
          setProfile(null);
          setUniversity(null);
          setIsLoading(false);
          return;
        }
        
        if (session?.user) {
          setUser(session.user);
          // Pass user data so fallback can be created if DB fails.
          // fetchProfile will call setIsLoading(false) in its finally
          // block, so we don't set it here.
          await fetchProfile(session.user.id, supabase, session.user);
          // Defensive: if fetchProfile returned without setting
          // isLoading (e.g. due to an early return), force it to
          // false here so the UI doesn't hang.
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        } else {
          // No session — explicitly clear user state and stop loading.
          // This is the "unauthenticated" terminal state.
          setUser(null);
          setProfile(null);
          setUniversity(null);
          setIsLoading(false);
        }
      } catch (error) {
        // Auth initialization failed. Don't log to console — this can
        // fire during normal SSR / hydration transitions and the noise
        // looks like repeated verification cycles. The user will see a
        // deterministic loading→unauthenticated transition.
        if (isMountedRef.current) {
          setUser(null);
          setProfile(null);
          setUniversity(null);
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
          } else if (event === "TOKEN_REFRESHED" && session?.user) {
            // BUG 5 FIX: When the proxy (or Supabase SDK) refreshes the
            // session, the user object's app_metadata is updated to the
            // latest server-side state. We MUST propagate this to React
            // state so the UI reflects any role/tenant changes an admin
            // just made. Previously this event was ignored, which left
            // the UI showing the stale role until a hard page reload.
            setUser(session.user);
            // Re-fetch the profile too — RLS now evaluates against the
            // new role/tenant, so the profile data may change.
            await fetchProfile(session.user.id, supabase, session.user);
          } else if (event === "INITIAL_SESSION") {
            // The INITIAL_SESSION event fires when the SDK finishes
            // loading the persisted session. If session is null here,
            // it means there's no persisted session — ensure isLoading
            // flips to false so the UI doesn't hang on the loading
            // skeleton forever.
            if (!session?.user) {
              setUser(null);
              setProfile(null);
              setUniversity(null);
            }
          }
        } catch (error) {
          // Auth state change error — don't log, the finally block
          // still flips isLoading to false so the UI doesn't hang.
        } finally {
          // ALWAYS flip isLoading to false after processing an auth
          // event. Previously, certain event paths (e.g. INITIAL_SESSION
          // with no user) didn't flip isLoading, leaving the dashboard
          // stuck on the loading skeleton and triggering React #310
          // when hooks reordered on the eventual state transition.
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
        // Silent — we still clear local state below regardless.
      }
    }
    // Defensive: clear any lingering Supabase auth cookies directly.
    // signOut() should already do this, but on some setups (subdomain
    // cookies, third-party cookie blocking, etc.) the cookie can persist
    // and the proxy will bounce the user back to /dashboard on their
    // next navigation to /login. Clearing document.cookie explicitly
    // guarantees the next request goes out unauthenticated.
    if (typeof document !== "undefined") {
      const clearCookie = (name: string) => {
        // Clear for the current path/domain and a few common variants.
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
        // Also clear for the parent domain (e.g. .internhub.pk) so the
        // cookie doesn't survive a subdomain switch.
        const host = window.location.hostname;
        const parts = host.split(".");
        if (parts.length >= 2) {
          const parent = parts.slice(1).join(".");
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${parent}`;
        }
      };
      // Supabase auth cookies start with "sb-".
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        if (name.startsWith("sb-")) {
          clearCookie(name);
        }
      });
    }
    setUser(null);
    setProfile(null);
    setUniversity(null);
  }, [supabase]);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    // SECURITY (2026-08-23 audit): DB profile role first, then app_metadata.
    // user_metadata is user-writable via auth.updateUser and must never be
    // trusted for role decisions.
    if (profile?.role && roles.includes(profile.role)) return true;

    const metaRole =
      (user?.app_metadata?.app_role as string | undefined) ||
      (user?.app_metadata?.role as string | undefined);
    if (metaRole && roles.includes(metaRole as UserRole)) return true;

    return false;
  }, [profile?.role, user?.app_metadata?.app_role, user?.app_metadata?.role]);

  // Determine role from multiple sources for the context value.
  // Priority:
  //   1. profile.role (DB — most accurate, but requires the profiles table
  //      to be reachable; on RLS failure we fall through)
  //   2. user.app_metadata.app_role (migration 0090) or legacy
  //      user.app_metadata.role (system-managed; kept in sync with
  //      profiles.role by the profiles_sync_role_to_auth trigger —
  //      migration 0011)
  //   3. user.user_metadata.role (set at signup; also synced by the
  //      trigger as of 0011, but kept last for legacy accounts)
  const getEffectiveRole = useCallback((): UserRole | null => {
    // SECURITY (2026-08-23 audit): DB profile first, then app_metadata.
    // user_metadata is user-writable and excluded from role resolution.
    // Priority 1: From profile (DB)
    if (profile?.role) return profile.role;

    // Priority 2: From app_metadata.app_role (migration 0090), with legacy
    // fallback to app_metadata.role.
    const metaRole =
      (user?.app_metadata?.app_role as string | undefined) ||
      (user?.app_metadata?.role as string | undefined);
    if (metaRole) return metaRole as UserRole;

    return null;
  }, [profile?.role, user?.app_metadata?.app_role, user?.app_metadata?.role]);

  // Compute the effective role once per render. The value is a primitive
  // (string or null), so identical inputs produce identical outputs — this
  // won't cause useMemo to think the value changed.
  const effectiveRole = getEffectiveRole();

  // Memoize the context value so consumers only re-render when one of the
  // actual values changes. Without this, every AuthProvider re-render
  // (e.g. isLoading flipping from true to false) creates a new value object
  // and forces ALL consumers to re-render — which can cascade through
  // RouteGuard's useCallback/useEffect chains and trigger "Maximum update
  // depth exceeded" (React #185) on login, when setUser → setProfile →
  // setUniversity → setIsLoading(false) all fire in quick succession.
  const value: AuthContextType = useMemo(
    () => ({
      user,
      profile,
      university,
      isLoading,
      isAuthenticated: !!user,
      role: effectiveRole,
      refreshProfile,
      logout,
      hasRole,
    }),
    [
      user,
      profile,
      university,
      isLoading,
      effectiveRole,
      refreshProfile,
      logout,
      hasRole,
    ]
  );

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
