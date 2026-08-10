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
    if (!client) return;
    
    try {
      const { data: profileData, error: profileError } = await client
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Handle case where profile doesn't exist yet (new user)
      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // No rows returned - profile doesn't exist yet
          console.log("Profile not found for user:", userId);
          setProfile(null);
          return;
        }
        console.error("Profile fetch error:", profileError.message);
        setProfile(null);
        return;
      }
      
      setProfile(profileData as Profile);

      // Fetch university if profile has university_id
      if (profileData?.university_id) {
        try {
          const { data: uniData, error: uniError } = await client
            .from("universities")
            .select("*")
            .eq("id", profileData.university_id)
            .single();

          if (!uniError && uniData) {
            setUniversity(uniData as University);
          }
        } catch (uniErr) {
          console.error("University fetch error:", uniErr);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
      setUniversity(null);
    }
  }, []);

  useEffect(() => {
    // Skip if supabase client is not available (SSR or build time)
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
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
        console.error("Error initializing auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === "SIGNED_IN" && session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id, supabase);
          } else if (event === "SIGNED_OUT") {
            setUser(null);
            setProfile(null);
            setUniversity(null);
          }
        } catch (error) {
          console.error("Auth state change error:", error);
        } finally {
          setIsLoading(false);
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
        console.error("Logout error:", error);
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
