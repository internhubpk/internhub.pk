-- 0055_fix_avatar_storage_and_notifications.sql
-- =============================================================================
-- InternHub — Fix avatar Storage path/RLS + notification schema improvements.
--
-- BACKGROUND
--   Avatar uploads were failing with:
--     StorageApiError: new row violates row-level security policy
--     URL: /storage/v1/object/avatars/avatars/avatar_<uid>_<ts>.jpg
--
--   Root causes (verified against production):
--     1. The client code constructed `filePath = 'avatars/${fileName}'` and
--        then called `.from('avatars').upload(filePath, ...)`. The Supabase
--        SDK treats `filePath` as a path RELATIVE TO the bucket root, so the
--        bucket id is prepended again when constructing the URL →
--        `avatars/avatars/avatar_...` (duplicate bucket name).
--     2. The `avatars_insert` WITH CHECK requires
--        `(storage.foldername(name))[1] = auth.uid()::text`. With the
--        duplicate path, the first folder is the literal string `'avatars'`,
--        not the user's UUID — so the check is always FALSE and INSERT is
--        denied.
--     3. The `avatars` bucket is `public = false` but the client uses
--        `getPublicUrl()` which returns a URL that only works for public
--        buckets. For a private bucket, the URL returns 400/error when
--        accessed without a signed token.
--     4. The bucket `file_size_limit` is 2 MB but the client validates at
--        5 MB — a 3-5 MB image passes client validation but fails the
--        bucket limit.
--
-- FIX
--   1. Make the `avatars` bucket PUBLIC — profile pictures are meant to be
--      seen by other users (supervisors, admins, peers). This aligns with
--      `getPublicUrl()` usage. Writes remain restricted by RLS.
--   2. Raise the `file_size_limit` to 5 MB to match client-side validation.
--   3. Add `image/jpg` to allowed_mime_types (some browsers report JPG as
--      `image/jpg` rather than `image/jpeg`).
--   4. Recreate the Storage RLS policies to use the correct path convention
--      `{user_id}/filename`. The policies are:
--        - SELECT: anyone can read (public bucket)
--        - INSERT: owner only (foldername = auth.uid())
--        - UPDATE: owner only (foldername = auth.uid())
--        - DELETE: owner only (foldername = auth.uid())
--
--   The client code will be updated separately to use `filePath = '${user.id}/${fileName}'`.
--
-- NOTIFICATION IMPROVEMENTS
--   The `notifications` table currently has:
--     - `category` (notification_category enum)
--     - `metadata` (jsonb)
--     - `is_read` (boolean)
--   But some code paths use `type`, `data`, `read` which don't exist.
--   We add helper columns for cleaner display:
--     - `action_url` (text) — for click-to-navigate
--     - `actor_user_id` (uuid) — who triggered the notification
--   And ensure the existing columns are properly indexed.
--
-- IDEMPOTENT
--   All statements use IF NOT EXISTS / DROP-then-CREATE so the migration
--   can be re-run safely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AVATAR BUCKET — make public, raise size limit, add image/jpg
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,  -- 5 MB
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
WHERE id = 'avatars';

-- -----------------------------------------------------------------------------
-- 2. STORAGE RLS POLICIES for the `avatars` bucket.
--    Path convention: `{user_id}/filename`
--    So (storage.foldername(name))[1] = the user's UUID.
-- -----------------------------------------------------------------------------

-- DROP existing avatar policies (idempotent)
DROP POLICY IF EXISTS avatars_read ON storage.objects;
DROP POLICY IF EXISTS avatars_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_update ON storage.objects;
DROP POLICY IF EXISTS avatars_delete ON storage.objects;

-- SELECT — anyone can read (public bucket). This is required for
-- getPublicUrl() to work.
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'avatars');

-- INSERT — owner only. The first path segment must be the user's UUID.
CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- UPDATE — owner only.
CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- DELETE — owner only.
CREATE POLICY avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- -----------------------------------------------------------------------------
-- 3. NOTIFICATIONS TABLE — add action_url and actor_user_id columns
--    for richer notification display and click-to-navigate.
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for efficient "unread count" queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;

-- Index for efficient "recent notifications" queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Reload PostgREST schema cache so the new policies take effect immediately.
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION 0055
-- =============================================================================
