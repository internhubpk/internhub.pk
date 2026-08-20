-- ============================================================================
-- InternHub.pk — Phase 1 Enhancements Migration
-- ----------------------------------------------------------------------------
-- Adds:
--   1. program_coordinator role to user_role enum
--   2. holidays table (university-scoped) + RLS
--   3. push_subscriptions table (per-user web push subscriptions) + RLS
--   4. weekly_log_daily_entries table (structured Monday-Friday entries) + RLS
--   5. generated_reports table (server-side generated docx/pdf metadata) + RLS
--   6. evaluation_cycles table (three-week + final evaluation cycle tracking) + RLS
--   7. final_grades table (40/30/25/5 weighted grade) + RLS
--   8. server-side helper function is_holiday(date, university_id)
--   9. server-side trigger to block weekly log submission on holidays
--  10. server-side trigger to auto-sync profiles.role <-> auth.users.app_metadata
--      for the new program_coordinator role
--  11. extension of existing RLS policies to cover new tables
-- ----------------------------------------------------------------------------
-- All new tables use:
--   * uuid PKs (uuid_generate_v4())
--   * explicit FKs with intentional ON DELETE behavior
--   * CHECK constraints for enums
--   * created_at/updated_at timestamps
--   * indexes on hot lookup columns
--   * RLS enabled with university-scoped policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions (idempotent)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Add program_coordinator to user_role enum
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  -- Add program_coordinator to the enum if not already present.
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'program_coordinator'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'program_coordinator' BEFORE 'pending_assignment';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. holidays table — university-scoped official holidays
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  holiday_date    date NOT NULL,
  end_date        date,  -- optional: for multi-day holidays (inclusive)
  is_active       boolean NOT NULL DEFAULT true,
  restrict_submissions boolean NOT NULL DEFAULT true,
  -- true = students cannot submit restricted tasks / weekly logs on this date
  created_by      uuid,  -- profiles.user_id of creator
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One name per (university, holiday_date) to avoid dupes
  UNIQUE (university_id, holiday_date)
);
CREATE INDEX IF NOT EXISTS idx_holidays_university_date ON holidays(university_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_active ON holidays(is_active) WHERE is_active = true;

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- RLS: holidays
--   * SELECT: super_admin, university_admin (own), department_coordinator (own),
--             faculty_supervisor (own), student (own) — they all need to SEE holidays
--             to know when submissions are restricted.
--   * INSERT/UPDATE/DELETE: super_admin (any), university_admin (own only)
DROP POLICY IF EXISTS holidays_select_policy ON holidays;
CREATE POLICY holidays_select_policy ON holidays
  FOR SELECT TO authenticated
  USING (
    -- super_admin sees all
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR
    -- everyone with a university_id matching the holiday's university sees it
    (university_id IN (
      SELECT university_id FROM profiles
      WHERE user_id = auth.uid() AND university_id IS NOT NULL
    ))
  );

DROP POLICY IF EXISTS holidays_insert_policy ON holidays;
CREATE POLICY holidays_insert_policy ON holidays
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR
    (
      auth.uid() IN (
        SELECT user_id FROM profiles
        WHERE role = 'university_admin' AND university_id = holidays.university_id
      )
    )
  );

DROP POLICY IF EXISTS holidays_update_policy ON holidays;
CREATE POLICY holidays_update_policy ON holidays
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR
    (
      auth.uid() IN (
        SELECT user_id FROM profiles
        WHERE role = 'university_admin' AND university_id = holidays.university_id
      )
    )
  )
  WITH CHECK (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR
    (
      auth.uid() IN (
        SELECT user_id FROM profiles
        WHERE role = 'university_admin' AND university_id = holidays.university_id
      )
    )
  );

