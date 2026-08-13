-- 0043_profiles_notification_prefs.sql
--
-- Adds a `notification_prefs` jsonb column to `profiles` so that each
-- user's notification preferences (which categories they want emailed,
-- which they want pushed in-app, do-not-disturb hours, etc.) persist
-- to the database and sync across devices/browsers.
--
-- Background:
--   Before this migration, the three settings pages
--   (university-admin, department-coordinator, company-hr) stored
--   notification preferences in localStorage with role-prefixed keys
--   (`univ_admin_prefs_<uid>`, `coord_prefs_<uid>`,
--   `company_hr_prefs_<uid>`). That meant:
--     1. Prefs didn't sync across devices or browsers.
--     2. Clearing browser data silently wiped the user's choices.
--     3. The three pages each re-implemented the same load/save
--        pattern with slightly different keys (fragile, easy to break).
--
--   This migration introduces a single canonical column. The
--   `src/lib/notification-prefs.ts` helper (added in the same commit)
--   reads/writes it; the three settings pages call that helper.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS keeps re-runs safe.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index for future "who wants email for category X?" queries.
CREATE INDEX IF NOT EXISTS idx_profiles_notification_prefs
  ON profiles USING gin (notification_prefs);

-- RLS note: the existing profiles SELECT/UPDATE policies already
-- cover the new column (a user can read/update their own row, and
-- admins can read/update rows in their tenant scope). No new policy
-- needed.

-- Diagnostic: report current state (will show 0 prefs until users
-- re-save from the settings UI).
SELECT
  COUNT(*) FILTER (WHERE notification_prefs <> '{}'::jsonb) AS users_with_prefs,
  COUNT(*) AS total_profiles
FROM profiles;
