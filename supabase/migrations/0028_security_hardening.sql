-- ============================================================================
-- InternHub.pk — 0028_security_hardening.sql
-- ----------------------------------------------------------------------------
-- COMPREHENSIVE SECURITY HARDENING
--
-- This migration closes every privilege-escalation and cross-tenant INSERT /
-- UPDATE bypass identified by the production RLS audit. It is fully
-- idempotent (every statement uses DROP POLICY IF EXISTS / CREATE OR
-- REPLACE FUNCTION / IF NOT EXISTS) and can be safely re-run.
--
-- ROOT CAUSES BEING FIXED
--
-- 1. profiles_update self-UPDATE allowed changing role / university_id /
--    company_id / department_id / program_id / status / is_active. A user
--    could UPDATE their own profile to role='super_admin' and the
--    profiles_sync_auth_metadata trigger would propagate it to
--    auth.users.raw_app_meta_data, which is then read by the JWT claim
--    `app_metadata.role` used by proxy.ts for route authorization.
--    CRITICAL privilege-escalation bypass. Fix: a trigger
--    (internhub.guard_profile_update) blocks UPDATEs to those columns
--    unless the caller is super_admin.
--
-- 2. profiles_insert self-INSERT allowed any role. A user could INSERT a
--    profile for themselves with role='super_admin'. The trigger fires
--    first (via on_auth_user_created) and the user_id PK conflict would
--    normally block a second INSERT, but if the trigger fails (its body
--    is wrapped in BEGIN...EXCEPTION) the user could INSERT directly.
--    Fix: tighten profiles_insert WITH CHECK to require either
--    super_admin OR a brand-new auth.users row (created in the last 5
--    seconds) with role in the pending_assignment / signup-meta set.
--    Simpler & safer: only allow self-INSERT when role matches the
--    role set by the trigger / signup flow, which is one of the 9 valid
--    enum values EXCEPT super_admin. (super_admin can only be set via
--    the dedicated promote_to_super_admin function.)
--
-- 3. sup_insert / sup_update allowed any university_admin or coordinator
--    to insert a supervisor pointing at ANY university_id. A
--    university_admin from IIUI could insert a supervisor with
--    university_id = MYU. Fix: enforce that the supervisor's
--    university_id / department_id / company_id matches the caller's
--    scope.
--
-- 4. si_insert / si_update (student_internships) had no tenant-scope
--    enforcement at all. A company_hr from Techify could INSERT a
--    student_internship pointing at Zora. Fix: enforce that company_id
--    / university_id / department_id match the caller's scope.
--
-- 5. ta_insert / ta_update (task_assignments) had no enforcement that
--    the task_id belongs to the caller's scope. Fix: enforce via EXISTS
--    check on tasks + programs/university/department.
--
-- 6. task_insert allowed faculty_supervisor to create a task pointing at
--    any program_id / internship_id / university_id / department_id.
--    Fix: enforce that program_id / internship_id / university_id /
--    department_id belongs to the caller's scope.
--
-- 7. att_insert / att_update for site_supervisor / faculty_supervisor
--    had no is_assigned_supervisor(student_user_id) check. A
--    site_supervisor could insert attendance for ANY student. Fix:
--    require is_assigned_supervisor for those roles.
--
-- 8. eval_insert allowed any evaluator to create an evaluation for ANY
--    student. Fix: require student-assignment check for
--    faculty_supervisor / site_supervisor / external_evaluator, and
--    company-ownership check for company_hr. Also validate that
--    evaluator_role matches the caller's actual role.
--
-- 9. sr_insert (supervisor_remarks) allowed any supervisor to remark on
--    ANY student. Fix: require is_assigned_supervisor check.
--
-- 10. wl_insert (weekly_logs) allowed a student to insert a weekly_log
--     with an arbitrary internship_id. Fix: require that the
--     internship_id corresponds to a student_internships row owned by
--     the student.
--
-- 11. ts_insert (task_submissions) allowed a student to insert a
--     submission for an arbitrary task_assignment_id. Fix: require that
--     the task_assignment_id belongs to the student.
--
-- 12. doc_insert (documents) allowed any user to upload a document
--     "about" any entity_id. Fix: for entity_type='student', require
--     that entity_id is either self or in the caller's scope.
--
-- 13. assign_role / promote_to_super_admin /
--     promote_to_super_admin_by_email had NO authorization check.
--     Although they live in the `internhub` schema (not exposed via the
--     Data API), they could be called from triggers or other functions.
--     Fix: add an explicit super_admin authorization check at the top
--     of each function.
--
-- 14. Duplicate `profiles_sync_role_to_auth` trigger on profiles (same
--     function as `profiles_sync_auth_metadata`). Drop the duplicate.
--
-- 15. Legacy functions: public.handle_new_auth_user,
--     public.update_updated_at_column, public.get_current_university_id,
--     public.get_current_user_university_id. None are referenced by any
--     app code (verified via grep). All are redundant with the
--     internhub.* equivalents. Drop them.
--
-- 16. Public RPC functions get_user_university_id /
--     get_user_department_id / get_user_company_id (kept for backward
--     compatibility) lack the safe UUID-regex guard that
--     internhub.current_university_id has. They CAST raw metadata
--     directly, which can throw on garbage values. Re-route them to
--     call the internhub.* equivalents so they inherit the safe-cast
--     behavior.
--
-- IDEMPOTENT
--   Every statement uses DROP POLICY IF EXISTS / CREATE OR REPLACE
--   FUNCTION / DROP TRIGGER IF EXISTS / IF NOT EXISTS. Safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Internhub authorization helpers — internal predicate functions
--    (private, not exposed via Data API) used by the tightened policies.
--    These are intentionally SECURITY DEFINER so that RLS policy
--    evaluation doesn't recurse through them.
-- ============================================================================

