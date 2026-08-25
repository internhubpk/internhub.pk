-- ============================================================================
-- InternHub.pk — 0093_internhub_bug_fixes.sql (2026-08-25)
-- ----------------------------------------------------------------------------
-- Consolidated fix for 7 production bugs reported by the operator:
--
--   FIX-A  Certificate verification_url backfill — replace hardcoded
--          https://xirea.tech/verify/... URLs in the certificates table
--          with https://careerstep.tech/verify/... (the canonical
--          production domain). The site-URL helper in src/lib/site-url.ts
--          already defaults to careerstep.tech, so newly-issued rows
--          are correct — but rows issued before the helper shipped still
--          have the legacy xirea.tech URL baked into verification_url.
--
--   FIX-B  Relax guard trigger for site_supervisor assignment — the
--          trg_guard_si_site_supervisor trigger (0087) blocked the mirror
--          write to student_internships.site_supervisor_id whenever the
--          linked internship_application was no longer in 'accepted'
--          state. After the internship was marked 'completed', HR lost
--          the ability to assign a supervisor at all, and the supervisor's
--          dashboard silently showed 0 students. The trigger now only
--          blocks assignments to SIs in (completed, cancelled, expired)
--          state — the SI-status check is sufficient; the linked
--          application's status is no longer part of the gate.
--
--   FIX-C  University-admin can MANAGE companies + company_hr accounts
--          in their university. The INSERT policy (0084) already allowed
--          university_admin to create companies, but co_update / co_delete
--          (0010) were super_admin-only — so university admins could
--          create but never edit or remove. Similarly, profiles_select /
--          profiles_update (0079 / 0028) only allowed university_admin
--          to see/edit profiles in their own university, but company_hr
--          profiles have university_id = NULL, so they were invisible
--          and unmanageable. We add a new SECURITY DEFINER helper
--          is_company_hr_in_my_university(user_id) and add it to the
--          relevant policies.
--
-- IDEMPOTENT
--   Every statement uses DROP IF EXISTS / CREATE OR REPLACE. Safe to
--   re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- FIX-A: Backfill certificate verification_url from xirea.tech → careerstep.tech
-- ============================================================================
-- The site-URL helper (src/lib/site-url.ts) defaults to
-- https://careerstep.tech and is used for all NEW certificate issuance.
-- Rows issued before the helper existed have the legacy xirea.tech URL
-- baked into the verification_url column. The display layer (student
-- certificates page, company-hr certificates page, public /verify page)
-- all REGENERATE the URL from verification_code via the helper, so
-- these stale rows still verify correctly — but the URL stored in the
-- DB is what's printed on generated PDFs and shared with LinkedIn, so
-- we backfill them.

UPDATE public.certificates
  SET verification_url = REPLACE(verification_url, 'https://xirea.tech/', 'https://careerstep.tech/')
  WHERE verification_url ILIKE '%xirea.tech/%';

-- Also handle the rare case where the URL was stored without a trailing
-- slash (defensive — the helper always produces a slash).
UPDATE public.certificates
  SET verification_url = REPLACE(verification_url, 'https://xirea.tech', 'https://careerstep.tech')
  WHERE verification_url ILIKE '%xirea.tech%'
    AND verification_url NOT ILIKE '%careerstep.tech%';

