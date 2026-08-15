/**
 * Shared helpers for resolving "which students does this supervisor oversee?"
 *
 * Background:
 *   The Faculty Supervisor → Student link lives in TWO places:
 *
 *   1. `student_internships.faculty_supervisor_id` (the historical link —
 *      set when the student is placed into an internship).
 *
 *   2. `students.faculty_supervisor_id` (added in migration 0041 — set by
 *      coordinators when they pre-assign a supervisor to a student who
 *      hasn't started an internship yet).
 *
 *   Several dashboards used to only query path #1, which is why a
 *   supervisor whose assignments lived in path #2 saw 0 students, 0 tasks,
 *   0 evaluations, etc. This helper unions both sources so the dashboards
 *   see the complete set.
 *
 *   This module is isomorphic: it works with either the browser Supabase
 *   client or the server Supabase client — the caller passes the client in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SupervisedStudent {
  /** The student's `profiles.user_id` (also `students.user_id`). */
  user_id: string;
  /** Optional — set when the link is via an active internship. */
  internship_id?: string | null;
  program_id?: string | null;
  company_id?: string | null;
  university_id?: string | null;
  department_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
}

/**
 * Fetch ALL students supervised by `supervisorUserId`, merging both sources:
 *   - student_internships.faculty_supervisor_id (any non-terminated status)
 *   - students.faculty_supervisor_id
 *
 * The result is deduplicated by student_user_id. When a student appears in
 * both sources, the student_internships row wins (it has more metadata).
 *
 * The function never throws — on error, it returns an empty array. Callers
 * should check the console for errors.
 */
export async function fetchSupervisedStudents(
  supabase: SupabaseClient,
  supervisorUserId: string
): Promise<SupervisedStudent[]> {
  if (!supervisorUserId) return [];

  // Path 1: student_internships. Include all non-terminated statuses so
  // historical data (completed/paused internships) stays visible.
  const [internshipsRes, studentsRes] = await Promise.all([
    supabase
      .from("student_internships")
      .select(
        `
        student_user_id,
        internship_id,
        program_id,
        company_id,
        university_id,
        department_id,
        start_date,
        end_date,
        status
      `
      )
      .eq("faculty_supervisor_id", supervisorUserId)
      .in("status", ["assigned", "active", "paused", "completed"]),
    supabase
      .from("students")
      .select("user_id, program_id, university_id, department_id")
      .eq("faculty_supervisor_id", supervisorUserId),
  ]);

  const byId = new Map<string, SupervisedStudent>();

  // Path 1 first (it has richer metadata, so it wins on dedupe).
  for (const row of internshipsRes.data || []) {
    if (!row.student_user_id) continue;
    byId.set(row.student_user_id, {
      user_id: row.student_user_id,
      internship_id: row.internship_id,
      program_id: row.program_id,
      company_id: row.company_id,
      university_id: row.university_id,
      department_id: row.department_id,
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status,
    });
  }

  // Path 2: only add students not already in path 1.
  for (const row of studentsRes.data || []) {
    if (!row.user_id) continue;
    if (byId.has(row.user_id)) continue;
    byId.set(row.user_id, {
      user_id: row.user_id,
      program_id: row.program_id,
      university_id: row.university_id,
      department_id: row.department_id,
    });
  }

  return Array.from(byId.values());
}

/**
 * Convenience wrapper — returns just the array of supervised student user_ids.
 * Useful for `IN` clauses.
 */
export async function fetchSupervisedStudentIds(
  supabase: SupabaseClient,
  supervisorUserId: string
): Promise<string[]> {
  const students = await fetchSupervisedStudents(supabase, supervisorUserId);
  return students.map((s) => s.user_id);
}