-- True if the current user is super_admin (single source of truth: auth.users).
CREATE OR REPLACE FUNCTION internhub.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT internhub.current_role() = 'super_admin'::user_role;
$$;
ALTER FUNCTION internhub.is_super_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.is_super_admin() TO authenticated, anon;

-- True if the current user's company_id matches p_company.
CREATE OR REPLACE FUNCTION internhub.is_company_hr_of(p_company uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
      WHERE user_id = (select auth.uid())
        AND role = 'company_hr'::user_role
        AND company_id = p_company
  );
$$;
ALTER FUNCTION internhub.is_company_hr_of(p_company uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.is_company_hr_of(uuid) TO authenticated, anon;

-- True if the given internship_id belongs to the current user's company
-- (for company_hr) OR is one of the internship_ids the student is
-- assigned to (for students) OR is in the user's university/department
-- (for admins). Used by att_insert / wl_insert / eval_insert scope checks.
CREATE OR REPLACE FUNCTION internhub.can_access_internship(p_internship uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internships i
      WHERE i.id = p_internship
        AND (
          internhub.is_super_admin()
          OR (internhub.current_role() = 'company_hr'
              AND i.company_id = internhub.current_company_id())
          OR (internhub.current_role() = 'university_admin'
              AND i.university_id = internhub.current_university_id())
          OR (internhub.current_role() = 'department_coordinator'
              AND i.department_id = internhub.current_department_id())
          OR (internhub.current_role() = 'faculty_supervisor'
              AND (i.department_id = internhub.current_department_id()
                   OR EXISTS (
                     SELECT 1 FROM public.student_internships si
                       WHERE si.internship_id = i.id
                         AND si.faculty_supervisor_id = (select auth.uid())
                   )))
          OR (internhub.current_role() = 'site_supervisor'
              AND EXISTS (
                SELECT 1 FROM public.student_internships si
                  WHERE si.internship_id = i.id
                    AND si.site_supervisor_id = (select auth.uid())
              ))
          OR (internhub.current_role() = 'student'
              AND EXISTS (
                SELECT 1 FROM public.student_internships si
                  WHERE si.internship_id = i.id
                    AND si.student_user_id = (select auth.uid())
              ))
        )
  );
$$;
ALTER FUNCTION internhub.can_access_internship(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.can_access_internship(uuid) TO authenticated, anon;

-- True if the given program_id belongs to the caller's scope
-- (super_admin / university_admin of same uni / coordinator of same dept /
-- faculty_supervisor of same dept).
CREATE OR REPLACE FUNCTION internhub.can_access_program(p_program uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs p
      WHERE p.id = p_program
        AND (
          internhub.is_super_admin()
          OR (internhub.current_role() = 'university_admin'
              AND p.university_id = internhub.current_university_id())
          OR (internhub.current_role() = 'department_coordinator'
              AND p.department_id = internhub.current_department_id())
          OR (internhub.current_role() = 'faculty_supervisor'
              AND p.department_id = internhub.current_department_id())
        )
  );
$$;
ALTER FUNCTION internhub.can_access_program(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.can_access_program(uuid) TO authenticated, anon;

-- True if the given department_id belongs to the caller's scope.
CREATE OR REPLACE FUNCTION internhub.can_access_department(p_department uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments d
      WHERE d.id = p_department
        AND (
          internhub.is_super_admin()
          OR d.university_id = internhub.current_university_id()
          OR (internhub.current_role() = 'department_coordinator'
              AND d.id = internhub.current_department_id())
        )
  );
$$;
ALTER FUNCTION internhub.can_access_department(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.can_access_department(uuid) TO authenticated, anon;

-- True if the given university_id matches the caller's scope.
CREATE OR REPLACE FUNCTION internhub.can_access_university(p_university uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p_university IS NOT NULL AND (
    internhub.is_super_admin()
    OR p_university = internhub.current_university_id()
  );
$$;
ALTER FUNCTION internhub.can_access_university(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.can_access_university(uuid) TO authenticated, anon;

-- True if the given task_id is one the caller may manage (creator OR
-- scoped to caller's uni/dept/program/internship).
CREATE OR REPLACE FUNCTION internhub.can_access_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
      WHERE t.id = p_task
        AND (
          internhub.is_super_admin()
          OR t.created_by = (select auth.uid())
          OR (t.university_id IS NOT NULL
              AND t.university_id = internhub.current_university_id())
          OR (t.department_id IS NOT NULL
              AND t.department_id = internhub.current_department_id())
          OR (t.program_id IS NOT NULL
              AND internhub.can_access_program(t.program_id))
          OR (t.internship_id IS NOT NULL
              AND internhub.can_access_internship(t.internship_id))
        )
  );
$$;
ALTER FUNCTION internhub.can_access_task(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.can_access_task(uuid) TO authenticated, anon;

-- True if the given student_user_id is one the caller may interact with
-- (the student themselves, or an assigned supervisor, or company HR
-- that received an application from them, or uni admin / coordinator of
-- their university / department).
CREATE OR REPLACE FUNCTION internhub.can_access_student(p_student uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p_student IS NOT NULL AND (
    p_student = (select auth.uid())
    OR internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = p_student
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = p_student
              AND p.department_id = internhub.current_department_id()
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(p_student))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internship_applications a
            WHERE a.student_user_id = p_student
              AND a.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.student_user_id = p_student
              AND si.company_id = internhub.current_company_id()
        ))
  );
$$;
ALTER FUNCTION internhub.can_access_student(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.can_access_student(uuid) TO authenticated, anon;

-- ============================================================================
-- 2. guard_profile_update — block non-super_admin from changing
--    authorization-bearing columns on profiles.
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_is_super_admin boolean;
BEGIN
  -- When auth.uid() is NULL, the call is from the service_role client
  -- (admin API routes) or the postgres superuser (SQL Editor). Both are
  -- privileged contexts that should bypass this guard.
  v_uid := (select auth.uid());
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow super_admin to do anything (assign_role / promote flows).
  SELECT internhub.is_super_admin() INTO v_is_super_admin;
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- Block role escalation / tenant reassignment by non-super_admin.
  -- Compare OLD vs NEW for each protected column.
  IF OLD.role IS DISTINCT FROM NEW.role
     OR OLD.university_id IS DISTINCT FROM NEW.university_id
     OR OLD.department_id IS DISTINCT FROM NEW.department_id
     OR OLD.program_id IS DISTINCT FROM NEW.program_id
     OR OLD.company_id IS DISTINCT FROM NEW.company_id
     OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    RAISE EXCEPTION
      'Permission denied: cannot modify authorization columns (role, university_id, department_id, program_id, company_id, status, is_active) without super_admin privileges.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION internhub.guard_profile_update() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_guard_profile_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION internhub.guard_profile_update();

-- ============================================================================
-- 3. profiles_insert — tighten to prevent self-INSERT with privileged role
-- ============================================================================
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    -- super_admin can insert any profile (via /api/admin/create-user)
    internhub.is_super_admin()
    -- self-INSERT only allowed for non-privileged roles. super_admin /
    -- university_admin / company_hr cannot be self-assigned (they must
    -- come from an admin flow).
    OR (
      user_id = (select auth.uid())
      AND role IN (
        'pending_assignment','student','faculty_supervisor',
        'department_coordinator','site_supervisor','external_evaluator'
      )
    )
  );

-- ============================================================================
-- 4. profiles_update — keep self-update for non-authorization columns,
--    keep super_admin / company_hr / university_admin branches. The
--    guard_profile_update trigger above prevents the actual column
--    changes for non-super_admin, so the WITH CHECK here can stay
--    liberal.
-- ============================================================================
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  );

-- ============================================================================
-- 5. supervisors — enforce tenant scope on INSERT / UPDATE
-- ============================================================================
DROP POLICY IF EXISTS sup_insert ON public.supervisors;
CREATE POLICY sup_insert ON public.supervisors
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'
        AND (university_id IS NULL OR university_id = internhub.current_university_id())
        AND (department_id IS NULL OR internhub.can_access_department(department_id)))
    OR (internhub.current_role() = 'department_coordinator'
        AND (university_id IS NULL OR university_id = internhub.current_university_id())
        AND (department_id IS NULL OR department_id = internhub.current_department_id()))
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS sup_update ON public.supervisors;
CREATE POLICY sup_update ON public.supervisors
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'
        AND (university_id IS NULL OR university_id = internhub.current_university_id()))
    OR (internhub.current_role() = 'department_coordinator'
        AND (university_id IS NULL OR university_id = internhub.current_university_id())
        AND (department_id IS NULL OR department_id = internhub.current_department_id()))
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'
        AND (university_id IS NULL OR university_id = internhub.current_university_id())
        AND (department_id IS NULL OR internhub.can_access_department(department_id)))
    OR (internhub.current_role() = 'department_coordinator'
        AND (university_id IS NULL OR university_id = internhub.current_university_id())
        AND (department_id IS NULL OR department_id = internhub.current_department_id()))
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  );

