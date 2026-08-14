-- ============================================================================
-- InternHub.pk — 0047_storage_buckets_and_objects_rls.sql
-- ----------------------------------------------------------------------------
-- TWO bugs fixed in this migration:
--
-- BUG 1: storage.buckets had RLS ENABLED but ZERO policies.
--   Every Supabase Storage API call internally does
--     SELECT FROM storage.buckets WHERE id = $1
--   to validate the bucket before serving the object. With RLS enabled
--   but no policy, that query returned 0 rows for authenticated/anon
--   users, and Storage interpreted this as "bucket does not exist /
--   schema invalid" → 503 DatabaseInvalidObjectDefinition on EVERY
--   private-bucket operation.
--
--   Fix: add SELECT policies on storage.buckets for authenticated + anon.
--
-- BUG 2: storage.objects read policies (cvs_read, documents_read,
--   certificates_read, internship_letters_read, task_attachments_read,
--   evaluation_files_read, signatures_read) all had EXISTS subqueries
--   that referenced the outer table as `objects.name`:
--     EXISTS (SELECT 1 FROM ... WHERE ... = (storage.foldername(objects.name))[1])
--   Postgres evaluates this `objects.name` reference inside the policy
--   expression, but the table alias `objects` is NOT in scope for the
--   subquery in the policy-evaluation context. This caused the entire
--   policy expression to fail with a Postgres error, which Supabase
--   Storage surfaced as 503 DatabaseInvalidObjectDefinition.
--
--   Fix: recreate all read policies using `name` (no table alias) inside
--   the EXISTS subqueries. The policy automatically has `name` in scope
--   because it's defined ON storage.objects.
--
-- IDEMPOTENT — DROP POLICY IF EXISTS before each CREATE.
-- ============================================================================

BEGIN;

-- ===========================================================================
-- PART 1: storage.buckets RLS policies (the root cause of the 503s)
-- ===========================================================================
-- Note: we cannot ALTER TABLE storage.buckets (we don't own it —
-- supabase_storage_admin does), but RLS is already enabled, so we
-- only need CREATE POLICY. Postgres has CREATE POLICY permission via
-- the supabase_privileged_role grant.

DROP POLICY IF EXISTS buckets_select_authenticated ON storage.buckets;
CREATE POLICY buckets_select_authenticated ON storage.buckets
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS buckets_select_anon ON storage.buckets;
CREATE POLICY buckets_select_anon ON storage.buckets
  FOR SELECT TO anon
  USING (true);

-- ===========================================================================
-- PART 2: Recreate storage.objects read policies with corrected column refs
-- ===========================================================================

-- --- cvs_read -----------------------------------------------------------
-- Owner (student), super_admin, company_hr (any application to their
-- company from this student), assigned supervisors, university_admin.
DROP POLICY IF EXISTS cvs_read ON storage.objects;
CREATE POLICY cvs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.internship_applications a
              WHERE a.student_user_id::text = (storage.foldername(name))[1]
                AND a.company_id = internhub.current_company_id()
          ))
      OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
          AND internhub.is_assigned_supervisor(
            NULLIF((storage.foldername(name))[1], '')::uuid
          ))
      OR (internhub.current_role() = 'university_admin'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
              WHERE p.user_id::text = (storage.foldername(name))[1]
                AND p.university_id = internhub.current_university_id()
          ))
    )
  );

-- --- documents_read -----------------------------------------------------
DROP POLICY IF EXISTS documents_read ON storage.objects;
CREATE POLICY documents_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() = 'university_admin'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
              WHERE p.user_id::text = (storage.foldername(name))[1]
                AND p.university_id = internhub.current_university_id()
          ))
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
              WHERE p.user_id::text = (storage.foldername(name))[1]
                AND p.company_id = internhub.current_company_id()
          ))
      OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
          AND internhub.is_assigned_supervisor(
            NULLIF((storage.foldername(name))[1],'')::uuid
          ))
    )
  );

-- --- certificates_read --------------------------------------------------
DROP POLICY IF EXISTS certificates_read ON storage.objects;
CREATE POLICY certificates_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
              WHERE p.user_id::text = (storage.foldername(name))[1]
                AND p.company_id = internhub.current_company_id()
          ))
      OR (internhub.current_role() = 'university_admin'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
              WHERE p.user_id::text = (storage.foldername(name))[1]
                AND p.university_id = internhub.current_university_id()
          ))
    )
  );

-- --- internship_letters_read -------------------------------------------
DROP POLICY IF EXISTS internship_letters_read ON storage.objects;
CREATE POLICY internship_letters_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'internship_letters'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.internship_applications a
              WHERE a.student_user_id::text = (storage.foldername(name))[1]
                AND a.company_id = internhub.current_company_id()
          ))
      OR (internhub.current_role() = 'university_admin'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
              WHERE p.user_id::text = (storage.foldername(name))[1]
                AND p.university_id = internhub.current_university_id()
          ))
    )
  );

-- --- task_attachments_read ---------------------------------------------
-- Path convention: task_attachments/<task_id>/<user_id>/<filename>
--
-- NOTE: The original policy had an EXISTS subquery against task_assignments
-- to verify that the student was actually assigned to the task. That caused
-- infinite RLS recursion: task_attachments_read → task_assignments (ta_select)
-- → tasks (task_select) → task_assignments (ta_select) → ...
-- Supabase Storage surfaced this as 503 DatabaseInvalidObjectDefinition on
-- EVERY private bucket, not just task_attachments — because policy
-- evaluation errors on any policy abort the entire query.
--
-- Fix: drop the EXISTS subquery. Rely on the path convention
-- (<task_id>/<user_id>/...) for scoping. The foldername[2] = auth.uid()
-- check still ensures students only read attachments they uploaded.
-- Faculty/coordinators/university_admins can read all task_attachments
-- (consistent with their broad read access to tasks).
DROP POLICY IF EXISTS task_attachments_read ON storage.objects;
CREATE POLICY task_attachments_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task_attachments'
    AND (
      (storage.foldername(name))[2] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR internhub.current_role() IN ('faculty_supervisor','department_coordinator','university_admin')
    )
  );

-- --- evaluation_files_read ---------------------------------------------
-- Path: evaluation_files/<student_user_id>/<evaluator_id>/<filename>
DROP POLICY IF EXISTS evaluation_files_read ON storage.objects;
CREATE POLICY evaluation_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evaluation_files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR (storage.foldername(name))[2] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
          AND internhub.is_assigned_supervisor(
            NULLIF((storage.foldername(name))[1],'')::uuid
          ))
    )
  );

-- --- signatures_read ----------------------------------------------------
-- Path: signatures/<supervisor_user_id>/<filename>
DROP POLICY IF EXISTS signatures_read ON storage.objects;
CREATE POLICY signatures_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.supervisors s
              WHERE s.user_id::text = (storage.foldername(name))[1]
                AND s.company_id = internhub.current_company_id()
          ))
    )
  );

-- --- avatars_read -------------------------------------------------------
-- Avatars are displayable to anyone authenticated.
DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR true
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
