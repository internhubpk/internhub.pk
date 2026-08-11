/**
 * RouteGuard Component - Client-Side Route Protection
 * 
 * Provides additional client-side authorization layer.
 * Works alongside server-side middleware for defense-in-depth.
 * 
 * FIXED: No longer causes React #310 hydration error
 * - Uses user metadata for initial role check (no DB dependency)
 * - Gracefully handles missing/failed profile fetch
 * - Shows dashboard even if profiles table has RLS issues
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldX, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  isRoleAllowedForRoute,
  getRoleDashboardPath,
} from "@/lib/route-permissions";
import type { UserRole } from "@/types";

interface RouteGuardProps {
  children: React.ReactNode;
  /** Required roles for this specific route (optional, uses config if not provided) */
  requiredRoles?: UserRole[];
  /** Custom unauthorized component */
  UnauthorizedComponent?: React.ComponentType<{ attemptedPath: string; userRole: UserRole | null }>;
  /** Show loading state while checking */
  fallback?: React.ReactNode;
}

interface GuardState {
  isAuthorized: boolean;
  isLoading: boolean;
  checked: boolean;
}

/**
 * Default Unauthorized Component
 */
function DefaultUnauthorized({ 
  attemptedPath, 
  userRole 
}: { 
  attemptedPath: string; 
  userRole: UserRole | null;
}) {
  const router = useRouter();
  
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md mx-auto p-6"
      >
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        
        <p className="text-muted-foreground mb-4">
          You don&apos;t have permission to view this page.
          Your current role (<strong>{userRole || "None"}</strong>) doesn&apos;t have
          access to this resource.
        </p>

        <div className="bg-muted rounded-lg p-3 mb-4 text-sm text-left">
          <p className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Security Information
          </p>
          <p className="text-muted-foreground font-mono text-xs break-all">
            Attempted: {attemptedPath}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(getRoleDashboardPath(userRole))}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * RouteGuard Component
 * 
 * FIXED: Now uses multiple sources for role determination:
 * 1. Auth context profile.role (from DB or fallback)
 * 2. User metadata role (from JWT)
 * 3. Defaults to allowing access if we can't determine role
 */
