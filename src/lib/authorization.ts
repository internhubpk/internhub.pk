/**
 * InternHub Authorization System
 * 
 * Centralized role-based access control (RBAC) for InternHub.
 * All authorization checks should use this system to ensure
 * consistent security across the application.
 * 
 * SECURITY ARCHITECTURE (Defense-in-Depth):
 * 1. Supabase Auth - Authentication layer
 * 2. Next.js Middleware - Route-level authorization
 * 3. Server-side Authorization - API route protection
 * 4. Client-side RouteGuard - UI protection
 * 5. Supabase RLS - Database-level isolation
 * 
 * ROLES HIERARCHY:
 * 1. super_admin      - Platform-level, full access
 * 2. university_admin  - University-level management
 * 3. department_coordinator - Department-scoped access
 * 4. faculty_supervisor - Supervision-specific access
 * 5. student           - Own data only
 * 6. company_hr        - Company-specific access
 * 7. site_supervisor   - Assigned interns only
 * 8. external_evaluator - Assigned evaluations only
 */

import { createClient } from "@/utils/supabase/server";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import { cookies } from "next/headers";
import type { UserRole } from "@/types";
import {
  isRoleAllowedForRoute,
  getRoleDashboardPath,
} from "@/lib/route-permissions";

export interface AuthContext {
  user: {
    id: string;
    email: string;
  } | null;
  profile: {
    id: string;
    role: UserRole | null;
    university_id: string | null;
    department_id: string | null;
  } | null;
  isAuthenticated: boolean;
}

/**
 * Role permissions matrix
 * Defines what each role can do
 */
