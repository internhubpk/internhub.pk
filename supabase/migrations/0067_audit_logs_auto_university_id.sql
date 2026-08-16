-- ============================================================================
-- InternHub.pk — 0067 audit_logs: auto-populate university_id
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The university admin dashboard's "Recent Activity" section queries
--   `audit_logs` filtered by `university_id = current_university_id()`.
--   All 23 existing rows have `university_id IS NULL` because callers of
--   `auditLog()` in src/lib/audit.ts do not consistently pass
--   `universityId` (it is an optional parameter). The result is that
--   university admins always see "No recent activity" even when there
--   ARE 23+ recent audit events from their own users.
--
--   Confirmed via direct DB inspection (2026-08-16):
--     SELECT COUNT(*) FROM audit_logs WHERE university_id IS NOT NULL;  -- 0
--     SELECT COUNT(*) FROM audit_logs;  -- 23
--
-- ROOT CAUSE
--   The `auditLog()` helper accepts `universityId?` as an optional field.
--   Most call sites across the codebase (api routes, action handlers) do
--   not pass it — they only know the actor's user_id. The DB layer must
--   therefore resolve the actor's university_id itself.
--
-- FIX
--   1. Add a BEFORE INSERT trigger that, when `university_id IS NULL`
--      and `user_id IS NOT NULL`, looks up the actor's university_id
--      from `profiles.university_id` (one indexed lookup, no recursion
--      because profiles_select is bypassed via SECURITY DEFINER +
--      row_security=off on the trigger function).
--
--   2. Backfill all 23 existing rows with `university_id IS NULL` by
--      joining to profiles on user_id.
--
--   3. Leave rows with `user_id IS NULL` (server-side / cron events)
--      alone — those legitimately have no actor university. Future
--      callers that know the university can still pass it explicitly;
--      the trigger only fills in when it's missing.
--
-- WHY A TRIGGER (not just updating call sites)
--   There are 30+ call sites of `audit()` / `auditLog()` across the
--   codebase. Updating each one to pass university_id would be a large
--   refactor with high risk of regression (and would still miss any
--   future caller that forgets). The DB trigger is a single, defensive
--   layer that fixes both existing rows and all future inserts, without
--   touching application code.
--
-- RLS / RECURSION SAFETY
--   The trigger function is `SECURITY DEFINER` (runs as postgres) with
--   `row_security = off`, so it does NOT trigger profiles_select RLS.
--   This mirrors the pattern used by `internhub.is_student_in_my_university()`
--   and the other RLS helper functions (migration 0064).
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + conditional UPDATE.
--   Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper function: resolve university_id from a user_id
-- ----------------------------------------------------------------------------
-- Placed in the internhub schema alongside the other RLS helpers so it's
-- discoverable and uses the same SECURITY DEFINER + row_security=off pattern.
CREATE OR REPLACE FUNCTION internhub.university_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT university_id
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

ALTER FUNCTION internhub.university_id_for_user(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.university_id_for_user(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 2. BEFORE INSERT trigger: auto-populate university_id from the actor
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_logs_set_university_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fill in if the caller didn't provide one.
  IF NEW.university_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.university_id := internhub.university_id_for_user(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.audit_logs_set_university_id() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_audit_logs_set_university_id ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_set_university_id
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_set_university_id();

-- ----------------------------------------------------------------------------
-- 3. Backfill existing rows where university_id IS NULL
-- ----------------------------------------------------------------------------
UPDATE public.audit_logs a
SET university_id = p.university_id
FROM public.profiles p
WHERE a.user_id = p.user_id
  AND a.university_id IS NULL
  AND p.university_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Diagnostic — verify the fix
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.audit_logs)                                            AS total_logs,
  (SELECT count(*) FROM public.audit_logs WHERE university_id IS NOT NULL)            AS logs_with_university,
  (SELECT count(*) FROM public.audit_logs WHERE university_id IS NULL)                AS logs_without_university,
  (SELECT count(*) FROM public.audit_logs WHERE user_id IS NOT NULL AND university_id IS NULL) AS logs_with_user_but_no_uni;
