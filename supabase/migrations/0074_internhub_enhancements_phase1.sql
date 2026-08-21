-- ============================================================================
-- InternHub.pk — Phase 1 Enhancements Migration (CORRECTED for live DB)
-- ----------------------------------------------------------------------------
-- This is the corrected version of 0074_internhub_enhancements_phase1.sql
-- adapted to the ACTUAL production schema at wqvbmjlloxsrvwhtdskv.supabase.co:
--
--   * weekly_logs uses `student_user_id` (NOT `student_id`)
--   * evaluations uses `student_user_id` (NOT `student_id`)
--   * student_internships uses `student_user_id` (NOT `student_id`)
--   * students PK is `user_id` (no separate `id`)
--   * student_internships.faculty_supervisor_id, .site_supervisor_id,
--     .external_evaluator_id all reference supervisors.id (not profiles.user_id)
--
-- Adds:
--   1. program_coordinator role to user_role enum
--   2. holidays table + is_holiday() SQL helper
--   3. push_subscriptions table
--   4. weekly_log_daily_entries table
--   5. generated_reports table
--   6. evaluation_cycles table
--   7. final_grades table
--   8. RLS on all new tables (university-scoped)
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Add program_coordinator to user_role enum
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'program_coordinator'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'program_coordinator' BEFORE 'pending_assignment';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  holiday_date    date NOT NULL,
  end_date        date,
  is_active       boolean NOT NULL DEFAULT true,
  restrict_submissions boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, holiday_date)
);
CREATE INDEX IF NOT EXISTS idx_holidays_university_date ON holidays(university_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_active ON holidays(is_active) WHERE is_active = true;

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holidays_select_policy ON holidays;
CREATE POLICY holidays_select_policy ON holidays
  FOR SELECT TO authenticated
  USING (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR
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
    (auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = holidays.university_id
    ))
  );

DROP POLICY IF EXISTS holidays_update_policy ON holidays;
CREATE POLICY holidays_update_policy ON holidays
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR (auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = holidays.university_id
    ))
  )
  WITH CHECK (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR (auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = holidays.university_id
    ))
  );

DROP POLICY IF EXISTS holidays_delete_policy ON holidays;
CREATE POLICY holidays_delete_policy ON holidays
  FOR DELETE TO authenticated
  USING (
    (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin'))
    OR (auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = holidays.university_id
    ))
  );

-- 3. is_holiday() SQL helper
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
        (end_date IS NULL AND holiday_date = check_date)
        OR
        (end_date IS NOT NULL AND check_date BETWEEN holiday_date AND end_date)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION is_holiday(date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_holiday(date, uuid) TO authenticated;

-- 4. push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL,
  endpoint        text NOT NULL,
  p256dh          text NOT NULL,
  auth            text NOT NULL,
  user_agent      text,
  preferences     jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active) WHERE is_active = true;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

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

-- 5. weekly_log_daily_entries
-- Uses student_user_id (actual column name on weekly_logs)
CREATE TABLE IF NOT EXISTS weekly_log_daily_entries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_log_id   uuid NOT NULL REFERENCES weekly_logs(id) ON DELETE CASCADE,
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  entry_date      date NOT NULL,
  tasks_performed text NOT NULL DEFAULT '',
  hours_worked    numeric(4,2) NOT NULL DEFAULT 0 CHECK (hours_worked >= 0 AND hours_worked <= 24),
  is_holiday      boolean NOT NULL DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (weekly_log_id, day_of_week),
  UNIQUE (weekly_log_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_entries_weekly_log ON weekly_log_daily_entries(weekly_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON weekly_log_daily_entries(entry_date);

ALTER TABLE weekly_log_daily_entries ENABLE ROW LEVEL SECURITY;

-- The weekly_logs table uses student_user_id (not student_id), and has
-- supervisor_id and faculty_supervisor_id columns. RLS mirrors weekly_logs.
DROP POLICY IF EXISTS wlde_select_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_select_policy ON weekly_log_daily_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id AND student_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id AND supervisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id AND faculty_supervisor_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM weekly_logs wl
      JOIN profiles p_student ON p_student.user_id = wl.student_user_id
      JOIN profiles admin ON admin.university_id = p_student.university_id
      WHERE wl.id = weekly_log_id AND admin.user_id = auth.uid() AND admin.role = 'university_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.department_id = p_coord.department_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'department_coordinator'
        AND p_student.user_id = (SELECT student_user_id FROM weekly_logs WHERE id = weekly_log_id)
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.program_id = p_coord.program_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'program_coordinator'
        AND p_student.user_id = (SELECT student_user_id FROM weekly_logs WHERE id = weekly_log_id)
    )
  );

