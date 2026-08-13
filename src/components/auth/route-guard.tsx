/**
 * RouteGuard Component - Client-Side Route Protection
 * 
 * Provides additional client-side authorization layer.
 * Works alongside server-side middleware for defense-in-depth.
 * 
 * FIXED (migration 0011 era):
 * - When a user lands on a route their role can't access AND we know their
 *   role, we now AUTO-REDIRECT them to their own dashboard instead of
 *   stranding them on a static "Access Denied" page. The static page is
 *   still rendered if we can't determine the role (e.g. during initial
 *   session load with no metadata).
 * - Role source priority is now: authRole (from AuthProvider, which is
 *   profile.role → app_metadata.role → user_metadata.role), then
 *   profile.role, then user.app_metadata.role, then user.user_metadata.role.
 *   Reading app_metadata before user_metadata protects against stale
 *   user_metadata on accounts whose role was changed before migration 0011.
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
 *
 * Only shown when we genuinely can't determine the user's role (e.g.
 * transient session-loading state). When we DO know the role and they're
 * on a forbidden route, RouteGuard redirects them to their dashboard
 * instead — much better UX than a dead-end page.
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

  // ----------------------------------------------------------------
  // PRIMITIVE-ONLY DEPS for resolveRole.
  //
  // The previous version depended on `user` and `profile` object
  // references, which change on every AuthProvider re-render even when
  // the underlying values are identical. That made `resolveRole`'s
  // reference change on every render, which cascaded into
  // `checkAuthorization`'s reference changing, which fired the
  // useEffect, which called setGuardState, which re-rendered — and
  // under the rapid auth-state transitions of login this became the
  // "Maximum update depth exceeded" (React #185) loop.
  //
  // By depending only on the primitive fields we actually read
  // (authRole, profile.role, app_metadata.role, user_metadata.role),
  // the callback reference stays stable across renders that don't
  // actually change the user's role.
  // ----------------------------------------------------------------
  const appMetaRole = user?.app_metadata?.role as string | undefined;
  const userMetaRole = user?.user_metadata?.role as string | undefined;
  const profileRole = profile?.role as string | undefined;

  const resolveRole = useCallback((): UserRole | null => {
    // Source 1: From auth context (AuthProvider computes this from
    // profile.role → app_metadata.role → user_metadata.role)
    if (authRole) return authRole;

    // Source 2: From profile object (DB row, may be a metadata fallback)
    if (profileRole) return profileRole as UserRole;

    // Source 3: From app_metadata (system-managed, kept in sync by trigger)
    if (appMetaRole) return appMetaRole as UserRole;

    // Source 4: From user_metadata (set at signup)
    if (userMetaRole && typeof userMetaRole === 'string') {
      return userMetaRole as UserRole;
    }

    return null;
  }, [authRole, profileRole, appMetaRole, userMetaRole]);

  /**
   * Perform authorization check.
   *
   * Deps are deliberately primitive-only (no object refs) so the
   * callback reference stays stable across unrelated re-renders.
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

    const userRole = resolveRole();

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
  }, [authLoading, isAuthenticated, user, pathname, requiredRoles, isMounted, resolveRole]);

  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  // AUTO-REDIRECT: if we've checked and the user is not authorized, AND we
  // know their role, send them to their own dashboard. Don't strand them on
  // a dead-end access-denied page when we have enough info to route them
  // somewhere useful. Only show the static UnauthorizedComponent if we
  // genuinely can't determine the role (e.g. transient session state).
  //
  // `router.replace` is idempotent for the same target path, but we still
  // gate on `pathname !== dashboardPath` to avoid queueing redundant
  // navigations on every render.
  useEffect(() => {
    if (guardState.checked && !guardState.isAuthorized) {
      const userRole = resolveRole();
      if (userRole) {
        const dashboardPath = getRoleDashboardPath(userRole);
        // Avoid infinite redirect loop: only redirect if we're not already
        // on the user's dashboard.
        if (pathname !== dashboardPath) {
          console.log(`[RouteGuard] Auto-redirecting to ${dashboardPath} (role: ${userRole}, attempted: ${pathname})`);
          router.replace(dashboardPath);
        }
      }
    }
    // resolveRole is stable (primitive deps), so this effect only fires
    // when guardState.checked, guardState.isAuthorized, router, or pathname
    // actually change — not on every AuthProvider re-render.
  }, [guardState.checked, guardState.isAuthorized, resolveRole, router, pathname]);

  // Show loading state during auth initialization
  // But don't block forever - timeout after 3 seconds. This is a safety
  // net for the rare case where the auth state never resolves (e.g. the
  // Supabase client throws during getSession and the finally block doesn't
  // fire). It is NOT involved in the normal login flow.
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

  // Not authorized - show unauthorized component (only reached if we
  // couldn't auto-redirect, e.g. role is null — otherwise the
  // auto-redirect useEffect above fires and pushes them to their dashboard)
  if (!guardState.isAuthorized && guardState.checked) {
    const displayRole = resolveRole();
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

  // Primitive-only deps — see the comment on RouteGuard.resolveRole for
  // why we don't depend on the `user` / `profile` object references.
  const appMetaRole = user?.app_metadata?.role as string | undefined;
  const userMetaRole = user?.user_metadata?.role as string | undefined;
  const profileRole = profile?.role as string | undefined;

  const resolveRole = useCallback((): UserRole | null => {
    if (authRole) return authRole;
    if (profileRole) return profileRole as UserRole;
    if (appMetaRole) return appMetaRole as UserRole;
    if (userMetaRole && typeof userMetaRole === 'string') return userMetaRole as UserRole;
    return null;
  }, [authRole, profileRole, appMetaRole, userMetaRole]);

  const canAccess = useCallback(
    (path?: string, roles?: UserRole[]) => {
      const targetPath = path || pathname;
      const userRole = resolveRole();

      if (roles && roles.length > 0) {
        return userRole ? roles.includes(userRole) : false;
      }

      return isRoleAllowedForRoute(userRole, targetPath);
    },
    [pathname, resolveRole]
  );

  const redirectToDashboard = useCallback(() => {
    const userRole = resolveRole();
    const dashboardPath = getRoleDashboardPath(userRole);
    window.location.href = dashboardPath;
  }, [resolveRole]);

  return {
    canAccess,
    userRole: resolveRole(),
    isAuthenticated,
    redirectToDashboard,
  };
}

export default RouteGuard;
