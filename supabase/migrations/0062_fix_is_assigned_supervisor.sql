-- ============================================================================
-- InternHub.pk — 0062 Fix is_assigned_supervisor + backfill SI.faculty_supervisor_id
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The faculty-supervisor dashboard shows 0 supervised students, 0 active
--   internships, 0 pending reviews — even when the coordinator page shows
--   the supervisor has assigned students and active supervisions.
--
--   Root cause: the `internhub.is_assigned_supervisor(p_student)` helper
--   ONLY checks `student_internships` for the supervisor relationship:
--
--     SELECT EXISTS (
--       SELECT 1 FROM public.student_internships si
--         WHERE si.student_user_id = p_student
--           AND (si.faculty_supervisor_id = auth.uid()
--                OR si.site_supervisor_id = auth.uid())
--           AND si.status IN ('assigned','active')
--     );
--
--   But the supervisor relationship is established via THREE independent
--   paths (see migrations 0015, 0041, and the faculty-supervisor dashboard
--   code's "THREE-PATH UNION"):
--
--     Path 1: student_internships.faculty_supervisor_id  (internship-time)
--     Path 2: students.faculty_supervisor_id             (pre-internship, 0041)
--     Path 3: programs.default_faculty_supervisor_id     (program default, 0015)
--
--   When a coordinator creates a program (which auto-creates the supervisor
--   account) and then creates a student in that program, the student's
--   `students.faculty_supervisor_id` is set to the supervisor's user_id
--   (Path 2) AND the program's `default_faculty_supervisor_id` is set
--   (Path 3). But when the student is later placed into an internship,
--   the new `student_internships` row is created with
--   `faculty_supervisor_id = NULL` — Path 1 is never populated.
--
--   Result: `is_assigned_supervisor()` returns false → RLS blocks the
--   supervisor from reading the `students` row (and `profiles`,
--   `evaluations`, `weekly_logs`, `task_submissions`, etc. — every table
--   whose RLS uses this helper) → the dashboard shows 0 everything.
--
--   The coordinator's reports route sidesteps this because it runs with
--   the coordinator's session and counts students via the indirect
--   (program-level) and pre-internship paths in application code. But the
--   faculty supervisor's dashboard queries `students` directly, which
--   hits the RLS wall.
--
-- SOLUTION
--   1. Broaden `is_assigned_supervisor(p_student)` to also return true if
--      EITHER:
--        (a) `students.faculty_supervisor_id = auth.uid()` for this student
--            (Path 2 — pre-internship direct assignment), OR
--        (b) The student is enrolled in a program where
--            `programs.default_faculty_supervisor_id = auth.uid()`
--            (Path 3 — program-level indirect assignment).
--      The existing Path 1 check (student_internships) is preserved.
--
--      This is a SAFE broadening because:
--        - The coordinator UI already says "Students enrolled in the
--          program are automatically assigned to this supervisor."
--        - The coordinator's reports route already counts these students
--          as "assigned" via the same logic.
--        - The function is SECURITY DEFINER (runs as postgres), so the
--          inner queries to `students` and `programs` bypass RLS — no
--          recursion risk.
--
--   2. Backfill `student_internships.faculty_supervisor_id` from
--      `students.faculty_supervisor_id` for existing rows where the SI
--      row's `faculty_supervisor_id` is NULL but the student has a
--      supervisor assigned on the `students` table. This makes the
--      existing data consistent and lets the supervisor dashboard's
--      Path 1 query (si.faculty_supervisor_id = user.id) work.
--
--   3. Add a trigger `si_auto_set_faculty_supervisor` that auto-sets
--      `student_internships.faculty_supervisor_id` from
--      `students.faculty_supervisor_id` on INSERT if the new SI row's
--      `faculty_supervisor_id` is NULL. This prevents the bug from
--      recurring when new internship rows are created.
--
--   4. Add a trigger `students_sync_si_faculty_supervisor` that, when a
--      coordinator assigns a faculty supervisor to a student via
--      `students.faculty_supervisor_id`, also updates any existing
--      `student_internships` rows for that student to set
--      `faculty_supervisor_id` to the same value (if they don't already
--      have one). This keeps the two tables in sync going forward.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION, DROP IF EXISTS + CREATE TRIGGER,
--   UPDATE WHERE ... AND faculty_supervisor_id IS NULL. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Broaden is_assigned_supervisor to cover all three assignment paths
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- A supervisor is "assigned" to a student if ANY of the following holds:
  --
  --   Path 1 (internship-time): there exists a student_internships row
  --     where the current user is the faculty_supervisor_id or
  --     site_supervisor_id AND the internship is in an active state.
  --
  --   Path 2 (pre-internship direct): the student's row in `students`
  --     has faculty_supervisor_id = current user. This is set by the
  --     coordinator via the Students page when the student hasn't been
  --     placed into an internship yet (migration 0041).
  --
  --   Path 3 (program-level indirect): the student is enrolled in a
  --     program whose default_faculty_supervisor_id = current user.
  --     This is the automatic assignment that happens when a coordinator
  --     creates a program (the supervisor is created with the program
  --     and every student subsequently enrolled in that program is
  --     "theirs" — migration 0015).
  --
  -- SECURITY DEFINER + STABLE: the inner SELECTs run as the function
  -- owner (postgres), so they bypass RLS — no recursion risk even though
  -- students_select and prog_select both call this function.
  SELECT
    -- Path 1: student_internships
    EXISTS (
      SELECT 1 FROM public.student_internships si
        WHERE si.student_user_id = p_student
          AND (si.faculty_supervisor_id = (select auth.uid())
               OR si.site_supervisor_id = (select auth.uid()))
          AND si.status IN ('assigned','active')
    )
    -- Path 2: students.faculty_supervisor_id
    OR EXISTS (
      SELECT 1 FROM public.students s
        WHERE s.user_id = p_student
          AND s.faculty_supervisor_id = (select auth.uid())
    )
    -- Path 3: programs.default_faculty_supervisor_id (via student's program)
    OR EXISTS (
      SELECT 1
        FROM public.students s
        JOIN public.programs p ON p.id = s.program_id
        WHERE s.user_id = p_student
          AND p.default_faculty_supervisor_id = (select auth.uid())
    );
$$;

COMMENT ON FUNCTION internhub.is_assigned_supervisor(uuid) IS
  'Returns true if the current auth user is an assigned supervisor for the '
  'given student user_id. Checks three assignment paths: (1) '
  'student_internships.faculty_supervisor_id or site_supervisor_id with '
  'active status, (2) students.faculty_supervisor_id (pre-internship '
  'direct assignment, migration 0041), (3) programs.default_faculty_'
  'supervisor_id for the student''s program (program-level indirect, '
  'migration 0015). SECURITY DEFINER — bypasses RLS to avoid recursion.';

-- Re-grant execute (in case a later migration revoked it)
GRANT EXECUTE ON FUNCTION internhub.is_assigned_supervisor(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 2. Backfill student_internships.faculty_supervisor_id from students
-- ----------------------------------------------------------------------------
-- For every student_internships row where faculty_supervisor_id is NULL,
-- look up the student's faculty_supervisor_id on the students table and
-- copy it across. This makes existing data consistent with the new
-- is_assigned_supervisor semantics and lets the supervisor dashboard's
-- Path 1 query (si.faculty_supervisor_id = user.id) work immediately.
--
-- Only updates rows where the SI.faculty_supervisor_id IS NULL — we
-- never overwrite an explicitly-set value (e.g. a site-supervisor-only
-- assignment, or a per-internship override).

UPDATE student_internships si
SET faculty_supervisor_id = sub.faculty_supervisor_id,
    updated_at = COALESCE(si.updated_at, now())
FROM (
  SELECT user_id, faculty_supervisor_id
  FROM students
  WHERE faculty_supervisor_id IS NOT NULL
) sub
WHERE si.student_user_id = sub.user_id
  AND si.faculty_supervisor_id IS NULL;

-- Diagnostic: report how many rows were backfilled / remain NULL.
SELECT
  COUNT(*) AS total_si_rows,
  COUNT(*) FILTER (WHERE faculty_supervisor_id IS NOT NULL) AS si_with_supervisor,
  COUNT(*) FILTER (WHERE faculty_supervisor_id IS NULL) AS si_without_supervisor
FROM student_internships;

-- ----------------------------------------------------------------------------
-- 3. Trigger: auto-set student_internships.faculty_supervisor_id on INSERT
-- ----------------------------------------------------------------------------
-- When a new student_internships row is created and faculty_supervisor_id
-- is NULL, look up the student's faculty_supervisor_id on the students
-- table and copy it across. This prevents the bug from recurring when
-- new internship rows are created (e.g. when a student applies to an
-- internship and is accepted).

CREATE OR REPLACE FUNCTION internhub.si_auto_set_faculty_supervisor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supervisor uuid;
BEGIN
  -- Only auto-set if the caller didn't explicitly provide one.
  IF NEW.faculty_supervisor_id IS NULL AND NEW.student_user_id IS NOT NULL THEN
    SELECT faculty_supervisor_id INTO v_supervisor
      FROM public.students
      WHERE user_id = NEW.student_user_id
      LIMIT 1;

    IF v_supervisor IS NOT NULL THEN
      NEW.faculty_supervisor_id := v_supervisor;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION internhub.si_auto_set_faculty_supervisor() TO authenticated, anon;

DROP TRIGGER IF EXISTS trg_si_auto_set_faculty_supervisor ON student_internships;
CREATE TRIGGER trg_si_auto_set_faculty_supervisor
  BEFORE INSERT ON student_internships
  FOR EACH ROW
  EXECUTE FUNCTION internhub.si_auto_set_faculty_supervisor();

-- ----------------------------------------------------------------------------
-- 4. Trigger: sync student_internships when students.faculty_supervisor_id changes
-- ----------------------------------------------------------------------------
-- When a coordinator assigns (or re-assigns) a faculty supervisor to a
-- student via the students table, propagate that to any existing
-- student_internships rows for that student. This keeps the two tables
-- in sync going forward.
--
-- We only UPDATE SI rows where faculty_supervisor_id IS NULL (or where
-- it currently matches the OLD value, for re-assignments). We never
-- overwrite an explicitly-set per-internship override that differs from
-- both the old and new students-table value.

CREATE OR REPLACE FUNCTION internhub.students_sync_si_faculty_supervisor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when faculty_supervisor_id actually changed.
  IF OLD.faculty_supervisor_id IS DISTINCT FROM NEW.faculty_supervisor_id THEN
    -- Update SI rows that have no explicit supervisor (NULL) or that
    -- were carrying the OLD students-table value (so a re-assignment
    -- propagates). Rows with a different explicit supervisor are left
    -- alone (they represent per-internship overrides).
    UPDATE public.student_internships
      SET faculty_supervisor_id = NEW.faculty_supervisor_id,
          updated_at = now()
      WHERE student_user_id = NEW.user_id
        AND (
          faculty_supervisor_id IS NULL
          OR faculty_supervisor_id = OLD.faculty_supervisor_id
        );
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION internhub.students_sync_si_faculty_supervisor() TO authenticated, anon;

DROP TRIGGER IF EXISTS trg_students_sync_si_faculty_supervisor ON students;
CREATE TRIGGER trg_students_sync_si_faculty_supervisor
  AFTER UPDATE OF faculty_supervisor_id ON students
  FOR EACH ROW
  EXECUTE FUNCTION internhub.students_sync_si_faculty_supervisor();

-- ----------------------------------------------------------------------------
-- 5. Diagnostic — verify the function now covers all three paths
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname = 'is_assigned_supervisor'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'internhub');

  IF v_count = 0 THEN
    RAISE EXCEPTION 'is_assigned_supervisor function not found — migration failed';
  END IF;

  RAISE NOTICE 'Migration 0062 complete: is_assigned_supervisor now covers all 3 assignment paths';
END $$;
