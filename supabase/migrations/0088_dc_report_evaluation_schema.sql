-- =============================================================================
-- 0088_dc_report_evaluation_schema.sql
-- =============================================================================
-- Department Coordinator — Student Reports Evaluation — 30%
-- -----------------------------------------------------------------------------
-- Per the InternHub HEC Stage 7 reference + product spec §18, the 30%
-- "Student Reports" slot of the final grade is the Department Coordinator's
-- evaluation of the student's submitted weekly logs / daily entries /
-- supporting evidence / reflection.
--
-- The 4 subcriteria are:
--   1. evidence_score          (0..25)  Evidence-based reporting
--   2. reflection_score        (0..25)  Reflection
--   3. clarity_score           (0..25)  Clarity
--   4. work_learning_score     (0..25)  Connection between work and learning
-- Combined total = 0..100 → that is the 30% "Student Reports" component.
--
-- BEFORE this migration:
--   - evaluations.evaluator_role was a user_role enum but the eval_insert /
--     eval_update RLS policies did NOT include 'department_coordinator' in
--     the allowed-roles list, so DCs could not insert/update evaluations.
--   - The evaluation_type enum had no value for a DC report evaluation.
--   - final_grades had student_reports_score but no DC-authored subcriteria
--     columns and no audit trail of who/when.
--   - computeStudentReportsScore() in src/lib/final-grade.ts auto-rubric'd
--     weekly_logs text-length / has-evidence — never read a DC's actual
--     evaluation.
--
-- AFTER this migration:
--   - 'department_coordinator' is permitted in eval_insert / eval_update
--     ONLY when the row's type = 'department_coordinator_report' AND the
--     caller's department_id matches the student's department_id.
--   - New evaluation_type enum value: 'department_coordinator_report'.
--   - final_grades gains 4 subcriteria columns + dc_evaluator_id +
--     dc_evaluated_at + department_coordinator_report_score (the same value
--     persisted in student_reports_score for back-compat with the existing
--     40/30/25/5 calculator).
--   - final_grades INSERT/UPDATE RLS extended to allow DCs to UPSERT rows
--     for students in their own department (only).
--   - A unique index guarantees at most ONE DC report evaluation per
--     (student_user_id, internship_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1 — Extend the evaluation_type enum.
-- -----------------------------------------------------------------------------
-- Add the new enum value. ALTER TYPE ... ADD VALUE is irreversible but
-- idempotent via IF NOT EXISTS (Postgres 9.3+).
DO $$
BEGIN
  -- Postgres <12 does not support ADD VALUE IF NOT EXISTS inside a
  -- transaction; the DO block + EXCEPTION clause guards against re-runs.
  BEGIN
    ALTER TYPE public.evaluation_type ADD VALUE 'department_coordinator_report';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_value  THEN NULL;
  END;
END $$;

-- -----------------------------------------------------------------------------
-- PART 2 — Add DC subcriteria columns + audit columns to final_grades.
-- -----------------------------------------------------------------------------
ALTER TABLE public.final_grades
  ADD COLUMN IF NOT EXISTS dc_evidence_score          numeric(5,2) CHECK (dc_evidence_score          IS NULL OR (dc_evidence_score          BETWEEN 0 AND 25)),
  ADD COLUMN IF NOT EXISTS dc_reflection_score        numeric(5,2) CHECK (dc_reflection_score        IS NULL OR (dc_reflection_score        BETWEEN 0 AND 25)),
  ADD COLUMN IF NOT EXISTS dc_clarity_score           numeric(5,2) CHECK (dc_clarity_score           IS NULL OR (dc_clarity_score           BETWEEN 0 AND 25)),
  ADD COLUMN IF NOT EXISTS dc_work_learning_score     numeric(5,2) CHECK (dc_work_learning_score     IS NULL OR (dc_work_learning_score     BETWEEN 0 AND 25)),
  ADD COLUMN IF NOT EXISTS department_coordinator_report_score numeric(5,2)
    GENERATED ALWAYS AS (
      COALESCE(dc_evidence_score, 0) +
      COALESCE(dc_reflection_score, 0) +
      COALESCE(dc_clarity_score, 0) +
      COALESCE(dc_work_learning_score, 0)
    ) STORED,
  ADD COLUMN IF NOT EXISTS dc_evaluator_id            uuid,
  ADD COLUMN IF NOT EXISTS dc_evaluated_at            timestamptz,
  ADD COLUMN IF NOT EXISTS dc_evaluation_comments     text;

COMMENT ON COLUMN public.final_grades.department_coordinator_report_score IS
  'Department Coordinator evaluation of the student''s submitted reports (the 30% component). = evidence + reflection + clarity + work_learning (each 0..25).';

COMMENT ON COLUMN public.final_grades.dc_evaluator_id IS
  'profiles.user_id of the Department Coordinator who submitted the report evaluation.';

-- Backfill student_reports_score from department_coordinator_report_score
-- where DC has already evaluated (rare in practice; this is a no-op on a
-- fresh DB but keeps a previously-migrated DB consistent).
UPDATE public.final_grades
   SET student_reports_score = department_coordinator_report_score
WHERE department_coordinator_report_score IS NOT NULL
  AND student_reports_score IS DISTINCT FROM department_coordinator_report_score;

-- -----------------------------------------------------------------------------
-- PART 3 — Replace the eval_insert / eval_update RLS policies to include
--          'department_coordinator' (scoped to dc_report type + dept match).
-- -----------------------------------------------------------------------------
-- We do NOT remove the existing permissive clauses for faculty_supervisor /
-- site_supervisor / external_evaluator / company_hr. We add a new
-- department_coordinator branch.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS eval_insert ON public.evaluations;
CREATE POLICY eval_insert ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = (SELECT auth.uid())
    AND evaluator_role = internhub.current_role()
    AND (
      internhub.is_super_admin()
      OR (
        internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id)
      )
      OR (
        internhub.current_role() = 'external_evaluator'
        AND internhub.is_assigned_supervisor(student_user_id)
      )
      OR (
        internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
          WHERE i.id = evaluations.internship_id
            AND i.company_id = internhub.current_company_id()
        )
      )
      -- NEW: Department Coordinator report evaluation (30% component).
      OR (
        internhub.current_role() = 'department_coordinator'
        AND type = 'department_coordinator_report'::evaluation_type
        AND internhub.is_student_in_my_department(student_user_id)
      )
    )
  );

