-- ============================================================================
-- 0087: Coordinator workflow RLS hardening (2026-08-24)
-- ----------------------------------------------------------------------------
-- Closes the RLS gaps identified during the coordinator-workflow refactor:
--
--   GAP-SI2/SI1 — site_supervisor assignment to student_internships was not
--                 gated by the linked application being in 'accepted' state.
--                 Now: a BEFORE UPDATE trigger on student_internships blocks
--                 setting site_supervisor_id unless the linked application is
--                 accepted AND the internship is still active.
--
--   GAP-S1     — supervisors INSERT for program_coordinator checked
--                 university_id only. Now also requires department_id =
--                 current_department_id() so a PC cannot create a supervisor
--                 in another department.
--
--   GAP-S2     — sup_delete was blanket (any HR/UA could delete any
--                 supervisor). Now scoped: company_hr → own company;
--                 university_admin → own university; super_admin → any.
--
--   GAP-PR1    — programs INSERT for department_coordinator checked
--                 university_id only. Now also requires department_id =
--                 current_department_id().
--
--   GAP-ISA2   — intern_supervisor_assignments UPDATE with_check was
--                 role-only, allowing student_internship_id rewrites to
--                 out-of-scope rows. Now mirrors the USING predicate.
-- ============================================================================

-- ============================================================================
-- GAP-SI2/SI1: state guard for site_supervisor assignment
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.guard_si_site_supervisor_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_app_status text;
BEGIN
  -- Only guard when site_supervisor_id is being SET (NULL → non-NULL, or
  -- changed to a different supervisor). Re-assignment of an existing
  -- supervisor is allowed (same state) — only NEW assignments need the
  -- accepted-state gate.
  IF NEW.site_supervisor_id IS NOT DISTINCT FROM OLD.site_supervisor_id THEN
    RETURN NEW;
  END IF;

  -- The internship must still be active (not completed/cancelled/expired).
  IF NEW.status IN ('completed', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Cannot assign a site supervisor to a completed or cancelled internship'
      USING ERRCODE = 'check_violation';
  END IF;

  -- The linked application must be in 'accepted' state. SI rows are
  -- normally created at acceptance, but an application can be later
  -- withdrawn/rejected — in that case a new site supervisor assignment
  -- must be blocked.
  IF NEW.application_id IS NOT NULL THEN
    SELECT status::text INTO v_app_status
    FROM public.internship_applications
    WHERE id = NEW.application_id;

    IF v_app_status IS NULL OR v_app_status <> 'accepted' THEN
      RAISE EXCEPTION 'Cannot assign a site supervisor: the linked application is not in accepted state (current: %)',
        COALESCE(v_app_status, 'not found')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_si_site_supervisor ON public.student_internships;
CREATE TRIGGER trg_guard_si_site_supervisor
  BEFORE UPDATE OF site_supervisor_id ON public.student_internships
  FOR EACH ROW
  EXECUTE FUNCTION internhub.guard_si_site_supervisor_assignment();

-- ============================================================================
-- GAP-S1: supervisors INSERT — PC must be department-scoped
-- ============================================================================
DROP POLICY IF EXISTS sup_insert ON public.supervisors;
CREATE POLICY sup_insert ON public.supervisors
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND university_id = internhub.current_university_id()
    )
    OR (
      internhub."current_role"() = 'program_coordinator'::user_role
      AND university_id = internhub.current_university_id()
      AND department_id = internhub.current_department_id()
    )
    OR (
      internhub."current_role"() = 'company_hr'::user_role
      AND company_id = internhub.current_company_id()
    )
  );

-- ============================================================================
-- GAP-S2: supervisors DELETE — tenant-scoped (was blanket)
-- ============================================================================
DROP POLICY IF EXISTS sup_delete ON public.supervisors;
CREATE POLICY sup_delete ON public.supervisors
  FOR DELETE TO authenticated
  USING (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND university_id = internhub.current_university_id()
    )
    OR (
      internhub."current_role"() = 'company_hr'::user_role
      AND company_id = internhub.current_company_id()
    )
  );

-- ============================================================================
-- GAP-PR1: programs INSERT — DC must be department-scoped
-- ============================================================================
DROP POLICY IF EXISTS prog_insert ON public.programs;
CREATE POLICY prog_insert ON public.programs
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND university_id = internhub.current_university_id()
    )
    OR (
      internhub."current_role"() = 'department_coordinator'::user_role
      AND university_id = internhub.current_university_id()
      AND department_id = internhub.current_department_id()
    )
  );

-- ============================================================================
-- GAP-ISA2: intern_supervisor_assignments UPDATE — mirror USING in WITH CHECK
--   The table has no company_id column — it joins to student_internships
--   via student_internship_id. The WITH CHECK must use the NEW row's
--   student_internship_id so a caller cannot rewrite it to an
--   out-of-scope row.
-- ============================================================================
DROP POLICY IF EXISTS isa_update ON public.intern_supervisor_assignments;
CREATE POLICY isa_update ON public.intern_supervisor_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'company_hr'::user_role
      AND EXISTS (
        SELECT 1 FROM public.student_internships si
        WHERE si.id = intern_supervisor_assignments.student_internship_id
          AND si.company_id = internhub.current_company_id()
      )
    )
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND EXISTS (
        SELECT 1 FROM public.student_internships si
        WHERE si.id = intern_supervisor_assignments.student_internship_id
          AND si.university_id = internhub.current_university_id()
      )
    )
    OR (
      internhub."current_role"() = 'department_coordinator'::user_role
      AND EXISTS (
        SELECT 1 FROM public.student_internships si
        WHERE si.id = intern_supervisor_assignments.student_internship_id
          AND si.department_id = internhub.current_department_id()
      )
    )
  )
  WITH CHECK (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'company_hr'::user_role
      AND EXISTS (
        SELECT 1 FROM public.student_internships si
        WHERE si.id = intern_supervisor_assignments.student_internship_id
          AND si.company_id = internhub.current_company_id()
      )
    )
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND EXISTS (
        SELECT 1 FROM public.student_internships si
        WHERE si.id = intern_supervisor_assignments.student_internship_id
          AND si.university_id = internhub.current_university_id()
      )
    )
    OR (
      internhub."current_role"() = 'department_coordinator'::user_role
      AND EXISTS (
        SELECT 1 FROM public.student_internships si
        WHERE si.id = intern_supervisor_assignments.student_internship_id
          AND si.department_id = internhub.current_department_id()
      )
    )
  );
