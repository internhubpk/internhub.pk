/**
 * InternHub Route Permissions Configuration
 * 
 * Centralized role-based route access control.
 * Every protected route must be listed here with its allowed roles.
 * 
 * SECURITY: This is the authoritative source for route authorization.
 * Routes NOT in this config are considered public (no auth required).
 */

import type { UserRole } from "@/types";

export interface RoutePermission {
  path: string;           // Route pattern (supports wildcards)
  roles: UserRole[];      // Roles that can access this route
  description?: string;   // For documentation/auditing
}

/**
 * Role-based route access matrix
 * 
 * Structure:
 * - Each entry defines a route pattern and which roles can access it
 * - Use wildcards (*) for nested routes
 * - More specific routes take precedence over wildcard patterns
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // ==========================================
  // SUPER ADMIN ROUTES
  // Only super_admin can access these
  // ==========================================
  {
    path: "/super-admin",
    roles: ["super_admin"],
    description: "Super Admin dashboard and all sub-routes"
  },
  
  // ==========================================
  // UNIVERSITY ADMIN ROUTES
  // Only university_admin can access these
  // ==========================================
  {
    path: "/university-admin",
    roles: ["university_admin"],
    description: "University Admin dashboard and all sub-routes"
  },
  
  // ==========================================
  // DEPARTMENT COORDINATOR ROUTES
  // Only department_coordinator can access these
  // ==========================================
  {
    path: "/department-coordinator",
    roles: ["department_coordinator"],
    description: "Department Coordinator dashboard and all sub-routes"
  },
  
  // ==========================================
  // FACULTY SUPERVISOR ROUTES
  // Only faculty_supervisor can access these
  // ==========================================
  {
    path: "/faculty-supervisor",
    roles: ["faculty_supervisor"],
    description: "Faculty Supervisor dashboard and all sub-routes"
  },
  
  // ==========================================
  // STUDENT ROUTES
  // Only students can access their own data
  // ==========================================
  {
    path: "/student",
    roles: ["student"],
    description: "Student dashboard and all personal routes"
  },
  
  // ==========================================
  // COMPANY HR ROUTES
  // Only company_hr can access these
  // ==========================================
  {
    path: "/company-hr",
    roles: ["company_hr"],
    description: "Company HR dashboard and all sub-routes"
  },
  
  // ==========================================
  // SITE SUPERVISOR ROUTES
  // Only site_supervisor can access these
  // ==========================================
  {
    path: "/site-supervisor",
    roles: ["site_supervisor"],
    description: "Site Supervisor dashboard and all sub-routes"
  },
  
  // ==========================================
  // EXTERNAL EVALUATOR ROUTES
  // Only external_evaluator can access these
  // ==========================================
  {
    path: "/external-evaluator",
    roles: ["external_evaluator"],
    description: "External Evaluator dashboard and all sub-routes"
  },
];

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES: string[] = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/auth",          // Auth callbacks
  "/privacy",
  "/terms",
  "/support",
  "/help",
  "/universities",  // Public university listing
  "/companies",     // Public company listing
  "/internships",   // Public internship marketplace
  "/marketplace",   // Public marketplace
];

/**
 * Check if a route is public (doesn't require authentication)
 */
export function isPublicRoute(pathname: string): boolean {
  // Exact match
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  
  // Check if path starts with any public route prefix
  return PUBLIC_ROUTES.some(route => 
    pathname === route || 
    pathname.startsWith(route + "/")
  );
}

/**
 * Get allowed roles for a specific route
 */
export function getAllowedRolesForRoute(pathname: string): UserRole[] | null {
  // Find matching permission - check most specific first
  const segments = pathname.split("/").filter(Boolean);
  
  // Try exact match first
  let exactMatch = ROUTE_PERMISSIONS.find(p => p.path === pathname);
  if (exactMatch) return exactMatch.roles;
  
  // Try progressive path matching
  for (let i = segments.length; i > 0; i--) {
    const partialPath = "/" + segments.slice(0, i).join("/");
    const match = ROUTE_PERMISSIONS.find(p => p.path === partialPath);
    if (match) return match.roles;
  }
  
  // No match found - route is either public or unrestricted
  return null;
}

/**
 * Check if a role is allowed to access a specific route
 */
export function isRoleAllowedForRoute(role: UserRole | null, pathname: string): boolean {
  if (!role) return false;
  
  const allowedRoles = getAllowedRolesForRoute(pathname);
  
  // If no permissions defined, allow access (public route)
  if (!allowedRoles || allowedRoles.length === 0) return true;
  
  return allowedRoles.includes(role);
}