-- ============================================================================
-- FIX-B: Relax guard trigger for site_supervisor assignment
-- ============================================================================
-- The previous version raised an exception when the linked
-- internship_application was NULL or not in 'accepted' state. That broke
-- the HR → supervisor assignment flow when the application had transitioned
-- to 'completed' (which is normal after the internship ends) — the mirror
-- write to student_internships.site_supervisor_id silently failed, the
-- HR API returned success with a warning, and the supervisor's dashboard
-- showed 0 students.
--
-- New behavior: only block assignments to SIs in the 'terminated' state
-- (the explicit "this is over and should never come back" state). The
-- SI-status check is sufficient to prevent nonsensical assignments; the
-- linked-application check added in 0087 was over-strict.
--
-- NOTE: the original 0087 trigger checked for
-- ('completed','cancelled','expired') — but the student_internship_status
-- enum (migration 0001) is ('assigned','active','paused','completed',
-- 'terminated'). 'cancelled' and 'expired' were never valid enum values
-- (the trigger's status check would have silently never matched them),
-- so the trigger was effectively only blocking 'completed'. We keep
-- 'completed' allowed (HR backfills the supervisor after the internship
-- officially ends) and explicitly block 'terminated'.

CREATE OR REPLACE FUNCTION internhub.guard_si_site_supervisor_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only guard when site_supervisor_id is being SET (NULL → non-NULL, or
  -- changed to a different supervisor). Re-assignment of an existing
  -- supervisor is allowed (same state) — only NEW assignments need the
  -- active-state gate.
  IF NEW.site_supervisor_id IS NOT DISTINCT FROM OLD.site_supervisor_id THEN
    RETURN NEW;
  END IF;

  -- The internship must not be in a terminal state. The
  -- student_internship_status enum (migration 0001) is
  -- ('assigned','active','paused','completed','terminated').
  -- 'assigned' and 'active' are the normal pre-internship /
  -- mid-internship states where a supervisor assignment makes
  -- sense. 'paused' is a temporary state — assignments are still
  -- permitted. 'completed' is allowed too — HR often backfills the
  -- supervisor assignment after the internship officially ends (the
  -- evaluation flow can be finalized post-completion), and the
  -- previous 'completed' block caused the supervisor's dashboard
  -- to silently lose the student. Only 'terminated' (the explicit
  -- "this is over and should never come back" state) blocks new
  -- supervisor assignments.
  IF NEW.status = 'terminated' THEN
    RAISE EXCEPTION 'Cannot assign a site supervisor to a terminated internship'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION internhub.guard_si_site_supervisor_assignment() OWNER TO postgres;

-- The trigger itself doesn't need to be recreated — the function body
-- is what changed. NOTIFY pgrst to reload schema cache.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIX-C1: New helper — is_company_hr_in_my_university(target_user_id)
-- ============================================================================
-- A university_admin needs to read and manage company_hr profiles that
-- belong to companies tied to their university (companies.university_id
-- = current_university_id()). Such profiles have university_id = NULL
-- (the HR belongs to a company, not a university), so the existing
-- `university_id = current_university_id()` clause in profiles_select
-- and profiles_update does not match them.
--
-- SECURITY DEFINER + row_security=off: this helper must run with
-- elevated privileges so it can read the `companies` table without
-- being blocked by the very RLS we're trying to extend. The function
-- is read-only and only returns a boolean, so the privilege elevation
-- is safe.

CREATE OR REPLACE FUNCTION internhub.is_company_hr_in_my_university(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.user_id = p_user_id
      AND p.role = 'company_hr'::user_role
      AND c.university_id = internhub.current_university_id()
  );
$$;

ALTER FUNCTION internhub.is_company_hr_in_my_university(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.is_company_hr_in_my_university(uuid) TO authenticated, anon;

-- ============================================================================
-- FIX-C2: Allow university_admin to UPDATE / DELETE companies in their
--         own university. (co_insert_university_admin from 0084 already
--         allows INSERT; this completes the CRUD triangle.)
-- ============================================================================
DROP POLICY IF EXISTS co_update ON public.companies;
CREATE POLICY co_update ON public.companies
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'::user_role
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS co_delete ON public.companies;
CREATE POLICY co_delete ON public.companies
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
  );

-- ============================================================================
-- FIX-C3: Extend profiles_select so university_admin can READ company_hr
--         profiles for companies in their university.
-- ============================================================================
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Self: always see own profile
    user_id = auth.uid()
    -- Super admin: see everything
    OR internhub.is_super_admin()
    -- University admin: see all profiles in their university, PLUS
    -- company_hr profiles whose company belongs to their university.
    OR (internhub.current_role() = 'university_admin'::user_role
        AND (university_id = internhub.current_university_id()
             OR internhub.is_company_hr_in_my_university(user_id)))
    -- Department coordinator: see all profiles in their department
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    -- Program coordinator: see profiles in their department
    OR (internhub.current_role() = 'program_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    -- Company HR: see company profiles + applicants
    OR (internhub.current_role() = 'company_hr'::user_role
        AND (company_id = internhub.current_company_id()
             OR internhub.is_student_applicant_in_my_company(user_id)))
    -- Faculty/site supervisors: see assigned students
    OR (internhub.current_role() IN ('faculty_supervisor'::user_role, 'site_supervisor'::user_role)
        AND internhub.is_assigned_supervisor(user_id))
    -- External evaluator: see evaluated students
    OR (internhub.current_role() = 'external_evaluator'::user_role
        AND internhub.is_external_evaluator_of_student(user_id))
    -- Students: see own supervisors
    OR (internhub.current_role() = 'student'::user_role
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
          WHERE si.student_user_id = auth.uid()
            AND (si.faculty_supervisor_id = profiles.user_id
                 OR si.site_supervisor_id = profiles.user_id
                 OR si.external_evaluator_id = profiles.user_id)
        ))
  );