DROP POLICY IF EXISTS wlde_insert_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_insert_policy ON weekly_log_daily_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id
      AND student_user_id = auth.uid() AND status IN ('draft','revision_required'))
  );

DROP POLICY IF EXISTS wlde_update_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_update_policy ON weekly_log_daily_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id
      AND student_user_id = auth.uid() AND status IN ('draft','revision_required'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id
      AND student_user_id = auth.uid() AND status IN ('draft','revision_required'))
  );

DROP POLICY IF EXISTS wlde_delete_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_delete_policy ON weekly_log_daily_entries
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id
      AND student_user_id = auth.uid() AND status IN ('draft','revision_required'))
  );

-- 6. generated_reports
CREATE TABLE IF NOT EXISTS generated_reports (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      uuid NOT NULL,
  internship_id   uuid,
  report_type     text NOT NULL CHECK (report_type IN ('weekly','midterm','final','custom','weekly_log_template')),
  week_number     integer,
  storage_path    text NOT NULL,
  filename        text NOT NULL,
  mime_type       text NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  file_size_bytes bigint,
  status          text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','expired')),
  generated_by    uuid NOT NULL,
  university_id   uuid,
  expires_at      timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gen_reports_student ON generated_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_gen_reports_internship ON generated_reports(internship_id);
CREATE INDEX IF NOT EXISTS idx_gen_reports_university ON generated_reports(university_id);
CREATE INDEX IF NOT EXISTS idx_gen_reports_type ON generated_reports(report_type, status);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- RLS for generated_reports: uses student_user_id semantics
-- (the student_id column stores the auth.users.id / profiles.user_id of the student)
DROP POLICY IF EXISTS gen_reports_select_policy ON generated_reports;
CREATE POLICY gen_reports_select_policy ON generated_reports
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR student_id = auth.uid()
    OR generated_by = auth.uid()
    OR (university_id IS NOT NULL AND auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = generated_reports.university_id
    ))
    OR EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.department_id = p_coord.department_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'department_coordinator'
        AND p_student.user_id = generated_reports.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.program_id = p_coord.program_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'program_coordinator'
        AND p_student.user_id = generated_reports.student_id
    )
    -- faculty_supervisor assigned via student_internships
    OR EXISTS (
      SELECT 1 FROM profiles p_fs
      JOIN supervisors s ON s.user_id = p_fs.user_id AND s.type = 'faculty'
      JOIN student_internships si ON si.faculty_supervisor_id = s.id
      WHERE p_fs.user_id = auth.uid() AND p_fs.role = 'faculty_supervisor'
        AND si.student_user_id = generated_reports.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_ss
      JOIN supervisors s ON s.user_id = p_ss.user_id AND s.type = 'site'
      JOIN student_internships si ON si.site_supervisor_id = s.id
      WHERE p_ss.user_id = auth.uid() AND p_ss.role = 'site_supervisor'
        AND si.student_user_id = generated_reports.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_hr
      JOIN student_internships si ON si.internship_id IN (
        SELECT id FROM internships WHERE company_id = p_hr.company_id
      )
      WHERE p_hr.user_id = auth.uid() AND p_hr.role = 'company_hr'
        AND si.student_user_id = generated_reports.student_id
    )
  );

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
    auth.uid() = generated_by
    OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
  );

COMMENT ON TABLE generated_reports IS 'Metadata for server-generated docx/pdf reports. Files are stored in Supabase Storage bucket "generated-reports" (private).';