/**
 * Get the base route for a user's role (their dashboard home)
 */
export function getRoleDashboardPath(role: UserRole | null): string {
  switch (role) {
    case "super_admin": return "/super-admin";
    case "university_admin": return "/university-admin";
    case "department_coordinator": return "/department-coordinator";
    case "faculty_supervisor": return "/faculty-supervisor";
    case "student": return "/student";
    case "company_hr": return "/company-hr";
    case "site_supervisor": return "/site-supervisor";
    case "external_evaluator": return "/external-evaluator";
    default: return "/dashboard"; // Fallback
  }
}

/**
 * Validate resource ownership
 * Used for checking if a user can access a specific resource ID
 */
export interface ResourceOwnershipCheck {
  userId: string;
  userRole: UserRole | null;
  userUniversityId: string | null;
  userDepartmentId: string | null;
  userCompanyId: string | null;
  resourceOwnerId?: string;
  resourceUniversityId?: string;
  resourceDepartmentId?: string;
  resourceCompanyId?: string;
  resourceSupervisorId?: string;
}

/**
 * Check if user has access to a specific resource
 * Implements defense-in-depth: role + university + ownership
 */
export function checkResourceAccess(
  check: ResourceOwnershipCheck
): { allowed: boolean; reason?: string } {
  const { userRole, userId, userUniversityId, userDepartmentId, userCompanyId } = check;
  const { 
    resourceOwnerId, 
    resourceUniversityId, 
    resourceDepartmentId, 
    resourceCompanyId,
    resourceSupervisorId 
  } = check;

  // Super admins can access everything
  if (userRole === "super_admin") {
    return { allowed: true };
  }

  // University admins can access anything in their university
  if (userRole === "university_admin") {
    if (resourceUniversityId && userUniversityId !== resourceUniversityId) {
      return { allowed: false, reason: "Cross-university access denied" };
    }
    return { allowed: true };
  }

  // Department coordinators must be in same university AND department
  if (userRole === "department_coordinator") {
    if (resourceUniversityId && userUniversityId !== resourceUniversityId) {
      return { allowed: false, reason: "Cross-university access denied" };
    }
    if (resourceDepartmentId && userDepartmentId !== resourceDepartmentId) {
      return { allowed: false, reason: "Cross-department access denied" };
    }
    return { allowed: true };
  }

  // Faculty supervisors can only access assigned resources
  if (userRole === "faculty_supervisor") {
    if (resourceUniversityId && userUniversityId !== resourceUniversityId) {
      return { allowed: false, reason: "Cross-university access denied" };
    }
    // Faculty supervisors are identified by supervisor_id on resources
    if (resourceSupervisorId && resourceSupervisorId !== userId) {
      return { allowed: false, reason: "Not assigned to this resource" };
    }
    return { allowed: true };
  }

  // Students can ONLY access their own data
  if (userRole === "student") {
    if (resourceOwnerId && resourceOwnerId !== userId) {
      return { allowed: false, reason: "Cannot access another student's data" };
    }
    if (resourceUniversityId && userUniversityId !== resourceUniversityId) {
      return { allowed: false, reason: "Cross-university access denied" };
    }
    return { allowed: true };
  }

  // Company HR can only access their company's data
  if (userRole === "company_hr") {
    if (resourceCompanyId && userCompanyId !== resourceCompanyId) {
      return { allowed: false, reason: "Cross-company access denied" };
    }
    if (resourceUniversityId && userUniversityId !== resourceUniversityId) {
      return { allowed: false, reason: "Cross-university access denied" };
    }
    return { allowed: true };
  }

  // Site supervisors can only access assigned interns
  if (userRole === "site_supervisor") {
    if (resourceUniversityId && userUniversityId !== resourceUniversityId) {
      return { allowed: false, reason: "Cross-university access denied" };
    }
    if (resourceSupervisorId && resourceSupervisorId !== userId) {
      return { allowed: false, reason: "Not assigned to this intern" };
    }
    return { allowed: true };
  }

  // External evaluators can only access evaluations assigned to them
  if (userRole === "external_evaluator") {
    if (resourceSupervisorId && resourceSupervisorId !== userId) {
      return { allowed: false, reason: "Evaluation not assigned to you" };
    }
    return { allowed: true };
  }

  // Unknown role - deny by default
  return { allowed: false, reason: "Unknown role" };
}