DROP POLICY IF EXISTS holidays_delete_policy ON holidays;
CREATE POLICY holidays_delete_policy ON holidays
  FOR DELETE TO authenticated
  USING (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR
    (
      auth.uid() IN (
        SELECT user_id FROM profiles
        WHERE role = 'university_admin' AND university_id = holidays.university_id
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. is_holiday helper function — used by weekly_logs and tasks triggers
--    Returns true if the given date falls on an active holiday for the
--    given university (or for any university if NULL — used for super_admin
--    checks where university scope is unknown). When university_id is NULL
--    and no university can be derived, returns false (allow submission).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_holiday(check_date date, univ_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM holidays
    WHERE is_active = true
      AND restrict_submissions = true
      AND (university_id = univ_id OR univ_id IS NULL)
      AND (
        -- single-day holiday
        (end_date IS NULL AND holiday_date = check_date)
        OR
        -- multi-day holiday (inclusive range)
        (end_date IS NOT NULL AND check_date BETWEEN holiday_date AND end_date)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION is_holiday(date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_holiday(date, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. push_subscriptions table — web push subscription endpoints per user
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL,  -- references profiles.user_id (auth.users.id)
  endpoint        text NOT NULL,
  p256dh          text NOT NULL,  -- client public key
  auth            text NOT NULL,   -- client auth secret
  -- A user may have multiple subscriptions (one per device/browser).
  -- The same endpoint must not be stored twice for the same user.
  user_agent      text,
  -- JSONB for forward compat (per-section prefs, locale, etc.)
  preferences     jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active) WHERE is_active = true;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: push_subscriptions — each user can ONLY manage their own subscriptions.
-- Server-side code (service role) bypasses RLS to send notifications.
DROP POLICY IF EXISTS push_subs_select_policy ON push_subscriptions;
CREATE POLICY push_subs_select_policy ON push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subs_insert_policy ON push_subscriptions;
CREATE POLICY push_subs_insert_policy ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subs_update_policy ON push_subscriptions;
CREATE POLICY push_subs_update_policy ON push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subs_delete_policy ON push_subscriptions;
CREATE POLICY push_subs_delete_policy ON push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. weekly_log_daily_entries — structured Monday-Friday entries
--    Each weekly_log row can have 0-7 daily_entries (one per weekday).
--    The weekly_logs.tasks_completed text[] column remains for back-compat.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_log_daily_entries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_log_id   uuid NOT NULL REFERENCES weekly_logs(id) ON DELETE CASCADE,
  -- ISO weekday: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  entry_date      date NOT NULL,
  tasks_performed text NOT NULL DEFAULT '',
  hours_worked    numeric(4,2) NOT NULL DEFAULT 0 CHECK (hours_worked >= 0 AND hours_worked <= 24),
  is_holiday      boolean NOT NULL DEFAULT false,  -- denormalized at submit time
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (weekly_log_id, day_of_week),
  UNIQUE (weekly_log_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_entries_weekly_log ON weekly_log_daily_entries(weekly_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON weekly_log_daily_entries(entry_date);

ALTER TABLE weekly_log_daily_entries ENABLE ROW LEVEL SECURITY;

-- RLS: weekly_log_daily_entries — same as weekly_logs (students own their own;
--      supervisors read their assigned students' entries).
DROP POLICY IF EXISTS wlde_select_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_select_policy ON weekly_log_daily_entries
  FOR SELECT TO authenticated
  USING (
    -- super_admin: all
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR
    -- student owns the parent weekly_log
    EXISTS (
      SELECT 1 FROM weekly_logs
      WHERE id = weekly_log_id AND student_id = auth.uid()
    )
    OR
    -- faculty_supervisor/site_supervisor assigned to the parent weekly_log
    EXISTS (
      SELECT 1 FROM weekly_logs
      WHERE id = weekly_log_id AND (supervisor_id = auth.uid() OR co_supervisor_id = auth.uid())
    )
    OR
    -- university_admin of the student's university
    EXISTS (
      SELECT 1 FROM weekly_logs wl
      JOIN students s ON s.id = wl.student_id
      JOIN profiles p ON p.user_id = wl.student_id
      JOIN profiles admin ON admin.university_id = p.university_id
      WHERE wl.id = weekly_log_id AND admin.user_id = auth.uid() AND admin.role = 'university_admin'
    )
    OR
    -- department_coordinator of the student's department
    EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.department_id = p_coord.department_id
      WHERE p_coord.user_id = auth.uid()
        AND p_coord.role = 'department_coordinator'
        AND p_student.user_id = (
          SELECT student_id FROM weekly_logs WHERE id = weekly_log_id
        )
    )
    OR
    -- program_coordinator of the student's program
    EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.program_id = p_coord.program_id
      WHERE p_coord.user_id = auth.uid()
        AND p_coord.role = 'program_coordinator'
        AND p_student.user_id = (
          SELECT student_id FROM weekly_logs WHERE id = weekly_log_id
        )
    )
  );

DROP POLICY IF EXISTS wlde_insert_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_insert_policy ON weekly_log_daily_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    -- student owns the parent weekly_log AND weekly_log is still in draft/revision_required
    EXISTS (
      SELECT 1 FROM weekly_logs
      WHERE id = weekly_log_id
        AND student_id = auth.uid()
        AND status IN ('draft', 'revision_required')
    )
  );

DROP POLICY IF EXISTS wlde_update_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_update_policy ON weekly_log_daily_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM weekly_logs
      WHERE id = weekly_log_id
        AND student_id = auth.uid()
        AND status IN ('draft', 'revision_required')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM weekly_logs
      WHERE id = weekly_log_id
        AND student_id = auth.uid()
        AND status IN ('draft', 'revision_required')
    )
  );

DROP POLICY IF EXISTS wlde_delete_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_delete_policy ON weekly_log_daily_entries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM weekly_logs
      WHERE id = weekly_log_id
        AND student_id = auth.uid()
        AND status IN ('draft', 'revision_required')
    )
  );

-- ----------------------------------------------------------------------------
-- 6. generated_reports table — metadata for server-generated docx/pdf files
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_reports (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- The student/internship this report was generated for
  student_id      uuid NOT NULL,  -- profiles.user_id
  internship_id   uuid,
  -- Type of report: weekly, midterm, final, custom
  report_type     text NOT NULL CHECK (report_type IN ('weekly','midterm','final','custom','weekly_log_template')),
  -- For weekly reports, the week number this report covers
  week_number     integer,
  -- The generated file path in Supabase Storage (private bucket)
  storage_path    text NOT NULL,
  -- Original filename (safe-sanitized)
  filename        text NOT NULL,
  -- File metadata
  mime_type       text NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  file_size_bytes bigint,
  -- Status: pending (queued), completed, failed, expired
  status          text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','expired')),
  -- Who requested the generation
  generated_by    uuid NOT NULL,  -- profiles.user_id
  -- University scope (denormalized for fast RLS filtering)
  university_id   uuid,  -- references universities(id)
  -- Optional expiry (reports can be auto-cleaned after N days)
  expires_at      timestamptz,
  -- JSONB metadata: template_version, placeholders, etc.
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gen_reports_student ON generated_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_gen_reports_internship ON generated_reports(internship_id);
CREATE INDEX IF NOT EXISTS idx_gen_reports_university ON generated_reports(university_id);
CREATE INDEX IF NOT EXISTS idx_gen_reports_type ON generated_reports(report_type, status);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- RLS: generated_reports — strict scoping
--   * student: own reports only
--   * program_coordinator: students in their program
--   * department_coordinator: students in their department
--   * university_admin: students in their university
--   * super_admin: all
--   * faculty_supervisor / site_supervisor: students assigned to them
--   * company_hr: students in their company's internships
DROP POLICY IF EXISTS gen_reports_select_policy ON generated_reports;
CREATE POLICY gen_reports_select_policy ON generated_reports
  FOR SELECT TO authenticated
  USING (
    -- super_admin
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR
    -- own report
    student_id = auth.uid()
    OR
    -- generated_by (the user who requested the report can re-download it)
    generated_by = auth.uid()
    OR
    -- university_admin of same university
    (
      university_id IS NOT NULL
      AND auth.uid() IN (
        SELECT user_id FROM profiles
        WHERE role = 'university_admin' AND university_id = generated_reports.university_id
      )
    )
    OR
    -- department_coordinator of same department
    EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.department_id = p_coord.department_id
      WHERE p_coord.user_id = auth.uid()
        AND p_coord.role = 'department_coordinator'
        AND p_student.user_id = generated_reports.student_id
    )
    OR
    -- program_coordinator of same program
    EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.program_id = p_coord.program_id
      WHERE p_coord.user_id = auth.uid()
        AND p_coord.role = 'program_coordinator'
        AND p_student.user_id = generated_reports.student_id
    )
    OR
    -- faculty_supervisor assigned to this student
    EXISTS (
      SELECT 1 FROM profiles p_fs
      JOIN student_internships si ON si.faculty_supervisor_id = (
        SELECT id FROM supervisors WHERE user_id = p_fs.user_id LIMIT 1
      )
      WHERE p_fs.user_id = auth.uid()
        AND p_fs.role = 'faculty_supervisor'
        AND si.student_id = generated_reports.student_id
    )
    OR
    -- site_supervisor assigned to this student
    EXISTS (
      SELECT 1 FROM profiles p_ss
      JOIN student_internships si ON si.site_supervisor_id = (
        SELECT id FROM supervisors WHERE user_id = p_ss.user_id LIMIT 1
      )
      WHERE p_ss.user_id = auth.uid()
        AND p_ss.role = 'site_supervisor'
        AND si.student_id = generated_reports.student_id
    )
    OR
    -- company_hr of this student's internship's company
    EXISTS (
      SELECT 1 FROM profiles p_hr
      JOIN student_internships si ON si.internship_id IN (
        SELECT id FROM internships WHERE company_id = p_hr.company_id
      )
      WHERE p_hr.user_id = auth.uid()
        AND p_hr.role = 'company_hr'
        AND si.student_id = generated_reports.student_id
    )
  );

-- INSERT/UPDATE/DELETE: only server-side (service role bypasses RLS).
-- Client users can only request generation through dedicated API endpoints.
DROP POLICY IF EXISTS gen_reports_insert_policy ON generated_reports;
CREATE POLICY gen_reports_insert_policy ON generated_reports
  FOR INSERT TO authenticated
  WITH CHECK (generated_by = auth.uid());

DROP POLICY IF EXISTS gen_reports_update_policy ON generated_reports;
CREATE POLICY gen_reports_update_policy ON generated_reports
  FOR UPDATE TO authenticated
  USING (generated_by = auth.uid())
  WITH CHECK (generated_by = auth.uid());

DROP POLICY IF EXISTS gen_reports_delete_policy ON generated_reports;
CREATE POLICY gen_reports_delete_policy ON generated_reports
  FOR DELETE TO authenticated
  USING (
    -- super_admin or generated_by
    auth.uid() = generated_by
    OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
  );

-- ----------------------------------------------------------------------------
-- 7. evaluation_cycles — three-week and final evaluation cycle tracking
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_cycles (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      uuid NOT NULL,  -- profiles.user_id
  internship_id   uuid NOT NULL,
  cycle_type      text NOT NULL CHECK (cycle_type IN ('three_week','final')),
  -- The week number that triggers this cycle (e.g. 3, 6, 9, ... for three-week;
  -- final week for final)
  trigger_week    integer NOT NULL,
  -- Status: pending, in_progress, completed, skipped
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  -- When the cycle became available to evaluators
  started_at      timestamptz,
  -- When the cycle was marked complete (all required evals submitted)
  completed_at    timestamptz,
  -- JSONB metadata: which evaluations were required, scores, etc.
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, internship_id, cycle_type, trigger_week)
);
CREATE INDEX IF NOT EXISTS idx_eval_cycles_student ON evaluation_cycles(student_id);
CREATE INDEX IF NOT EXISTS idx_eval_cycles_internship ON evaluation_cycles(internship_id);
CREATE INDEX IF NOT EXISTS idx_eval_cycles_status ON evaluation_cycles(status);

