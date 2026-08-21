/**
 * Final Grade Calculation Service
 *
 * Implements the Final Evaluation architecture defined in the InternHub
 * reference workflow:
 *
 *   Final weighted score =
 *     40% Site Supervisor Evaluations
 *   + 30% Student Reports (weekly logs)
 *   + 25% Faculty Supervisor Evaluation
 *   + 5%  Activity Log Completion
 *
 * Each component produces a normalized 0-100 score. The weighted sum is
 * the final 0-100 score. Letter grades are derived via the standard
 * scale used by Ibadat International University Islamabad.
 *
 * SECURITY:
 *   - All calculations run server-side only.
 *   - Inputs are read from real Supabase tables (no client-provided scores).
 *   - The function takes a student_id + internship_id and resolves all
 *     required data via the authenticated supabase client (RLS-enforced).
 *   - The caller is responsible for ensuring the caller has authority to
 *     compute the final grade (typically a program_coordinator or
 *     university_admin — enforced by the API route).
 *
 * DO NOT ALLOW unauthorized roles to set the final grade manually. The
 * final_grade row's status can be 'pending' → 'computed' → 'locked'.
 * Once 'locked', no further updates are allowed.
 */

import { createClient } from "@/utils/supabase/server";

// ----------------------------------------------------------------------------
// Weights (per updated spec: 40% / 30% / 25% / 5%)
//   - Site Supervisor     40%  (was 40%, unchanged)
//   - Department Coord.   30%  (CHANGED — was "Student Reports 30%")
//   - Faculty Supervisor  25%  (unchanged)
//   - Activity Log         5%  (unchanged; or auto — see safeAverage)
// ----------------------------------------------------------------------------
export const FINAL_GRADE_WEIGHTS = {
  site_supervisor: 0.40,           // 40% — Site Supervisor Evaluations
  department_coordinator: 0.30,    // 30% — Department Coordinator Evaluation
  faculty_supervisor: 0.25,        // 25% — Faculty Supervisor Evaluation
  activity_log: 0.05,              //  5% — Activity Log Completion (or auto)
} as const;

// Letter grade thresholds (per standard IIUI / Ibadat scale).
const LETTER_GRADE_THRESHOLDS: Array<{ min: number; grade: string }> = [
  { min: 90, grade: "A+" },
  { min: 85, grade: "A" },
  { min: 80, grade: "B+" },
  { min: 75, grade: "B" },
  { min: 70, grade: "C+" },
  { min: 65, grade: "C" },
  { min: 60, grade: "D+" },
  { min: 50, grade: "D" },
  { min: 0, grade: "F" },
];

export function letterGradeFromScore(score: number): string {
  for (const threshold of LETTER_GRADE_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.grade;
    }
  }
  return "F";
}

// ----------------------------------------------------------------------------
// Component score calculators
// ----------------------------------------------------------------------------

/**
 * Component 1: Site Supervisor Evaluations (40%)
 *
 * Average score across all site_supervisor evaluations for this
 * student/internship. Each evaluation's `scores` JSONB contains a
 * mapping of criterion → numeric score (0-100). We average the
 * criterion means across all evaluations.
 *
 * If no site supervisor evaluations exist, returns null (component not
 * available yet — final grade cannot be computed).
 */
async function computeSiteSupervisorScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  internshipId: string
): Promise<{ score: number | null; metadata: Record<string, unknown> }> {
  // evaluations uses student_user_id (not student_id) on the live DB.
  const { data: evals, error } = await supabase
    .from("evaluations")
    .select("id, scores, status, submitted_at, evaluator_role")
    .eq("student_user_id", studentId)
    .eq("internship_id", internshipId)
    .eq("evaluator_role", "site_supervisor")
    .in("status", ["submitted", "approved"]);

  if (error) {
    console.error("[final-grade] site_supervisor query failed:", error);
    return { score: null, metadata: { error: error.message } };
  }

  if (!evals || evals.length === 0) {
    return { score: null, metadata: { evalCount: 0 } };
  }

  // For each evaluation, compute the mean of its `scores` values.
  const evalMeans: number[] = [];
  for (const ev of evals) {
    const scores = ev.scores as Record<string, number> | null;
    if (scores && typeof scores === "object") {
      const values = Object.values(scores).filter(
        (v): v is number => typeof v === "number" && !Number.isNaN(v) && v >= 0 && v <= 100
      );
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        evalMeans.push(mean);
      }
    }
  }

  if (evalMeans.length === 0) {
    return { score: null, metadata: { evalCount: evals.length, scoredCount: 0 } };
  }

  const avg = evalMeans.reduce((a, b) => a + b, 0) / evalMeans.length;
  return {
    score: Math.round(avg * 100) / 100,
    metadata: {
      evalCount: evals.length,
      scoredCount: evalMeans.length,
      perEvalMeans: evalMeans,
    },
  };
}

