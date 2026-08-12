-- ============================================================================
-- InternHub.pk — 0012 University admin can update own university
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The `uni_update` policy on `universities` currently only allows
--   `super_admin` to UPDATE rows. This means a university_admin cannot
--   edit their own university's name, contact email, address, etc. from
--   the /university-admin/settings page — every save returns
--   `new row violates row-level security policy`.
--
-- FIX
--   Extend the `uni_update` policy so that a `university_admin` can also
--   UPDATE the row whose `id = internhub.current_university_id()` (i.e.
--   their own university only). They still cannot touch other
--   universities. Super Admin retains the existing unrestricted access.
--
--   This migration is fully idempotent — uses DROP POLICY IF EXISTS +
--   CREATE POLICY so it can be re-run safely.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Universities — UPDATE policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS uni_update ON universities;

CREATE POLICY uni_update ON universities
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND id = internhub.current_university_id())
  );

-- Note: INSERT and DELETE on universities remain super_admin-only —
-- university_admins can neither create new universities nor delete their
-- own. That stays as-is from migration 0002.

-- ----------------------------------------------------------------------------
-- 2. Diagnostic — should show the new policy
-- ----------------------------------------------------------------------------
SELECT
  pol.polname AS policy_name,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
  AND cls.relname = 'universities'
  AND pol.polname = 'uni_update';
