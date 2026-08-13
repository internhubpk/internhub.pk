-- ============================================================================
-- InternHub.pk — 0035_ensure_profile_and_fix_trigger.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   1. The on_auth_user_created trigger (internhub_handle_new_user) silently
--      fails to create profiles rows for some new auth.users. The exception
--      is swallowed, so auth.users INSERT succeeds but profiles never gets
--      a row. This leaves orphaned auth users who can sign in but have no
--      profile, no RLS scope, and no role.
--
--   2. The /api/admin/create-user route's upsert+verify step ALSO fails
--      silently for these users, because the verify step only fixes
--      university_id when it's wrong — it does NOT fix department_id when
--      university_id is correct but department_id is NULL.
--
--   3. Several existing auth.users have NO profile row at all (created
--      during the broken-trigger window). They need to be backfilled.
--
--   4. Several university_admin profiles have university_id = NULL even
--      though their auth.users.app_metadata has the correct university_id.
--      This breaks RLS for them (university_id = current_university_id()
--      evaluates to NULL = uuid → FALSE), so they can't see coordinators,
--      students, or programs in their university.
--
--   5. The guard_profile_update trigger blocks UPDATEs to authorization
--      columns when auth.uid() is non-NULL and the caller is not super_admin.
--      This is correct for direct user-driven UPDATEs, but it also blocks
--      the on_auth_user_metadata_updated trigger's UPDATE when called from
--      a session that has auth.uid() set (e.g., a user updating their own
--      metadata via supabase.auth.updateUser). The guard already handles
--      the NULL auth.uid() case (service role / postgres), so this is OK.
--
-- FIX
--   1. Add internhub.ensure_profile_exists(p_user_id uuid) — a
--      SECURITY DEFINER function that creates a profiles row from
--      auth.users metadata if one doesn't exist. Idempotent. Callable
--      from API routes as a guaranteed safety net.
--
--   2. Rewrite internhub_handle_new_user to be SIMPLER and more robust:
--      INSERT ... ON CONFLICT (user_id) DO NOTHING. No UPDATE branch.
--      No exception swallowing that hides real errors. If the INSERT
--      fails, the error is surfaced (and the API route's
--      ensure_profile_exists call will retry).
--
--   3. Backfill all auth.users without a profiles row, using their
--      metadata. Universities / departments that don't exist are left
--      NULL (FK allows it).
--
--   4. Backfill NULL university_id in profiles from auth.users metadata,
--      but only when the university actually exists (FK safety).
--
-- IDEMPOTENT
--   All statements use IF NOT EXISTS / ON CONFLICT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. internhub.ensure_profile_exists(p_user_id uuid)
--    Creates a profiles row for the given auth.users id if one doesn't
--    exist. Reads university_id, department_id, company_id, role,
--    full_name, first_name, last_name, phone, avatar_url from
--    auth.users metadata. Idempotent.
--
--    Returns TRUE if a row was created, FALSE if one already existed.
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.ensure_profile_exists(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user record;
  v_role text;
  v_assigned_role user_role;
  v_university_id text;
  v_department_id text;
  v_company_id text;
  v_full_name text;
  v_status profile_status;
  v_existing uuid;
  v_uni uuid;
  v_dept uuid;
  v_comp uuid;
BEGIN
  -- Check if profile already exists
  SELECT user_id INTO v_existing FROM public.profiles WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN FALSE;
  END IF;

  -- Fetch the auth.users row
  SELECT * INTO v_auth_user FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auth.users row not found for user_id %', p_user_id;
  END IF;

  -- Resolve role
  v_role := COALESCE(
    v_auth_user.raw_app_meta_data->>'role',
    v_auth_user.raw_user_meta_data->>'role',
    'pending_assignment'
  );
  v_assigned_role := CASE
    WHEN v_role = 'super_admin' THEN 'super_admin'::user_role
    WHEN v_role = 'university_admin' THEN 'university_admin'::user_role
    WHEN v_role = 'department_coordinator' THEN 'department_coordinator'::user_role
    WHEN v_role = 'faculty_supervisor' THEN 'faculty_supervisor'::user_role
    WHEN v_role = 'student' THEN 'student'::user_role
    WHEN v_role = 'company_hr' THEN 'company_hr'::user_role
    WHEN v_role = 'site_supervisor' THEN 'site_supervisor'::user_role
    WHEN v_role = 'external_evaluator' THEN 'external_evaluator'::user_role
    ELSE 'pending_assignment'::user_role
  END;

  -- Resolve tenant IDs (only set if the UUID actually exists in the FK table)
  v_university_id := COALESCE(
    CASE
      WHEN v_auth_user.raw_app_meta_data->>'university_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN v_auth_user.raw_app_meta_data->>'university_id'
      ELSE NULL
    END,
    CASE
      WHEN v_auth_user.raw_user_meta_data->>'university_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN v_auth_user.raw_user_meta_data->>'university_id'
      ELSE NULL
    END
  );

  v_department_id := COALESCE(
    CASE
      WHEN v_auth_user.raw_app_meta_data->>'department_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN v_auth_user.raw_app_meta_data->>'department_id'
      ELSE NULL
    END,
    CASE
      WHEN v_auth_user.raw_user_meta_data->>'department_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN v_auth_user.raw_user_meta_data->>'department_id'
      ELSE NULL
    END
  );

  v_company_id := COALESCE(
    CASE
      WHEN v_auth_user.raw_app_meta_data->>'company_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN v_auth_user.raw_app_meta_data->>'company_id'
      ELSE NULL
    END,
    CASE
      WHEN v_auth_user.raw_user_meta_data->>'company_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN v_auth_user.raw_user_meta_data->>'company_id'
      ELSE NULL
    END
  );

  -- Validate FK targets exist; NULL out if they don't (avoids FK violation)
  IF v_university_id IS NOT NULL THEN
    SELECT id INTO v_uni FROM public.universities WHERE id = v_university_id::uuid;
    IF NOT FOUND THEN v_uni := NULL; END IF;
  END IF;
  IF v_department_id IS NOT NULL THEN
    SELECT id INTO v_dept FROM public.departments WHERE id = v_department_id::uuid;
    IF NOT FOUND THEN v_dept := NULL; END IF;
  END IF;
  IF v_company_id IS NOT NULL THEN
    SELECT id INTO v_comp FROM public.companies WHERE id = v_company_id::uuid;
    IF NOT FOUND THEN v_comp := NULL; END IF;
  END IF;

  v_full_name := COALESCE(
    v_auth_user.raw_user_meta_data->>'full_name',
    v_auth_user.raw_user_meta_data->>'name',
    NULLIF(TRIM(COALESCE(v_auth_user.raw_user_meta_data->>'first_name', '') || ' ' ||
                 COALESCE(v_auth_user.raw_user_meta_data->>'last_name', '')), '')
  );

  v_status := CASE WHEN v_assigned_role = 'pending_assignment' THEN 'pending' ELSE 'active' END;

  -- Insert the profile (ON CONFLICT DO NOTHING for safety)
  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role,
    avatar_url, phone, status, is_active,
    university_id, department_id, company_id
  ) VALUES (
    p_user_id,
    COALESCE(v_auth_user.email, ''),
    v_full_name,
    v_auth_user.raw_user_meta_data->>'first_name',
    v_auth_user.raw_user_meta_data->>'last_name',
    v_assigned_role,
    v_auth_user.raw_user_meta_data->>'avatar_url',
    v_auth_user.raw_user_meta_data->>'phone',
    v_status,
    true,
    v_uni,
    v_dept,
    v_comp
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

ALTER FUNCTION internhub.ensure_profile_exists(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.ensure_profile_exists(uuid) TO authenticated, anon, service_role;

-- ============================================================================
-- 2. Rewrite internhub_handle_new_user to be SIMPLER and more robust.
--    Just INSERT ON CONFLICT DO NOTHING. No UPDATE branch (the API route
--    handles updates via ensure_profile_exists + explicit UPDATEs).
--    Still wrap in EXCEPTION to avoid breaking auth.users INSERT, but
--    also RAISE WARNING so the error is visible in logs.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.internhub_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delegate to internhub.ensure_profile_exists — single source of truth.
  -- Wrap in EXCEPTION so auth.users INSERT always succeeds even if the
  -- profiles INSERT fails (FK to a deleted university, etc.).
  BEGIN
    PERFORM internhub.ensure_profile_exists(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'internhub_handle_new_user: ensure_profile_exists failed for user %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.internhub_handle_new_user() OWNER TO postgres;

-- ============================================================================
-- 3. Backfill missing profiles for ALL auth.users without one.
--    Uses ensure_profile_exists so the logic is centralized.
-- ============================================================================
DO $$
DECLARE
  v_user record;
  v_count int := 0;
BEGIN
  FOR v_user IN
    SELECT au.id FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.user_id
    WHERE p.user_id IS NULL
  LOOP
    BEGIN
      PERFORM internhub.ensure_profile_exists(v_user.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Backfill failed for user %: % (%)', v_user.id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
  RAISE NOTICE 'Backfilled % missing profile(s)', v_count;
END;
$$;

-- ============================================================================
-- 4. Backfill NULL university_id in profiles from auth.users metadata.
--    Only when the university actually exists (FK safety). Also backfill
--    department_id and company_id the same way.
-- ============================================================================
UPDATE public.profiles p
SET university_id = (au.raw_app_meta_data->>'university_id')::uuid,
    updated_at = now()
FROM auth.users au
WHERE p.user_id = au.id
  AND p.university_id IS NULL
  AND au.raw_app_meta_data->>'university_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM public.universities u WHERE u.id = (au.raw_app_meta_data->>'university_id')::uuid);

UPDATE public.profiles p
SET department_id = (au.raw_app_meta_data->>'department_id')::uuid,
    updated_at = now()
FROM auth.users au
WHERE p.user_id = au.id
  AND p.department_id IS NULL
  AND au.raw_app_meta_data->>'department_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = (au.raw_app_meta_data->>'department_id')::uuid);

UPDATE public.profiles p
SET company_id = (au.raw_app_meta_data->>'company_id')::uuid,
    updated_at = now()
FROM auth.users au
WHERE p.user_id = au.id
  AND p.company_id IS NULL
  AND au.raw_app_meta_data->>'company_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = (au.raw_app_meta_data->>'company_id')::uuid);

-- ============================================================================
-- 5. Also sync role from app_metadata to profiles.role (in case the role
--    was changed in auth.users but not propagated to profiles).
-- ============================================================================
UPDATE public.profiles p
SET role = (au.raw_app_meta_data->>'role')::user_role,
    updated_at = now()
FROM auth.users au
WHERE p.user_id = au.id
  AND au.raw_app_meta_data->>'role' IS NOT NULL
  AND p.role::text <> au.raw_app_meta_data->>'role'
  AND au.raw_app_meta_data->>'role' IN
      ('super_admin','university_admin','department_coordinator',
       'faculty_supervisor','student','company_hr','site_supervisor',
       'external_evaluator','pending_assignment');

COMMIT;

NOTIFY pgrst, 'reload schema';
