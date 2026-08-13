-- ============================================================================
-- InternHub.pk — 0037_internship_images.sql
-- ----------------------------------------------------------------------------
-- Adds cover/banner image support to internship posts.
--
-- Two changes:
--
-- 1. New `image_url` column on `public.internships`.
--    Holds the Supabase Storage public URL of the internship's banner image
--    (an "ad" image, like a LinkedIn job banner or OpenGraph image). NULL
--    means no image was uploaded — UI falls back to a gradient placeholder.
--
-- 2. New PUBLIC storage bucket `internship_images` + RLS policies.
--    Public so the marketplace (which non-authenticated visitors can browse)
--    can render the banners without signed URLs. Writes are scoped to
--    company_hr (only their own company_id prefix) + super_admin.
--
-- Path convention: `internship_images/<company_id>/<internship_id_or_drafts>/<filename>`
--   - For edits to an existing internship:  <company_id>/<internship_id>/<ts>_<file>
--   - For new-creation uploads (no id yet): <company_id>/drafts/<ts>_<file>
--   The URL stored on internships.image_url is the public URL Supabase
--   generates from the path. The drafts/ prefix is harmless — once the
--   internship is created, the URL is just a string on the row.
--
-- IDEMPOTENT
--   All statements use IF NOT EXISTS / DROP POLICY IF EXISTS /
--   CREATE OR REPLACE. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Add image_url column to internships
-- ----------------------------------------------------------------------------
ALTER TABLE public.internships
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.internships.image_url IS
  'Public Supabase Storage URL of the internship banner/cover image. NULL when no image was uploaded.';

-- ----------------------------------------------------------------------------
-- 2. Create PUBLIC storage bucket for internship banner images
-- ----------------------------------------------------------------------------
-- Public so unauthenticated marketplace visitors can load the images.
-- 5 MB limit, png/jpeg/webp only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'internship_images',
  'internship_images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 3. Storage RLS policies for internship_images bucket
-- ----------------------------------------------------------------------------
-- Public bucket → SELECT is open by default (no policy needed for reads).
-- INSERT/UPDATE/DELETE: only company_hr (owning company prefix) or super_admin.
--
-- Path convention: `internship_images/<company_id>/...`
-- (storage.foldername(name))[1] is the company_id segment.

-- INSERT: company_hr must own the company_id prefix; super_admin can write anywhere.
DROP POLICY IF EXISTS "internship_images_insert" ON storage.objects;
CREATE POLICY "internship_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'internship_images'
    AND (
      internhub.current_role() = 'super_admin'
      OR (
        internhub.current_role() = 'company_hr'
        AND (storage.foldername(name))[1] = internhub.current_company_id()::text
      )
    )
  );

-- UPDATE: company_hr can replace/delete files in their own company prefix.
DROP POLICY IF EXISTS "internship_images_update" ON storage.objects;
CREATE POLICY "internship_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'internship_images'
    AND (
      internhub.current_role() = 'super_admin'
      OR (
        internhub.current_role() = 'company_hr'
        AND (storage.foldername(name))[1] = internhub.current_company_id()::text
      )
    )
  )
  WITH CHECK (
    bucket_id = 'internship_images'
    AND (
      internhub.current_role() = 'super_admin'
      OR (
        internhub.current_role() = 'company_hr'
        AND (storage.foldername(name))[1] = internhub.current_company_id()::text
      )
    )
  );

-- DELETE: company_hr can delete files in their own company prefix; super_admin anywhere.
DROP POLICY IF EXISTS "internship_images_delete" ON storage.objects;
CREATE POLICY "internship_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'internship_images'
    AND (
      internhub.current_role() = 'super_admin'
      OR (
        internhub.current_role() = 'company_hr'
        AND (storage.foldername(name))[1] = internhub.current_company_id()::text
      )
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
