-- 0056_backfill_null_eval_ratings.sql
--
-- Backfill historical evaluations with rating = NULL → rating = 0.
--
-- Background: the POST /api/site-supervisor/evaluations/daily endpoint
-- previously stored `rating = NULL` when the caller omitted the `rating`
-- field from the request body. The student evaluations page renders NULL
-- ratings as "—", making it look like the evaluation has no rating at
-- all (the user reported this as the "Daily evaluation data from the
-- actual SITE SUPERVISOR is missing and displays '-' instead of the
-- real evaluation" bug).
--
-- The endpoint has been patched to default rating to 0 when omitted
-- (consistent with the non-daily /api/site-supervisor/evaluations route
-- which already defaulted to 0). This migration backfills the existing
-- NULL rows so the historical evaluations also display correctly.
--
-- Safety:
--   - Only touches rows where rating IS NULL.
--   - Sets rating = 0 (the minimum value allowed by the CHECK constraint
--     rating BETWEEN 0 AND 5).
--   - Idempotent: running it twice is a no-op the second time.
--   - Does NOT touch scores, comments, status, or any other column.
--
-- After this migration, the student evaluations page will show all
-- historical site-supervisor daily/weekly evaluations with their actual
-- rating (0 if the supervisor skipped the overall rating, otherwise the
-- 0-5 value they entered).

UPDATE public.evaluations
SET rating = 0,
    updated_at = NOW()
WHERE rating IS NULL;

-- Diagnostic: verify no NULL ratings remain.
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT COUNT(*) INTO null_count FROM public.evaluations WHERE rating IS NULL;
  IF null_count > 0 THEN
    RAISE NOTICE 'WARNING: % evaluations still have NULL rating after backfill.', null_count;
  ELSE
    RAISE NOTICE 'OK: all evaluations have a non-NULL rating.';
  END IF;
END $$;