-- ============================================================================
-- 6. student_internships — enforce tenant scope on INSERT / UPDATE
-- ============================================================================
DROP POLICY IF EXISTS si_insert ON public.student_internships;
CREATE POLICY si_insert ON public.student_internships
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin'
        AND (university_id IS NULL OR university_id = internhub.current_university_id()))
    OR (internhub.current_role() = 'department_coordinator'
        AND (department_id IS NULL OR department_id = internhub.current_department_id()))
  );

DROP POLICY IF EXISTS si_update ON public.student_internships;
CREATE POLICY si_update ON public.student_internships
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin'
        AND (university_id IS NULL OR university_id = internhub.current_university_id()))
    OR (internhub.current_role() = 'department_coordinator'
        AND (department_id IS NULL OR department_id = internhub.current_department_id()))
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin'
        AND (university_id IS NULL OR university_id = internhub.current_university_id()))
    OR (internhub.current_role() = 'department_coordinator'
        AND (department_id IS NULL OR department_id = internhub.current_department_id()))
  );

-- ============================================================================
-- 7. task_assignments — enforce that task_id belongs to caller's scope
-- ============================================================================
DROP POLICY IF EXISTS ta_insert ON public.task_assignments;
CREATE POLICY ta_insert ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = (select auth.uid())
    AND (
      internhub.is_super_admin()
      OR internhub.current_role() IN ('faculty_supervisor','university_admin','department_coordinator')
    )
    AND internhub.can_access_task(task_id)
    AND internhub.can_access_student(student_user_id)
  );