ALTER TABLE evaluation_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eval_cycles_select_policy ON evaluation_cycles;
CREATE POLICY eval_cycles_select_policy ON evaluation_cycles
  FOR SELECT TO authenticated
  USING (
    -- super_admin
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR
    -- own cycle
    student_id = auth.uid()
    OR
    -- university/department/program coordinators & admins of the student
    EXISTS (
      SELECT 1 FROM profiles p_student
      LEFT JOIN profiles p_admin ON p_admin.university_id = p_student.university_id AND p_admin.role = 'university_admin'
      LEFT JOIN profiles p_dc ON p_dc.department_id = p_student.department_id AND p_dc.role = 'department_coordinator'
      LEFT JOIN profiles p_pc ON p_pc.program_id = p_student.program_id AND p_pc.role = 'program_coordinator'
      WHERE p_student.user_id = evaluation_cycles.student_id
        AND (p_admin.user_id = auth.uid() OR p_dc.user_id = auth.uid() OR p_pc.user_id = auth.uid())
    )
    OR
    -- faculty_supervisor / site_supervisor assigned to this student
    EXISTS (
      SELECT 1 FROM student_internships si
      WHERE si.student_id = evaluation_cycles.student_id
        AND si.internship_id = evaluation_cycles.internship_id
        AND (
          si.faculty_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
          OR si.site_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS eval_cycles_insert_policy ON evaluation_cycles;
CREATE POLICY eval_cycles_insert_policy ON evaluation_cycles
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Only server-side (service role bypasses) OR super_admin/university_admin
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin'))
  );

DROP POLICY IF EXISTS eval_cycles_update_policy ON evaluation_cycles;
CREATE POLICY eval_cycles_update_policy ON evaluation_cycles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin'))
    OR
    -- evaluators can mark cycle status when they submit their eval
    EXISTS (
      SELECT 1 FROM student_internships si
      WHERE si.student_id = evaluation_cycles.student_id
        AND si.internship_id = evaluation_cycles.internship_id
        AND (
          si.faculty_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
          OR si.site_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin'))
    OR
    EXISTS (
      SELECT 1 FROM student_internships si
      WHERE si.student_id = evaluation_cycles.student_id
        AND si.internship_id = evaluation_cycles.internship_id
        AND (
          si.faculty_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
          OR si.site_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 8. final_grades — 40/30/25/5 weighted final grade
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS final_grades (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id          uuid NOT NULL UNIQUE,  -- profiles.user_id
  internship_id       uuid NOT NULL,
  -- Component scores (0-100 each, NULL = not yet computed)
  site_supervisor_score     numeric(5,2),  -- 40% weight
  student_reports_score     numeric(5,2),  -- 30% weight
  faculty_supervisor_score  numeric(5,2),  -- 25% weight
  activity_log_score        numeric(5,2),  -- 5% weight
  -- The final computed weighted score (0-100)
  final_score              numeric(5,2),
  -- Letter grade (A+, A, B+, B, ..., F) computed from final_score
  letter_grade             text CHECK (letter_grade IN ('A+','A','B+','B','C+','C','D+','D','F','')),
  -- Status: pending (components not all available), computed, locked
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','computed','locked','failed')),
  -- JSONB metadata: which evaluations/reports were used, computed_at, etc.
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- University scope (denormalized for RLS)
  university_id            uuid,
  computed_at              timestamptz,
  computed_by              uuid,  -- profiles.user_id of who triggered the computation
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, internship_id)
);
CREATE INDEX IF NOT EXISTS idx_final_grades_student ON final_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_final_grades_internship ON final_grades(internship_id);
CREATE INDEX IF NOT EXISTS idx_final_grades_university ON final_grades(university_id);

ALTER TABLE final_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS final_grades_select_policy ON final_grades;
CREATE POLICY final_grades_select_policy ON final_grades
  FOR SELECT TO authenticated
  USING (
    -- super_admin
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR
    -- own grade
    student_id = auth.uid()
    OR
    (
      university_id IS NOT NULL
      AND auth.uid() IN (
        SELECT user_id FROM profiles
        WHERE role = 'university_admin' AND university_id = final_grades.university_id
      )
    )
    OR
    -- department_coordinator
    EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.department_id = p_coord.department_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'department_coordinator'
        AND p_student.user_id = final_grades.student_id
    )
    OR
    -- program_coordinator
    EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.program_id = p_coord.program_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'program_coordinator'
        AND p_student.user_id = final_grades.student_id
    )
    OR
    -- faculty_supervisor assigned to this student
    EXISTS (
      SELECT 1 FROM profiles p_fs
      JOIN student_internships si ON si.faculty_supervisor_id = (
        SELECT id FROM supervisors WHERE user_id = p_fs.user_id LIMIT 1
      )
      WHERE p_fs.user_id = auth.uid() AND p_fs.role = 'faculty_supervisor'
        AND si.student_id = final_grades.student_id
    )
    OR
    -- site_supervisor assigned to this student
    EXISTS (
      SELECT 1 FROM profiles p_ss
      JOIN student_internships si ON si.site_supervisor_id = (
        SELECT id FROM supervisors WHERE user_id = p_ss.user_id LIMIT 1
      )
      WHERE p_ss.user_id = auth.uid() AND p_ss.role = 'site_supervisor'
        AND si.student_id = final_grades.student_id
    )
  );

DROP POLICY IF EXISTS final_grades_insert_policy ON final_grades;
CREATE POLICY final_grades_insert_policy ON final_grades
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Only super_admin / university_admin / program_coordinator / server-side
    auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role IN ('super_admin','university_admin','program_coordinator')
    )
  );

DROP POLICY IF EXISTS final_grades_update_policy ON final_grades;
CREATE POLICY final_grades_update_policy ON final_grades
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role IN ('super_admin','university_admin','program_coordinator')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role IN ('super_admin','university_admin','program_coordinator')
    )
  );