-- 7. evaluation_cycles
CREATE TABLE IF NOT EXISTS evaluation_cycles (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      uuid NOT NULL,
  internship_id   uuid NOT NULL,
  cycle_type      text NOT NULL CHECK (cycle_type IN ('three_week','final')),
  trigger_week    integer NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  started_at      timestamptz,
  completed_at    timestamptz,
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
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p_student
      LEFT JOIN profiles p_admin ON p_admin.university_id = p_student.university_id AND p_admin.role = 'university_admin'
      LEFT JOIN profiles p_dc ON p_dc.department_id = p_student.department_id AND p_dc.role = 'department_coordinator'
      LEFT JOIN profiles p_pc ON p_pc.program_id = p_student.program_id AND p_pc.role = 'program_coordinator'
      WHERE p_student.user_id = evaluation_cycles.student_id
        AND (p_admin.user_id = auth.uid() OR p_dc.user_id = auth.uid() OR p_pc.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM student_internships si
      WHERE si.student_user_id = evaluation_cycles.student_id
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
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin'))
  );

DROP POLICY IF EXISTS eval_cycles_update_policy ON evaluation_cycles;
CREATE POLICY eval_cycles_update_policy ON evaluation_cycles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin'))
    OR EXISTS (
      SELECT 1 FROM student_internships si
      WHERE si.student_user_id = evaluation_cycles.student_id
        AND si.internship_id = evaluation_cycles.internship_id
        AND (
          si.faculty_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
          OR si.site_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin'))
    OR EXISTS (
      SELECT 1 FROM student_internships si
      WHERE si.student_user_id = evaluation_cycles.student_id
        AND si.internship_id = evaluation_cycles.internship_id
        AND (
          si.faculty_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
          OR si.site_supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
        )
    )
  );

-- 8. final_grades
CREATE TABLE IF NOT EXISTS final_grades (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id          uuid NOT NULL UNIQUE,
  internship_id       uuid NOT NULL,
  site_supervisor_score     numeric(5,2),
  student_reports_score     numeric(5,2),
  faculty_supervisor_score  numeric(5,2),
  activity_log_score        numeric(5,2),
  final_score              numeric(5,2),
  letter_grade             text CHECK (letter_grade IN ('A+','A','B+','B','C+','C','D+','D','F','')),
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','computed','locked','failed')),
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  university_id            uuid,
  computed_at              timestamptz,
  computed_by              uuid,
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
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR student_id = auth.uid()
    OR (university_id IS NOT NULL AND auth.uid() IN (
      SELECT user_id FROM profiles WHERE role = 'university_admin' AND university_id = final_grades.university_id
    ))
    OR EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.department_id = p_coord.department_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'department_coordinator'
        AND p_student.user_id = final_grades.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_coord
      JOIN profiles p_student ON p_student.program_id = p_coord.program_id
      WHERE p_coord.user_id = auth.uid() AND p_coord.role = 'program_coordinator'
        AND p_student.user_id = final_grades.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_fs
      JOIN supervisors s ON s.user_id = p_fs.user_id AND s.type = 'faculty'
      JOIN student_internships si ON si.faculty_supervisor_id = s.id
      WHERE p_fs.user_id = auth.uid() AND p_fs.role = 'faculty_supervisor'
        AND si.student_user_id = final_grades.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p_ss
      JOIN supervisors s ON s.user_id = p_ss.user_id AND s.type = 'site'
      JOIN student_internships si ON si.site_supervisor_id = s.id
      WHERE p_ss.user_id = auth.uid() AND p_ss.role = 'site_supervisor'
        AND si.student_user_id = final_grades.student_id
    )
  );

DROP POLICY IF EXISTS final_grades_insert_policy ON final_grades;
CREATE POLICY final_grades_insert_policy ON final_grades
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin','program_coordinator'))
  );

DROP POLICY IF EXISTS final_grades_update_policy ON final_grades;
CREATE POLICY final_grades_update_policy ON final_grades
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin','program_coordinator'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin','university_admin','program_coordinator'))
  );

DROP POLICY IF EXISTS final_grades_delete_policy ON final_grades;
CREATE POLICY final_grades_delete_policy ON final_grades
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('super_admin')));

-- Done.
