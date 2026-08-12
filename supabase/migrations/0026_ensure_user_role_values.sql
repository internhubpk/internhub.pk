-- ============================================================================
-- InternHub.pk — 0026_ensure_user_role_values.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The `on_auth_user_created` trigger raises
--     ERROR: invalid input value for enum user_role: "site_supervisor"
--   when the company-hr/supervisors API creates a new site supervisor.
--   Supabase Auth surfaces this to the API caller as
--     "Database error creating new user" (HTTP 500 from GoTrue).
--
--   Root cause: migration 0001 declares the `user_role` enum with all 9
--   values but wraps CREATE TYPE in `EXCEPTION WHEN duplicate_object THEN
--   NULL` — so if the type already existed on production (from a legacy
--   deployment that pre-dates 0000_drop_legacy, or because 0000 was
--   commented out to preserve production data), 0001 silently no-ops and
--   NEVER adds the missing values.
--
--   Migration 0006 defensively re-adds only `pending_assignment`. It does
--   NOT re-add `site_supervisor`, `company_hr`, or `external_evaluator`.
--   These three values are referenced in the trigger's CASE assignment
--   (0025 line 73), so any attempt to create a user with one of those
--   roles fails at the enum cast — BEFORE the inner BEGIN...EXCEPTION
--   block (which only wraps the profiles INSERT).
--
-- FIX
--   Defensively ALTER TYPE ADD VALUE IF NOT EXISTS for all 9 user_role
--   values. This is safe to run on any DB state:
--     - If a value exists, it's a no-op.
--     - If a value is missing, it's added.
--   ALTER TYPE ADD VALUE cannot run inside a transaction block in PG <12,
--   but PG 12+ allows it (Supabase is PG 15+). We still avoid wrapping it
--   in BEGIN/COMMIT for safety.
--
-- IDEMPOTENT
--   Each statement uses IF NOT EXISTS. Safe to re-run.
-- ============================================================================

-- Drop legacy enum values first (in case old "admin" / "teacher" / etc. exist
-- from pre-0001 deployments). We do NOT drop the type itself — only clean
-- up obsolete values if present. Note: ALTER TYPE DROP VALUE was added in
-- PG 13 but is irreversible and can break existing rows, so we leave
-- obsolete values alone and only ensure the 9 canonical values exist.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'university_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'department_coordinator';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'faculty_supervisor';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'student';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'company_hr';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'site_supervisor';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'external_evaluator';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'pending_assignment';

-- Also ensure profile_status has all 4 canonical values
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'disabled';

-- And supervisor_type
ALTER TYPE public.supervisor_type ADD VALUE IF NOT EXISTS 'faculty';
ALTER TYPE public.supervisor_type ADD VALUE IF NOT EXISTS 'site';
ALTER TYPE public.supervisor_type ADD VALUE IF NOT EXISTS 'external';

NOTIFY pgrst, 'reload schema';
