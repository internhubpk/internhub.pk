-- ============================================================================
-- InternHub.pk — 0021 STRUCTURAL FIX for NULL university_id
-- ----------------------------------------------------------------------------
-- PROBLEM (root cause, finally)
--   The on_auth_user_created trigger (internhub_handle_new_user, defined in
--   migration 0001) inserts the new profile row with ONLY:
--     user_id, email, full_name, first_name, last_name, role, avatar_url,
--     phone, status, is_active
--   It does NOT write university_id, department_id, or company_id — even
--   though those values are sitting right there in raw_user_meta_data and
--   raw_app_meta_data. So every account created via:
--     • /api/admin/create-user (super_admin → university_admin)
--     • /api/admin/create-user (university_admin → coordinator/faculty/student)
--     • self-signup (pending_assignment role)
--   gets a profiles row with university_id = NULL. Then RLS blocks the
--   admin from seeing or updating them.
--
--   Previous backfill migrations (0018, 0019, 0020) treated the symptom by
--   copying university_id from auth.users metadata into profiles. But
--   every NEW user created after the backfill still had the same bug.
--
-- STRUCTURAL FIX
--   1. REWRITE internhub_handle_new_user() to:
--      a) Read university_id, department_id, company_id from
--         raw_app_meta_data FIRST, then raw_user_meta_data (priority).
--      b) Validate each UUID with a regex before casting (avoids
--         invalid_text_representation error).
--      c) Write all three tenant IDs into the profile INSERT.
--      d) Change ON CONFLICT (user_id) DO NOTHING → DO UPDATE SET ...
--         so if the trigger fires twice (e.g. re-import), the tenant
--         IDs are refreshed instead of silently dropped.
--
--   2. ADD on_auth_user_metadata_updated trigger (AFTER UPDATE on
--      auth.users) — fires when raw_user_meta_data or raw_app_meta_data
--      changes. Propagates the new tenant IDs to profiles. This handles:
--        • super_admin reassigns a user to a different university via
--          the dashboard (calls supabase.auth.admin.updateUserById)
--        • /api/admin/create-user's verify-and-fix step writes app_meta
--          → trigger propagates to profiles
--
--   3. EXTEND internhub.sync_role_to_auth_users() (already fires on
--      profiles INSERT/UPDATE) to ALSO sync university_id,
--      department_id, company_id from profiles back to auth.users
--      metadata. This handles:
--        • PATCH /api/coordinators/[id] updates profiles → trigger
--          syncs to auth.users so RLS helper functions see the new IDs
--
--   4. ONE-TIME backfill of any remaining NULL profiles.university_id
--      using the same FK-validated approach as 0020. After this
--      migration, no new NULL rows should ever appear (because the
--      trigger now writes them correctly).
--
--   5. DIAGNOSTIC: list any profiles that STILL have NULL university_id
--      after the backfill — these need manual cleanup.
--
-- IDEMPOTENT
--   All CREATE OR REPLACE / DROP IF EXISTS. Safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. REWRITE internhub_handle_new_user() — the AFTER INSERT trigger on
--    auth.users. Now writes university_id, department_id, company_id
--    from metadata into the profiles row.
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text;
  assigned_role user_role;
  v_university_id text;
  v_department_id text;
  v_company_id    text;
