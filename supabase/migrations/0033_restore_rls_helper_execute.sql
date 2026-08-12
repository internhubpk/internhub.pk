-- ============================================================================
-- InternHub.pk — 0033_restore_rls_helper_execute.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   Migration 0031 revoked EXECUTE FROM PUBLIC on the internhub.* read-only
--   helper functions (current_university_id, current_company_id, etc.) under
--   the assumption that "RLS policy evaluation can call them regardless of
--   EXECUTE grants (postgres / service_role bypass)". This assumption is
--   FALSE.
--
--   In PostgreSQL, RLS policy expressions are evaluated as the QUERYING USER
--   (the role issuing the SELECT/INSERT/UPDATE/DELETE). The user must have
--   EXECUTE privilege on every function called from the policy expression.
--   SECURITY DEFINER controls *how* the function body executes (as the owner)
--   — it does NOT bypass the privilege check on the call itself.
--
--   As a result, every RLS policy that calls one of these helpers now errors
--   with `permission denied for function current_university_id` for any
--   authenticated user. This breaks every dashboard page because:
--     - `profiles_select` calls `current_university_id()` → profile lookup
--       fails → API returns 404 PROFILE_NOT_FOUND
--     - `internships_select`, `programs_select`, `departments_select`,
--       `student_internships_select`, `supervisors_select`,
--       `intern_supervisor_assignments_select`, `attendance_select`,
--       `evaluations_select`, `weekly_logs_select`, `task_assignments_select`,
--       `task_submissions_select`, `documents_select`, `audit_logs_select`,
--       `certificates_select`, `cv_uploads_select`, `reports_select`,
--       `report_templates_select`, `supervisor_remarks_select`, etc. all
--       call at least one of these helpers.
--     - Storage policies for private buckets also call them, breaking
--       uploads/downloads for authenticated users.
--
-- FIX
--   Restore EXECUTE on the read-only helpers to `authenticated` and `anon`.
--   These functions are:
--     - All SECURITY DEFINER (execute as postgres)
--     - All read-only (only SELECT from auth.users / profiles)
--     - All return the *caller's own* tenant IDs (NULL for anon, real value
--       for authenticated) — they never leak another user's data.
--     - Located in the `internhub` schema which is NOT exposed via the
--       PostgREST Data API, so they cannot be called directly via REST.
--
--   They are ONLY callable from SQL (RLS policy evaluation, triggers, other
--   functions). Granting EXECUTE to anon/authenticated is safe.
--
--   The admin-only functions (assign_role, promote_to_super_admin,
--   promote_to_super_admin_by_email) are intentionally NOT granted — only
--   postgres / service_role can call them (via service-role API routes).
--
--   The can_access_*, is_super_admin, is_company_hr_of helpers already have
--   an explicit authenticated grant from migration 0028 — we additionally
--   grant to anon here for consistency (storage policies evaluated for anon).
--
-- IDEMPOTENT
--   GRANT is idempotent.
-- ============================================================================

BEGIN;

-- ---- Core tenant-ID helpers (used by ~all RLS policies) -----------------
GRANT EXECUTE ON FUNCTION internhub.current_profile() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.current_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.current_university_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.current_department_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.current_company_id() TO authenticated, anon;

-- ---- Boolean role / membership helpers ----------------------------------
GRANT EXECUTE ON FUNCTION internhub.is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.is_company_hr(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.is_company_hr_of(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.is_assigned_supervisor(uuid) TO authenticated, anon;

-- ---- Resource-access helpers (added in 0028) ----------------------------
-- These already had authenticated; also grant anon for storage policies.
GRANT EXECUTE ON FUNCTION internhub.can_access_internship(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.can_access_program(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.can_access_department(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.can_access_university(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.can_access_task(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION internhub.can_access_student(uuid) TO authenticated, anon;

-- ---- Storage helper -----------------------------------------------------
-- Used by storage policies (storage_is_owner returns true if the caller
-- owns the file). Required for private-bucket uploads/downloads.
GRANT EXECUTE ON FUNCTION internhub.storage_is_owner() TO authenticated, anon;

-- ---- public.get_user_* (already granted to authenticated in 0031) -------
-- These are NOT called by any RLS policy or storage policy (the internhub.*
-- helpers are used instead). They are kept only for backward-compat as
-- PostgREST RPC endpoints and are not invoked by the app at all (verified
-- via grep). Anon does not need EXECUTE — leave anon revoked (per 0032).

COMMIT;

NOTIFY pgrst, 'reload schema';
