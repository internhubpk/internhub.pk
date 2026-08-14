-- ============================================================================
-- InternHub.pk — 0046_marketplace_public_anon.sql
-- ----------------------------------------------------------------------------
-- BUG: /marketplace shows zero internships to logged-out visitors.
--
-- Root cause: the `int_select` and `co_select` RLS policies were defined as
--   FOR SELECT TO authenticated
-- meaning only logged-in users could read internships and companies.
-- Anon visitors (no JWT) silently got 0 rows from the Supabase REST API —
-- no error, just an empty list — so the marketplace page rendered
-- "No internships found" with a clear-filters button that did nothing.
--
-- The marketplace is supposed to be a PUBLIC catalog: prospects browse
-- open internships before signing up, and the marketing landing page also
-- surfaces featured roles. Both flows must work for anon.
--
-- FIX: add an `anon` SELECT policy on `internships` (restricted to
-- status IN ('open','active') — i.e. currently-accepting-applications,
-- excluding 'completed' since those have already closed) and on `companies`
-- (all rows; companies are explicitly public for the marketplace).
--
-- Authenticated users keep their existing (broader) policy — no change to
-- the `authenticated` policy. Only `anon` is added.
--
-- IDEMPOTENT — DROP POLICY IF EXISTS before each CREATE.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Internships: anon may SELECT only currently-open internships.
--    (Authenticated users keep the broader existing policy.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS int_select_anon ON public.internships;
CREATE POLICY int_select_anon ON public.internships
  FOR SELECT TO anon
  USING (
    status IN ('open','active')
  );

-- ---------------------------------------------------------------------------
-- 2. Companies: anon may SELECT all rows. (The existing comment on
--    co_select already says "companies are publicly listed for the
--    marketplace" — this finally makes that true for anon too.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS co_select_anon ON public.companies;
CREATE POLICY co_select_anon ON public.companies
  FOR SELECT TO anon
  USING (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
