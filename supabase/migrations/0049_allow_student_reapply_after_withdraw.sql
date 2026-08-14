-- ============================================================================
-- InternHub.pk — 0049_allow_student_reapply_after_withdraw.sql
-- ----------------------------------------------------------------------------
-- BUG: Students who withdrew an application could not reapply. The apply
-- modal would try to INSERT a new row, which failed with the
-- UNIQUE(internship_id, student_user_id) constraint (23505). The previous
-- workaround was to tell the student to "submit a new application" — but
-- the schema didn't allow it.
--
-- The previous migration (e5e63a6, marketplace apply modal) changed the
-- apply flow to UPDATE the existing withdrawn row back to 'pending'
-- instead of INSERTing. But the guard_application_update trigger from
-- migration 0036 blocks that — students may only set status='withdrawn',
-- not status='pending'.
--
-- FIX: Extend guard_application_update to allow students to set status
-- back to 'pending' ONLY when the OLD status was 'withdrawn'. This means:
--   - A student who withdrew can reapply (status: withdrawn → pending).
--   - A student whose app was rejected/accepted by HR CANNOT un-decide
--     it themselves (status: rejected/accepted → pending is still blocked).
--   - All other student update restrictions (can't reassign internship/
--     company/student) remain in force.
--
-- IDEMPOTENT — CREATE OR REPLACE FUNCTION + DROP TRIGGER + CREATE TRIGGER.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION internhub.guard_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  -- When auth.uid() is NULL, the call is from the service_role client
  -- (admin API routes) or the postgres superuser. Both are privileged
  -- contexts that should bypass this guard.
  IF (select auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- super_admin can do anything.
  IF internhub.is_super_admin() THEN
    RETURN NEW;
  END IF;

  v_role := internhub.current_role();

  IF v_role = 'student' THEN
    -- Students may NOT reassign their application to a different
    -- internship, company, or student (applies to withdraw AND reapply).
    IF OLD.internship_id IS DISTINCT FROM NEW.internship_id
       OR OLD.company_id IS DISTINCT FROM NEW.company_id
       OR OLD.student_user_id IS DISTINCT FROM NEW.student_user_id THEN
      RAISE EXCEPTION 'Students cannot reassign an application'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Status transitions allowed for students:
    --   * any → 'withdrawn'  (student cancels their application)
    --   * 'withdrawn' → 'pending'  (student re-applies with updated
    --     cover letter / resume / answers; the marketplace apply modal
    --     uses this path)
    -- Any other status change is forbidden — in particular, students
    -- cannot un-accept or un-reject an application that HR has already
    -- decided on.
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'withdrawn' THEN
        -- Always allowed (withdrawing own app).
        NULL;
      ELSIF OLD.status = 'withdrawn' AND NEW.status = 'pending' THEN
        -- Allowed: reapply after withdraw.
        NULL;
      ELSE
        RAISE EXCEPTION 'Students may only withdraw an application or reapply after withdrawing, not set status %', NEW.status
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  ELSIF v_role = 'company_hr' THEN
    -- HR may only change application status. Rewriting any other column
    -- is forbidden (prevents hijacking applications to different internships
    -- or students).
    IF OLD.internship_id IS DISTINCT FROM NEW.internship_id
       OR OLD.student_user_id IS DISTINCT FROM NEW.student_user_id
       OR OLD.company_id IS DISTINCT FROM NEW.company_id
       OR OLD.cover_letter IS DISTINCT FROM NEW.cover_letter
       OR OLD.resume_url IS DISTINCT FROM NEW.resume_url THEN
      RAISE EXCEPTION 'company_hr may only change application status'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.guard_application_update() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_guard_application_update ON public.internship_applications;
CREATE TRIGGER trg_guard_application_update
  BEFORE UPDATE ON public.internship_applications
  FOR EACH ROW EXECUTE FUNCTION internhub.guard_application_update();

COMMIT;

NOTIFY pgrst, 'reload schema';
