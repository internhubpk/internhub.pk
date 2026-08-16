-- ============================================================================
-- 0070_assign_role_service_role_bypass.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   /api/admin/assign-role calls `public.assign_role(...)` (the wrapper from
--   migration 0069) via the SERVICE_ROLE client. Inside the underlying
--   `internhub.assign_role()`, the authz check is:
--
--     SELECT internhub.current_role() INTO v_caller_role;
--     IF v_caller_role IS DISTINCT FROM 'super_admin'::user_role THEN
--       RAISE EXCEPTION 'Permission denied: only super_admin can call assign_role()'
--         USING ERRCODE = 'insufficient_privilege';
--     END IF;
--
--   `internhub.current_role()` reads `auth.users WHERE id = auth.uid()`.
--   For service_role calls, `auth.uid()` returns NULL (no user JWT in the
--   request), so the SELECT returns no row and COALESCE falls through to
--   'pending_assignment'. The check then fails with:
--
--     Permission denied: only super_admin can call assign_role()
--
--   Even though the API route has ALREADY verified (lines 124-132 of
--   route.ts) that the human caller is super_admin via their JWT.
--
-- FIX
--   Apply the same `auth.uid() IS NULL` bypass pattern that migration 0029
--   applied to `guard_profile_update` and `guard_notification_update`. When
--   `auth.uid()` is NULL, the call is from service_role (server-side API
--   route) or postgres (SQL Editor bootstrap) — both privileged contexts
--   that have already been authorized upstream.
--
--   We also apply the same fix to `internhub.promote_to_super_admin()` and
--   `internhub.promote_to_super_admin_by_email()` which have the same
--   broken check (their 0028 comment claims they work for bootstrap, but
--   they actually raise the same exception because current_role() never
--   returns NULL — it returns 'pending_assignment' via COALESCE).
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. internhub.assign_role — add service_role / postgres bypass
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.assign_role(
  p_user_id uuid,
  p_role user_role,
  p_university_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid,
  p_program_id uuid DEFAULT NULL::uuid,
  p_company_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role user_role;
  v_uid uuid;
BEGIN
  -- Authorization: only super_admin may assign roles via this function.
  -- When auth.uid() is NULL, the call is from the service_role client
  -- (admin API routes, which already verified the human caller is
  -- super_admin upstream) or the postgres superuser (SQL Editor
  -- bootstrap). Both are privileged contexts — bypass the check.
  -- Mirrors the pattern from migration 0029.
  v_uid := (select auth.uid());
  IF v_uid IS NOT NULL THEN
    SELECT internhub.current_role() INTO v_caller_role;
    IF v_caller_role IS DISTINCT FROM 'super_admin'::user_role THEN
      RAISE EXCEPTION 'Permission denied: only super_admin can call assign_role()'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % does not exist in auth.users', p_user_id;
  END IF;
  IF p_role = 'super_admin' THEN
    RAISE EXCEPTION 'Use promote_to_super_admin() for super_admin assignment';
  END IF;
  IF p_role = 'pending_assignment' THEN
    RAISE EXCEPTION 'Cannot assign pending_assignment role';
  END IF;

  -- Validate scopes
  IF p_role IN ('university_admin','department_coordinator','faculty_supervisor','student')
     AND p_university_id IS NULL THEN
    RAISE EXCEPTION 'university_id is required for role %', p_role;
  END IF;
  IF p_role IN ('department_coordinator','faculty_supervisor') AND p_department_id IS NULL THEN
    RAISE EXCEPTION 'department_id is required for role %', p_role;
  END IF;
  IF p_role IN ('company_hr','site_supervisor') AND p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for role %', p_role;
  END IF;

  -- Validate department belongs to university
  IF p_department_id IS NOT NULL AND p_university_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.departments d
        WHERE d.id = p_department_id AND d.university_id = p_university_id
    ) THEN
      RAISE EXCEPTION 'Department % does not belong to university %', p_department_id, p_university_id;
    END IF;
  END IF;

  -- Validate program belongs to department
  IF p_program_id IS NOT NULL AND p_department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.programs p
        WHERE p.id = p_program_id AND p.department_id = p_department_id
    ) THEN
      RAISE EXCEPTION 'Program % does not belong to department %', p_program_id, p_department_id;
    END IF;
  END IF;

  -- Update profile
  UPDATE public.profiles
    SET
      role = p_role,
      university_id = p_university_id,
      department_id = p_department_id,
      program_id = p_program_id,
      company_id = p_company_id,
      status = 'active',
      is_active = true,
      updated_at = now()
    WHERE user_id = p_user_id;

  -- Update app_metadata so JWT carries the role
  UPDATE auth.users
    SET raw_app_meta_data =
          COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role::text)
    WHERE id = p_user_id;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, university_id, details)
  VALUES (
    (select auth.uid()),
    'user.role_change',
    'profile',
    p_user_id,
    p_university_id,
    jsonb_build_object('new_role', p_role::text, 'university_id', p_university_id,
                       'department_id', p_department_id, 'company_id', p_company_id)
  );
END;
$$;
ALTER FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. internhub.promote_to_super_admin — add service_role / postgres bypass
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.promote_to_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role user_role;
  v_uid uuid;
BEGIN
  -- Same bypass pattern as assign_role above. When auth.uid() is NULL,
  -- the call is from service_role or postgres (bootstrap from SQL Editor).
  v_uid := (select auth.uid());
  IF v_uid IS NOT NULL THEN
    SELECT internhub.current_role() INTO v_caller_role;
    IF v_caller_role IS DISTINCT FROM 'super_admin'::user_role THEN
      RAISE EXCEPTION 'Permission denied: only super_admin can call promote_to_super_admin()'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % does not exist in auth.users', p_user_id;
  END IF;

  -- Upsert profile row
  INSERT INTO public.profiles (user_id, email, role, status, is_active)
  SELECT
    u.id,
    COALESCE(u.email, ''),
    'super_admin'::user_role,
    'active'::profile_status,
    true
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'super_admin',
        status = 'active',
        is_active = true,
        updated_at = now();

  -- Also set app_metadata so the JWT carries the role for proxy.ts
  UPDATE auth.users
    SET raw_app_meta_data =
          COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb
    WHERE id = p_user_id;

  -- Issue a log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'user.role_change', 'profile', p_user_id,
          jsonb_build_object('new_role','super_admin','method','bootstrap_function'));
END;
$$;
ALTER FUNCTION internhub.promote_to_super_admin(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin(uuid) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. internhub.promote_to_super_admin_by_email — add service_role / postgres bypass
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.promote_to_super_admin_by_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_caller_role user_role;
  v_uid uuid;
BEGIN
  v_uid := (select auth.uid());
  IF v_uid IS NOT NULL THEN
    SELECT internhub.current_role() INTO v_caller_role;
    IF v_caller_role IS DISTINCT FROM 'super_admin'::user_role THEN
      RAISE EXCEPTION 'Permission denied: only super_admin can call promote_to_super_admin_by_email()'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', p_email;
  END IF;

  -- Delegate to the uuid-based variant
  PERFORM internhub.promote_to_super_admin(v_user_id);
END;
$$;
ALTER FUNCTION internhub.promote_to_super_admin_by_email(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;

-- Reload PostgREST schema cache so the updated function bodies are picked up.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- End of 0070_assign_role_service_role_bypass.sql
-- ============================================================================
