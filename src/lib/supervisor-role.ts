/**
 * Supervisor role helpers.
 *
 * The InternHub platform has THREE supervisor roles:
 *   - faculty_supervisor   (university-side, pre-internship + during)
 *   - site_supervisor      (company-side, during internship)
 *   - external_evaluator   (independent, during internship)
 *
 * All three share the same UI pages under `/site-supervisor/*` and the same
 * API routes under `/api/site-supervisor/*`. The role determines which
 * column on `student_internships` (and `weekly_logs`) is used to filter
 * "assigned" students/logs.
 *
 * This file centralizes the role → column mapping so the API routes and
 * UI pages don't have to repeat the same if/else everywhere.
 */

import type { UserRole } from "@/types";

/** Supervisor roles that share the site-supervisor UI/API surface. */
export const SUPERVISOR_ROLES: UserRole[] = [
  "site_supervisor",
  "external_evaluator",
];

/**
 * Returns the `student_internships` column name that links a student to a
 * supervisor of the given role.
 *
 *   site_supervisor     → "site_supervisor_id"
 *   external_evaluator  → "external_evaluator_id"
 *
 * Faculty supervisors use a different code path (they have an additional
 * `students.faculty_supervisor_id` link and a different dashboard at
 * `/faculty-supervisor/*`), so they're intentionally NOT included here.
 */
export function getSupervisorColumn(role: UserRole | null | undefined): string {
  if (role === "external_evaluator") return "external_evaluator_id";
  // Default to site_supervisor_id for site_supervisor AND for any
  // unexpected role (defensive — better to fall through to the original
  // behavior than to crash).
  return "site_supervisor_id";
}

/**
 * Returns the `weekly_logs` column name that stores this supervisor role's
 * signature URL.
 *
 *   site_supervisor     → "site_supervisor_signature_url"
 *   external_evaluator  → "external_evaluator_signature_url"
 *
 * (faculty_supervisor uses "faculty_supervisor_signature_url" but is not
 *  handled here — see the faculty-supervisor routes.)
 */
export function getSignatureColumn(role: UserRole | null | undefined): string {
  if (role === "external_evaluator") return "external_evaluator_signature_url";
  return "site_supervisor_signature_url";
}

/**
 * Returns the `weekly_logs` column name that stores this supervisor role's
 * remarks.
 */
export function getRemarksColumn(role: UserRole | null | undefined): string {
  if (role === "external_evaluator") return "external_evaluator_remarks";
  return "site_supervisor_remarks";
}

/**
 * Returns the `weekly_logs` column name that stores this supervisor role's
 * signed-at timestamp.
 */
export function getSignedAtColumn(role: UserRole | null | undefined): string {
  if (role === "external_evaluator") return "external_evaluator_signed_at";
  return "site_supervisor_signed_at";
}

/**
 * Returns the `weekly_logs` column name that stores this supervisor role's
 * user_id (used for the JOIN back to profiles).
 */
export function getWeeklyLogSupervisorColumn(
  role: UserRole | null | undefined
): string {
  if (role === "external_evaluator") return "external_evaluator_id";
  return "site_supervisor_id";
}

/**
 * Returns the `evaluations.evaluator_role` value for this supervisor role.
 * Used when inserting evaluation rows.
 *
 *   site_supervisor     → "site_supervisor"
 *   external_evaluator  → "external_evaluator"
 */
export function getEvaluatorRoleValue(
  role: UserRole | null | undefined
): UserRole {
  if (role === "external_evaluator") return "external_evaluator";
  return "site_supervisor";
}

/**
 * Type guard — is this role one of the supervisor roles that share the
 * site-supervisor UI/API surface?
 */
export function isSupervisorRole(role: UserRole | null | undefined): boolean {
  return (
    role === "site_supervisor" || role === "external_evaluator"
  );
}

/**
 * Human-readable label for the supervisor role, used in UI copy.
 */
export function getSupervisorRoleLabel(
  role: UserRole | null | undefined
): string {
  if (role === "external_evaluator") return "External Evaluator";
  return "Site Supervisor";
}