/**
 * Component 2: Department Coordinator Evaluation (30%)
 *
 * Average score across all evaluations submitted by department_coordinator
 * for this student/internship. Mirrors computeSiteSupervisorScore but
 * filters on evaluator_role = 'department_coordinator'.
 *
 * If no department_coordinator evaluations exist, returns null.
 */
async function computeDepartmentCoordinatorScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  internshipId: string
): Promise<{ score: number | null; metadata: Record<string, unknown> }> {
  // NOTE: weekly_logs uses student_user_id (the student's auth.users.id),
  // not student_id. evaluations uses student_user_id too (migration 0001
  // column name on the live DB).
  const { data: evals, error } = await supabase
    .from("evaluations")
    .select("id, scores, status, submitted_at, evaluator_role, type")
    .eq("student_user_id", studentId)
    .eq("internship_id", internshipId)
    .eq("evaluator_role", "department_coordinator")
    .in("status", ["submitted", "approved"]);

  if (error) {
    console.error("[final-grade] department_coordinator query failed:", error);
    return { score: null, metadata: { error: error.message } };
  }

  if (!evals || evals.length === 0) {
    return { score: null, metadata: { evalCount: 0 } };
  }

  const evalMeans: number[] = [];
  for (const ev of evals) {
    const scores = ev.scores as Record<string, number> | null;
    if (scores && typeof scores === "object") {
      const values = Object.values(scores).filter(
        (v): v is number => typeof v === "number" && !Number.isNaN(v) && v >= 0 && v <= 100
      );
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        evalMeans.push(mean);
      }
    }
  }

  if (evalMeans.length === 0) {
    return { score: null, metadata: { evalCount: evals.length, scoredCount: 0 } };
  }

  const avg = evalMeans.reduce((a, b) => a + b, 0) / evalMeans.length;
  return {
    score: Math.round(avg * 100) / 100,
    metadata: {
      evalCount: evals.length,
      scoredCount: evalMeans.length,
      perEvalMeans: evalMeans,
      types: evals.map((e) => e.type),
    },
  };
}

/**
 * Component 3: Faculty Supervisor Evaluation (25%)
 *
 * Average score of the faculty_supervisor's final evaluation(s) for this
 * student/internship. Uses the `evaluations` table filtered by
 * evaluator_role = 'faculty_supervisor' and type = 'final' (or 'midterm').
 *
 * If no faculty supervisor evaluation exists, returns null.
 */
async function computeFacultySupervisorScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  internshipId: string
): Promise<{ score: number | null; metadata: Record<string, unknown> }> {
  // evaluations uses student_user_id (not student_id) on the live DB.
  const { data: evals, error } = await supabase
    .from("evaluations")
    .select("id, scores, status, type")
    .eq("student_user_id", studentId)
    .eq("internship_id", internshipId)
    .eq("evaluator_role", "faculty_supervisor")
    .in("status", ["submitted", "approved"])
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[final-grade] faculty_supervisor query failed:", error);
    return { score: null, metadata: { error: error.message } };
  }

  if (!evals || evals.length === 0) {
    return { score: null, metadata: { evalCount: 0 } };
  }

  const evalMeans: number[] = [];
  for (const ev of evals) {
    const scores = ev.scores as Record<string, number> | null;
    if (scores && typeof scores === "object") {
      const values = Object.values(scores).filter(
        (v): v is number => typeof v === "number" && !Number.isNaN(v) && v >= 0 && v <= 100
      );
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        evalMeans.push(mean);
      }
    }
  }

  if (evalMeans.length === 0) {
    return { score: null, metadata: { evalCount: evals.length, scoredCount: 0 } };
  }

  const avg = evalMeans.reduce((a, b) => a + b, 0) / evalMeans.length;
  return {
    score: Math.round(avg * 100) / 100,
    metadata: {
      evalCount: evals.length,
      scoredCount: evalMeans.length,
      types: evals.map((e) => e.type),
    },
  };
}