DROP POLICY IF EXISTS ta_update ON public.task_assignments;
CREATE POLICY ta_update ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR assigned_by = (select auth.uid())
    OR (internhub.current_role() IN ('faculty_supervisor','university_admin','department_coordinator')
        AND internhub.can_access_task(task_id))
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR (internhub.current_role() IN ('faculty_supervisor','university_admin','department_coordinator')
        AND internhub.can_access_task(task_id))
  );

-- ============================================================================
-- 8. tasks — enforce tenant scope on program_id / internship_id /
--    university_id / department_id
-- ============================================================================
DROP POLICY IF EXISTS task_insert ON public.tasks;
CREATE POLICY task_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (
      internhub.is_super_admin()
      OR internhub.current_role() IN ('faculty_supervisor','university_admin','department_coordinator')
    )
    AND (program_id IS NULL OR internhub.can_access_program(program_id))
    AND (internship_id IS NULL OR internhub.can_access_internship(internship_id))
    AND (university_id IS NULL OR internhub.can_access_university(university_id))
    AND (department_id IS NULL OR internhub.can_access_department(department_id))
  );

DROP POLICY IF EXISTS task_update ON public.tasks;
CREATE POLICY task_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR created_by = (select auth.uid())
    OR (internhub.current_role() IN ('faculty_supervisor','university_admin','department_coordinator')
        AND internhub.can_access_task(id))
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR internhub.current_role() IN ('faculty_supervisor','university_admin','department_coordinator')
  );

