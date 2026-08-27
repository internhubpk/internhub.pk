-- 0101_certificate_verification_domain_force_careerstep.sql
--
-- BACKGROUND
-- ----------
-- Despite migrations 0093/0094 rewriting historical legacy-domain
-- (xirea.tech) certificate URLs, a certificate uploaded on 2026-08-27 was
-- STILL issued with `https://xirea.tech/verify/IH-K5FJ-XSR7`.
--
-- ROOT CAUSE
-- ----------
-- src/lib/site-url.ts `getCanonicalBaseUrl()` resolved
-- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` FIRST — and the production
-- deployment still has the legacy domain set in those generic vars. So every
-- freshly generated verification URL inherited the legacy domain, no matter
-- what the hardcoded platform default was.
--
-- FIX (code, in src/lib/site-url.ts)
-- ----------------------------------
-- Verification URLs now use a DEDICATED base:
--   NEXT_PUBLIC_CERTIFICATES_BASE_URL  (explicit override, if ever needed)
--   → else ALWAYS "https://careerstep.tech"
-- They no longer read the generic site env vars at all.
--
-- FIX (this migration)
-- --------------------
-- Backfill: rebuild every `verification_url` that is not already on
-- careerstep.tech from its (immutable) `verification_code`. Idempotent.

-- Rebuild verification_url from verification_code for any row whose stored
-- URL does not point at the canonical platform domain.
UPDATE certificates
SET verification_url = 'https://careerstep.tech/verify/' || verification_code,
    updated_at = now()
WHERE verification_code IS NOT NULL
  AND verification_code <> ''
  AND (
    verification_url IS NULL
    OR verification_url NOT ILIKE 'https://careerstep.tech/verify/%'
  );

-- Sanity report: how many rows (should be 0) still carry a legacy domain.
DO $$
DECLARE
  stale_count integer;
BEGIN
  SELECT count(*) INTO stale_count
  FROM certificates
  WHERE verification_url ILIKE '%xirea.tech%'
     OR verification_url ILIKE '%vercel.app%';
  IF stale_count > 0 THEN
    RAISE NOTICE 'WARNING: % certificate rows still carry a legacy domain', stale_count;
  ELSE
    RAISE NOTICE 'OK: no certificate rows carry a legacy domain';
  END IF;
END $$;