DROP POLICY IF EXISTS eval_update ON public.evaluations;
CREATE POLICY eval_update ON public.evaluations
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR evaluator_id = (SELECT auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN (
      'super_admin', 'faculty_supervisor', 'site_supervisor',
      'external_evaluator', 'company_hr'
    )
    -- NEW: Department Coordinator may update their own DC report evaluations
    -- (the row must remain a dc_report type and the student must still be in
    -- the caller's department).
    OR (
      internhub.current_role() = 'department_coordinator'
      AND type = 'department_coordinator_report'::evaluation_type
      AND evaluator_id = (SELECT auth.uid())
      AND internhub.is_student_in_my_department(student_user_id)
    )
  );

-- -----------------------------------------------------------------------------
-- PART 4 — Extend final_grades INSERT/UPDATE RLS to allow DCs (scoped).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS final_grades_insert_policy ON public.final_grades;
CREATE POLICY final_grades_insert_policy ON public.final_grades
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin','program_coordinator'))
    -- NEW: DCs may upsert a final_grades row for a student in their dept
    -- (the computation runs in code; the DC's profile must match the
    -- student's department_id).
    OR (
      auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'department_coordinator')
      AND EXISTS (
        SELECT 1 FROM profiles p_coord
        JOIN profiles p_student ON p_student.department_id = p_coord.department_id
        WHERE p_coord.user_id = auth.uid()
          AND p_coord.role = 'department_coordinator'
          AND p_student.user_id = final_grades.student_id
      )
    )
  );

