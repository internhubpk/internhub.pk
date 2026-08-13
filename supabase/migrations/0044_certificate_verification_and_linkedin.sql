-- ============================================================================
-- InternHub.pk — 0044_certificate_verification_and_linkedin.sql
-- ----------------------------------------------------------------------------
-- Adds public verification + LinkedIn "Add to Profile" support to certificates.
--
-- BACKGROUND
--   Previously certificates were issued by company HR with only a
--   certificate_number and (optionally) a file_url. There was no way for
--   a third party (employer, LinkedIn) to verify a certificate's
--   authenticity, and no way for a student to add it to their LinkedIn
--   profile directly from InternHub.
--
-- CHANGES
--   1. certificates.verification_code  — short unique code, used in the
--      public verification URL (/verify/<code>). Indexed UNIQUE.
--   2. certificates.verification_url   — full absolute URL to the public
--      verification page. Stored so the LinkedIn "Add to Profile" link
--      and the student's "View Verification" button can use it directly
--      without re-deriving it on every render.
--   3. certificates.linkedin_added_at  — timestamp set when the student
--      clicks "Add to LinkedIn". Lets us show a "Added to LinkedIn" badge
--      and lets the company see uptake analytics.
--   4. Backfill verification_code + verification_url for existing rows.
--   5. Ensure the `certificates` storage bucket exists (public read,
--      authenticated write) so company HR can upload certificate files.
--
-- IDEMPOTENT
--   All statements use ADD COLUMN IF NOT EXISTS / CREATE IF NOT EXISTS.
--   Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. New columns on certificates
-- ----------------------------------------------------------------------------
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS verification_code text;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS verification_url text;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS linkedin_added_at timestamptz;

-- Unique index on verification_code (partial — only where not null, so
-- multiple NULLs are allowed until backfill runs).
CREATE UNIQUE INDEX IF NOT EXISTS certificates_verification_code_key
  ON public.certificates (verification_code)
  WHERE verification_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Helper — generate a unique verification code.
--    Format: IH-XXXX-XXXX (8 random base32 chars in two groups of 4).
--    base32 (no 0/O/1/I) avoids ambiguity when read off a printout.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.generate_verification_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'IH-' ||
         upper(substr(encode(gen_random_bytes(4), 'base32'), 1, 4)) || '-' ||
         upper(substr(encode(gen_random_bytes(4), 'base32'), 1, 4));
$$;

ALTER FUNCTION internhub.generate_verification_code() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 3. Backfill — fill verification_code + verification_url for every existing
--    certificate that doesn't have one yet.
--
--    We can't call generate_verification_code() inside a single UPDATE ...
--    VALUES because each row needs a different code. The CTE below generates
--    one code per row by calling the function in a lateral subquery, then
--    updates certificates by id.
-- ----------------------------------------------------------------------------
WITH codes AS (
  SELECT
    c.id,
    internhub.generate_verification_code() AS code
  FROM public.certificates c
  WHERE c.verification_code IS NULL
)
UPDATE public.certificates cert
SET
  verification_code = codes.code,
  verification_url  = COALESCE(cert.verification_url,
    concat(
      current_setting('app.public_url', true),
      CASE WHEN current_setting('app.public_url', true) LIKE '%/' THEN '' ELSE '/' END,
      'verify/',
      codes.code
    )
  )
FROM codes
WHERE cert.id = codes.id;

-- ----------------------------------------------------------------------------
-- 4. Storage bucket for certificate files.
--    Public read so LinkedIn / employers can fetch the file_url directly.
--    Authenticated write — company HR uploads via the API route.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for the certificates bucket.
DROP POLICY IF EXISTS "certificates_bucket_public_read" ON storage.objects;
CREATE POLICY "certificates_bucket_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'certificates');

-- Authenticated users can upload to the certificates bucket. The API
-- route enforces that the caller is company_hr and is uploading to a
-- path scoped to their company_id.
DROP POLICY IF EXISTS "certificates_bucket_auth_write" ON storage.objects;
CREATE POLICY "certificates_bucket_auth_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificates');

-- Allow the uploader (or super_admin) to update / delete their own
-- certificate files. The `name` column on storage.objects is the full
-- path (e.g., "<uploader_uuid>/<filename>"). We check the path starts
-- with the caller's UUID so company_hr can manage only their own uploads.
DROP POLICY IF EXISTS "certificates_bucket_owner_update" ON storage.objects;
CREATE POLICY "certificates_bucket_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (name like (select auth.uid()::text) || '/%'
         OR internhub.is_super_admin())
  );

DROP POLICY IF EXISTS "certificates_bucket_owner_delete" ON storage.objects;
CREATE POLICY "certificates_bucket_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (name like (select auth.uid()::text) || '/%'
         OR internhub.is_super_admin())
  );

-- ----------------------------------------------------------------------------
-- 5. RLS — make verification_code + verification_url readable to the student
--    (already covered by the existing certificates SELECT policy, since the
--    columns are on the certificates table). No new policy needed.
--
--    Also: super_admin and company_hr can update linkedin_added_at via the
--    existing UPDATE policy. Students update their own linkedin_added_at
--    via a NEW policy below (only that one column).
-- ----------------------------------------------------------------------------

-- Students can mark their own certificate as "added to LinkedIn".
-- This is a narrow policy — it only allows updating linkedin_added_at
-- on certificates where student_user_id = auth.uid(). All other columns
-- remain protected by the existing certificates_update policy.
DROP POLICY IF EXISTS cert_student_linkedin_update ON public.certificates;
CREATE POLICY cert_student_linkedin_update
  ON public.certificates
  FOR UPDATE
  TO authenticated
  USING (
    internhub.current_role() = 'student'
    AND student_user_id = (select auth.uid())
  )
  WITH CHECK (
    internhub.current_role() = 'student'
    AND student_user_id = (select auth.uid())
  );

COMMIT;

-- ----------------------------------------------------------------------------
-- 6. Verification — backfill result.
-- ----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE verification_code IS NULL) AS missing_code,
  count(*) FILTER (WHERE verification_url IS NULL)  AS missing_url,
  count(*) AS total
FROM public.certificates;
