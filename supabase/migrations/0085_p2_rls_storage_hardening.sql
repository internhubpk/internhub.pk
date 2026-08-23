-- ============================================================================
-- 0085: P2 AUDIT — RLS & storage hygiene hardening
-- ----------------------------------------------------------------------------
-- Second-pass verification findings (2026-08-23):
--   H1. cert_delete policy had no tenant predicates (latent cross-tenant
--       delete; PostgREST currently blocks it because DELETE is gated by
--       SELECT visibility, but the policy itself must be tenant-safe).
--   H2. cert_student_linkedin_update allowed students to UPDATE any column
--       of their own certificate (title, verification_code, status...).
--   H3. audit_logs INSERT used WITH CHECK (true) — any authenticated user
--       could forge audit entries attributed to other users.
--   H4. weekly_logs_with_names is owned by postgres WITHOUT security_invoker
--       — view queries run with the owner's privileges and BYPASS RLS.
--   H5. Migration 0007 granted anon full DML on public tables (policy layer
--       blocked abuse, but least-privilege demands revocation).
--   H6. signatures/avatars storage read policies included anon — enabling
--       anonymous object enumeration via the storage list API.
-- ============================================================================

-- ============================================================================
-- H1. Tenant-scoped certificate DELETE
-- ============================================================================
DROP POLICY IF EXISTS cert_delete ON public.certificates;
CREATE POLICY cert_delete ON public.certificates
  FOR DELETE TO authenticated
  USING (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'company_hr'::user_role
      AND company_id = internhub.current_company_id()
    )
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND student_user_id IN (
        SELECT s.user_id FROM public.students s
        WHERE s.university_id = internhub.current_university_id()
      )
    )
  );

-- ============================================================================
-- H2. Students may only touch the LinkedIn timestamp on their certificates.
--     RLS cannot restrict columns; a BEFORE UPDATE guard trigger can.
--     Privileged roles (super_admin/company_hr/university_admin/faculty)
--     bypass the guard — their UPDATE policies already scope them.
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.guard_certificate_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role user_role;
BEGIN
  SELECT internhub."current_role"() INTO v_role;

  IF v_role = 'student'::user_role THEN
    IF NEW.title           IS DISTINCT FROM OLD.title
    OR NEW.certificate_number IS DISTINCT FROM OLD.certificate_number
    OR NEW.verification_code IS DISTINCT FROM OLD.verification_code
    OR NEW.status          IS DISTINCT FROM OLD.status
    OR NEW.file_url        IS DISTINCT FROM OLD.file_url
    OR NEW.company_id      IS DISTINCT FROM OLD.company_id
    OR NEW.student_user_id IS DISTINCT FROM OLD.student_user_id
    OR NEW.internship_id   IS DISTINCT FROM OLD.internship_id
    OR NEW.issued_at       IS DISTINCT FROM OLD.issued_at THEN
      RAISE EXCEPTION 'Permission denied: students may only update linkedin fields on their certificate'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_certificate_update ON public.certificates;
CREATE TRIGGER trg_guard_certificate_update
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION internhub.guard_certificate_update();

-- ============================================================================
-- H3. Audit log inserts must be attributable to the acting user.
--     (service_role bypasses RLS entirely, so server-side audit writes
--     still work.)
-- ============================================================================
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- H4. Make the view RLS-respecting.
-- ============================================================================
ALTER VIEW public.weekly_logs_with_names SET (security_invoker = on);

-- ============================================================================
-- H5. Revoke anon DML on public tables (anon keeps SELECT for the public
--     marketplace policies that intentionally TO anon).
-- ============================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', r.table_name);
  END LOOP;
END $$;

-- ============================================================================
-- H6. Stop anonymous storage-object enumeration on personal-asset buckets.
--     Public GETs via /object/public/... do not depend on these policies
--     (they are served directly for public buckets); the app fetches
--     signatures via signed URLs (authenticated) and avatars via public
--     URLs, so dropping anon from the API read policies is safe.
-- ============================================================================
DROP POLICY IF EXISTS signatures_read ON storage.objects;
CREATE POLICY signatures_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'signatures'::text);

DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars'::text);
-- avatars stay anonymously readable (public profile images served over the
-- public URL path anyway); enumeration via the list API is acceptable for
-- avatars because object names are user UUIDs already exposed in profiles.
-- Signatures (handwritten personal data) are the ones that must not be
-- enumerable by anonymous callers.
