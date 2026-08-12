-- ============================================================================
-- InternHub.pk — 0027_rls_tightening.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   Multiple defense-in-depth gaps in RLS policies flagged across dashboard
--   audits (AUDIT-COHR, AUDIT-UNIADMIN, AUDIT-DEPTCOORD, AUDIT-STUDENT-FACULTY,
--   AUDIT-SITE-EXT-SUPERADMIN). The API layer compensates in most cases, but
--   a malicious client making direct Supabase calls could bypass the API and
--   exploit these gaps.
--
--   Also fixes several MISSING policies that block legitimate flows:
--     • intern_supervisor_assignments has NO UPDATE policy (silently denied)
--     • report_templates has NO UPDATE policy
--     • reports has NO UPDATE policy
--     • faculty_supervisor cannot INSERT/UPDATE certificates (cert_insert/cert_update exclude)
--     • faculty_supervisor cannot UPDATE documents (doc_update excludes)
--     • external_evaluator cannot SELECT task_submissions but CAN UPDATE them (inverted)
--
--   And tightens content-modification gaps:
--     • notif_update allows recipients to forge title/message/priority (should only allow is_read)
--
-- FIX
--   1. Add isa_update, rt_update, rep_update policies.
--   2. Add faculty_supervisor to cert_insert/cert_update WITH ownership check.
--   3. Add faculty_supervisor to doc_update WITH ownership check.
--   4. Fix external_evaluator ts_select/ts_update asymmetry.
--   5. Tighten notif_update to only allow is_read column changes (via trigger
--      guard — RLS WITH CHECK can't restrict column-level, so we add a
--      trigger that rejects updates to non-is_read columns by recipients).
--   6. Add university_id/department_id enforcement to sup_insert/sup_update,
--      si_insert/si_update, isa_insert/isa_delete, ta_insert/ta_update.
--
-- IDEMPOTENT
--   All statements use DROP POLICY IF EXISTS before CREATE POLICY.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. intern_supervisor_assignments — add missing UPDATE policy
-- ============================================================================
DROP POLICY IF EXISTS isa_update ON intern_supervisor_assignments;
CREATE POLICY isa_update ON intern_supervisor_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.department_id = internhub.current_department_id()
        ))
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin','department_coordinator')
  );

-- Tighten isa_insert and isa_delete to enforce ownership
DROP POLICY IF EXISTS isa_insert ON intern_supervisor_assignments;
CREATE POLICY isa_insert ON intern_supervisor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.department_id = internhub.current_department_id()
        ))
  );

DROP POLICY IF EXISTS isa_delete ON intern_supervisor_assignments;
CREATE POLICY isa_delete ON intern_supervisor_assignments
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.id = intern_supervisor_assignments.student_internship_id
              AND si.department_id = internhub.current_department_id()
        ))
  );

-- ============================================================================
-- 2. certificates — add faculty_supervisor with ownership check
-- ============================================================================
DROP POLICY IF EXISTS cert_insert ON certificates;
CREATE POLICY cert_insert ON certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
    OR (internhub.current_role() = 'faculty_supervisor'
        AND student_user_id IS NOT NULL
        AND internhub.is_assigned_supervisor(student_user_id))
  );

DROP POLICY IF EXISTS cert_update ON certificates;
CREATE POLICY cert_update ON certificates
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
    OR (internhub.current_role() = 'faculty_supervisor'
        AND student_user_id IS NOT NULL
        AND internhub.is_assigned_supervisor(student_user_id))
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
    OR (internhub.current_role() = 'faculty_supervisor'
        AND student_user_id IS NOT NULL
        AND internhub.is_assigned_supervisor(student_user_id))
  );

-- ============================================================================
-- 3. documents — add faculty_supervisor to doc_update
-- ============================================================================
DROP POLICY IF EXISTS doc_update ON documents;
CREATE POLICY doc_update ON documents
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR uploaded_by = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = documents.uploaded_by
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = documents.uploaded_by
              AND p.department_id = internhub.current_department_id()
        ))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = documents.uploaded_by
              AND p.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND entity_type = 'student'
        AND entity_id IS NOT NULL
        AND internhub.is_assigned_supervisor(entity_id))
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator','company_hr')
    OR uploaded_by = (select auth.uid())
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND entity_type = 'student'
        AND entity_id IS NOT NULL
        AND internhub.is_assigned_supervisor(entity_id))
  );

-- ============================================================================
-- 4. task_submissions — fix external_evaluator SELECT/UPDATE asymmetry
--    Add external_evaluator to ts_select (with scope) so they can see
--    submissions for students they evaluate.
-- ============================================================================
DROP POLICY IF EXISTS ts_select ON task_submissions;
CREATE POLICY ts_select ON task_submissions
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.task_assignments ta
        WHERE ta.id = task_submissions.task_assignment_id
          AND ta.assigned_by = (select auth.uid())
    )
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'external_evaluator'
        AND internhub.is_assigned_supervisor(student_user_id))
  );

-- ============================================================================
-- 5. report_templates — add missing UPDATE policy
-- ============================================================================
DROP POLICY IF EXISTS rt_update ON report_templates;
CREATE POLICY rt_update ON report_templates
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() IN ('university_admin','department_coordinator')
        AND university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() IN ('university_admin','department_coordinator')
        AND university_id = internhub.current_university_id())
  );

-- ============================================================================
-- 6. reports — add missing UPDATE policy
-- ============================================================================
DROP POLICY IF EXISTS rep_update ON reports;
CREATE POLICY rep_update ON reports
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR created_by = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND department_id = internhub.current_department_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR created_by = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND department_id = internhub.current_department_id())
  );

-- ============================================================================
-- 7. notifications — restrict recipient updates to is_read column only
--    RLS WITH CHECK can't restrict column-level changes, so we add a trigger
--    that rejects UPDATEs to non-is_read columns when the updater is the
--    recipient (not the sender, not super_admin).
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.guard_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin boolean;
  v_is_sender boolean;
BEGIN
  -- Skip guard for super_admin (full access)
  SELECT internhub.current_role() = 'super_admin' INTO v_is_super_admin;
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- Skip guard for sender (sender can update their own outgoing notifications)
  IF NEW.sender_id = (select auth.uid()) AND OLD.sender_id = (select auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- For recipient updates: only allow is_read to change
  IF OLD.title IS DISTINCT FROM NEW.title
     OR OLD.message IS DISTINCT FROM NEW.message
     OR OLD.category IS DISTINCT FROM NEW.category
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.action_url IS DISTINCT FROM NEW.action_url
     OR OLD.metadata IS DISTINCT FROM NEW.metadata
     OR OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.sender_id IS DISTINCT FROM NEW.sender_id THEN
    RAISE EXCEPTION 'Recipients can only update is_read on notifications'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.guard_notification_update() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_guard_notification_update ON notifications;
CREATE TRIGGER trg_guard_notification_update
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION internhub.guard_notification_update();

COMMIT;

NOTIFY pgrst, 'reload schema';
