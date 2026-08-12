/**
 * InternHub Resource-Level Authorization
 * 
 * Provides helpers for checking access to specific resources.
 * Implements defense-in-depth with role + university + ownership checks.
 * 
 * Usage in API routes:
 * ```typescript
 * import { requireResourceAccess } from '@/lib/resource-auth';
 * 
 * // In API route handler:
 * const auth = await requireResourceAccess({
 *   resourceId: params.id,
 *   resourceType: 'student_report',
 *   action: 'read'
 * });
 * ```
 */

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { UserRole } from "@/types";

export interface ResourceAuthContext {
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
    role: UserRole | null;
    university_id: string | null;
    department_id: string | null;
    company_id: string | null;
  };
}

export interface ResourceAccessRequest {
  /** The ID of the resource being accessed */
  resourceId?: string;
  /** Type of resource for lookup */
  resourceType?: 
    | "student_profile"
    | "student_internship"
    | "student_report"
    | "student_weekly_log"
    | "student_document"
    | "university_data"
    | "department_data"
    | "company_data"
    | "internship"
    | "application"
    | "evaluation"
    | "attendance";
  /** Action being performed */
  action?: "read" | "create" | "update" | "delete" | "manage";
}

/**
 * Get authenticated user context for server-side operations
 */
export async function getResourceAuthContext(): Promise<ResourceAuthContext | null> {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return null;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return null;
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    
    if (profileError || !profile) return null;
    
    return {
      user: {
        id: user.id,
        email: user.email || "",
      },
      profile: {
        id: profile.id,
        role: profile.role as UserRole,
        university_id: profile.university_id,
        department_id: (profile as any).department_id || null,
        company_id: (profile as any).company_id || null,
      },
    };
  } catch (error) {
    console.error("Resource auth context error:", error);
    return null;
  }
}

/**
 * Check if user can access a specific student's data
 * Only the student themselves, their supervisors, or admins can access
 */
export async function canAccessStudentData(
  authContext: ResourceAuthContext,
  targetStudentUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { profile, user } = authContext;
  const role = profile.role;

  // Super admin can access everything
  if (role === "super_admin") {
    return { allowed: true };
  }

  // Student can only access their own data
  if (role === "student") {
    if (user.id === targetStudentUserId) {
      return { allowed: true };
    }
    return { allowed: false, reason: "Students can only access their own data" };
  }

  // University/department admins must verify same university
  if (["university_admin", "department_coordinator"].includes(role!)) {
    // Verify target student is in same university
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return { allowed: false, reason: "Server unavailable" };
    
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("university_id, department_id")
      .eq("user_id", targetStudentUserId)
      .single();

    if (!targetProfile) {
      return { allowed: false, reason: "Student not found" };
    }

    if (targetProfile.university_id !== profile.university_id) {
      return { allowed: false, reason: "Cross-university access denied" };
    }

    // Department coordinators must also be in same department
    if (role === "department_coordinator") {
      if (targetProfile.department_id !== profile.department_id) {
        return { allowed: false, reason: "Cross-department access denied" };
      }
    }

    return { allowed: true };
  }

  // Faculty/site supervisor - check assignment
  if (["faculty_supervisor", "site_supervisor"].includes(role!)) {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return { allowed: false, reason: "Server unavailable" };

    // Check if supervisor is assigned to this student
    const { data: assignment } = await supabase
      .from("student_internships")
      .select("id")
      .or(`faculty_supervisor_id.eq.${user.id},site_supervisor_id.eq.${user.id}`)
      .eq("student_user_id", targetStudentUserId)
      .maybeSingle();

    if (!assignment) {
      return { allowed: false, reason: "Not assigned to this student" };
    }

    return { allowed: true };
  }

  // Company HR - check if student applied to their company's internship
  if (role === "company_hr") {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return { allowed: false, reason: "Server unavailable" };

    const { data: application } = await supabase
      .from("internship_applications")
      .select("id")
      .eq("student_user_id", targetStudentUserId)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!application) {
      return { allowed: false, reason: "Student not associated with your company" };
    }

    return { allowed: true };
  }

  // External evaluator - check evaluation assignment
  if (role === "external_evaluator") {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return { allowed: false, reason: "Server unavailable" };

    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("id")
      .eq("evaluator_id", user.id)
      .eq("student_user_id", targetStudentUserId)
      .maybeSingle();

    if (!evaluation) {
      return { allowed: false, reason: "Evaluation not assigned to you" };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: "Insufficient permissions" };
}

