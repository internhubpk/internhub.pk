/**
 * InternHub Audit Logging System
 * 
 * Provides centralized audit logging for security-sensitive operations.
 * All important actions should be logged for compliance and debugging.
 * 
 * LOGGED ACTIONS:
 * - User authentication (login, logout)
 * - Student registration/changes
 * - Supervisor assignments
 * - Internship status changes
 * - Application approvals/rejections
 * - Evaluations submitted
 * - Certificates issued
 * - Settings changes
 * - Administrative actions
 */

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.register"
  | "student.create"
  | "student.update"
  | "student.delete"
  | "supervisor.assign"
  | "supervisor.unassign"
  | "internship.create"
  | "internship.update"
  | "internship.approve"
  | "internship.reject"
  | "internship.complete"
  | "application.submit"
  | "application.approve"
  | "application.reject"
  | "evaluation.submit"
  | "evaluation.approve"
  | "certificate.issue"
  | "certificate.revoke"
  | "document.upload"
  | "document.delete"
  | "company.create"
  | "company.verify"
  | "company.suspend"
  | "department.create"
  | "department.update"
  | "program.create"
  | "policy.create"
  | "policy.update"
  | "settings.change"
  | "user.role_change"
  | "university.create"
  | "university.update"
  | "university.suspend";

export interface AuditLogEntry {
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  // Optional — not all audit events are scoped to a university (e.g. global
  // super_admin actions). When omitted, `null` is stored in the DB.
  universityId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit entry from server-side code
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return;
    
    // Get current user if available
    const { data: { user } } = await supabase.auth.getUser();
    
    const logData = {
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      university_id: entry.universityId,
      user_id: user?.id || null,
      details: entry.details || {},
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    };
    
    // Insert into audit_logs table
    const { error } = await supabase.from("audit_logs").insert(logData);
    
    if (error) {
      console.error("Audit log error:", error);
      // Don't throw - audit logging shouldn't break the main flow
    }
  } catch (error) {
    console.error("Audit log exception:", error);
    // Silently fail to not disrupt main functionality
  }
}

/**
 * Convenience functions for common audit actions
 */

export const audit = {
  // Authentication
  login: (userId: string, universityId: string | null = null) =>
    auditLog({
      action: "auth.login",
      entityType: "user",
      entityId: userId,
      universityId,
    }),
  
  logout: (userId: string) =>
    auditLog({
      action: "auth.logout",
      entityType: "user",
      entityId: userId,
      universityId: null,
    }),
  
  register: (userId: string, role: string, universityId: string | null = null) =>
    auditLog({
      action: "auth.register",
      entityType: "profile",
      entityId: userId,
      universityId,
      details: { role },
    }),
  
  // Student operations
  studentCreate: (studentId: string, universityId: string) =>
    auditLog({
      action: "student.create",
      entityType: "student",
      entityId: studentId,
      universityId,
    }),
  
  studentUpdate: (studentId: string, universityId: string, changes: Record<string, any>) =>
    auditLog({
      action: "student.update",
      entityType: "student",
      entityId: studentId,
      universityId,
      details: changes,
    }),
  
  // Internship operations
  internshipCreate: (internshipId: string, universityId: string) =>
    auditLog({
      action: "internship.create",
      entityType: "internship",
      entityId: internshipId,
      universityId,
    }),
  
  internshipApprove: (internshipId: string, universityId: string, approvedBy: string) =>
    auditLog({
      action: "internship.approve",
      entityType: "internship",
      entityId: internshipId,
      universityId,
      details: { approved_by: approvedBy },
    }),
  
  internshipReject: (internshipId: string, universityId: string, reason: string) =>
    auditLog({
      action: "internship.reject",
      entityType: "internship",
      entityId: internshipId,
      universityId,
      details: { reason },
    }),
  
  // Application operations
  applicationSubmit: (applicationId: string, studentId: string, internshipId: string) =>
    auditLog({
      action: "application.submit",
      entityType: "application",
      entityId: applicationId,
      universityId: null,
      details: { student_id: studentId, internship_id: internshipId },
    }),
  
  applicationApprove: (applicationId: string, approvedBy: string) =>
    auditLog({
      action: "application.approve",
      entityType: "application",
      entityId: applicationId,
      universityId: null,
      details: { approved_by: approvedBy },
    }),
  
  applicationReject: (applicationId: string, rejectedBy: string, reason: string) =>
    auditLog({
      action: "application.reject",
      entityType: "application",
      entityId: applicationId,
      universityId: null,
      details: { rejected_by: rejectedBy, reason },
    }),
  
  // Evaluation operations
  evaluationSubmit: (evaluationId: string, evaluatorId: string, evaluatorType: string) =>
    auditLog({
      action: "evaluation.submit",
      entityType: "evaluation",
      entityId: evaluationId,
      universityId: null,
      details: { evaluator_id: evaluatorId, evaluator_type: evaluatorType },
    }),
  
  // Certificate operations
  certificateIssue: (certificateId: string, studentId: string, universityId: string) =>
    auditLog({
      action: "certificate.issue",
      entityType: "certificate",
      entityId: certificateId,
      universityId,
      details: { student_id: studentId },
    }),
  
  certificateRevoke: (certificateId: string, reason: string) =>
    auditLog({
      action: "certificate.revoke",
      entityType: "certificate",
      entityId: certificateId,
      details: { reason },
    }),
  
  // Document operations
  documentUpload: (documentId: string, documentType: string, entityType: string) =>
    auditLog({
      action: "document.upload",
      entityType: "document",
      entityId: documentId,
      details: { document_type: documentType, entity_type: entityType },
    }),
  
  // Company operations
  companyCreate: (companyId: string, universityId: string) =>
    auditLog({
      action: "company.create",
      entityType: "company",
      entityId: companyId,
      universityId,
    }),
  
  companyVerify: (companyId: string, verifiedBy: string) =>
    auditLog({
      action: "company.verify",
      entityType: "company",
      entityId: companyId,
      details: { verified_by: verifiedBy },
    }),
  
  // Settings operations
  settingsChange: (settingKey: string, oldValue: any, newValue: any, universityId?: string) =>
    auditLog({
      action: "settings.change",
      entityType: "settings",
      entityId: null,
      universityId,
      details: { key: settingKey, old_value: oldValue, new_value: newValue },
    }),
  
  // Role changes
  userRoleChange: (targetUserId: string, oldRole: string, newRole: string, changedBy: string) =>
    auditLog({
      action: "user.role_change",
      entityType: "profile",
      entityId: targetUserId,
      details: { old_role: oldRole, new_role: newRole, changed_by: changedBy },
    }),
};

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filters: {
  universityId?: string;
  action?: AuditAction;
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) return { data: [], total: 0, limit: filters.limit || 50, offset: 0 };
    
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    
    if (filters.universityId) {
      query = query.eq("university_id", filters.universityId);
    }
    
    if (filters.action) {
      query = query.eq("action", filters.action);
    }
    
    if (filters.entityType) {
      query = query.eq("entity_type", filters.entityType);
    }
    
    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }
    
    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }
    
    if (filters.dateTo) {
      query = query.lte("created_at", filters.dateTo);
    }
    
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;
    
    const { data, error, count } = await query.range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return {
      data: data || [],
      total: count || 0,
      limit,
      offset,
    };
  } catch (error) {
    console.error("Query audit logs error:", error);
    return { data: [], total: 0, limit: filters.limit || 50, offset: 0 };
  }
}
