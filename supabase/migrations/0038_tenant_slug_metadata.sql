-- ============================================================================
-- InternHub.pk — 0038 Sync tenant_slug + tenant_domain to auth.users metadata
-- ----------------------------------------------------------------------------
-- PURPOSE
--   The proxy (src/proxy.ts) needs to know each user's tenant slug so it can
--   redirect them to their university's subdomain on login (e.g. a student
--   belonging to IIUI who signs in on the apex domain gets redirected to
--   iiui.<current-domain>). The proxy MUST NOT make DB calls (it runs on
--   every request — DB calls would kill latency and connection pool budget),
--   so the slug has to live in the JWT's app_metadata.
--
--   Migration 0013 already syncs `university_id` (UUID) into app_metadata,
--   but a UUID doesn't help the proxy — it needs the slug (e.g. "iiui") to
--   build the redirect URL. Looking up the slug from the UUID on every
--   request would reintroduce the DB call we're trying to avoid.
--
--   This migration extends the existing profiles_sync_auth_metadata trigger
--   (created in 0013, last touched in 0011) to ALSO look up the slug + domain
--   from public.universities whenever university_id changes, and write them
--   to both raw_app_meta_data and raw_user_meta_data as `tenant_slug` and
--   `tenant_domain`.
--
-- WHAT THIS DOES
--   1. Rewrites internhub.sync_role_to_auth_users() (the trigger function
--      from 0011/0013) to:
--      a) Keep syncing role, university_id, department_id, company_id as before.
--      b) When university_id is set/changed, SELECT slug + domain FROM
--         universities WHERE id = NEW.university_id and add tenant_slug /
--         tenant_domain to the metadata payload.
--      c) When university_id is cleared (set to NULL), remove tenant_slug /
--         tenant_domain from metadata by setting them to NULL (jsonb '-' operator).
--   2. Re-attaches the trigger (DROP IF EXISTS + CREATE) — same name as 0013.
--   3. One-time backfill: for every user whose profiles.university_id is set
--      but whose app_metadata.tenant_slug is missing or stale, look up the
--      slug from universities and write it into both raw_app_meta_data and
--      raw_user_meta_data.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER +
--   conditional UPDATEs that only touch out-of-sync rows. Safe to re-run.
--
-- RLS NOTE
--   The trigger function is SECURITY DEFINER owned by postgres, so it can
--   read from public.universities regardless of the caller's role. The
--   universities table is anon-readable anyway (so the landing page can
--   render tenant branding pre-auth), but SECURITY DEFINER guarantees the
--   trigger works even if that policy changes in the future.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rewrite the sync trigger function to also sync tenant_slug + tenant_domain
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.sync_role_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  v_tenant_slug text;
  v_tenant_domain text;
BEGIN
  -- Build a jsonb object with ONLY the non-null / changed fields. This
  -- keeps the metadata payload small and avoids overwriting fields with
  -- null when only one of them changed.
  meta := '{}'::jsonb;

  IF (TG_OP = 'INSERT' AND NEW.role IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
    meta := meta || jsonb_build_object('role', NEW.role::text);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.university_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.university_id IS DISTINCT FROM OLD.university_id) THEN
    meta := meta || jsonb_build_object('university_id', NEW.university_id::text);

    -- Look up the slug + domain for this university. If the university_id
    -- is NULL (being cleared) we'll skip this and instead delete the keys
    -- below. If the lookup fails (e.g. university row was deleted), we
    -- leave any existing tenant_slug in place — the user can still be
    -- redirected to the old subdomain until an admin corrects the data.
    IF NEW.university_id IS NOT NULL THEN
      SELECT slug, domain
        INTO v_tenant_slug, v_tenant_domain
        FROM public.universities
        WHERE id = NEW.university_id;

      IF v_tenant_slug IS NOT NULL THEN
        meta := meta || jsonb_build_object('tenant_slug', v_tenant_slug);
        -- domain may legitimately be NULL (university without a custom
        -- subdomain yet); only write it when present so we don't clobber
        -- a previously-set value with null.
        IF v_tenant_domain IS NOT NULL THEN
          meta := meta || jsonb_build_object('tenant_domain', v_tenant_domain);
        END IF;
      END IF;
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.department_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.department_id IS DISTINCT FROM OLD.department_id) THEN
    meta := meta || jsonb_build_object('department_id', NEW.department_id::text);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.company_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id) THEN
    meta := meta || jsonb_build_object('company_id', NEW.company_id::text);
  END IF;

  -- If university_id was just cleared, remove any stale tenant_slug /
  -- tenant_domain from metadata so the proxy doesn't redirect a user to a
  -- tenant they no longer belong to.
  IF (TG_OP = 'UPDATE' AND NEW.university_id IS NULL AND OLD.university_id IS NOT NULL) THEN
    UPDATE auth.users
      SET raw_app_meta_data =
            COALESCE(raw_app_meta_data, '{}'::jsonb) - 'tenant_slug' - 'tenant_domain',
          raw_user_meta_data =
            COALESCE(raw_user_meta_data, '{}'::jsonb) - 'tenant_slug' - 'tenant_domain'
      WHERE id = NEW.user_id;
  END IF;

  -- Only UPDATE auth.users if we actually have something to sync.
  IF meta <> '{}'::jsonb THEN
    UPDATE auth.users
      SET raw_app_meta_data =
            COALESCE(raw_app_meta_data, '{}'::jsonb) || meta,
          raw_user_meta_data =
            COALESCE(raw_user_meta_data, '{}'::jsonb) || meta
      WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.sync_role_to_auth_users() OWNER TO postgres;

