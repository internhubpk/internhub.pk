-- ============================================================================
-- InternHub.pk — 0036_fix_rls_gaps.sql
-- ----------------------------------------------------------------------------
-- Fixes 4 RLS/schema bugs identified by code audit:
--
-- BUG 1: accepted internships become invisible to university_admin/
--        department_coordinator because student_internships rows created
--        via "accept application" have NULL university_id/department_id/
--        program_id, and si_select uses plain equality (no IS NULL fallback).
--        Fix: (A) backfill trigger + one-time repair, (B) fix si_select.
--
-- BUG 2: students can self-approve their own applications; HR can hijack
--        application rows (rewrite internship_id/student_user_id/company_id).
--        app_update has no column-level restriction.
--        Fix: guard_application_update trigger (same pattern as
--        guard_profile_update from migration 0028).
--
-- BUG 3: company_hr can self-verify their own company (is_verified/is_active).
--        ALREADY FIXED on production — co_update only allows super_admin.
--        Skipping (no-op).
--
-- BUG 4: department_coordinator can edit/delete students outside their
--        department. students_insert/update/delete only check university_id,
--        not department_id.
--        Fix: add department_id parity to insert/update/delete.
--
-- BUG 5 (minor, note only): proxy.ts uses stale JWT for route-gating while
--        RLS uses live DB state. Not a data-corruption bug — flagging as
--        follow-up, not addressed here.
--
-- IDEMPOTENT
--   All statements use DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS /
--   CREATE OR REPLACE. Safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- BUG 1A: Backfill tenant columns on student_internships via trigger.
--          Fires BEFORE INSERT — fills university_id/department_id/program_id
--          from the students table if they're NULL.
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.backfill_student_internship_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.university_id IS NULL OR NEW.department_id IS NULL OR NEW.program_id IS NULL THEN
    SELECT s.university_id, s.department_id, s.program_id
      INTO NEW.university_id, NEW.department_id, NEW.program_id
      FROM public.students s
      WHERE s.user_id = NEW.student_user_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.backfill_student_internship_tenant() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_backfill_si_tenant ON public.student_internships;
CREATE TRIGGER trg_backfill_si_tenant
  BEFORE INSERT ON public.student_internships
  FOR EACH ROW EXECUTE FUNCTION internhub.backfill_student_internship_tenant();

-- One-time repair of any existing rows with NULL tenant columns.
-- (Currently 0 rows on production, but defensive — future-proofs against
-- any rows created before this trigger was deployed.)
UPDATE public.student_internships si
SET university_id = s.university_id,
    department_id = s.department_id,
    program_id    = s.program_id
FROM public.students s
WHERE s.user_id = si.student_user_id
  AND (si.university_id IS NULL OR si.department_id IS NULL OR si.program_id IS NULL);

-- ============================================================================
-- BUG 1B: Fix si_select to match si_insert/si_update's NULL fallback.
--          Defense in depth — even with the trigger, NULL tenant columns
--          should not make a row invisible to the owning university/dept.
-- ============================================================================
DROP POLICY IF EXISTS si_select ON public.student_internships;
CREATE POLICY si_select ON public.student_internships
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin'
        AND (university_id IS NULL OR university_id = internhub.current_university_id()))
    OR (internhub.current_role() = 'department_coordinator'
        AND (department_id IS NULL OR department_id = internhub.current_department_id()))
    OR faculty_supervisor_id = (select auth.uid())
    OR site_supervisor_id = (select auth.uid())
  );

-- ============================================================================
-- BUG 2: Guard internship_applications UPDATE to prevent:
--        - Students self-approving (only 'withdrawn' allowed for students)
--        - Students reassigning their application to a different
--          internship/company/student
--        - HR rewriting internship_id/student_user_id/company_id/
--          cover_letter/resume_url (HR may only change status)
--
--        Same pattern as guard_profile_update (migration 0028).
--        super_admin bypasses all checks.
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.guard_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  -- When auth.uid() is NULL, the call is from the service_role client
  -- (admin API routes) or the postgres superuser. Both are privileged
  -- contexts that should bypass this guard.
  IF (select auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- super_admin can do anything.
  IF internhub.is_super_admin() THEN
    RETURN NEW;
  END IF;

  v_role := internhub.current_role();

  IF v_role = 'student' THEN
    -- Students may only withdraw their own application (status → 'withdrawn').
    -- Any other status change is forbidden.
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'withdrawn' THEN
      RAISE EXCEPTION 'Students may only withdraw an application, not set status %', NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    -- Students cannot reassign their application to a different
    -- internship, company, or student.
    IF OLD.internship_id IS DISTINCT FROM NEW.internship_id
       OR OLD.company_id IS DISTINCT FROM NEW.company_id
       OR OLD.student_user_id IS DISTINCT FROM NEW.student_user_id THEN
      RAISE EXCEPTION 'Students cannot reassign an application'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF v_role = 'company_hr' THEN
    -- HR may only change application status. Rewriting any other column
    -- is forbidden (prevents hijacking applications to different internships
    -- or students).
    IF OLD.internship_id IS DISTINCT FROM NEW.internship_id
       OR OLD.student_user_id IS DISTINCT FROM NEW.student_user_id
       OR OLD.company_id IS DISTINCT FROM NEW.company_id
       OR OLD.cover_letter IS DISTINCT FROM NEW.cover_letter
       OR OLD.resume_url IS DISTINCT FROM NEW.resume_url THEN
      RAISE EXCEPTION 'company_hr may only change application status'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.guard_application_update() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_guard_application_update ON public.internship_applications;
CREATE TRIGGER trg_guard_application_update
  BEFORE UPDATE ON public.internship_applications
  FOR EACH ROW EXECUTE FUNCTION internhub.guard_application_update();

-- ============================================================================
-- BUG 3: company_hr self-verify (is_verified/is_active).
--        ALREADY FIXED on production — co_update only allows super_admin.
--        No action needed. (If co_update ever gets a company_hr branch
--        added back, add a guard_company_update trigger here.)
-- ============================================================================

-- ============================================================================
-- BUG 4: department_coordinator can edit/delete students outside their
--        department. students_insert/update/delete only check university_id.
--        Fix: add department_id parity (department_id = current_department_id()
--        OR department_id IS NULL for unassigned students).
-- ============================================================================
DROP POLICY IF EXISTS students_insert ON public.students;
CREATE POLICY students_insert ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND university_id = internhub.current_university_id()
        AND (department_id = internhub.current_department_id() OR department_id IS NULL))
  );

DROP POLICY IF EXISTS students_update ON public.students;
CREATE POLICY students_update ON public.students
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND university_id = internhub.current_university_id()
        AND (department_id = internhub.current_department_id() OR department_id IS NULL))
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND university_id = internhub.current_university_id()
        AND (department_id = internhub.current_department_id() OR department_id IS NULL))
  );

DROP POLICY IF EXISTS students_delete ON public.students;
CREATE POLICY students_delete ON public.students
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND university_id = internhub.current_university_id()
        AND (department_id = internhub.current_department_id() OR department_id IS NULL))
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
