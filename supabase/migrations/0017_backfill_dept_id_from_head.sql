-- ============================================================================
-- InternHub.pk — 0017 Backfill profiles.department_id from departments.head_id
-- ----------------------------------------------------------------------------
-- PROBLEM
--   On the university admin → coordinators page, some coordinators show
--   "Unassigned" for department, but the same person shows up as "Head: [name]"
--   on the university admin → departments page. This is because:
--     - departments.head_id points at the coordinator (set when the admin
--       created the department and picked a head)
--     - profiles.department_id is NULL on that same coordinator (the column
--       was never backfilled when they were promoted to head)
--   The coordinators page reads `profiles.department_id`, sees NULL → shows
--   "Unassigned". The departments page reads `departments.head_id` →
--   resolves head_name from profiles → shows them as Head.
--
--   This is purely a data-inconsistency fix. No schema change, no policy
--   change. Idempotent — only touches rows where profiles.department_id IS
--   NULL AND there's a matching departments row pointing at this user as
--   head_id. Safe to re-run.
--
-- CAVEAT
--   If a user is head of MULTIPLE departments, this picks the first one
--   (by created_at). That's an edge case — most coordinators are head of
--   exactly one department. If they're head of more than one, the admin
--   can manually pick the "primary" department on the coordinators page.
-- ============================================================================

BEGIN;

UPDATE public.profiles p
SET
  department_id = d.id,
  updated_at    = now()
FROM (
  SELECT DISTINCT ON (head_id) head_id, id, created_at
  FROM public.departments
  WHERE head_id IS NOT NULL
  ORDER BY head_id, created_at ASC
) d
WHERE p.user_id = d.head_id
  AND p.department_id IS NULL;

COMMIT;

-- ----------------------------------------------------------------------------
-- Diagnostic — should show 0 rows after this runs.
--   Any row here is a coordinator who is a department head but whose
--   profiles.department_id is still NULL after the backfill (e.g. because
--   they're head of a department in a DIFFERENT university than their own
--   profile.university_id — that's a data-integrity issue to investigate
--   manually).
-- ----------------------------------------------------------------------------
SELECT
  p.user_id,
  p.email,
  p.role,
  p.university_id  AS profile_university,
  d.id             AS department_id,
  d.name           AS department_name,
  d.university_id  AS department_university
FROM public.profiles p
JOIN public.departments d ON d.head_id = p.user_id
WHERE p.department_id IS NULL
ORDER BY p.email;