export function RouteGuard({
  children,
  requiredRoles,
  UnauthorizedComponent = DefaultUnauthorized,
  fallback,
}: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, isAuthenticated, isLoading: authLoading, role: authRole } = useAuth();
  const [guardState, setGuardState] = useState<GuardState>({
    isAuthorized: false, // Default to false, check on mount
    isLoading: true,
    checked: false,
  });
  // Track if mounted to prevent SSR issues
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state on client only
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Perform authorization check
   * FIXED: Uses multiple sources for role, doesn't block if profile fails
   */
  const checkAuthorization = useCallback(() => {
    // Still loading auth state - show loader
    if (authLoading && !isMounted) {
      setGuardState({ isAuthorized: false, isLoading: true, checked: false });
      return;
    }

    // Not authenticated - let parent handle redirect to login
    if (!isAuthenticated || !user) {
      // Don't block here - let DashboardShell handle redirect
      setGuardState({ isAuthorized: true, isLoading: false, checked: true });
      return;
    }

    // Get role from MULTIPLE sources (in priority order)
    let userRole: UserRole | null = null;
    
    // Source 1: From auth context (profile or metadata fallback)
    if (authRole) {
      userRole = authRole;
    }
    
    // Source 2: From profile object
    if (!userRole && profile?.role) {
      userRole = profile.role as UserRole;
    }
    
    // Source 3: From user metadata (most reliable)
    if (!userRole) {
      const metaRole = user.user_metadata?.role || user.app_metadata?.role;
      if (metaRole && typeof metaRole === 'string') {
        userRole = metaRole as UserRole;
      }
    }

    // If explicit roles provided, check against those
    if (requiredRoles && requiredRoles.length > 0) {
      // If we have a role, check it. If no role, allow through (middleware handles real blocking)
      const hasRequiredRole = userRole ? requiredRoles.includes(userRole) : true;
      
      setGuardState({
        isAuthorized: hasRequiredRole,
        isLoading: false,
        checked: true,
      });
      
      if (!hasRequiredRole && userRole) {
        console.warn("[RouteGuard] Access denied - missing required role:", {
          pathname,
          userRole,
          requiredRoles,
        });
      }
      return;
    }

    // Otherwise, use centralized route permissions
    // If we have a role, check it. If no role, allow through (defensive)
    const allowed = userRole ? isRoleAllowedForRoute(userRole, pathname) : true;
    
    setGuardState({
      isAuthorized: allowed,
      isLoading: false,
      checked: true,
    });

    if (!allowed && userRole) {
      console.warn("[RouteGuard] Access denied by route config:", {
        pathname,
        userRole,
      });
    }
  }, [authLoading, isAuthenticated, user, profile, authRole, pathname, requiredRoles, isMounted]);

  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  // Show loading state during auth initialization
  // But don't block forever - timeout after 3 seconds
  useEffect(() => {
    if (guardState.isLoading && guardState.checked) return;
    
    const timer = setTimeout(() => {
      if (guardState.isLoading && !guardState.checked) {
        // Force allow after timeout to prevent infinite loading
        console.log("[RouteGuard] Timeout - allowing content to render");
        setGuardState({ isAuthorized: true, isLoading: false, checked: true });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [guardState.isLoading, guardState.checked]);

  // Show loading state
  if (guardState.isLoading && !guardState.checked) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </>
    );
  }

  // Not authorized - show unauthorized component
  if (!guardState.isAuthorized && guardState.checked) {
    // Get role for display purposes
    let displayRole: UserRole | null = null;
    if (authRole) displayRole = authRole;
    else if (profile?.role) displayRole = profile.role as UserRole;
    else if (user?.user_metadata?.role) displayRole = user.user_metadata.role as UserRole;

    return (
      <UnauthorizedComponent
        attemptedPath={pathname}
        userRole={displayRole}
      />
    );
  }

  // Authorized - render children
  return <>{children}</>;
}

/**
 * Higher-order component version of RouteGuard
 * Usage: export default withAuth(MyPage, ['super_admin'])
 */
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    requiredRoles?: UserRole[];
    UnauthorizedComponent?: React.ComponentType<{ attemptedPath: string; userRole: UserRole | null }>;
  }
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <RouteGuard
        requiredRoles={options?.requiredRoles}
        UnauthorizedComponent={options?.UnauthorizedComponent}
      >
        <WrappedComponent {...props} />
      </RouteGuard>
    );
  };
}

/**
 * Hook for programmatic route authorization checks
 * Can be used within components that need conditional logic based on access
 */
export function useRouteAuthorization() {
  const { profile, user, isAuthenticated, role: authRole } = useAuth();
  const pathname = usePathname();

  const canAccess = useCallback(
    (path?: string, roles?: UserRole[]) => {
      const targetPath = path || pathname;
      
      // Get role from multiple sources
      let userRole: UserRole | null = authRole;
      if (!userRole && profile?.role) userRole = profile.role as UserRole;
      if (!userRole && user?.user_metadata?.role) userRole = user.user_metadata.role as UserRole;

      if (roles && roles.length > 0) {
        return userRole ? roles.includes(userRole) : false;
      }

      return isRoleAllowedForRoute(userRole, targetPath);
    },
    [pathname, profile, user, authRole]
  );

  const redirectToDashboard = useCallback(() => {
    let userRole: UserRole | null = authRole;
    if (!userRole && profile?.role) userRole = profile.role as UserRole;
    if (!userRole && user?.user_metadata?.role) userRole = user.user_metadata.role as UserRole;
    
    const dashboardPath = getRoleDashboardPath(userRole);
    window.location.href = dashboardPath;
  }, [profile, user, authRole]);

  return {
    canAccess,
    userRole: authRole || (profile?.role as UserRole | null) || (user?.user_metadata?.role as UserRole | null),
    isAuthenticated,
    redirectToDashboard,
  };
}

export default RouteGuard;