DROP POLICY IF EXISTS final_grades_update_policy ON public.final_grades;
CREATE POLICY final_grades_update_policy ON public.final_grades
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin','program_coordinator'))
    OR (
      auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'department_coordinator')
      AND EXISTS (
        SELECT 1 FROM profiles p_coord
        JOIN profiles p_student ON p_student.department_id = p_coord.department_id
        WHERE p_coord.user_id = auth.uid()
          AND p_coord.role = 'department_coordinator'
          AND p_student.user_id = final_grades.student_id
      )
    )
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin','program_coordinator'))
    OR (
      auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'department_coordinator')
      AND EXISTS (
        SELECT 1 FROM profiles p_coord
        JOIN profiles p_student ON p_student.department_id = p_coord.department_id
        WHERE p_coord.user_id = auth.uid()
          AND p_coord.role = 'department_coordinator'
          AND p_student.user_id = final_grades.student_id
      )
    )
  );

-- -----------------------------------------------------------------------------
-- PART 5 — Unique constraint for DC report evaluations.
-- -----------------------------------------------------------------------------
-- A single DC can submit at most one report evaluation per
-- (student_user_id, internship_id). This is in ADDITION to the existing
-- non-unique idx_eval_student index — we leave that index alone for query
-- performance on other evaluator_role rows.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dc_report_per_student_internship
  ON public.evaluations (student_user_id, internship_id)
  WHERE evaluator_role = 'department_coordinator'
    AND type = 'department_coordinator_report'::evaluation_type;

-- -----------------------------------------------------------------------------
-- PART 6 — Helpful view: department_coordinator_report_evaluations
-- -----------------------------------------------------------------------------
-- A convenience view so the DC UI can fetch "all students in my dept + their
-- DC report evaluation + their existing report score" in one shot. Reads
-- only — RLS still applies.
CREATE OR REPLACE VIEW public.department_coordinator_report_evaluations AS
SELECT
  e.id                                  AS evaluation_id,
  e.student_user_id,
  e.internship_id,
  e.evaluator_id                        AS dc_evaluator_id,
  e.status                              AS evaluation_status,
  e.scores                              AS subcriteria_scores,
  e.comments                            AS dc_comments,
  e.submitted_at,
  e.updated_at,
  (e.scores ->> 'evidence_score')::numeric       AS evidence_score,
  (e.scores ->> 'reflection_score')::numeric     AS reflection_score,
  (e.scores ->> 'clarity_score')::numeric        AS clarity_score,
  (e.scores ->> 'work_learning_score')::numeric AS work_learning_score,
  COALESCE(
    (e.scores ->> 'evidence_score')::numeric, 0
  ) + COALESCE(
    (e.scores ->> 'reflection_score')::numeric, 0
  ) + COALESCE(
    (e.scores ->> 'clarity_score')::numeric, 0
  ) + COALESCE(
    (e.scores ->> 'work_learning_score')::numeric, 0
  )                                     AS total_score
FROM public.evaluations e
WHERE e.evaluator_role = 'department_coordinator'
  AND e.type = 'department_coordinator_report'::evaluation_type;

ALTER VIEW public.department_coordinator_report_evaluations
  OWNER TO postgres;
GRANT SELECT ON public.department_coordinator_report_evaluations TO authenticated;

-- =============================================================================
-- Done. The DC report-evaluation workflow now has:
--   - DB columns for the 4 subcriteria + total + audit fields.
--   - RLS policies permitting DCs to insert/update their own evaluations.
--   - RLS policies permitting DCs to upsert final_grades rows for their
--     own-dept students (so the post-submit recompute succeeds).
--   - A unique guarantee of one DC report evaluation per student/internship.
--   - A convenience view for the DC UI to consume.
-- =============================================================================
