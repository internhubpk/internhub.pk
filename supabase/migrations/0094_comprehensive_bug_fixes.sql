-- ============================================================================
-- Migration 0094: Comprehensive Bug Fixes
-- ----------------------------------------------------------------------------
-- Fixes:
--   1. Supervisor dashboard: site_supervisor can't see students assigned
--      via intern_supervisor_assignments when mirror column is NULL.
--      Creates SECURITY DEFINER helper + extends si_select RLS policy.
--   2. Backfill mirror columns from intern_supervisor_assignments for
--      existing rows where the mirror write silently failed.
--   3. Fix any remaining xirea.tech URLs in certificates.verification_url.
--   4. Fix is_assigned_supervisor to also check intern_supervisor_assignments.
-- ============================================================================

BEGIN;

-- ── 1. SECURITY DEFINER helper: has_active_si_assignment ──────────────
-- Checks intern_supervisor_assignments with row_security=off to avoid
-- RLS recursion between si_select ↔ isa_select policies.
CREATE OR REPLACE FUNCTION internhub.has_active_si_assignment(p_si_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intern_supervisor_assignments isa
    WHERE isa.student_internship_id = p_si_id
      AND isa.supervisor_id = (SELECT auth.uid())
      AND isa.is_active = true
      AND isa.ended_at IS NULL
  );
$$;

COMMENT ON FUNCTION internhub.has_active_si_assignment IS
  'Security-definer helper that checks intern_supervisor_assignments for an active assignment. Used by RLS policies to avoid recursion.';

-- ── 2. Extend si_select RLS policy ───────────────────────────────────
-- Drop and recreate si_select to add two new conditions:
--   a) has_active_si_assignment(id) — covers site_supervisor rows
--      where the mirror column write silently failed.
--   b) external_evaluator_id = auth.uid() — external evaluators were
--      completely missing from the policy.
DROP POLICY IF EXISTS si_select ON public.student_internships;

CREATE POLICY si_select ON public.student_internships
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator' AND department_id = internhub.current_department_id())
    OR faculty_supervisor_id = (select auth.uid())
    OR site_supervisor_id = (select auth.uid())
    OR external_evaluator_id = (select auth.uid())
    OR internhub.has_active_si_assignment(id)
  );

-- ── 3. Fix is_assigned_supervisor to also check assignments table ─────
-- The existing function only checks the mirror columns. Add a 4th path
-- that checks intern_supervisor_assignments so profiles/joins work too.
-- NOTE: parameter name must match existing (p_student) because multiple
-- RLS policies depend on this function and cannot be dropped.
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_internships si
    WHERE si.student_user_id = p_student
      AND (
        si.site_supervisor_id = (SELECT auth.uid())
        OR si.faculty_supervisor_id = (SELECT auth.uid())
        OR si.external_evaluator_id = (SELECT auth.uid())
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.intern_supervisor_assignments isa
    WHERE isa.intern_id = p_student
      AND isa.supervisor_id = (SELECT auth.uid())
      AND isa.is_active = true
      AND isa.ended_at IS NULL
  );
$$;

COMMENT ON FUNCTION internhub.is_assigned_supervisor IS
  'Checks if the current user is assigned as a supervisor (site, faculty, or external) to the given student. Checks both mirror columns and the intern_supervisor_assignments table.';

-- ── 4. Backfill mirror columns from intern_supervisor_assignments ─────
-- For rows where the mirror write silently failed, fix the data.
-- Only update where the mirror column is currently NULL to avoid
-- clobbering intentional reassignments.

-- 4a. Site supervisor backfill
UPDATE public.student_internships si
SET site_supervisor_id = isa.supervisor_id,
    updated_at = now()
FROM public.intern_supervisor_assignments isa
WHERE isa.student_internship_id = si.id
  AND isa.type = 'site'
  AND isa.is_active = true
  AND isa.ended_at IS NULL
  AND si.site_supervisor_id IS NULL;

-- 4b. External evaluator backfill
UPDATE public.student_internships si
SET external_evaluator_id = isa.supervisor_id,
    updated_at = now()
FROM public.intern_supervisor_assignments isa
WHERE isa.student_internship_id = si.id
  AND isa.type = 'external'
  AND isa.is_active = true
  AND isa.ended_at IS NULL
  AND si.external_evaluator_id IS NULL;

-- 4c. Faculty supervisor backfill
UPDATE public.student_internships si
SET faculty_supervisor_id = isa.supervisor_id,
    updated_at = now()
FROM public.intern_supervisor_assignments isa
WHERE isa.student_internship_id = si.id
  AND isa.type = 'faculty'
  AND isa.is_active = true
  AND isa.ended_at IS NULL
  AND si.faculty_supervisor_id IS NULL;

-- ── 5. Fix any remaining xirea.tech URLs in certificates ──────────────
UPDATE public.certificates
SET verification_url = REPLACE(verification_url, 'https://xirea.tech/', 'https://careerstep.tech/')
WHERE verification_url ILIKE '%xirea.tech/%';

UPDATE public.certificates
SET verification_url = REPLACE(verification_url, 'http://xirea.tech/', 'https://careerstep.tech/')
WHERE verification_url ILIKE '%http://xirea.tech/%';

COMMIT;
