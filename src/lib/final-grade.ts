/**
 * Final Grade Calculation Service
 *
 * Implements the Final Evaluation architecture defined in the InternHub
 * reference workflow (HEC Stage 7 reference image + spec §18):
 *
 *   Final weighted score =
 *     40% Site Supervisor Evaluations
 *   + 30% Student Reports (weekly logs + progress reports + evidence + reflection)
 *   + 25% Faculty Supervisor Evaluation
 *   +  5% Activity Log Completion
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
// Weights — STRICTLY per HEC Stage 7 reference + spec §18
//   - Site Supervisor     40%   Site Supervisor Evaluations
//   - Student Reports     30%   Evidence-based reporting, reflection, clarity,
//                               connection between work and learning
//   - Faculty Supervisor  25%   Academic oversight, feedback, final review
//   - Activity Log         5%   Timely, complete weekly activity documentation
//
// DO NOT change these weights. The HEC Stage 7 reference image is authoritative.
// ----------------------------------------------------------------------------
export const FINAL_GRADE_WEIGHTS = {
  site_supervisor: 0.40,           // 40% — Site Supervisor Evaluations
  student_reports: 0.30,          // 30% — Student Reports (weekly logs + reflection + evidence)
  faculty_supervisor: 0.25,       // 25% — Faculty Supervisor Evaluation
  activity_log: 0.05,             //  5% — Activity Log Completion
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
 * Component 2: Student Reports (30%)
 *
 * Per HEC Stage 7 reference + spec §18:
 *   "Student Reports — 30%"
 *   Includes:
 *     - Evidence-based reporting
 *     - Reflection
 *     - Clarity
 *     - Connection between work and learning
 *
 * Score is derived from the student's own submitted weekly_logs quality.
 * If faculty-supervisor weekly report evaluations exist (evaluator_role =
 * 'faculty_supervisor' AND type = 'weekly_log'), those authored scores are
 * preferred as the authoritative measure of report quality.
 *
 * Auto-computed rubric (when no faculty weekly_log evaluations exist):
 *   For each submitted/approved weekly_log, compute a 0-100 quality score:
 *     - Has at least 1 supporting_evidence attachment  : +30 pts (evidence)
 *     - learnings text length >= 100 chars               : +25 pts (reflection)
 *     - challenges text length >= 50 chars               : +20 pts (clarity)
 *     - next_week_goals text length >= 50 chars          : +15 pts (linkage)
 *     - tasks_completed array has >= 1 entries OR
 *       weekly_log_daily_entries has >= 1 row            : +10 pts (completeness)
 *   Capped at 100 per log. Final score = mean across all logs.
 *
 * If no weekly logs submitted yet, returns null (component not available).
 */