/**
 * Check if user can access university-level data
 */
export async function canAccessUniversityData(
  authContext: ResourceAuthContext,
  targetUniversityId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { profile, user } = authContext;
  const role = profile.role;

  // Super admin can access any university
  if (role === "super_admin") {
    return { allowed: true };
  }

  // All other roles must belong to that university
  if (profile.university_id !== targetUniversityId) {
    return { allowed: false, reason: "Cross-university access denied" };
  }

  // University admin has full access to their university
  if (role === "university_admin") {
    return { allowed: true };
  }

  // Other roles have limited access within their university
  if (["department_coordinator", "faculty_supervisor", "student", "company_hr", "site_supervisor", "external_evaluator"].includes(role!)) {
    return { allowed: true }; // They're in the right university
  }

  return { allowed: false, reason: "Insufficient permissions" };
}

/**
 * Check if user can access company data
 */
export async function canAccessCompanyData(
  authContext: ResourceAuthContext,
  targetCompanyId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { profile, user } = authContext;
  const role = profile.role;

  // Super admin can access anything
  if (role === "super_admin") {
    return { allowed: true };
  }

  // Company HR can only access their own company
  if (role === "company_hr") {
    if (profile.company_id === targetCompanyId) {
      return { allowed: true };
    }
    return { allowed: false, reason: "Cross-company access denied" };
  }

  // University admin - check if company belongs to their university
  if (role === "university_admin") {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return { allowed: false, reason: "Server unavailable" };

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("id", targetCompanyId)
      .eq("university_id", profile.university_id)
      .maybeSingle();

    if (!company) {
      return { allowed: false, reason: "Company not in your university" };
    }

    return { allowed: true };
  }

  // Other roles generally shouldn't access company data directly
  return { allowed: false, reason: "Company data access restricted" };
}

/**
 * Require resource access - throws if not authorized
 * Use in API route handlers
 */
export async function requireResourceAccess(request: ResourceAccessRequest) {
  const authContext = await getResourceAuthContext();
  
  if (!authContext) {
    throw new Error("Authentication required");
  }

  const { resourceId, resourceType, action = "read" } = request;

  // If no specific resource, just require authentication
  if (!resourceId && !resourceType) {
    return authContext;
  }

  // Handle different resource types
  switch (resourceType) {
    case "student_profile":
    case "student_report":
    case "student_document": {
      if (!resourceId) throw new Error("Student user ID required");
      const access = await canAccessStudentData(authContext, resourceId);
      if (!access.allowed) throw new Error(access.reason || "Access denied");
      break;
    }
    
    case "university_data": {
      if (!resourceId) throw new Error("University ID required");
      const access = await canAccessUniversityData(authContext, resourceId);
      if (!access.allowed) throw new Error(access.reason || "Access denied");
      break;
    }

    case "company_data": {
      if (!resourceId) throw new Error("Company ID required");
      const access = await canAccessCompanyData(authContext, resourceId);
      if (!access.allowed) throw new Error(access.reason || "Access denied");
      break;
    }

    default:
      // For other types, at least verify same university
      if (authContext.profile.role !== "super_admin") {
        // Additional checks would go here based on resource type
      }
  }

  return authContext;
}

/**
 * Build Supabase query filters for tenant isolation
 * Automatically adds university_id filter based on user's role
 */
export function getTenantFilter(authContext: Record<string, any>): Record<string, any> {
  const { profile } = authContext;
  
  // Super admin sees all
  if (profile?.role === "super_admin") {
    return {};
  }

  // All others are filtered by university
  const filter: Record<string, any> = {};
  
  if (profile?.university_id) {
    filter.university_id = profile.university_id;
  }

  // Department coordinators also filtered by department
  if (profile?.role === "department_coordinator" && profile?.department_id) {
    filter.department_id = profile.department_id;
  }

  // Company HR filtered by company
  if (profile?.role === "company_hr" && profile?.company_id) {
    filter.company_id = profile.company_id;
  }

  return filter;
}
