-- ============================================================================
-- 0058_weekly_logs_signatures_and_evidence.sql
--
-- Extends weekly_logs to support the new "Weekly Internship Activity Report"
-- workflow:
--   - Student fills the form online (program/department auto-fetched)
--   - Student uploads supporting evidence files + university logo + signature
--   - Site supervisor reviews, adds remarks, signs
--   - Faculty supervisor reviews, adds remarks, signs
--
-- All new columns are nullable so existing rows / queries keep working.
-- ============================================================================

-- 1. New columns on weekly_logs -------------------------------------------
ALTER TABLE weekly_logs
  ADD COLUMN IF NOT EXISTS program_name           text,        -- denormalized at submit time (snapshot)
  ADD COLUMN IF NOT EXISTS department_name        text,        -- denormalized at submit time (snapshot)
  ADD COLUMN IF NOT EXISTS university_logo_url    text,        -- student-uploaded university logo (universal template)
  ADD COLUMN IF NOT EXISTS weekly_activities      jsonb,       -- [{day:"Monday",date:"2026-08-10",tasks:"...",hours:"8"}, ...]
  ADD COLUMN IF NOT EXISTS learning_outcomes      text,        -- separate from `learnings` to match the PDF layout
  ADD COLUMN IF NOT EXISTS challenges_solutions   text,        -- alias of `challenges` (kept for PDF alignment)
  ADD COLUMN IF NOT EXISTS supporting_evidence    jsonb,       -- [{name,url,size,type}, ...]
  ADD COLUMN IF NOT EXISTS student_signature_url  text,        -- URL in `signatures` bucket
  ADD COLUMN IF NOT EXISTS student_signed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS site_supervisor_signature_url     text,
  ADD COLUMN IF NOT EXISTS site_supervisor_remarks          text,
  ADD COLUMN IF NOT EXISTS site_supervisor_signed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS site_supervisor_id    uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS faculty_supervisor_signature_url text,
  ADD COLUMN IF NOT EXISTS faculty_supervisor_remarks       text,
  ADD COLUMN IF NOT EXISTS faculty_supervisor_signed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS faculty_supervisor_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Backfill the denormalized columns for existing rows from joined tables,
-- so old weekly_logs still display correctly in the new UI.
UPDATE weekly_logs wl
  SET
    program_name    = p.name,
    department_name = d.name
  FROM profiles pr
  LEFT JOIN programs    p  ON p.id  = pr.program_id
  LEFT JOIN departments d  ON d.id  = pr.department_id
  WHERE pr.user_id = wl.student_user_id
    AND (wl.program_name IS NULL OR wl.department_name IS NULL);

-- Index the new signature/lookup columns for fast "pending sign-off" queries.
CREATE INDEX IF NOT EXISTS idx_wl_site_supervisor    ON weekly_logs(site_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_wl_faculty_supervisor ON weekly_logs(faculty_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_wl_site_signed_at     ON weekly_logs(site_supervisor_signed_at);
CREATE INDEX IF NOT EXISTS idx_wl_faculty_signed_at  ON weekly_logs(faculty_supervisor_signed_at);

-- 2. Extend weekly_log_status enum to include the new "site_signed" and
--    "fully_signed" intermediate states.
--    - submitted:        student submitted, awaiting site supervisor
--    - site_signed:      site supervisor has signed (NEW)
--    - faculty_signed:   faculty supervisor has signed (NEW)
--    - approved:         both signatures present (terminal)
--    - rejected / revision_required: as before
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_log_status') THEN
    CREATE TYPE weekly_log_status AS ENUM
      ('draft','submitted','site_signed','faculty_signed','approved','rejected','revision_required');
  ELSE
    BEGIN
      ALTER TYPE weekly_log_status ADD VALUE IF NOT EXISTS 'site_signed';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TYPE weekly_log_status ADD VALUE IF NOT EXISTS 'faculty_signed';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

-- 3. Storage RLS: allow students to upload to the `signatures` bucket too.
--    The bucket already allows site_supervisor / faculty_supervisor / etc.
--    Path convention: `signatures/<user_id>/<filename>` — first segment
--    must equal auth.uid(), which the existing policies already enforce.
DROP POLICY IF EXISTS "signatures_insert" ON storage.objects;
CREATE POLICY "signatures_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND internhub.current_role() IN
        ('student','site_supervisor','faculty_supervisor','external_evaluator','company_hr','super_admin')
  );

-- Students can READ their own signatures.
DROP POLICY IF EXISTS "signatures_read" ON storage.objects;
CREATE POLICY "signatures_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR internhub.current_role() = 'super_admin'
      OR internhub.current_role() = 'student'  -- students can read each other's? no — narrowed below.
    )
  );

-- Tighter: students can only READ signatures in their OWN folder.
-- The previous OR-clause was too permissive; fix it.
DROP POLICY IF EXISTS "signatures_read" ON storage.objects;
CREATE POLICY "signatures_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (
      -- Owner of the signature
      (storage.foldername(name))[1] = (select auth.uid())::text
      -- Super admin: everything
      OR internhub.current_role() = 'super_admin'
      -- HR: signatures owned by supervisors in their company
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.supervisors s
              WHERE s.user_id::text = (storage.foldername(name))[1]
                AND s.company_id = internhub.current_company_id()
          ))
      -- Site / faculty supervisor: signatures of students they supervise
      OR (internhub.current_role() IN ('site_supervisor','faculty_supervisor')
          AND EXISTS (
            SELECT 1 FROM public.student_internships si
              WHERE si.student_user_id::text = (storage.foldername(name))[1]
                AND internhub.is_assigned_supervisor(si.student_user_id)
          ))
    )
  );

-- 4. Update existing RLS UPDATE policy on weekly_logs to allow signed_at
--    updates from supervisors. The existing policy already permits
--    faculty/site supervisors to UPDATE — no change needed, just verify.
-- (No-op — kept here for documentation.)

-- 5. Updated audit log support. The audit_logs.entity_type CHECK already
--    allows 'weekly_log' and 'signature'. No change needed.

-- 6. Helpful view: weekly_logs_with_signatures — joins profiles to expose
--    student name, program, department, and supervisor names for reports.
DROP VIEW IF EXISTS weekly_logs_detailed;
CREATE VIEW weekly_logs_detailed AS
SELECT
  wl.*,
  sp.first_name       AS student_first_name,
  sp.last_name        AS student_last_name,
  sp.full_name        AS student_full_name,
  sp.student_id_number AS student_registration_no,
  sp.email            AS student_email,
  d.name              AS student_department_name,
  d.code              AS student_department_code,
  p.name              AS student_program_name,
  p.code              AS student_program_code,
  ssp.full_name       AS site_supervisor_name,
  fsp.full_name       AS faculty_supervisor_name,
  i.title             AS internship_title,
  i.host_org_name     AS internship_host_org
FROM weekly_logs wl
LEFT JOIN profiles   sp  ON sp.user_id  = wl.student_user_id
LEFT JOIN departments d  ON d.id        = sp.department_id
LEFT JOIN programs    p  ON p.id        = sp.program_id
LEFT JOIN profiles   ssp ON ssp.user_id = wl.site_supervisor_id
LEFT JOIN profiles   fsp ON fsp.user_id = wl.faculty_supervisor_id
LEFT JOIN internships i  ON i.id        = wl.internship_id;

COMMENT ON VIEW weekly_logs_detailed IS
  'Convenience view joining weekly_logs with profiles / departments / programs / supervisors for reporting.';