/**
 * Component 4: Activity Log Completion (5%)
 *
 * Score = (completed_activity_logs / expected_activity_logs) * 100
 *
 * "Completed" = weekly logs submitted or approved.
 * "Expected" = total weeks the internship has been active (clamped to
 * the internship's duration_weeks, falling back to the actual weeks
 * elapsed since start_date if duration is not set).
 */
async function computeActivityLogScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  internshipId: string
): Promise<{ score: number | null; metadata: Record<string, unknown> }> {
  // Fetch the internship to determine expected weeks.
  const { data: internship } = await supabase
    .from("internships")
    .select("id, duration_weeks, start_date, end_date")
    .eq("id", internshipId)
    .single();

  if (!internship) {
    return { score: null, metadata: { error: "internship_not_found" } };
  }

  // Count completed weekly logs. weekly_logs uses student_user_id (not
  // student_id) on the live DB.
  const { count: completedCount, error: countErr } = await supabase
    .from("weekly_logs")
    .select("id", { count: "exact", head: true })
    .eq("student_user_id", studentId)
    .eq("internship_id", internshipId)
    .in("status", ["submitted", "approved"]);

  if (countErr) {
    console.error("[final-grade] activity_log count failed:", countErr);
    return { score: null, metadata: { error: countErr.message } };
  }

  // Determine expected weeks.
  let expectedWeeks = internship.duration_weeks;
  if (!expectedWeeks || expectedWeeks <= 0) {
    if (internship.start_date) {
      const start = new Date(internship.start_date);
      const end = internship.end_date ? new Date(internship.end_date) : new Date();
      const weeksElapsed = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
      );
      expectedWeeks = weeksElapsed;
    } else {
      expectedWeeks = 1;
    }
  }

  const completed = completedCount || 0;
  const ratio = Math.min(1, completed / Math.max(1, expectedWeeks));
  const score = Math.round(ratio * 100 * 100) / 100;

  return {
    score,
    metadata: {
      completed,
      expected: expectedWeeks,
      ratio: Math.round(ratio * 100) / 100,
    },
  };
}

// ----------------------------------------------------------------------------
// Main entry point
// ----------------------------------------------------------------------------

export interface FinalGradeResult {
  student_id: string;
  internship_id: string;
  site_supervisor_score: number | null;
  student_reports_score: number | null;
  faculty_supervisor_score: number | null;
  activity_log_score: number | null;
  final_score: number | null;
  letter_grade: string | null;
  status: "pending" | "computed" | "locked" | "failed";
  metadata: Record<string, unknown>;
  computed_at: string;
}

/**
 * Compute (and persist) the final grade for a student/internship.
 *
 * Rules:
 *   1. If ANY required component is null (not yet available), the final
 *      grade cannot be computed → status = "pending".
 *   2. If all components are available, the weighted sum is computed →
 *      status = "computed".
 *   3. If the existing final_grade row has status = "locked", the function
 *      returns the existing grade WITHOUT recomputing.
 *   4. The persisted row uses an UPSERT keyed on (student_id, internship_id).
 *
 * @param studentId The student's auth.users.id (profiles.user_id)
 * @param internshipId The internship UUID
 * @returns The computed (or existing) final grade result.
 */