export const ROLE_PERMISSIONS: Record<UserRole, {
  canManageUniversities: boolean;
  canManageUsers: boolean;
  canManageStudents: boolean;
  canManageDepartments: boolean;
  canManagePrograms: boolean;
  canManageCompanies: boolean;
  canManageInternships: boolean;
  canEvaluate: boolean;
  canIssueCertificates: boolean;
  canViewReports: boolean;
  canEditSettings: boolean;
  canAccessAllUniversityData: boolean;
  canAccessOwnDepartmentOnly: boolean;
  canAccessAssignedStudentsOnly: boolean;
  canAccessCompanyData: boolean;
}> = {
  super_admin: {
    canManageUniversities: true,
    canManageUsers: true,
    canManageStudents: true,
    canManageDepartments: true,
    canManagePrograms: true,
    canManageCompanies: true,
    canManageInternships: true,
    canEvaluate: false,
    canIssueCertificates: false,
    canViewReports: true,
    canEditSettings: true,
    canAccessAllUniversityData: true,
    canAccessOwnDepartmentOnly: false,
    canAccessAssignedStudentsOnly: false,
    canAccessCompanyData: false,
  },
  university_admin: {
    canManageUniversities: false,
    canManageUsers: true,
    canManageStudents: true,
    canManageDepartments: true,
    canManagePrograms: true,
    canManageCompanies: true,
    canManageInternships: true,
    canEvaluate: false,
    canIssueCertificates: true,
    canViewReports: true,
    canEditSettings: true,
    canAccessAllUniversityData: true,
    canAccessOwnDepartmentOnly: false,
    canAccessAssignedStudentsOnly: false,
    canAccessCompanyData: false,
  },
  department_coordinator: {
    canManageUniversities: false,
    canManageUsers: false,
    canManageStudents: true,
    canManageDepartments: false,
    canManagePrograms: false,
    canManageCompanies: false,
    canManageInternships: true,
    canEvaluate: false,
    canIssueCertificates: false,
    canViewReports: true,
    canEditSettings: false,
    canAccessAllUniversityData: false,
    canAccessOwnDepartmentOnly: true,
    canAccessAssignedStudentsOnly: false,
    canAccessCompanyData: false,
  },
  faculty_supervisor: {
    canManageUniversities: false,
    canManageUsers: false,
    canManageStudents: false,
    canManageDepartments: false,
    canManagePrograms: false,
    canManageCompanies: false,
    canManageInternships: false,
    canEvaluate: true,
    canIssueCertificates: false,
    canViewReports: true,
    canEditSettings: false,
    canAccessAllUniversityData: false,
    canAccessOwnDepartmentOnly: false,
    canAccessAssignedStudentsOnly: true,
    canAccessCompanyData: false,
  },
  student: {
    canManageUniversities: false,
    canManageUsers: false,
    canManageStudents: false,
    canManageDepartments: false,
    canManagePrograms: false,
    canManageCompanies: false,
    canManageInternships: false,
    canEvaluate: false,
    canIssueCertificates: false,
    canViewReports: false,
    canEditSettings: false,
    canAccessAllUniversityData: false,
    canAccessOwnDepartmentOnly: false,
    canAccessAssignedStudentsOnly: false,
    canAccessCompanyData: false,
  },
  company_hr: {
    canManageUniversities: false,
    canManageUsers: false,
    canManageStudents: false,
    canManageDepartments: false,
    canManagePrograms: false,
    canManageCompanies: false,
    canManageInternships: true,
    canEvaluate: true,
    canIssueCertificates: true,
    canViewReports: true,
    canEditSettings: false,
    canAccessAllUniversityData: false,
    canAccessOwnDepartmentOnly: false,
    canAccessAssignedStudentsOnly: false,
    canAccessCompanyData: true,
  },
  site_supervisor: {
    canManageUniversities: false,
    canManageUsers: false,
    canManageStudents: false,
    canManageDepartments: false,
    canManagePrograms: false,
    canManageCompanies: false,
    canManageInternships: false,
    canEvaluate: true,
    canIssueCertificates: false,
    canViewReports: false,
    canEditSettings: false,
    canAccessAllUniversityData: false,
    canAccessOwnDepartmentOnly: false,
    canAccessAssignedStudentsOnly: true,
    canAccessCompanyData: false,
  },
  external_evaluator: {
    canManageUniversities: false,
    canManageUsers: false,
    canManageStudents: false,
    canManageDepartments: false,
    canManagePrograms: false,
    canManageCompanies: false,
    canManageInternships: false,
    canEvaluate: true,
    canIssueCertificates: false,
    canViewReports: false,
    canEditSettings: false,
    canAccessAllUniversityData: false,
    canAccessOwnDepartmentOnly: false,
    canAccessAssignedStudentsOnly: false,
    canAccessCompanyData: false,
  },
};

/**
 * Get current authentication context for server-side operations
 */
export async function getServerAuthContext(): Promise<AuthContext> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        user: null,
        profile: null,
        isAuthenticated: false
      };
    }
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    
    if (profileError || !profile) {
      return {
        user: {
          id: user.id,
          email: user.email || ""
        },
        profile: null,
        isAuthenticated: true
      };
    }
    
    return {
      user: {
        id: user.id,
        email: user.email || ""
      },
      profile: {
        id: profile.id,
        role: profile.role as UserRole,
        university_id: profile.university_id,
        department_id: (profile as any).department_id || null
      },
      isAuthenticated: true
    };
    
  } catch (error) {
    console.error("Auth context error:", error);
    return {
      user: null,
      profile: null,
      isAuthenticated: false
    };
  }
}

/**
 * Check if user has a specific role
 */
export function hasRole(userRole: UserRole | null, requiredRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRole: UserRole | null, roles: UserRole[]): boolean {
  return hasRole(userRole, roles);
}

/**
 * Check if user has a specific permission based on their role
 */
export function hasPermission(
  userRole: UserRole | null,
  permission: keyof typeof ROLE_PERMISSIONS[UserRole]
): boolean {
  if (!userRole) return false;
  
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions[permission] || false;
}

/**
 * Require authentication - throw if not authenticated
 */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getServerAuthContext();
  
  if (!context.isAuthenticated || !context.user) {
    throw new Error("Authentication required");
  }
  
  return context;
}