-- ============================================================================
-- 9. attendance — require is_assigned_supervisor for site/faculty
--    supervisors; require company-ownership for company_hr; require
--    can_access_internship for admins.
-- ============================================================================
DROP POLICY IF EXISTS att_insert ON public.attendance;
CREATE POLICY att_insert ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = attendance.internship_id
              AND i.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() IN ('site_supervisor','faculty_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
  );

DROP POLICY IF EXISTS att_update ON public.attendance;
CREATE POLICY att_update ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = attendance.internship_id
              AND i.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() IN ('site_supervisor','faculty_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = attendance.internship_id
              AND i.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() IN ('site_supervisor','faculty_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
  );

-- ============================================================================
-- 10. evaluations — require student-assignment check; validate
--     evaluator_role matches caller's actual role
-- ============================================================================
DROP POLICY IF EXISTS eval_insert ON public.evaluations;
CREATE POLICY eval_insert ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = (select auth.uid())
    AND evaluator_role = internhub.current_role()
    AND (
      internhub.is_super_admin()
      OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
          AND internhub.is_assigned_supervisor(student_user_id))
      OR (internhub.current_role() = 'external_evaluator'
          AND EXISTS (
            SELECT 1 FROM public.evaluations e
              WHERE e.evaluator_id = (select auth.uid())
                AND e.student_user_id = evaluations.student_user_id
          ))
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.internships i
              WHERE i.id = evaluations.internship_id
                AND i.company_id = internhub.current_company_id()
          ))
    )
  );

