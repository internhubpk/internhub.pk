-- ============================================================================
-- InternHub.pk — 0010 Super admin CRUD on companies + profiles
-- ----------------------------------------------------------------------------
-- WHY
--   Super admin needs to:
--     * add / update / delete companies (host organizations)
--     * add / update / delete company_hr user accounts
--   The existing RLS policies on `companies` and `profiles` already allow
--   super_admin to do all of this (current_role() = 'super_admin' is the
--   first branch of every policy). BUT the policies were never applied to
--   the live DB for `companies` (only `profiles` got its policies in 0007),
--   and the `companies` table currently has only a permissive SELECT policy.
--   This migration adds the missing INSERT / UPDATE / DELETE policies for
--   super_admin on `companies`, and re-asserts the profiles policies so
--   super_admin can manage company_hr rows.
--
-- IDEMPOTENT
--   DROP POLICY IF EXISTS before every CREATE POLICY. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Companies — super_admin full CRUD; public SELECT for marketplace.
--    (Replaces the permissive co_select from 0007 which was SELECT-only.)
-- ----------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS co_select   ON public.companies;
DROP POLICY IF EXISTS co_insert   ON public.companies;
DROP POLICY IF EXISTS co_update   ON public.companies;
DROP POLICY IF EXISTS co_delete   ON public.companies;

CREATE POLICY co_select ON public.companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY co_insert ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (internhub.current_role() = 'super_admin');

CREATE POLICY co_update ON public.companies
  FOR UPDATE TO authenticated
  USING (internhub.current_role() = 'super_admin')
  WITH CHECK (internhub.current_role() = 'super_admin');

CREATE POLICY co_delete ON public.companies
  FOR DELETE TO authenticated
  USING (internhub.current_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- 2. Profiles — re-assert super_admin full CRUD (so company_hr management
--    works). These are the same policies from 0007, re-stated here so the
--    live DB has them even if 0007 was run partially.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;

-- (select/insert/update/delete already created in 0007 — DROP IF EXISTS
--  first so re-running this migration is safe.)
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_delete ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
  );

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (internhub.current_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- 3. Universities — super_admin full CRUD (re-assert; 0002 may not have run
--    on the live DB).
-- ----------------------------------------------------------------------------
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uni_select ON public.universities;
DROP POLICY IF EXISTS uni_insert ON public.universities;
DROP POLICY IF EXISTS uni_update ON public.universities;
DROP POLICY IF EXISTS uni_delete ON public.universities;

CREATE POLICY uni_select ON public.universities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY uni_insert ON public.universities
  FOR INSERT TO authenticated
  WITH CHECK (internhub.current_role() = 'super_admin');

CREATE POLICY uni_update ON public.universities
  FOR UPDATE TO authenticated
  USING (internhub.current_role() = 'super_admin')
  WITH CHECK (internhub.current_role() = 'super_admin');

CREATE POLICY uni_delete ON public.universities
  FOR DELETE TO authenticated
  USING (internhub.current_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- 4. Sanity check
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies')   AS company_policies,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles')    AS profile_policies,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'universities') AS university_policies;
