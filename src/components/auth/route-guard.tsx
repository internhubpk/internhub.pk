/**
 * RouteGuard Component - Client-Side Route Protection
 * 
 * Provides additional client-side authorization layer.
 * Works alongside server-side middleware for defense-in-depth.
 * 
 * Features:
 * - Checks if user's role matches route requirements
 * - Shows unauthorized state if access denied
 * - Prevents rendering protected content without proper auth
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
 */
export function RouteGuard({
  children,
  requiredRoles,
  UnauthorizedComponent = DefaultUnauthorized,
  fallback,
}: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, isAuthenticated, isLoading: authLoading } = useAuth();
  const [guardState, setGuardState] = useState<GuardState>({
    isAuthorized: false,
    isLoading: true,
    checked: false,
  });

  /**
   * Perform authorization check
   */
  const checkAuthorization = useCallback(() => {
    // Still loading auth state
    if (authLoading) {
      setGuardState({ isAuthorized: false, isLoading: true, checked: false });
      return;
    }

    // Not authenticated - let parent handle redirect to login
    if (!isAuthenticated || !profile) {
      setGuardState({ isAuthorized: false, isLoading: true, checked: true });
      return;
    }

    // Check role-based access
    const userRole = profile.role as UserRole | null;
    
    // If explicit roles provided, check against those
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.includes(userRole!);
      setGuardState({
        isAuthorized: hasRequiredRole,
        isLoading: false,
        checked: true,
      });
      
      // Log unauthorized attempt
      if (!hasRequiredRole) {
        console.warn("[RouteGuard] Access denied - missing required role:", {
          pathname,
          userRole,
          requiredRoles,
        });
      }
      return;
    }

    // Otherwise, use centralized route permissions
    const allowed = isRoleAllowedForRoute(userRole, pathname);
    
    setGuardState({
      isAuthorized: allowed,
      isLoading: false,
      checked: true,
    });

    // Log unauthorized attempt
    if (!allowed) {
      console.warn("[RouteGuard] Access denied by route config:", {
        pathname,
        userRole,
      });
    }
  }, [authLoading, isAuthenticated, profile, pathname, requiredRoles]);

  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  // Show loading state
  if (guardState.isLoading) {
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
    return (
      <UnauthorizedComponent
        attemptedPath={pathname}
        userRole={profile?.role as UserRole | null}
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
  const { profile, isAuthenticated } = useAuth();
  const pathname = usePathname();

  const canAccess = useCallback(
    (path?: string, roles?: UserRole[]) => {
      const targetPath = path || pathname;
      const userRole = profile?.role as UserRole | null;

      if (roles && roles.length > 0) {
        return roles.includes(userRole!);
      }

      return isRoleAllowedForRoute(userRole, targetPath);
    },
    [pathname, profile]
  );

  const redirectToDashboard = useCallback(() => {
    const dashboardPath = getRoleDashboardPath(profile?.role as UserRole | null);
    window.location.href = dashboardPath;
  }, [profile]);

  return {
    canAccess,
    userRole: profile?.role as UserRole | null,
    isAuthenticated,
    redirectToDashboard,
  };
}

export default RouteGuard;
