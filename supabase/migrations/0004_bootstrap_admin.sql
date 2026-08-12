-- ============================================================================
-- InternHub.pk — Bootstrap Admin Functions
-- ----------------------------------------------------------------------------
-- This migration provides a SAFE way to create the initial super_admin
-- account WITHOUT embedding any passwords or secrets in the repository.
--
-- Usage:
--   1. The deploy operator creates an auth.users row via Supabase Dashboard
--      OR via `supabase auth admin create-user` CLI.
--   2. The deploy operator then runs:
--        SELECT internhub.promote_to_super_admin('<user-uuid>');
--      OR, if they only know the email:
--        SELECT internhub.promote_to_super_admin_by_email('<email>');
--   3. These functions are SECURITY DEFINER but can only be invoked by the
--      postgres role (i.e. via the SQL editor or service role) — they are
--      NOT exposed to the anon/authenticated roles. See the REVOKE below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. promote_to_super_admin(user_uuid)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.promote_to_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  -- Confirm the user exists in auth.users
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

-- ----------------------------------------------------------------------------
-- 2. promote_to_super_admin_by_email(email)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.promote_to_super_admin_by_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row with email %', p_email;
  END IF;
  PERFORM internhub.promote_to_super_admin(v_user_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. assign_role(user_uuid, role, university_id, department_id, program_id, company_id)
--    — trusted-admin-only helper to assign scoped roles to existing users.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.assign_role(
  p_user_id uuid,
  p_role user_role,
  p_university_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_program_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  IF p_role IN ('university_admin','department_coordinator','faculty_supervisor','student') AND p_university_id IS NULL THEN
    RAISE EXCEPTION 'university_id is required for role %', p_role;
  END IF;
  IF p_role IN ('department_coordinator','faculty_supervisor') AND p_department_id IS NULL THEN
    RAISE EXCEPTION 'department_id is required for role %', p_role;
  END IF;
  IF p_role IN ('company_hr','site_supervisor') AND p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for role %', p_role;
  END IF;

  -- Validate that department belongs to university
  IF p_department_id IS NOT NULL AND p_university_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = p_department_id AND d.university_id = p_university_id) THEN
      RAISE EXCEPTION 'Department % does not belong to university %', p_department_id, p_university_id;
    END IF;
  END IF;

  -- Validate that program belongs to department
  IF p_program_id IS NOT NULL AND p_department_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.programs p WHERE p.id = p_program_id AND p.department_id = p_department_id) THEN
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

-- ----------------------------------------------------------------------------
-- 4. REVOKE execute from anon/authenticated — these are admin-only functions
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Helpful comment
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION internhub.promote_to_super_admin(uuid) IS
  'Bootstrap-only: promotes an auth.users row to super_admin. Invoke via SQL Editor or service role only.';
COMMENT ON FUNCTION internhub.promote_to_super_admin_by_email(text) IS
  'Bootstrap-only: promotes an auth.users row (matched by email) to super_admin.';
COMMENT ON FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) IS
  'Admin-only: assigns a scoped role to an existing user. Enforces FK integrity between university/department/program/company.';

-- ============================================================================
-- End of 0004_bootstrap_admin.sql
-- ============================================================================
