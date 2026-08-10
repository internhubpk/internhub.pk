/**
 * InternHub Tenant Resolution Service
 * 
 * This service provides centralized tenant (university) resolution
 * for multi-tenant isolation. All university-specific operations
 * should use this service to determine the active tenant context.
 * 
 * IMPORTANT: Never trust client-provided university_id.
 * Always derive tenant from authenticated user context.
 */

import { createClient } from "@/utils/supabase/server";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import { cookies } from "next/headers";
import type { University, Profile, UserRole } from "@/types";

export interface TenantContext {
  university: University | null;
  universityId: string | null;
  isResolved: boolean;
  error?: string;
}

/**
 * Get the current tenant context for server-side operations
 * Uses authenticated user's profile to determine university
 */
export async function getServerTenantContext(): Promise<TenantContext> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        university: null,
        universityId: null,
        isResolved: false,
        error: "Not authenticated"
      };
    }
    
    // Get user profile with university relationship
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*, universities!inner(*)")
      .eq("user_id", user.id)
      .single();
    
    if (profileError || !profile) {
      // User exists but no profile - might need onboarding
      return {
        university: null,
        universityId: null,
        isResolved: false,
        error: "Profile not found"
      };
    }
    
    // Super Admin may not have a specific university
    if (profile.role === "super_admin") {
      return {
        university: null,
        universityId: null,
        isResolved: true
      };
    }
    
    // Extract university from profile relationship
    const university = (profile as any).universities as University | null;
    
    if (!university) {
      return {
        university: null,
        universityId: profile.university_id || null,
        isResolved: !!profile.university_id,
        error: profile.university_id ? "University not found" : "No university assigned"
      };
    }
    
    return {
      university,
      universityId: university.id,
      isResolved: true
    };
    
  } catch (error) {
    console.error("Tenant resolution error:", error);
    return {
      university: null,
      universityId: null,
      isResolved: false,
      error: "Failed to resolve tenant"
    };
  }
}

/**
 * Get current tenant context for client-side operations
 * Should be used in React components with 'use client' directive
 */
export async function getClientTenantContext(): Promise<TenantContext> {
  try {
    const supabase = createBrowserClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        university: null,
        universityId: null,
        isResolved: false,
        error: "Not authenticated"
      };
    }
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*, universities!inner(*)")
      .eq("user_id", user.id)
      .single();
    
    if (profileError || !profile) {
      return {
        university: null,
        universityId: null,
        isResolved: false,
        error: "Profile not found"
      };
    }
    
    if (profile.role === "super_admin") {
      return {
        university: null,
        universityId: null,
        isResolved: true
      };
    }
    
    const university = (profile as any).universities as University | null;
    
    return {
      university,
      universityId: university?.id || profile.university_id || null,
      isResolved: !!(university || profile.university_id)
    };
    
  } catch (error) {
    console.error("Client tenant resolution error:", error);
    return {
      university: null,
      universityId: null,
      isResolved: false,
      error: "Failed to resolve tenant"
    };
  }
}

/**
 * Resolve tenant from domain/subdomain
 * For future use when implementing subdomain-based routing
 */
export function resolveTenantFromDomain(hostname: string): string | null {
  // Example: iiui.internhub.pk -> iiui
  // Example: comsats.internhub.pk -> comsats
  
  const domainParts = hostname.split(".");
  
  // Check if it's a subdomain format
  if (domainParts.length >= 3 && domainParts[domainParts.length - 2] + "." + domainParts[domainParts.length - 1] === "internhub.pk") {
    const subdomain = domainParts[0];
    
    // Don't treat www or app as subdomains
    if (!["www", "app", "admin", "api"].includes(subdomain)) {
      return subdomain;
    }
  }
  
  return null;
}

/**
 * Validate that a resource belongs to the current tenant
 * Prevents cross-tenant data access
 */
export function validateTenantOwnership(
  resourceUniversityId: string | null | undefined,
  currentUniversityId: string | null
): boolean {
  // If no current university context, deny access
  if (!currentUniversityId) {
    return false;
  }
  
  // If resource has no university, allow (platform-level resource)
  if (!resourceUniversityId) {
    return true;
  }
  
  // Strict equality check
  return resourceUniversityId === currentUniversityId;
}

/**
 * Build RLS-compliant query with university filter
 * Always include this filter for university-specific queries
 */
export function buildTenantQuery(baseQuery: any, universityId: string) {
  return baseQuery.eq("university_id", universityId);
}

/**
 * Hook-like function for getting tenant in Server Components
 * Use this at the top of server components that need tenant context
 */
export async function requireTenant() {
  const context = await getServerTenantContext();
  
  if (!context.isResolved) {
    throw new Error(context.error || "Tenant not resolved");
  }
  
  return context;
}