-- Re-attach the trigger. DROP IF EXISTS makes this safe to re-run.
DROP TRIGGER IF EXISTS profiles_sync_role_to_auth ON public.profiles;
DROP TRIGGER IF EXISTS profiles_sync_auth_metadata ON public.profiles;

CREATE TRIGGER profiles_sync_auth_metadata
  AFTER INSERT OR UPDATE OF role, university_id, department_id, company_id
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION internhub.sync_role_to_auth_users();

-- ----------------------------------------------------------------------------
-- 2. One-time backfill — for every user whose profiles.university_id is set
--    but whose app_metadata.tenant_slug is missing or stale, look up the
--    slug + domain from universities and write them into BOTH
--    raw_app_meta_data AND raw_user_meta_data.
--
--    We coalesce to ensure we don't overwrite a correct value with NULL,
--    and the WHERE clause ensures we only touch rows that actually need
--    updating (idempotent on re-run).
-- ----------------------------------------------------------------------------

-- 2a. Backfill tenant_slug into raw_app_meta_data
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('tenant_slug', uni.slug)
FROM public.profiles p
JOIN public.universities uni ON uni.id = p.university_id
WHERE p.user_id = u.id
  AND p.university_id IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'tenant_slug', '') <> uni.slug;

-- 2b. Backfill tenant_slug into raw_user_meta_data
UPDATE auth.users u
SET raw_user_meta_data =
      COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('tenant_slug', uni.slug)
FROM public.profiles p
JOIN public.universities uni ON uni.id = p.university_id
WHERE p.user_id = u.id
  AND p.university_id IS NOT NULL
  AND COALESCE(u.raw_user_meta_data->>'tenant_slug', '') <> uni.slug;

-- 2c. Backfill tenant_domain into raw_app_meta_data (only where the
--     university has a domain set — leaves null domains alone)
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('tenant_domain', uni.domain)
FROM public.profiles p
JOIN public.universities uni ON uni.id = p.university_id
WHERE p.user_id = u.id
  AND p.university_id IS NOT NULL
  AND uni.domain IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'tenant_domain', '') <> uni.domain;

-- 2d. Backfill tenant_domain into raw_user_meta_data
UPDATE auth.users u
SET raw_user_meta_data =
      COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('tenant_domain', uni.domain)
FROM public.profiles p
JOIN public.universities uni ON uni.id = p.university_id
WHERE p.user_id = u.id
  AND p.university_id IS NOT NULL
  AND uni.domain IS NOT NULL
  AND COALESCE(u.raw_user_meta_data->>'tenant_domain', '') <> uni.domain;

-- ----------------------------------------------------------------------------
-- 3. Diagnostic — should show 0 out-of-sync rows after this runs.
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
     JOIN public.universities uni ON uni.id = p.university_id
    WHERE p.university_id IS NOT NULL
      AND COALESCE(u.raw_app_meta_data->>'tenant_slug', '') <> uni.slug)
                                                              AS app_meta_tenant_slug_out_of_sync,
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
     JOIN public.universities uni ON uni.id = p.university_id
    WHERE p.university_id IS NOT NULL
      AND uni.domain IS NOT NULL
      AND COALESCE(u.raw_app_meta_data->>'tenant_domain', '') <> uni.domain)
                                                              AS app_meta_tenant_domain_out_of_sync,
  (SELECT count(*) FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'profiles'
      AND trigger_name = 'profiles_sync_auth_metadata')        AS trigger_exists;
