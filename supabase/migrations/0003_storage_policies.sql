-- ============================================================================
-- InternHub.pk — Supabase Storage Migration
-- ----------------------------------------------------------------------------
-- Creates private storage buckets for the platform and RLS policies that
-- enforce the same authorization hierarchy as the database.
--
-- Buckets:
--   cvs               — student CVs
--   task_attachments  — files uploaded against tasks (by either student or supervisor)
--   internship_letters — offer/acceptance letters issued by companies
--   certificates      — completion certificates
--   evaluation_files  — supporting documents for evaluations
--   signatures        — supervisor digital signatures
--   documents         — general documents bucket (avatar, transcript, etc.)
--   avatars           — user avatar images
--
-- All buckets are PRIVATE. No public reads. Storage policies verify that the
-- requester is the owner or is otherwise authorized via the same helper
-- functions used by the database RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Create buckets (idempotent)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cvs', 'cvs', false, 5242880, ARRAY['application/pdf','application/msword','application/vnd.open-pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('task_attachments', 'task_attachments', false, 10485760, ARRAY['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('internship_letters', 'internship_letters', false, 5242880, ARRAY['application/pdf']),
  ('certificates', 'certificates', false, 5242880, ARRAY['application/pdf','image/png','image/jpeg']),
  ('evaluation_files', 'evaluation_files', false, 5242880, ARRAY['application/pdf','image/png','image/jpeg','text/plain']),
  ('signatures', 'signatures', false, 1048576, ARRAY['image/png','image/jpeg']),
  ('documents', 'documents', false, 10485760, ARRAY['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('avatars', 'avatars', false, 2097152, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1. Helper functions for storage policies
-- ----------------------------------------------------------------------------
-- Storage RLS policies run with auth.uid() available; we re-use the helpers
-- from the internhub schema. They are SECURITY DEFINER so the policy
-- evaluation works without needing to grant direct access to underlying
-- tables.

-- Return TRUE if the auth.uid() is the owner of the path's user_id prefix.
-- Path convention for user-owned files: `<user_id>/...`
CREATE OR REPLACE FUNCTION internhub.storage_is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (storage.foldername(name))[1] = (select auth.uid())::text,
    false
  ) FROM storage.objects WHERE storage.objects.id = (select storage.objects.id);
$$;

-- Simpler: pattern-matched policies below inline the ownership check.

-- ----------------------------------------------------------------------------
-- 2. CVs bucket — student owns, supervisor/HR can read
-- ----------------------------------------------------------------------------
-- Storage object convention: `cvs/<student_user_id>/<filename>`

DROP POLICY IF EXISTS "cvs_read" ON storage.objects;
CREATE POLICY "cvs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (
      -- Owner reads own CV
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      -- HR can read CVs of students who applied to their company
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.internship_applications a
              WHERE a.student_user_id::text = (storage.foldername(name))[1]
                AND a.company_id = internhub.current_company_id()
          ))
      -- Assigned supervisors can read CV
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

DROP POLICY IF EXISTS "cvs_insert" ON storage.objects;
CREATE POLICY "cvs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND internhub.current_role() IN ('student','super_admin')
  );

DROP POLICY IF EXISTS "cvs_update" ON storage.objects;
CREATE POLICY "cvs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "cvs_delete" ON storage.objects;
CREATE POLICY "cvs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Avatars bucket — owner owns
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR true -- avatars are displayable to anyone authenticated (directory)
    )
  );

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ----------------------------------------------------------------------------
-- 4. Task attachments — supervisor/owner can write; assignee can read
-- ----------------------------------------------------------------------------
-- Path: `task_attachments/<task_id>/<user_id>/<filename>`
DROP POLICY IF EXISTS "task_attachments_read" ON storage.objects;
CREATE POLICY "task_attachments_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task_attachments'
    AND (
      (storage.foldername(name))[2] = (select auth.uid())::text  -- uploader
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() = 'student'
          AND EXISTS (
            SELECT 1 FROM public.task_assignments ta
              WHERE ta.task_id::text = (storage.foldername(name))[1]
                AND ta.student_user_id = (select auth.uid())
          ))
      OR (internhub.current_role() IN ('faculty_supervisor','department_coordinator','university_admin'))
    )
  );