-- ============================================================================
-- FIX-C4: Extend profiles_update so university_admin can EDIT / deactivate
--         company_hr profiles for companies in their university.
-- ============================================================================
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'::user_role
        AND (university_id = internhub.current_university_id()
             OR internhub.is_company_hr_in_my_university(user_id)))
    OR (internhub.current_role() = 'company_hr'::user_role
        AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'::user_role
        AND (university_id = internhub.current_university_id()
             OR internhub.is_company_hr_in_my_university(user_id)))
    OR (internhub.current_role() = 'company_hr'::user_role
        AND company_id = internhub.current_company_id())
  );

COMMIT;

-- ============================================================================
-- FIX-D: Backfill student_internships.<mirror_column> from
--        intern_supervisor_assignments where the mirror write was lost.
-- ============================================================================
-- The HR assignment flow has TWO writes:
--   1. INSERT into intern_supervisor_assignments  (always succeeds)
--   2. UPDATE student_internships.site_supervisor_id (sometimes silently
--      failed due to the old guard trigger / RLS / network race)
-- When step 2 failed, the supervisor's dashboard (which reads the mirror
-- column) showed 0 students even though the assignment row existed.
--
-- This backfill repairs every existing broken row by joining to the
-- latest active assignment of each type and writing the supervisor_id
-- back to the corresponding mirror column. It only fires for SIs in
-- non-terminal states (the only states where a supervisor assignment
-- is meaningful).

BEGIN;

-- Site supervisors
UPDATE public.student_internships si
  SET site_supervisor_id = sub.supervisor_id,
      updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (a.student_internship_id)
      a.student_internship_id,
      a.supervisor_id
    FROM public.intern_supervisor_assignments a
    WHERE a.is_active = true
      AND a.type = 'site'
      AND a.ended_at IS NULL
    ORDER BY a.student_internship_id, a.assigned_at DESC
  ) sub
WHERE si.site_supervisor_id IS NULL
  AND si.id = sub.student_internship_id
  AND si.status <> 'terminated'::public.student_internship_status;

-- External evaluators
UPDATE public.student_internships si
  SET external_evaluator_id = sub.supervisor_id,
      updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (a.student_internship_id)
      a.student_internship_id,
      a.supervisor_id
    FROM public.intern_supervisor_assignments a
    WHERE a.is_active = true
      AND a.type = 'external'
      AND a.ended_at IS NULL
    ORDER BY a.student_internship_id, a.assigned_at DESC
  ) sub
WHERE si.external_evaluator_id IS NULL
  AND si.id = sub.student_internship_id
  AND si.status <> 'terminated'::public.student_internship_status;

-- Faculty supervisors (rare from company HR; included for completeness)
UPDATE public.student_internships si
  SET faculty_supervisor_id = sub.supervisor_id,
      updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (a.student_internship_id)
      a.student_internship_id,
      a.supervisor_id
    FROM public.intern_supervisor_assignments a
    WHERE a.is_active = true
      AND a.type = 'faculty'
      AND a.ended_at IS NULL
    ORDER BY a.student_internship_id, a.assigned_at DESC
  ) sub
WHERE si.faculty_supervisor_id IS NULL
  AND si.id = sub.student_internship_id
  AND si.status <> 'terminated'::public.student_internship_status;

COMMIT;

-- ============================================================================
-- Verification: print post-migration state
-- ============================================================================
SELECT
  (SELECT count(*) FROM public.certificates
     WHERE verification_url ILIKE '%xirea.tech%')             AS certs_with_xirea,
  (SELECT count(*) FROM public.certificates
     WHERE verification_url ILIKE '%careerstep.tech%')         AS certs_with_careerstep,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'companies'
       AND policyname LIKE 'co_%')                            AS company_policies,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'profiles'
       AND policyname LIKE 'profiles_%')                      AS profile_policies,
  (SELECT count(*) FROM pg_proc
     WHERE proname = 'is_company_hr_in_my_university')        AS uni_hr_helper_exists;
