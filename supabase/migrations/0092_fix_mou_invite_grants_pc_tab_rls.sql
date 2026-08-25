-- =============================================================================
-- 0092_fix_mou_invite_grants_pc_tab_rls.sql
-- ----------------------------------------------------------------------------
-- Fixes three bugs:
--
--   BUG 1 — MoU invite INSERT/UPDATE/DELETE fails silently
--     Root cause: migration 0091 only granted SELECT on mou_invitations.
--     Without INSERT/UPDATE/DELETE grants, the RLS WITH CHECK never
--     executes and the operation is denied at the privilege layer.
--     Fix: GRANT INSERT, UPDATE, DELETE TO authenticated.
--
--   BUG 2 — MoU invitation RLS policies use inline subqueries against
--     profiles which are themselves subject to profiles RLS. This can
--     cause the subquery to return empty. Rewrite to use internhub
--     helper functions (SECURITY DEFINER, row_security=off).
--
--   BUG 3 — DC Program Coordinator tab empty
--     Root cause A: profiles_select uses internhub.current_department_id()
--     which reads from auth.users metadata. If the DC's metadata is missing
--     department_id (migration 0079 only backfilled when role mismatched),
--     the function returns NULL causing no rows to be returned.
--     Fix: Comprehensive backfill that syncs ALL auth metadata from profiles.
--
--     Root cause B: prog_select only checks university_id, not department_id
--     for DC. Add department_coordinator clause to prog_select.
--
--   Also adds GRANT INSERT/UPDATE/DELETE on internship_target_departments
--   (same issue as mou_invitations — 0091 only granted SELECT).
-- =============================================================================

BEGIN;

-- ============================================================================
-- BUG 1: Missing GRANTs on mou_invitations
-- ============================================================================
GRANT INSERT ON mou_invitations TO authenticated;
GRANT UPDATE ON mou_invitations TO authenticated;
GRANT DELETE ON mou_invitations TO authenticated;

-- Also fix internship_target_departments (same issue from 0091)
GRANT INSERT ON internship_target_departments TO authenticated;
GRANT DELETE ON internship_target_departments TO authenticated;

-- ============================================================================
-- BUG 2: Rewrite mou_invitations RLS to use helper functions
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.is_mou_inviter(p_university_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT
    internhub.is_super_admin()
    OR (
      internhub.current_role() = 'university_admin'::user_role
      AND p_university_id = internhub.current_university_id()
    )
    OR (
      internhub.current_role() = 'company_hr'::user_role
      AND p_company_id = internhub.current_company_id()
    );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_mou_inviter(uuid, uuid) TO authenticated, anon;

-- Helper: is_mou_invitee — checks if current user's email matches invitee_email
CREATE OR REPLACE FUNCTION internhub.is_mou_invitee(p_invitee_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.email = p_invitee_email
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_mou_invitee(text) TO authenticated, anon;

-- Rewrite SELECT policy
DROP POLICY IF EXISTS mou_inv_select_policy ON mou_invitations;
CREATE POLICY mou_inv_select_policy ON mou_invitations
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR internhub.is_mou_inviter(university_id, company_id)
    OR internhub.is_mou_invitee(invitee_email)
  );

-- Rewrite INSERT policy
DROP POLICY IF EXISTS mou_inv_insert_policy ON mou_invitations;
CREATE POLICY mou_inv_insert_policy ON mou_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.is_mou_inviter(university_id, company_id)
  );

-- Rewrite UPDATE policy
DROP POLICY IF EXISTS mou_inv_update_policy ON mou_invitations;
CREATE POLICY mou_inv_update_policy ON mou_invitations
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR internhub.is_mou_inviter(university_id, company_id)
    OR internhub.is_mou_invitee(invitee_email)
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR internhub.is_mou_inviter(university_id, company_id)
    OR internhub.is_mou_invitee(invitee_email)
  );

-- ============================================================================
-- BUG 3A: Comprehensive auth metadata backfill
-- ============================================================================
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'university_id', COALESCE(
      (u.raw_app_meta_data->>'university_id')::uuid,
      (SELECT p.university_id FROM public.profiles p WHERE p.user_id = u.id)
    ),
    'department_id', COALESCE(
      (u.raw_app_meta_data->>'department_id')::uuid,
      (SELECT p.department_id FROM public.profiles p WHERE p.user_id = u.id)
    ),
    'company_id', COALESCE(
      (u.raw_app_meta_data->>'company_id')::uuid,
      (SELECT p.company_id FROM public.profiles p WHERE p.user_id = u.id)
    ),
    'program_id', COALESCE(
      (u.raw_app_meta_data->>'program_id')::uuid,
      (SELECT p.program_id FROM public.profiles p WHERE p.user_id = u.id)
    )
  )
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = u.id
    AND (
      (u.raw_app_meta_data->>'university_id') IS NULL
      OR (u.raw_app_meta_data->>'department_id') IS NULL
      OR (u.raw_app_meta_data->>'company_id') IS NULL
      OR (u.raw_app_meta_data->>'program_id') IS NULL
    )
);

-- ============================================================================
-- BUG 3B: Update prog_select to allow DC by department_id
-- ============================================================================
DROP POLICY IF EXISTS prog_select ON programs;
CREATE POLICY prog_select ON programs
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR university_id = internhub.current_university_id()
    OR (
      internhub.current_role() = 'department_coordinator'::user_role
      AND department_id = internhub.current_department_id()
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