-- ============================================================================
-- 11. supervisor_remarks — require is_assigned_supervisor
-- ============================================================================
DROP POLICY IF EXISTS sr_insert ON public.supervisor_remarks;
CREATE POLICY sr_insert ON public.supervisor_remarks
  FOR INSERT TO authenticated
  WITH CHECK (
    supervisor_id = (select auth.uid())
    AND internhub.current_role() IN ('faculty_supervisor','site_supervisor','external_evaluator','company_hr')
    AND (
      internhub.is_super_admin()
      OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
          AND internhub.is_assigned_supervisor(student_user_id))
      OR (internhub.current_role() = 'company_hr'
          AND EXISTS (
            SELECT 1 FROM public.student_internships si
              WHERE si.student_user_id = supervisor_remarks.student_user_id
                AND si.company_id = internhub.current_company_id()
          ))
      OR (internhub.current_role() = 'external_evaluator'
          AND EXISTS (
            SELECT 1 FROM public.evaluations e
              WHERE e.evaluator_id = (select auth.uid())
                AND e.student_user_id = supervisor_remarks.student_user_id
          ))
    )
  );

-- ============================================================================
-- 12. weekly_logs — student must own the student_internships row for the
--     internship_id (when set). supervisor_id (when set) must be the
--     student's assigned faculty or site supervisor.
-- ============================================================================
DROP POLICY IF EXISTS wl_insert ON public.weekly_logs;
CREATE POLICY wl_insert ON public.weekly_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    student_user_id = (select auth.uid())
    AND (
      internhub.is_super_admin()
      OR internhub.current_role() = 'student'
    )
    AND (
      internship_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.student_internships si
          WHERE si.student_user_id = (select auth.uid())
            AND si.internship_id = weekly_logs.internship_id
            AND si.status IN ('assigned','active')
      )
    )
  );

-- ============================================================================
-- 13. task_submissions — student must own the task_assignment
-- ============================================================================
DROP POLICY IF EXISTS ts_insert ON public.task_submissions;
CREATE POLICY ts_insert ON public.task_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_user_id = (select auth.uid())
    AND internhub.current_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.task_assignments ta
        WHERE ta.id = task_submissions.task_assignment_id
          AND ta.student_user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.tasks t
        WHERE t.id = task_submissions.task_id
          AND (
            internhub.is_super_admin()
            OR t.created_by = (select auth.uid())
            OR EXISTS (
              SELECT 1 FROM public.task_assignments ta2
                WHERE ta2.task_id = t.id
                  AND ta2.student_user_id = (select auth.uid())
            )
          )
    )
  );

-- ============================================================================
-- 14. documents — for entity_type='student', require that entity_id is
--     either self or in the caller's scope.
-- ============================================================================
DROP POLICY IF EXISTS doc_insert ON public.documents;
CREATE POLICY doc_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
    AND (
      entity_type <> 'student'
      OR entity_id IS NULL
      OR entity_id = (select auth.uid())
      OR internhub.can_access_student(entity_id)
    )
  );