export async function computeFinalGrade(
  studentId: string,
  internshipId: string
): Promise<FinalGradeResult> {
  const supabase = await createClient();

  // 1. Check existing final_grade row (may be locked).
  const { data: existing } = await supabase
    .from("final_grades")
    .select("*")
    .eq("student_id", studentId)
    .eq("internship_id", internshipId)
    .single();

  if (existing?.status === "locked") {
    return {
      student_id: studentId,
      internship_id: internshipId,
      site_supervisor_score: (existing as any).site_supervisor_score,
      student_reports_score: (existing as any).student_reports_score,
      faculty_supervisor_score: (existing as any).faculty_supervisor_score,
      activity_log_score: (existing as any).activity_log_score,
      final_score: (existing as any).final_score,
      letter_grade: (existing as any).letter_grade,
      status: "locked",
      metadata: ((existing as any).metadata) || {},
      computed_at: (existing as any).computed_at || new Date().toISOString(),
    };
  }

  // 2. Fetch university_id for the student (for RLS scoping on insert).
  const { data: profile } = await supabase
    .from("profiles")
    .select("university_id")
    .eq("user_id", studentId)
    .single();

  // 3. Compute all 4 components.
  //    Component 2 is now "Department Coordinator Evaluation" (was Student Reports).
  const [site, deptCoord, faculty, activity] = await Promise.all([
    computeSiteSupervisorScore(supabase, studentId, internshipId),
    computeDepartmentCoordinatorScore(supabase, studentId, internshipId),
    computeFacultySupervisorScore(supabase, studentId, internshipId),
    computeActivityLogScore(supabase, studentId, internshipId),
  ]);

  const allAvailable =
    site.score !== null &&
    deptCoord.score !== null &&
    faculty.score !== null &&
    activity.score !== null;

  let finalScore: number | null = null;
  let letterGrade: string | null = null;
  let status: "pending" | "computed" = "pending";

  if (allAvailable) {
    finalScore =
      (site.score! * FINAL_GRADE_WEIGHTS.site_supervisor) +
      (deptCoord.score! * FINAL_GRADE_WEIGHTS.department_coordinator) +
      (faculty.score! * FINAL_GRADE_WEIGHTS.faculty_supervisor) +
      (activity.score! * FINAL_GRADE_WEIGHTS.activity_log);
    finalScore = Math.round(finalScore * 100) / 100;
    letterGrade = letterGradeFromScore(finalScore);
    status = "computed";
  }

  const result: FinalGradeResult = {
    student_id: studentId,
    internship_id: internshipId,
    site_supervisor_score: site.score,
    // Back-compat: `student_reports_score` field is kept on the type so the
    // DB upsert still works against existing rows — but now stores the
    // Department Coordinator's evaluation score.
    student_reports_score: deptCoord.score,
    faculty_supervisor_score: faculty.score,
    activity_log_score: activity.score,
    final_score: finalScore,
    letter_grade: letterGrade,
    status,
    metadata: {
      weights: FINAL_GRADE_WEIGHTS,
      site_supervisor: site.metadata,
      department_coordinator: deptCoord.metadata,
      faculty_supervisor: faculty.metadata,
      activity_log: activity.metadata,
    },
    computed_at: new Date().toISOString(),
  };

  // 4. Persist (upsert). Note: this requires the caller to be authorized
  //    to write to final_grades (per RLS, only super_admin / university_admin
  //    / program_coordinator).
  const { error: upsertErr } = await supabase
    .from("final_grades")
    .upsert(
      {
        student_id: studentId,
        internship_id: internshipId,
        university_id: profile?.university_id || null,
        site_supervisor_score: site.score,
        // Back-compat: store dept coordinator score in the student_reports_score
        // column (existing schema). The column name is misleading but changing
        // the schema would require a new migration; we keep it for now.
        student_reports_score: deptCoord.score,
        faculty_supervisor_score: faculty.score,
        activity_log_score: activity.score,
        final_score: finalScore,
        letter_grade: letterGrade,
        status,
        metadata: result.metadata,
        computed_at: status === "computed" ? result.computed_at : null,
        computed_by: profile?.university_id ? (await getCurrentUserId(supabase)) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,internship_id" }
    );

  if (upsertErr) {
    console.error("[final-grade] upsert failed:", upsertErr);
    (result as any).status = "failed";
    (result.metadata as any).upsertError = upsertErr.message;
  }

  return result;
}

async function getCurrentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}