BEGIN
  -- Role from metadata (priority: app_meta first, then user_meta)
  meta_role := COALESCE(
    NEW.raw_app_meta_data->>'role',
    NEW.raw_user_meta_data->>'role',
    'pending_assignment'
  );
  assigned_role := CASE
    WHEN meta_role = 'super_admin' THEN 'super_admin'
    WHEN meta_role = 'university_admin' THEN 'university_admin'
    WHEN meta_role = 'department_coordinator' THEN 'department_coordinator'
    WHEN meta_role = 'faculty_supervisor' THEN 'faculty_supervisor'
    WHEN meta_role = 'student' THEN 'student'
    WHEN meta_role = 'company_hr' THEN 'company_hr'
    WHEN meta_role = 'site_supervisor' THEN 'site_supervisor'
    WHEN meta_role = 'external_evaluator' THEN 'external_evaluator'
    ELSE 'pending_assignment'
  END;

  -- Tenant IDs from metadata — validate UUID format before casting
  v_university_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'university_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'university_id'
      ELSE NULL
    END
  );

  v_department_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'department_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'department_id'
      ELSE NULL
    END
  );

  v_company_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'company_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'company_id'
      ELSE NULL
    END
  );

  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role,
    avatar_url, phone, status, is_active,
    university_id, department_id, company_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    assigned_role,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN assigned_role = 'pending_assignment' THEN 'pending' ELSE 'active' END,
    true,
    v_university_id::uuid,
    v_department_id::uuid,
    v_company_id::uuid
  )
  -- DO UPDATE instead of DO NOTHING so re-runs refresh tenant IDs.
  -- Don't overwrite role (sync_role_to_auth trigger handles that
  -- separately to avoid recursion). Don't overwrite email/full_name
  -- either — those might have been edited by the user.
  ON CONFLICT (user_id) DO UPDATE SET
    university_id = EXCLUDED.university_id,
    department_id = EXCLUDED.department_id,
    company_id    = EXCLUDED.company_id,
    updated_at    = now()
  WHERE
    public.profiles.university_id IS DISTINCT FROM EXCLUDED.university_id
    OR public.profiles.department_id IS DISTINCT FROM EXCLUDED.department_id
    OR public.profiles.company_id    IS DISTINCT FROM EXCLUDED.company_id;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub_handle_new_user() OWNER TO postgres;

-- Re-attach the trigger (DROP IF EXISTS makes this idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION internhub_handle_new_user();

-- ============================================================================
-- 2. NEW TRIGGER: on_auth_user_metadata_updated
--    Fires AFTER UPDATE on auth.users when raw_user_meta_data or
--    raw_app_meta_data changes. Propagates new tenant IDs to profiles.
--    This handles the case where an admin reassigns a user via
--    supabase.auth.admin.updateUserById (e.g. super_admin moves a
--    coordinator from one university to another via the dashboard).
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub_sync_auth_meta_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_university_id text;
  v_department_id text;
  v_company_id    text;
BEGIN
  -- Only act if tenant-bearing metadata columns changed
  IF TG_OP = 'UPDATE'
     AND OLD.raw_user_meta_data IS NOT DISTINCT FROM NEW.raw_user_meta_data
     AND OLD.raw_app_meta_data  IS NOT DISTINCT FROM NEW.raw_app_meta_data THEN
    RETURN NEW;
  END IF;

  -- Resolve effective tenant IDs (app_meta priority, then user_meta)
  v_university_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'university_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'university_id'
      ELSE NULL
    END
  );

  v_department_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'department_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'department_id'
      ELSE NULL
    END
  );

  v_company_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'company_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'company_id'
      ELSE NULL
    END
  );

  -- Propagate to profiles row (only update if value actually changed)
  UPDATE public.profiles
  SET
    university_id = CASE
      WHEN v_university_id IS NOT NULL THEN v_university_id::uuid
      ELSE university_id
    END,
    department_id = CASE
      WHEN v_department_id IS NOT NULL THEN v_department_id::uuid
      ELSE department_id
    END,
    company_id = CASE
      WHEN v_company_id IS NOT NULL THEN v_company_id::uuid
      ELSE company_id
    END,
    updated_at = now()
  WHERE user_id = NEW.id
    AND (university_id IS DISTINCT FROM v_university_id::uuid
         OR department_id IS DISTINCT FROM v_department_id::uuid
         OR company_id    IS DISTINCT FROM v_company_id::uuid);

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub_sync_auth_meta_to_profile() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_metadata_updated ON auth.users;
CREATE TRIGGER on_auth_user_metadata_updated
  AFTER UPDATE OF raw_user_meta_data, raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION internhub_sync_auth_meta_to_profile();