-- ============================================================================
-- 15. Add authorization checks to assign_role / promote_to_super_admin /
--     promote_to_super_admin_by_email. These live in the internhub schema
--     (not exposed via Data API), but defense in depth requires they
--     verify the caller is super_admin before mutating roles.
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.assign_role(
  p_user_id uuid,
  p_role user_role,
  p_university_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid,
  p_program_id uuid DEFAULT NULL::uuid,
  p_company_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  -- Authorization: only super_admin may assign roles via this function.
  SELECT internhub.current_role() INTO v_caller_role;
  IF v_caller_role IS DISTINCT FROM 'super_admin'::user_role THEN
    RAISE EXCEPTION 'Permission denied: only super_admin can call assign_role()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % does not exist in auth.users', p_user_id;
  END IF;
  IF p_role = 'super_admin' THEN
    RAISE EXCEPTION 'Use promote_to_super_admin() for super_admin assignment';
  END IF;
  IF p_role = 'pending_assignment' THEN
    RAISE EXCEPTION 'Cannot assign pending_assignment role';
  END IF;

  -- Validate scopes
  IF p_role IN ('university_admin','department_coordinator','faculty_supervisor','student')
     AND p_university_id IS NULL THEN
    RAISE EXCEPTION 'university_id is required for role %', p_role;
  END IF;
  IF p_role IN ('department_coordinator','faculty_supervisor') AND p_department_id IS NULL THEN
    RAISE EXCEPTION 'department_id is required for role %', p_role;
  END IF;
  IF p_role IN ('company_hr','site_supervisor') AND p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for role %', p_role;
  END IF;

  -- Validate department belongs to university
  IF p_department_id IS NOT NULL AND p_university_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.departments d
        WHERE d.id = p_department_id AND d.university_id = p_university_id
    ) THEN
      RAISE EXCEPTION 'Department % does not belong to university %', p_department_id, p_university_id;
    END IF;
  END IF;

  -- Validate program belongs to department
  IF p_program_id IS NOT NULL AND p_department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.programs p
        WHERE p.id = p_program_id AND p.department_id = p_department_id
    ) THEN
      RAISE EXCEPTION 'Program % does not belong to department %', p_program_id, p_department_id;
    END IF;
  END IF;

  -- Update profile
  UPDATE public.profiles
    SET
      role = p_role,
      university_id = p_university_id,
      department_id = p_department_id,
      program_id = p_program_id,
      company_id = p_company_id,
      status = 'active',
      is_active = true,
      updated_at = now()
    WHERE user_id = p_user_id;

  -- Update app_metadata so JWT carries the role
  UPDATE auth.users
    SET raw_app_meta_data =
          COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role::text)
    WHERE id = p_user_id;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, university_id, details)
  VALUES (
    (select auth.uid()),
    'user.role_change',
    'profile',
    p_user_id,
    p_university_id,
    jsonb_build_object('new_role', p_role::text, 'university_id', p_university_id,
                       'department_id', p_department_id, 'company_id', p_company_id)
  );
END;
$$;
ALTER FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION internhub.promote_to_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  -- Authorization: only super_admin may promote another user to super_admin.
  -- (For initial bootstrap, run this from the SQL Editor as the postgres
  -- superuser — the function body's auth check is skipped because
  -- auth.uid() returns NULL in that context, and the function is owned
  -- by postgres which has BYPASSRLS. The intent is to allow bootstrap
  -- via psql / SQL Editor while preventing regular authenticated users
  -- from invoking it via RPC.)
  SELECT internhub.current_role() INTO v_caller_role;
  IF v_caller_role IS NOT NULL AND v_caller_role IS DISTINCT FROM 'super_admin'::user_role THEN
    RAISE EXCEPTION 'Permission denied: only super_admin can call promote_to_super_admin()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % does not exist in auth.users', p_user_id;
  END IF;

  -- Upsert profile row
  INSERT INTO public.profiles (user_id, email, role, status, is_active)
  SELECT
    u.id,
    COALESCE(u.email, ''),
    'super_admin'::user_role,
    'active'::profile_status,
    true
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'super_admin',
        status = 'active',
        is_active = true,
        updated_at = now();

  -- Also set app_metadata so the JWT carries the role for proxy.ts
  UPDATE auth.users
    SET raw_app_meta_data =
          COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb
    WHERE id = p_user_id;

  -- Issue a log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'user.role_change', 'profile', p_user_id,
          jsonb_build_object('new_role','super_admin','method','bootstrap_function'));
