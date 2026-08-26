-- ============================================================================
-- 0096_internship_images_student_logo_upload.sql
--
-- Problem: the weekly-log university-logo upload route
-- (POST /api/student/weekly-logs/[id]/logo) stores the student's chosen
-- logo in the PUBLIC `internship_images` bucket so the Word report
-- generator can fetch it later. But the bucket's INSERT policy only
-- allowed company_hr (owning company prefix) and super_admin — students
-- were blocked with "new row violates row-level security policy".
--
-- Fix: allow ANY authenticated user to INSERT/UPDATE objects in
-- `internship_images` under their OWN user_id prefix
-- (`internship_images/<auth.uid>/...`), mirroring the `signatures` and
-- `documents` bucket conventions. This is scoped:
--   * the first path segment MUST equal the caller's auth.uid()
--   * existing company_hr / super_admin policies are untouched
--   * the bucket is public (reads were already open), so no SELECT policy
--     is needed.
-- =============================================================================

-- INSERT: any authenticated user may upload under their own <user_id>/ prefix.
DROP POLICY IF EXISTS "internship_images_insert_own_prefix" ON storage.objects;
CREATE POLICY "internship_images_insert_own_prefix" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'internship_images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- UPDATE: same scoping for upserts of the caller's own objects.
DROP POLICY IF EXISTS "internship_images_update_own_prefix" ON storage.objects;
CREATE POLICY "internship_images_update_own_prefix" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'internship_images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'internship_images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

COMMENT ON POLICY "internship_images_insert_own_prefix" ON storage.objects IS
  'Any authenticated user may upload to internship_images under their own <user_id>/ prefix (weekly-log university logos, etc.).';