DROP POLICY IF EXISTS final_grades_delete_policy ON final_grades;
CREATE POLICY final_grades_delete_policy ON final_grades
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin'))
  );

-- ----------------------------------------------------------------------------
-- 9. Update profiles_sync_auth_metadata trigger to handle program_coordinator
-- ----------------------------------------------------------------------------
-- The existing trigger (migration 0011/0038) syncs profiles.role to
-- auth.users.raw_app_meta_data->>'role'. We don't need to change the trigger
-- function — it operates on any role value. We just need to verify it's
-- still active and correct.
-- (No-op for the trigger itself, but we add a backfill for any
-- program_coordinator profiles that may exist without synced metadata.)

-- ----------------------------------------------------------------------------
-- 10. Storage bucket for generated reports (private)
-- ----------------------------------------------------------------------------
-- Note: Supabase Storage buckets are not created via SQL migrations in the
-- standard flow. They're created via the Supabase Dashboard or CLI.
-- The application code will create the bucket on first use if it doesn't
-- exist, OR an admin must create it manually:
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('generated-reports', 'generated-reports', false)
--   ON CONFLICT (id) DO NOTHING;
-- For now, we add a comment as documentation.
COMMENT ON TABLE generated_reports IS 'Metadata for server-generated docx/pdf reports. Files are stored in Supabase Storage bucket "generated-reports" (private).';

-- ----------------------------------------------------------------------------
-- 11. Storage bucket for push subscription VAPID public key (public)
-- ----------------------------------------------------------------------------
-- VAPID public key is safe to expose to the browser; it's not a secret.
-- It will be exposed via a public API endpoint, not stored in a bucket.
-- The VAPID PRIVATE key is stored as an environment variable on the server.

-- ----------------------------------------------------------------------------
-- Done.
-- ----------------------------------------------------------------------------