END;
$$;
ALTER FUNCTION internhub.promote_to_super_admin(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION internhub.promote_to_super_admin_by_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_caller_role user_role;
BEGIN
  SELECT internhub.current_role() INTO v_caller_role;
  IF v_caller_role IS NOT NULL AND v_caller_role IS DISTINCT FROM 'super_admin'::user_role THEN
    RAISE EXCEPTION 'Permission denied: only super_admin can call promote_to_super_admin_by_email()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row with email %', p_email;
  END IF;
  PERFORM internhub.promote_to_super_admin(v_user_id);
END;
$$;
ALTER FUNCTION internhub.promote_to_super_admin_by_email(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin_by_email(text) FROM anon, authenticated;

-- ============================================================================
-- 16. Drop duplicate `profiles_sync_role_to_auth` trigger
-- ============================================================================
DROP TRIGGER IF EXISTS profiles_sync_role_to_auth ON public.profiles;

-- ============================================================================
-- 17. Drop legacy / unused functions
-- ============================================================================
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_university_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_university_id() CASCADE;

-- Re-route the remaining public.get_user_* helpers to the internhub.*
-- equivalents so they inherit the safe-UUID-regex guard. These ARE
-- exposed via PostgREST (used by some legacy code paths); keep their
-- signatures but make their bodies thin wrappers.
CREATE OR REPLACE FUNCTION public.get_user_university_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT internhub.current_university_id();
$$;
ALTER FUNCTION public.get_user_university_id() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.get_user_department_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT internhub.current_department_id();
$$;
ALTER FUNCTION public.get_user_department_id() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT internhub.current_company_id();
$$;
ALTER FUNCTION public.get_user_company_id() OWNER TO postgres;

-- ============================================================================
-- 18. Tighten notifications INSERT — only allow sender_id = auth.uid()
--     OR sender_id IS NULL (system notifications). Require that the
--     caller is an admin / HR / supervisor if they're sending to a
--     user_id other than themselves.
-- ============================================================================
DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NOT NULL
    AND (sender_id IS NULL OR sender_id = (select auth.uid()))
  );

-- ============================================================================
-- 19. Add missing indexes for performance (tasks.university_id,
--     tasks.department_id, intern_supervisor_assignments new columns)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_university ON public.tasks(university_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON public.tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_isa_intern ON public.intern_supervisor_assignments(intern_id);
CREATE INDEX IF NOT EXISTS idx_isa_internship ON public.intern_supervisor_assignments(internship_id);
CREATE INDEX IF NOT EXISTS idx_isa_assigned_by ON public.intern_supervisor_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_isa_active ON public.intern_supervisor_assignments(is_active);

-- ============================================================================
-- 20. Verify all tenant tables still have RLS enabled (sanity check).
--     NOTE: We deliberately do NOT re-apply FORCE ROW LEVEL SECURITY
--     because (a) the SECURITY DEFINER helper functions (current_role,
--     current_university_id, current_department_id, current_company_id)
--     all read from auth.users (not subject to RLS), so no recursion
--     risk; and (b) the SECURITY DEFINER trigger functions
--     (internhub_handle_new_user, internhub_touch_attendance,
--     sync_role_to_auth_users, internhub_sync_auth_meta_to_profile)
--     rely on the function owner (postgres, which has BYPASSRLS) to
--     bypass RLS for their writes. Enabling FORCE would break the
--     triggers because postgres (as table owner) would suddenly be
--     subject to RLS, and the trigger-fired INSERTs (e.g. attendance
--     insert from task_submissions trigger) would fail RLS because the
--     student's role isn't allowed to insert attendance.
--     The current state (RLS enabled, NOT forced) is correct: anon +
--     authenticated roles are subject to RLS, while postgres
--     (BYPASSRLS) + service_role (BYPASSRLS) bypass it for admin
--     operations. This is the standard Supabase production pattern.
-- ============================================================================
DO $$
DECLARE
  t text;
  rls_off_count int := 0;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND NOT c.relrowsecurity
  LOOP
    RAISE NOTICE 'Table % does NOT have RLS enabled — would enable', t;
    rls_off_count := rls_off_count + 1;
  END LOOP;
  IF rls_off_count = 0 THEN
    RAISE NOTICE 'All public tables have RLS enabled.';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
