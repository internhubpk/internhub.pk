-- =============================================================================
-- 0097_fix_internship_apply_and_hr_dept_visibility.sql
-- =============================================================================
-- Fixes THREE live-reported bugs, all database-side:
--
-- BUG 1 (CRITICAL): Students cannot submit internship applications.
--   POST /rest/v1/internship_applications fails for EVERY insert with:
--     42703 — column "vacancies" does not exist
--   ROOT CAUSE: migration 0091 created trigger function
--   `check_internship_capacity()` that SELECTs `vacancies` and
--   `applicant_count` from `internships` — columns that DO NOT EXIST.
--   The real columns are `max_applicants` and `current_applicants`
--   (migration 0001). The BEFORE INSERT trigger raises before RLS even
--   runs, so no role (including service role) can insert an application.
--   Verified live: {"code":"42703","message":"column \"vacancies\" does not exist"}
--
-- BUG 2 (HIGH): Company HR sees ZERO departments for MoU-linked
--   universities in the "Target Departments" multi-select when creating
--   an internship.
--   ROOT CAUSE: `dept_select` policy on `departments` (migration 0002)
--   only allows super_admin OR `university_id = current_university_id()`.
--   company_hr profiles have university_id = NULL, so RLS filters out
--   every row even though /api/departments authorizes company_hr and
--   validates the MoU. (A code-level fix in /api/departments also ships
--   in this commit — this policy fix is the defense-in-depth layer.)
--
-- BUG 3 (context): Newly created internships are invisible to students
--   because they are created with status='draft'. That is by design
--   (HR must click Publish), and the app-side fix (publish-immediately
--   option + clearer toasts) ships in code. No schema change needed
--   here — noted for completeness.
--
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX THE BROKEN CAPACITY TRIGGER (unblocks ALL student applications)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_internship_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_applicants integer;
  v_current_count   integer;
BEGIN
  -- Only check on INSERT to internship_applications
  IF TG_OP = 'INSERT' THEN
    -- Use the REAL columns (migration 0001):
    --   max_applicants  → capacity limit (NULL = unlimited)
    --   current_applicants → live count maintained by
    --                        trg_internships_applicant_count (migration 0057)
    SELECT i.max_applicants, i.current_applicants
      INTO v_max_applicants, v_current_count
      FROM internships i
      WHERE i.id = NEW.internship_id;

    IF v_max_applicants IS NOT NULL AND v_current_count IS NOT NULL THEN
      IF v_current_count >= v_max_applicants THEN
        RAISE EXCEPTION 'This internship has reached its capacity (%/%)',
          v_current_count, v_max_applicants;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.check_internship_capacity() IS
  'BEFORE INSERT guard on internship_applications. Rejects new applications when internships.current_applicants >= internships.max_applicants (NULL max_applicants = unlimited). Fixed in 0097: previously referenced non-existent columns vacancies/applicant_count, which broke EVERY application insert with 42703.';

-- Safety net: make sure the trigger itself exists (in case a fresh database
-- applied 0091 partially).
DROP TRIGGER IF EXISTS trg_check_internship_capacity ON public.internship_applications;
CREATE TRIGGER trg_check_internship_capacity
  BEFORE INSERT ON public.internship_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_internship_capacity();

-- ----------------------------------------------------------------------------
-- 2. ALLOW company_hr TO READ DEPARTMENTS OF MoU-LINKED UNIVERSITIES
-- ----------------------------------------------------------------------------

-- Helper: does the current user's company have an ACTIVE MoU with the given
-- university? SECURITY DEFINER so the policy does not recurse into the
-- company_university_mous SELECT policy (and so it stays fast).
CREATE OR REPLACE FUNCTION internhub.current_company_has_active_mou(p_university_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM company_university_mous m
      JOIN profiles p ON p.user_id = auth.uid() AND p.company_id IS NOT NULL
     WHERE m.company_id = p.company_id
       AND m.university_id = p_university_id
       AND m.status = 'active'
       AND (m.ends_at IS NULL OR m.ends_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION internhub.current_company_has_active_mou(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internhub.current_company_has_active_mou(uuid) TO authenticated;

-- Replace the departments SELECT policy: university members keep their
-- access, and company_hr gains read access to departments of universities
-- where THEIR company has an active MoU (needed for the internship
-- "Target Departments" multi-select).
DROP POLICY IF EXISTS dept_select ON departments;
CREATE POLICY dept_select ON departments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR university_id = internhub.current_university_id()
    OR (
      internhub.current_role() = 'company_hr'
      AND internhub.current_company_has_active_mou(departments.university_id)
    )
  );

COMMENT ON POLICY dept_select ON departments IS
  'super_admin sees all; university members see their own university''s departments; company_hr sees departments of universities where their company has an ACTIVE MoU (for internship department targeting). Fixed in 0097 — previously company_hr saw zero rows.';

-- ----------------------------------------------------------------------------
-- Done. After applying, verify:
--   1. As a student, submit an internship application (no more 42703).
--   2. As company HR, open the internship create dialog → Target
--      Departments shows the MoU university's departments.
-- =============================================================================