/**
 * Require specific role(s) - throw if user doesn't have required role
 */
export async function requireRole(requiredRoles: UserRole[]): Promise<AuthContext> {
  const context = await requireAuth();
  
  if (!hasRole(context.profile?.role || null, requiredRoles)) {
    throw new Error(`Required role(s): ${requiredRoles.join(", ")}`);
  }
  
  return context;
}

/**
 * Require university access - verify user belongs to specified university
 */
export async function requireUniversityAccess(universityId?: string): Promise<AuthContext & { universityId: string }> {
  const context = await requireAuth();
  
  // Super admins can access any university
  if (context.profile?.role === "super_admin") {
    return { ...context, universityId: universityId || "" };
  }
  
  // Other users must have matching university_id
  const userUniversityId = context.profile?.university_id;
  
  if (!userUniversityId) {
    throw new Error("No university assigned to user");
  }
  
  // If specific university requested, verify match
  if (universityId && userUniversityId !== universityId) {
    throw new Error("Access denied to this university");
  }
  
  return { ...context, universityId: userUniversityId };
}

/**
 * Require department access - for department coordinators
 */
export async function requireDepartmentAccess(departmentId: string): Promise<AuthContext> {
  const context = await requireAuth();
  
  const userRole = context.profile?.role;
  
  // Super admins and uni admins can access all departments
  if (userRole === "super_admin" || userRole === "university_admin") {
    return context;
  }
  
  // Department coordinators must have matching department
  if (userRole === "department_coordinator") {
    if (context.profile?.department_id !== departmentId) {
      throw new Error("Access denied to this department");
    }
    return context;
  }
  
  throw new Error("Insufficient privileges for department access");
}

/**
 * Check if resource belongs to authenticated user
 * For students accessing their own data
 */
export async function requireOwnership(resourceUserId: string): Promise<AuthContext> {
  const context = await requireAuth();
  
  // Super admins can access anything
  if (context.profile?.role === "super_admin") {
    return context;
  }
  
  // University admins can access their university's data
  if (context.profile?.role === "university_admin") {
    return context;
  }
  
  // Other users must own the resource
  if (context.user?.id !== resourceUserId) {
    throw new Error("Access denied: Resource does not belong to you");
  }
  
  return context;
}

/**
 * Build authorization error response for API routes
 */
export function authorizationError(message: string = "Access denied") {
  return Response.json(
    { success: false, error: message },
    { status: 403 }
  );
}

/**
 * Build authentication error response for API routes
 */
export function authenticationError(message: string = "Not authenticated") {
  return Response.json(
    { success: false, error: message },
    { status: 401 }
  );
}

/**
 * Check if user can access a specific route (server-side)
 */
export async function requireRouteAccess(pathname: string): Promise<AuthContext> {
  const context = await requireAuth();
  
  const userRole: UserRole | null = context.profile?.role ?? null;
  
  if (!isRoleAllowedForRoute(userRole, pathname)) {
    throw new Error(`Route access denied for role: ${userRole}`);
  }
  
  return context;
}

/**
 * Get safe redirect URL based on user's role
 * Prevents redirect loops and ensures user goes to valid dashboard
 */
export function getSafeRedirectUrl(userRole: UserRole | null, fallback?: string): string {
  if (userRole) {
    return getRoleDashboardPath(userRole);
  }
  return fallback || "/dashboard";
}

/**
 * Audit log helper - logs security-relevant actions
 * In production, this should write to an audit log table
 */
export function auditLog(action: string, details: Record<string, any>, authContext?: AuthContext): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId: authContext?.user?.id,
    role: authContext?.profile?.role,
    universityId: authContext?.profile?.university_id,
    ...details,
  };
  
  // Console log in development
  if (process.env.NODE_ENV === "development") {
    console.log("[AUDIT]", JSON.stringify(logEntry, null, 2));
  }
  
  // TODO: In production, write to audit_logs table
  // Example:
  // await supabase.from('audit_logs').insert(logEntry);
}