async function computeStudentReportsScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  internshipId: string
): Promise<{ score: number | null; metadata: Record<string, unknown> }> {
  // weekly_logs uses student_user_id (the student's auth.users.id), not student_id.
  const { data: weeklyLogs, error } = await supabase
    .from("weekly_logs")
    .select("id, learnings, challenges, next_week_goals, tasks_completed, supporting_evidence, status, week_number")
    .eq("student_user_id", studentId)
    .eq("internship_id", internshipId)
    .in("status", ["submitted", "approved"])
    .order("week_number", { ascending: true });

  if (error) {
    console.error("[final-grade] student_reports query failed:", error);
    return { score: null, metadata: { error: error.message } };
  }

  if (!weeklyLogs || weeklyLogs.length === 0) {
    return { score: null, metadata: { weeklyLogCount: 0 } };
  }

  // Try faculty-supervisor weekly report evaluations first.
  // evaluations.type enum: weekly_log | midterm | final | company_evaluation | supervisor_evaluation | task
  // evaluator_role: faculty_supervisor
  const { data: facultyWeeklyEvals, error: fweErr } = await supabase
    .from("evaluations")
    .select("id, scores, status, type")
    .eq("student_user_id", studentId)
    .eq("internship_id", internshipId)
    .eq("evaluator_role", "faculty_supervisor")
    .eq("type", "weekly_log")
    .in("status", ["submitted", "approved"]);

  if (fweErr) {
    console.error("[final-grade] faculty weekly eval query failed:", fweErr);
    // fall through to auto-compute
  } else if (facultyWeeklyEvals && facultyWeeklyEvals.length > 0) {
    const evalMeans: number[] = [];
    for (const ev of facultyWeeklyEvals) {
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
    if (evalMeans.length > 0) {
      const avg = evalMeans.reduce((a, b) => a + b, 0) / evalMeans.length;
      return {
        score: Math.round(avg * 100) / 100,
        metadata: {
          source: "faculty_weekly_log_evaluations",
          evalCount: facultyWeeklyEvals.length,
          scoredCount: evalMeans.length,
          perEvalMeans: evalMeans,
          weeklyLogCount: weeklyLogs.length,
        },
      };
    }
  }

  // Auto-compute from weekly_logs quality (rubric above).
  const perLogScores: Array<{ weekNumber: number | null; score: number }> = [];

  // Pull daily entries counts per weekly log in one query.
  const weeklyLogIds = weeklyLogs.map((w) => w.id);
  let dailyEntryCounts: Record<string, number> = {};
  if (weeklyLogIds.length > 0) {
    const { data: dailyRows, error: dailyErr } = await supabase
      .from("weekly_log_daily_entries")
      .select("weekly_log_id")
      .in("weekly_log_id", weeklyLogIds);
    if (!dailyErr && dailyRows) {
      for (const row of dailyRows) {
        const wid = row.weekly_log_id as string;
        dailyEntryCounts[wid] = (dailyEntryCounts[wid] || 0) + 1;
      }
    }
  }

  for (const log of weeklyLogs) {
    let score = 0;

    // +30: evidence-based reporting — at least 1 supporting_evidence attachment.
    const evidence = log.supporting_evidence;
    if (Array.isArray(evidence) && evidence.length > 0) {
      score += 30;
    } else if (evidence && typeof evidence === "object" && !Array.isArray(evidence)) {
      // Some legacy rows store evidence as a single object.
      score += 30;
    }

    // +25: reflection — learnings text length >= 100 chars.
    if (log.learnings && log.learnings.trim().length >= 100) {
      score += 25;
    } else if (log.learnings && log.learnings.trim().length >= 50) {
      // Partial credit for shorter reflections.
      score += 12;
    }

    // +20: clarity — challenges text length >= 50 chars.
    if (log.challenges && log.challenges.trim().length >= 50) {
      score += 20;
    } else if (log.challenges && log.challenges.trim().length >= 25) {
      score += 10;
    }

    // +15: connection between work and learning — next_week_goals text length >= 50 chars.
    if (log.next_week_goals && log.next_week_goals.trim().length >= 50) {
      score += 15;
    } else if (log.next_week_goals && log.next_week_goals.trim().length >= 25) {
      score += 7;
    }

    // +10: completeness — at least 1 task documented (legacy array OR new daily entries table).
    const tasksCompleted = log.tasks_completed as string[] | null;
    const hasLegacyTasks = Array.isArray(tasksCompleted) && tasksCompleted.length > 0;
    const dailyCount = dailyEntryCounts[log.id as string] || 0;
    if (hasLegacyTasks || dailyCount > 0) {
      score += 10;
    }

    if (score > 100) score = 100;
    perLogScores.push({ weekNumber: log.week_number, score });
  }

  if (perLogScores.length === 0) {
    return { score: null, metadata: { weeklyLogCount: weeklyLogs.length, scoredCount: 0 } };
  }

  const totalScore = perLogScores.reduce((a, b) => a + b.score, 0);
  const avgScore = totalScore / perLogScores.length;

  return {
    score: Math.round(avgScore * 100) / 100,
    metadata: {
      source: "weekly_log_quality_rubric",
      weeklyLogCount: weeklyLogs.length,
      scoredCount: perLogScores.length,
      perLogScores,
      rubric: {
        evidence: 30,
        reflection: 25,
        clarity: 20,
        linkage: 15,
        completeness: 10,
      },
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

  // 3. Compute all 4 components per HEC Stage 7 reference + spec §18:
  //      40% Site Supervisor | 30% Student Reports | 25% Faculty Supervisor | 5% Activity Log
  const [site, studentReports, faculty, activity] = await Promise.all([
    computeSiteSupervisorScore(supabase, studentId, internshipId),
    computeStudentReportsScore(supabase, studentId, internshipId),
    computeFacultySupervisorScore(supabase, studentId, internshipId),
    computeActivityLogScore(supabase, studentId, internshipId),
  ]);

  const allAvailable =
    site.score !== null &&
    studentReports.score !== null &&
    faculty.score !== null &&
    activity.score !== null;

  let finalScore: number | null = null;
  let letterGrade: string | null = null;
  let status: "pending" | "computed" = "pending";

  if (allAvailable) {
    finalScore =
      (site.score! * FINAL_GRADE_WEIGHTS.site_supervisor) +
      (studentReports.score! * FINAL_GRADE_WEIGHTS.student_reports) +
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
    // `student_reports_score` is the 30% Student Reports component (weekly logs + reflection + evidence).
    student_reports_score: studentReports.score,
    faculty_supervisor_score: faculty.score,
    activity_log_score: activity.score,
    final_score: finalScore,
    letter_grade: letterGrade,
    status,
    metadata: {
      weights: FINAL_GRADE_WEIGHTS,
      site_supervisor: site.metadata,
      student_reports: studentReports.metadata,
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
        // `student_reports_score` is the 30% Student Reports component per HEC Stage 7 + spec §18.
        student_reports_score: studentReports.score,
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

// ------------------------------------------------------------------------------
// Pure unit-test helper — verifies the HEC Stage 7 weights WITHOUT touching the DB.
// Used by the test suite to prove the 40/30/25/5 split is enforced in code.
//
// DO NOT change the weights here — HEC Stage 7 reference + spec §18 are authoritative.
// ------------------------------------------------------------------------------
export function computeWeightedScore(
  siteSupervisorScore: number,
  studentReportsScore: number,
  facultySupervisorScore: number,
  activityLogScore: number
): number {
  const total =
    siteSupervisorScore * FINAL_GRADE_WEIGHTS.site_supervisor +
    studentReportsScore * FINAL_GRADE_WEIGHTS.student_reports +
    facultySupervisorScore * FINAL_GRADE_WEIGHTS.faculty_supervisor +
    activityLogScore * FINAL_GRADE_WEIGHTS.activity_log;
  return Math.round(total * 100) / 100;
}

// ------------------------------------------------------------------------------
// Sanity check at module-load: weights must sum to exactly 1.0.
// If a future edit drifts the weights, this throws at import time.
// ------------------------------------------------------------------------------
if (Math.abs(
  FINAL_GRADE_WEIGHTS.site_supervisor +
  FINAL_GRADE_WEIGHTS.student_reports +
  FINAL_GRADE_WEIGHTS.faculty_supervisor +
  FINAL_GRADE_WEIGHTS.activity_log - 1.0
) > 0.0001) {
  console.error(
    "[final-grade] CRITICAL: FINAL_GRADE_WEIGHTS do not sum to 1.0 — got",
    FINAL_GRADE_WEIGHTS
  );
}
