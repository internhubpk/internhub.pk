-- ============================================================================
-- InternHub.pk — 0000 Drop Legacy Schema
-- ----------------------------------------------------------------------------
-- This migration drops any pre-existing tables from earlier, incompatible
-- versions of the InternHub schema. It is safe to run on:
--   * Supabase Preview databases (which are ephemeral and rebuilt from
--     production; if production is empty, this is a no-op).
--   * A brand-new Supabase project (no-op — DROP TABLE IF EXISTS).
--
-- It is DESTRUCTIVE on a database that already contains real production data
-- from a previous schema version. If you are running this against a
-- production database with real data, COMMENT OUT this file in
-- `supabase/migrations/` and instead write a data-preserving migration.
--
-- Why this exists:
--   Earlier commits defined a `profiles` table with `status text` (not the
--   `profile_status` enum), an `internships` table with `is_remote`/`skills`/
--   `vacancies` columns (since renamed to `remote`/`required_skills`/
--   `max_applicants`), and several other schema differences. When the new
--   migration runs against such a database, `CREATE TABLE IF NOT EXISTS`
--   silently no-ops and subsequent `CREATE INDEX` statements fail with
--   "column X does not exist". Dropping the legacy tables here lets
--   `0001_initial_schema.sql` create them fresh.
-- ============================================================================

-- Drop in dependency-safe order (children first, parents last).
DROP TABLE IF EXISTS public.supervisor_remarks          CASCADE;
DROP TABLE IF EXISTS public.reports                     CASCADE;
DROP TABLE IF EXISTS public.report_templates            CASCADE;
DROP TABLE IF EXISTS public.subscriptions               CASCADE;
DROP TABLE IF EXISTS public.licenses                    CASCADE;
DROP TABLE IF EXISTS public.storage_allocations         CASCADE;
DROP TABLE IF EXISTS public.platform_settings           CASCADE;
DROP TABLE IF EXISTS public.audit_logs                  CASCADE;
DROP TABLE IF EXISTS public.messages                    CASCADE;
DROP TABLE IF EXISTS public.online_meetings             CASCADE;
DROP TABLE IF EXISTS public.notifications               CASCADE;
DROP TABLE IF EXISTS public.cv_uploads                  CASCADE;
DROP TABLE IF EXISTS public.documents                   CASCADE;
DROP TABLE IF EXISTS public.certificates                CASCADE;
DROP TABLE IF EXISTS public.attendance                  CASCADE;
DROP TABLE IF EXISTS public.evaluations                 CASCADE;
DROP TABLE IF EXISTS public.weekly_logs                 CASCADE;
DROP TABLE IF EXISTS public.task_attachments            CASCADE;
DROP TABLE IF EXISTS public.task_submissions            CASCADE;
DROP TABLE IF EXISTS public.task_assignments            CASCADE;
DROP TABLE IF EXISTS public.tasks                       CASCADE;
DROP TABLE IF EXISTS public.intern_supervisor_assignments CASCADE;
DROP TABLE IF EXISTS public.student_internships         CASCADE;
DROP TABLE IF EXISTS public.internship_applications     CASCADE;
DROP TABLE IF EXISTS public.applications                CASCADE;  -- legacy alias
DROP TABLE IF EXISTS public.internships                 CASCADE;
DROP TABLE IF EXISTS public.company_users               CASCADE;
DROP TABLE IF EXISTS public.site_supervisors            CASCADE;  -- legacy alias
DROP TABLE IF EXISTS public.supervisors                 CASCADE;
DROP TABLE IF EXISTS public.external_evaluators         CASCADE;  -- legacy
DROP TABLE IF EXISTS public.students                    CASCADE;
DROP TABLE IF EXISTS public.profiles                    CASCADE;
DROP TABLE IF EXISTS public.companies                   CASCADE;
DROP TABLE IF EXISTS public.host_organizations          CASCADE;  -- legacy alias
DROP TABLE IF EXISTS public.programs                    CASCADE;
DROP TABLE IF EXISTS public.departments                 CASCADE;
DROP TABLE IF EXISTS public.universities                CASCADE;

-- Legacy enum types from older schemas (only drop if they exist).
-- The new schema recreates them in 0001_initial_schema.sql with the same
-- names, so we use DROP TYPE IF EXISTS to clear any incompatible definitions.
-- Note: DROP TYPE will fail if any table column still uses it, but we've
-- already dropped all tables above, so this is safe.
DO $$ BEGIN
  DROP TYPE IF EXISTS public.user_role                 CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.internship_status         CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.application_status        CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.evaluation_type           CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.evaluation_status         CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.weekly_log_status         CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.document_type             CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.document_status           CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.attendance_status         CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.message_type              CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.notification_category     CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.notification_priority     CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.supervisor_type           CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.student_internship_status CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.license_tier              CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.task_status               CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.task_submission_status    CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.certificate_status        CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.profile_status            CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Drop legacy triggers and functions if they exist.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.internhub_handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_legacy() CASCADE;
