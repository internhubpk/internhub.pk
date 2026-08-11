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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = React.useRef(true);

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

  const fetchProfile = useCallback(async (userId: string, client: SupabaseClient | null) => {
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
        // If we get 403/permission error, build profile from user_metadata instead
        console.log("Profile table not accessible, using user_metadata fallback");
        
        // Get current session to extract metadata
        const { data: { session } } = await client.auth.getSession();
        
        if (session?.user && isMountedRef.current) {
          const meta = session.user.user_metadata || {};
          const fallbackProfile: Profile = {
            user_id: userId,
            email: session.user.email || "",
            full_name: meta.full_name || null,
            first_name: meta.first_name || null,
            last_name: meta.last_name || null,
            role: (meta.role || 'student') as UserRole,
            avatar_url: meta.avatar_url || null,
            phone: null,
            bio: null,
            username: null,
            university_id: null,
            department_id: null,
            company_id: null,
            status: 'active',
            is_active: true,
            student_id: null,
            company_name: null,
            job_title: null,
            organization: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
        } else if (isMountedRef.current) {
          setProfile(null);
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
      
      try {
        const { data: { session } } = await client.auth.getSession();
        if (session?.user && isMountedRef.current) {
          const meta = session.user.user_metadata || {};
          const fallbackProfile: Profile = {
            user_id: userId,
            email: session.user.email || "",
            full_name: meta.full_name || null,
            role: (meta.role || 'student') as UserRole,
            status: 'active',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
        }
      } catch (e) {
        if (isMountedRef.current) {
          setProfile(null);
          setUniversity(null);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Skip if supabase client is not available (SSR or build time)
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Prevent duplicate initializations
    let isInitialized = false;

    // Get initial session
    const initializeAuth = async () => {
      if (isInitialized) return;
      isInitialized = true;
      
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
          await fetchProfile(session.user.id, supabase);
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
            await fetchProfile(session.user.id, supabase);
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
      await fetchProfile(user.id, supabase);
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
    if (!profile?.role) return false;
    return roles.includes(profile.role);
  }, [profile?.role]);

  const value: AuthContextType = {
    user,
    profile,
    university,
    isLoading,
    isAuthenticated: !!user,
    role: profile?.role || null,
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