-- ============================================================================
-- 3. EXTEND internhub.sync_role_to_auth_users() to ALSO sync tenant IDs
--    from profiles back to auth.users metadata.
--    This handles the case where profiles is updated directly (e.g. via
--    PATCH /api/coordinators/[id] which updates profiles.department_id).
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.sync_role_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_patch jsonb := '{}'::jsonb;
BEGIN
  -- Role
  IF (TG_OP = 'INSERT' AND NEW.role IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
    meta_patch := meta_patch || jsonb_build_object('role', NEW.role::text);
  END IF;

  -- university_id (only patch if changed — avoids clobbering other metadata)
  IF (TG_OP = 'INSERT' AND NEW.university_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.university_id IS DISTINCT FROM OLD.university_id) THEN
    meta_patch := meta_patch || jsonb_build_object(
      'university_id', COALESCE(NEW.university_id::text, null)
    );
  END IF;

  -- department_id
  IF (TG_OP = 'INSERT' AND NEW.department_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.department_id IS DISTINCT FROM OLD.department_id) THEN
    meta_patch := meta_patch || jsonb_build_object(
      'department_id', COALESCE(NEW.department_id::text, null)
    );
  END IF;

  -- company_id
  IF (TG_OP = 'INSERT' AND NEW.company_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id) THEN
    meta_patch := meta_patch || jsonb_build_object(
      'company_id', COALESCE(NEW.company_id::text, null)
    );
  END IF;

  -- Only write if there's something to sync
  IF meta_patch <> '{}'::jsonb THEN
    UPDATE auth.users
      SET raw_app_meta_data  = COALESCE(raw_app_meta_data,  '{}'::jsonb) || meta_patch,
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || meta_patch
      WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.sync_role_to_auth_users() OWNER TO postgres;

-- Re-attach (already exists from migration 0011, but DROP IF EXISTS keeps
-- this idempotent)
DROP TRIGGER IF EXISTS profiles_sync_role_to_auth ON public.profiles;
CREATE TRIGGER profiles_sync_role_to_auth
  AFTER INSERT OR UPDATE OF role, university_id, department_id, company_id
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION internhub.sync_role_to_auth_users();

COMMIT;

-- ============================================================================
-- 4. ONE-TIME BACKFILL — for existing profiles with NULL university_id
--    whose auth.users metadata has a valid UUID. Same approach as 0020.
-- ============================================================================
UPDATE public.profiles p
SET
  university_id = sub.university_id,
  updated_at    = now()
FROM (
  SELECT
    au.id AS user_id,
    (au.raw_app_meta_data->>'university_id')::uuid AS university_id
  FROM auth.users au
  WHERE au.raw_app_meta_data->>'university_id'
        ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.universities u
      WHERE u.id::text = au.raw_app_meta_data->>'university_id'
    )
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin');

UPDATE public.profiles p
SET
  university_id = sub.university_id,
  updated_at    = now()
FROM (
  SELECT
    au.id AS user_id,
    (au.raw_user_meta_data->>'university_id')::uuid AS university_id
  FROM auth.users au
  WHERE au.raw_user_meta_data->>'university_id'
        ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.universities u
      WHERE u.id::text = au.raw_user_meta_data->>'university_id'
    )
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin');

-- ============================================================================
-- 5. DIAGNOSTIC — any profiles that STILL have NULL university_id after
--    the backfill. These are accounts whose auth.users metadata is also
--    missing or invalid. To fix each row:
--      UPDATE public.profiles SET university_id = '<real-uuid>'
--      WHERE user_id = '<uuid>';
--    OR delete the account and re-create via the dashboard.
-- ============================================================================
SELECT
  p.user_id,
  p.email,
  p.role,
  p.university_id   AS profile_uni,
  p.department_id   AS profile_dept,
  au.raw_user_meta_data->>'university_id'  AS user_meta_uni,
  au.raw_app_meta_data->>'university_id'   AS app_meta_uni
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin')
ORDER BY p.role, p.email;

-- ============================================================================
-- 6. Reload PostgREST schema cache so all function/trigger changes are live.
-- ============================================================================
NOTIFY pgrst, 'reload schema';