DROP POLICY IF EXISTS "task_attachments_insert" ON storage.objects;
CREATE POLICY "task_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task_attachments'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;
CREATE POLICY "task_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task_attachments'
    AND (
      (storage.foldername(name))[2] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Internship letters & Certificates — HR writes; student reads own
-- ----------------------------------------------------------------------------
-- Path: `internship_letters/<student_user_id>/<filename>`
DROP POLICY IF EXISTS "internship_letters_read" ON storage.objects;
CREATE POLICY "internship_letters_read" ON storage.objects
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

DROP POLICY IF EXISTS "internship_letters_insert" ON storage.objects;
CREATE POLICY "internship_letters_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'internship_letters'
    AND internhub.current_role() IN ('super_admin','company_hr','university_admin')
  );

DROP POLICY IF EXISTS "internship_letters_delete" ON storage.objects;
CREATE POLICY "internship_letters_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'internship_letters'
    AND internhub.current_role() IN ('super_admin','company_hr')
  );

-- Path: `certificates/<student_user_id>/<filename>`
DROP POLICY IF EXISTS "certificates_read" ON storage.objects;
CREATE POLICY "certificates_read" ON storage.objects
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

DROP POLICY IF EXISTS "certificates_insert" ON storage.objects;
CREATE POLICY "certificates_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certificates'
    AND internhub.current_role() IN ('super_admin','company_hr','university_admin')
  );

DROP POLICY IF EXISTS "certificates_delete" ON storage.objects;
CREATE POLICY "certificates_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'certificates'
    AND internhub.current_role() IN ('super_admin','company_hr','university_admin')
  );

-- ----------------------------------------------------------------------------
-- 6. Evaluation files — supervisor writes; student reads own
-- ----------------------------------------------------------------------------
-- Path: `evaluation_files/<student_user_id>/<evaluator_id>/<filename>`
DROP POLICY IF EXISTS "evaluation_files_read" ON storage.objects;
CREATE POLICY "evaluation_files_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evaluation_files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text  -- student
      OR (storage.foldername(name))[2] = (select auth.uid())::text  -- evaluator
      OR internhub.current_role() = 'super_admin'
      OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
          AND internhub.is_assigned_supervisor(NULLIF((storage.foldername(name))[1],'')::uuid))
    )
  );

DROP POLICY IF EXISTS "evaluation_files_insert" ON storage.objects;
CREATE POLICY "evaluation_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evaluation_files'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "evaluation_files_delete" ON storage.objects;
CREATE POLICY "evaluation_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'evaluation_files'
    AND (
      (storage.foldername(name))[2] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Signatures — owner owns; verified by HR/super_admin
-- ----------------------------------------------------------------------------
-- Path: `signatures/<supervisor_user_id>/<filename>`
DROP POLICY IF EXISTS "signatures_read" ON storage.objects;
CREATE POLICY "signatures_read" ON storage.objects
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

DROP POLICY IF EXISTS "signatures_insert" ON storage.objects;
CREATE POLICY "signatures_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND internhub.current_role() IN ('site_supervisor','faculty_supervisor','external_evaluator','company_hr','super_admin')
  );

DROP POLICY IF EXISTS "signatures_update" ON storage.objects;
CREATE POLICY "signatures_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "signatures_delete" ON storage.objects;
CREATE POLICY "signatures_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Documents (general) — owner owns
-- ----------------------------------------------------------------------------
-- Path: `documents/<user_id>/<filename>` (for owner-scoped files)
DROP POLICY IF EXISTS "documents_read" ON storage.objects;
CREATE POLICY "documents_read" ON storage.objects
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
          AND internhub.is_assigned_supervisor(NULLIF((storage.foldername(name))[1],'')::uuid))
    )
  );

DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
CREATE POLICY "documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "documents_update" ON storage.objects;
CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
    )
  );

-- ============================================================================
-- End of 0003_storage_policies.sql
-- ============================================================================
