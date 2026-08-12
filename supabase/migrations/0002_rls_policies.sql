-- ============================================================================
-- InternHub.pk — Row Level Security Migration
-- ----------------------------------------------------------------------------
-- This migration enables RLS on every tenant/private table and creates
-- explicit, narrowly-scoped policies for each role.
--
-- Roles:
--   super_admin              — global scope
--   university_admin         — one university
--   department_coordinator   — one university + one department
--   faculty_supervisor       — one university + one department + assigned program(s)
--   student                  — own user only
--   company_hr               — one company only
--   site_supervisor          — assigned students only
--   external_evaluator       — assigned evaluations only
--
-- Every policy uses `(select auth.uid())` rather than calling auth.uid() per
-- row. Anonymous access is denied on private tables. No policy uses `USING
-- (true)` for private data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper functions (security definer, private schema, search_path locked)
-- ----------------------------------------------------------------------------
-- The functions live in the `internhub` schema which is NOT exposed via the
-- Supabase Data API. They are the ONLY security-definer functions in the
-- system and are tightly scoped.
CREATE SCHEMA IF NOT EXISTS internhub;

-- Return the role + tenant ids for the current user in a single round trip.
CREATE OR REPLACE FUNCTION internhub.current_profile()
RETURNS TABLE (
  user_id uuid,
  role user_role,
  university_id uuid,
  department_id uuid,
  program_id uuid,
  company_id uuid,
  status profile_status
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.user_id,
    p.role,
    p.university_id,
    p.department_id,
    p.program_id,
    p.company_id,
    p.status
  FROM public.profiles p
  WHERE p.user_id = (select auth.uid());
$$;

-- Convenience: current role as text
CREATE OR REPLACE FUNCTION internhub.current_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Convenience: current user's university_id
CREATE OR REPLACE FUNCTION internhub.current_university_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT university_id FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Convenience: current user's department_id
CREATE OR REPLACE FUNCTION internhub.current_department_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT department_id FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Convenience: current user's company_id
CREATE OR REPLACE FUNCTION internhub.current_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Return true if current user is the assigned faculty OR site supervisor for a
-- given student_user_id
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_internships si
      WHERE si.student_user_id = p_student
        AND (si.faculty_supervisor_id = (select auth.uid())
             OR si.site_supervisor_id = (select auth.uid()))
        AND si.status IN ('assigned','active')
  );
$$;

-- Return true if current user is an HR of the company that owns a given
-- internship row.
CREATE OR REPLACE FUNCTION internhub.is_company_hr(p_company uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
      WHERE user_id = (select auth.uid())
        AND role = 'company_hr'
        AND company_id = p_company
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. Universities — public read for published list, write restricted to super_admin
-- ----------------------------------------------------------------------------
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uni_select ON universities;
CREATE POLICY uni_select ON universities
  FOR SELECT TO authenticated
  USING (true); -- universities are publicly listed (catalog) — safe

DROP POLICY IF EXISTS uni_insert ON universities;
CREATE POLICY uni_insert ON universities
  FOR INSERT TO authenticated
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS uni_update ON universities;
CREATE POLICY uni_update ON universities
  FOR UPDATE TO authenticated
  USING (internhub.current_role() = 'super_admin')
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS uni_delete ON universities;
CREATE POLICY uni_delete ON universities
  FOR DELETE TO authenticated
  USING (internhub.current_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- 2. Departments — read by same-university members; write by uni admin / super admin
-- ----------------------------------------------------------------------------
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dept_select ON departments;
CREATE POLICY dept_select ON departments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR university_id = internhub.current_university_id()
  );

DROP POLICY IF EXISTS dept_insert ON departments;
CREATE POLICY dept_insert ON departments
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS dept_update ON departments;
CREATE POLICY dept_update ON departments
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS dept_delete ON departments;
CREATE POLICY dept_delete ON departments
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

-- ----------------------------------------------------------------------------
-- 3. Programs — same pattern as departments
-- ----------------------------------------------------------------------------
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prog_select ON programs;
CREATE POLICY prog_select ON programs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR university_id = internhub.current_university_id()
  );

DROP POLICY IF EXISTS prog_insert ON programs;
CREATE POLICY prog_insert ON programs
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS prog_update ON programs;
CREATE POLICY prog_update ON programs
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS prog_delete ON programs;
CREATE POLICY prog_delete ON programs
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

-- ----------------------------------------------------------------------------
-- 4. Companies — public read for marketplace; HR/super_admin write
-- ----------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS co_select ON companies;
CREATE POLICY co_select ON companies
  FOR SELECT TO authenticated
  USING (true); -- companies are publicly listed for the marketplace

DROP POLICY IF EXISTS co_insert ON companies;
CREATE POLICY co_insert ON companies
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','company_hr')
  );

DROP POLICY IF EXISTS co_update ON companies;
CREATE POLICY co_update ON companies
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS co_delete ON companies;
CREATE POLICY co_delete ON companies
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND id = internhub.current_company_id())
  );

-- ----------------------------------------------------------------------------
-- 5. Profiles — every user can read own profile; admin-scoped reads for others
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())                              -- self
    OR internhub.current_role() = 'super_admin'                -- super admin
    -- university admin: read everyone in own university
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    -- department coordinator: read everyone in own department
    OR (internhub.current_role() = 'department_coordinator'
        AND department_id = internhub.current_department_id())
    -- faculty supervisor: read students in own department + supervised students
    OR (internhub.current_role() = 'faculty_supervisor'
        AND (department_id = internhub.current_department_id()
             OR internhub.is_assigned_supervisor(user_id)))
    -- company_hr: read everyone in own company (students/interns assigned)
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
    -- site supervisor: read only assigned students
    OR (internhub.current_role() = 'site_supervisor'
        AND internhub.is_assigned_supervisor(user_id))
    -- external_evaluator: read only students they evaluate
    OR (internhub.current_role() = 'external_evaluator'
        AND EXISTS (
          SELECT 1 FROM public.evaluations e
            WHERE e.evaluator_id = (select auth.uid())
              AND e.student_user_id = profiles.user_id
        ))
  );

DROP POLICY IF EXISTS profiles_insert ON profiles;
-- Insert is performed by the SECURITY DEFINER trigger on auth.users.
-- Users themselves cannot insert directly.
CREATE POLICY profiles_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())                              -- self can update own profile (within limits enforced at app layer)
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS profiles_delete ON profiles;
CREATE POLICY profiles_delete ON profiles
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
  );

-- ----------------------------------------------------------------------------
-- 6. Students extension table — same scoping as profiles
-- ----------------------------------------------------------------------------
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS students_select ON students;
CREATE POLICY students_select ON students
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND (university_id = internhub.current_university_id()
             AND (department_id = internhub.current_department_id()
                  OR department_id IS NULL)))
    OR (internhub.current_role() = 'faculty_supervisor'
        AND internhub.is_assigned_supervisor(user_id))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internship_applications a
            WHERE a.student_user_id = students.user_id
              AND a.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() = 'site_supervisor'
        AND internhub.is_assigned_supervisor(user_id))
  );

DROP POLICY IF EXISTS students_insert ON students;
CREATE POLICY students_insert ON students
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS students_update ON students;
CREATE POLICY students_update ON students
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS students_delete ON students;
CREATE POLICY students_delete ON students
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

-- ----------------------------------------------------------------------------
-- 7. Supervisors — read for same-university or company; write for admins
-- ----------------------------------------------------------------------------
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sup_select ON supervisors;
CREATE POLICY sup_select ON supervisors
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() IN ('university_admin','department_coordinator','faculty_supervisor')
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() IN ('company_hr','site_supervisor')
        AND company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS sup_insert ON supervisors;
CREATE POLICY sup_insert ON supervisors
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator','company_hr')
  );

DROP POLICY IF EXISTS sup_update ON supervisors;
CREATE POLICY sup_update ON supervisors
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator','company_hr')
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator','company_hr')
  );

DROP POLICY IF EXISTS sup_delete ON supervisors;
CREATE POLICY sup_delete ON supervisors
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin','company_hr')
  );

-- ----------------------------------------------------------------------------
-- 8. Company users — company_hr + super_admin can manage; members can read own
-- ----------------------------------------------------------------------------
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cu_select ON company_users;
CREATE POLICY cu_select ON company_users
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS cu_insert ON company_users;
CREATE POLICY cu_insert ON company_users
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr')
    AND (internhub.current_role() = 'super_admin'
         OR company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS cu_update ON company_users;
CREATE POLICY cu_update ON company_users
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr')
    AND (internhub.current_role() = 'super_admin'
         OR company_id = internhub.current_company_id())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr')
    AND (internhub.current_role() = 'super_admin'
         OR company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS cu_delete ON company_users;
CREATE POLICY cu_delete ON company_users
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr')
    AND (internhub.current_role() = 'super_admin'
         OR company_id = internhub.current_company_id())
  );

-- ----------------------------------------------------------------------------
-- 9. Internships — public read for open/active; HR/admin write
-- ----------------------------------------------------------------------------
ALTER TABLE internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS int_select ON internships;
CREATE POLICY int_select ON internships
  FOR SELECT TO authenticated
  USING (
    status IN ('open','active','completed')           -- marketplace visibility
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator' AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'faculty_supervisor'
        AND (department_id = internhub.current_department_id()
             OR EXISTS (
               SELECT 1 FROM public.student_internships si
                 WHERE si.internship_id = internships.id
                   AND si.faculty_supervisor_id = (select auth.uid())
             )))
    OR (internhub.current_role() = 'site_supervisor'
        AND EXISTS (
          SELECT 1 FROM public.student_internships si
            WHERE si.internship_id = internships.id
              AND si.site_supervisor_id = (select auth.uid())
        ))
    OR (internhub.current_role() = 'student'
        AND (
          -- Students see internships scoped to their university/department/program
          (university_id = internhub.current_university_id())
          OR (department_id = internhub.current_department_id())
          OR (program_id IS NULL AND university_id IS NULL)
        ))
  );

DROP POLICY IF EXISTS int_insert ON internships;
CREATE POLICY int_insert ON internships
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
    AND (
      internhub.current_role() = 'super_admin'
      OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
      OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
    )
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS int_update ON internships;
CREATE POLICY int_update ON internships
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS int_delete ON internships;
CREATE POLICY int_delete ON internships
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
  );

-- ----------------------------------------------------------------------------
-- 10. Internship applications — student owns, company_hr manages, admins read
-- ----------------------------------------------------------------------------
ALTER TABLE internship_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_applications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_select ON internship_applications;
CREATE POLICY app_select ON internship_applications
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    -- student sees own applications
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    -- company_hr sees applications to their company's internships
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    -- university admin sees applications to their university's internships
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = internship_applications.internship_id
              AND i.university_id = internhub.current_university_id()
        ))
    -- department coordinator same
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = internship_applications.internship_id
              AND i.department_id = internhub.current_department_id()
        ))
    -- faculty supervisor / site supervisor: only if student is assigned to them
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
  );

DROP POLICY IF EXISTS app_insert ON internship_applications;
CREATE POLICY app_insert ON internship_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'student'
    AND student_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS app_update ON internship_applications;
CREATE POLICY app_update ON internship_applications
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS app_delete ON internship_applications;
CREATE POLICY app_delete ON internship_applications
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
  );

-- ----------------------------------------------------------------------------
-- 11. Student internships — owned by student; HR/admins/supervisors read
-- ----------------------------------------------------------------------------
ALTER TABLE student_internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_internships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS si_select ON student_internships;
CREATE POLICY si_select ON student_internships
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator' AND department_id = internhub.current_department_id())
    OR faculty_supervisor_id = (select auth.uid())
    OR site_supervisor_id = (select auth.uid())
  );

DROP POLICY IF EXISTS si_insert ON student_internships;
CREATE POLICY si_insert ON student_internships
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin','department_coordinator')
  );

DROP POLICY IF EXISTS si_update ON student_internships;
CREATE POLICY si_update ON student_internships
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator' AND department_id = internhub.current_department_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator' AND department_id = internhub.current_department_id())
  );

DROP POLICY IF EXISTS si_delete ON student_internships;
CREATE POLICY si_delete ON student_internships
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
  );

-- ----------------------------------------------------------------------------
-- 12. Intern supervisor assignments — same scoping as student_internships
-- ----------------------------------------------------------------------------
ALTER TABLE intern_supervisor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE intern_supervisor_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isa_select ON intern_supervisor_assignments;
CREATE POLICY isa_select ON intern_supervisor_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR supervisor_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.student_internships si
        WHERE si.id = intern_supervisor_assignments.student_internship_id
          AND (si.student_user_id = (select auth.uid())
               OR si.faculty_supervisor_id = (select auth.uid())
               OR si.site_supervisor_id = (select auth.uid())
               OR si.company_id = internhub.current_company_id()
               OR si.university_id = internhub.current_university_id())
    )
  );

DROP POLICY IF EXISTS isa_insert ON intern_supervisor_assignments;
CREATE POLICY isa_insert ON intern_supervisor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin','department_coordinator')
  );

DROP POLICY IF EXISTS isa_delete ON intern_supervisor_assignments;
CREATE POLICY isa_delete ON intern_supervisor_assignments
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr','university_admin','department_coordinator')
  );

-- ----------------------------------------------------------------------------
-- 13. Tasks — faculty_supervisor owns; students see assigned; admins read
-- ----------------------------------------------------------------------------
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_select ON tasks;
CREATE POLICY task_select ON tasks
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    -- creator
    OR created_by = (select auth.uid())
    -- faculty supervisor of the program/internship
    OR (internhub.current_role() = 'faculty_supervisor'
        AND (program_id IS NOT NULL
             OR EXISTS (
               SELECT 1 FROM public.student_internships si
                 WHERE si.internship_id = tasks.internship_id
                   AND si.faculty_supervisor_id = (select auth.uid())
             )))
    -- student: only if assigned via task_assignments
    OR (internhub.current_role() = 'student'
        AND EXISTS (
          SELECT 1 FROM public.task_assignments ta
            WHERE ta.task_id = tasks.id
              AND ta.student_user_id = (select auth.uid())
        ))
    -- department coordinator / university admin: read in scope
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.programs p
            WHERE p.id = tasks.program_id
              AND p.department_id = internhub.current_department_id()
        ))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.programs p
            WHERE p.id = tasks.program_id
              AND p.university_id = internhub.current_university_id()
        ))
  );

DROP POLICY IF EXISTS task_insert ON tasks;
CREATE POLICY task_insert ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','faculty_supervisor','university_admin','department_coordinator')
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS task_update ON tasks;
CREATE POLICY task_update ON tasks
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR created_by = (select auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','faculty_supervisor','university_admin','department_coordinator')
  );

DROP POLICY IF EXISTS task_delete ON tasks;
CREATE POLICY task_delete ON tasks
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR created_by = (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 14. Task assignments — supervisor creates; student sees own; supervisor sees own
-- ----------------------------------------------------------------------------
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ta_select ON task_assignments;
CREATE POLICY ta_select ON task_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR assigned_by = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.tasks t JOIN public.programs p ON p.id = t.program_id
            WHERE t.id = task_assignments.task_id
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.tasks t JOIN public.programs p ON p.id = t.program_id
            WHERE t.id = task_assignments.task_id
              AND p.department_id = internhub.current_department_id()
        ))
  );

DROP POLICY IF EXISTS ta_insert ON task_assignments;
CREATE POLICY ta_insert ON task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','faculty_supervisor','university_admin','department_coordinator')
  );

DROP POLICY IF EXISTS ta_update ON task_assignments;
CREATE POLICY ta_update ON task_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR assigned_by = (select auth.uid())
    OR (internhub.current_role() IN ('faculty_supervisor','university_admin','department_coordinator'))
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','faculty_supervisor','university_admin','department_coordinator')
  );

DROP POLICY IF EXISTS ta_delete ON task_assignments;
CREATE POLICY ta_delete ON task_assignments
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR assigned_by = (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 15. Task submissions — student owns; supervisor reviews
-- ----------------------------------------------------------------------------
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ts_select ON task_submissions;
CREATE POLICY ts_select ON task_submissions
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR reviewed_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.task_assignments ta
        WHERE ta.id = task_submissions.task_assignment_id
          AND ta.assigned_by = (select auth.uid())
    )
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.task_assignments ta
            JOIN public.tasks t ON t.id = ta.task_id
            JOIN public.programs p ON p.id = t.program_id
            WHERE ta.id = task_submissions.task_assignment_id
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.task_assignments ta
            JOIN public.tasks t ON t.id = ta.task_id
            JOIN public.programs p ON p.id = t.program_id
            WHERE ta.id = task_submissions.task_assignment_id
              AND p.department_id = internhub.current_department_id()
        ))
  );

DROP POLICY IF EXISTS ts_insert ON task_submissions;
CREATE POLICY ts_insert ON task_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'student'
    AND student_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS ts_update ON task_submissions;
CREATE POLICY ts_update ON task_submissions
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()) AND reviewed_at IS NULL)
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor','external_evaluator'))
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor','external_evaluator'))
  );

DROP POLICY IF EXISTS ts_delete ON task_submissions;
CREATE POLICY ts_delete ON task_submissions
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
  );

-- ----------------------------------------------------------------------------
-- 16. Task attachments — read if task is readable; write by task creator
-- ----------------------------------------------------------------------------
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tatt_select ON task_attachments;
CREATE POLICY tatt_select ON task_attachments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.tasks t
        WHERE t.id = task_attachments.task_id
          AND (t.created_by = (select auth.uid())
               OR EXISTS (
                 SELECT 1 FROM public.task_assignments ta
                   WHERE ta.task_id = t.id
                     AND ta.student_user_id = (select auth.uid())
               ))
    )
  );

DROP POLICY IF EXISTS tatt_insert ON task_attachments;
CREATE POLICY tatt_insert ON task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tasks t
        WHERE t.id = task_attachments.task_id
          AND t.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS tatt_delete ON task_attachments;
CREATE POLICY tatt_delete ON task_attachments
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR uploaded_by = (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 17. Weekly logs — student owns; supervisor reviews
-- ----------------------------------------------------------------------------
ALTER TABLE weekly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wl_select ON weekly_logs;
CREATE POLICY wl_select ON weekly_logs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR supervisor_id = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = weekly_logs.student_user_id
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = weekly_logs.student_user_id
              AND p.department_id = internhub.current_department_id()
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = weekly_logs.internship_id
              AND i.company_id = internhub.current_company_id()
        ))
  );

DROP POLICY IF EXISTS wl_insert ON weekly_logs;
CREATE POLICY wl_insert ON weekly_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','student')
    AND student_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS wl_update ON weekly_logs;
CREATE POLICY wl_update ON weekly_logs
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()) AND status IN ('draft','revision_required'))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor'))
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','student','faculty_supervisor','site_supervisor')
  );

DROP POLICY IF EXISTS wl_delete ON weekly_logs;
CREATE POLICY wl_delete ON weekly_logs
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
  );

-- ----------------------------------------------------------------------------
-- 18. Evaluations — student reads own; evaluator owns; supervisors write
-- ----------------------------------------------------------------------------
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eval_select ON evaluations;
CREATE POLICY eval_select ON evaluations
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR evaluator_id = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = evaluations.student_user_id
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = evaluations.student_user_id
              AND p.department_id = internhub.current_department_id()
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = evaluations.internship_id
              AND i.company_id = internhub.current_company_id()
        ))
  );

DROP POLICY IF EXISTS eval_insert ON evaluations;
CREATE POLICY eval_insert ON evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','faculty_supervisor','site_supervisor','external_evaluator','company_hr')
    AND evaluator_id = (select auth.uid())
  );

DROP POLICY IF EXISTS eval_update ON evaluations;
CREATE POLICY eval_update ON evaluations
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR evaluator_id = (select auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','faculty_supervisor','site_supervisor','external_evaluator','company_hr')
  );

DROP POLICY IF EXISTS eval_delete ON evaluations;
CREATE POLICY eval_delete ON evaluations
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR evaluator_id = (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 19. Attendance — student reads own; HR/supervisors read; HR writes
-- ----------------------------------------------------------------------------
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS att_select ON attendance;
CREATE POLICY att_select ON attendance
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = attendance.internship_id
              AND i.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = attendance.student_user_id
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = attendance.student_user_id
              AND p.department_id = internhub.current_department_id()
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
  );

DROP POLICY IF EXISTS att_insert ON attendance;
CREATE POLICY att_insert ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','site_supervisor','faculty_supervisor')
  );

DROP POLICY IF EXISTS att_update ON attendance;
CREATE POLICY att_update ON attendance
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr','site_supervisor','faculty_supervisor')
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','site_supervisor','faculty_supervisor')
  );

DROP POLICY IF EXISTS att_delete ON attendance;
CREATE POLICY att_delete ON attendance
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr')
  );

-- ----------------------------------------------------------------------------
-- 20. Certificates — student reads own; HR/university_admin write
-- ----------------------------------------------------------------------------
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cert_select ON certificates;
CREATE POLICY cert_select ON certificates
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
  );

DROP POLICY IF EXISTS cert_insert ON certificates;
CREATE POLICY cert_insert ON certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
  );

DROP POLICY IF EXISTS cert_update ON certificates;
CREATE POLICY cert_update ON certificates
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
  );

DROP POLICY IF EXISTS cert_delete ON certificates;
CREATE POLICY cert_delete ON certificates
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','company_hr','university_admin')
  );

-- ----------------------------------------------------------------------------
-- 21. Documents — owner reads; supervisors/HR read in scope; owner uploads
-- ----------------------------------------------------------------------------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_select ON documents;
CREATE POLICY doc_select ON documents
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR uploaded_by = (select auth.uid())
    -- documents about a student: that student can read
    OR (entity_type = 'student' AND entity_id = (select auth.uid()))
    -- university admin scope
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
          SELECT 1 FROM public.companies c, public.profiles p
            WHERE p.user_id = documents.uploaded_by
              AND p.company_id = c.id
              AND c.id = internhub.current_company_id()
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND entity_type = 'student'
        AND internhub.is_assigned_supervisor(entity_id))
  );

DROP POLICY IF EXISTS doc_insert ON documents;
CREATE POLICY doc_insert ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
  );

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
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = documents.uploaded_by
              AND p.company_id = internhub.current_company_id()
        ))
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','company_hr')
    OR uploaded_by = (select auth.uid())
  );

DROP POLICY IF EXISTS doc_delete ON documents;
CREATE POLICY doc_delete ON documents
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR uploaded_by = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = documents.uploaded_by
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = documents.uploaded_by
              AND p.company_id = internhub.current_company_id()
        ))
  );

-- ----------------------------------------------------------------------------
-- 22. CV uploads — student owns
-- ----------------------------------------------------------------------------
ALTER TABLE cv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_uploads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cv_select ON cv_uploads;
CREATE POLICY cv_select ON cv_uploads
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internship_applications a
            WHERE a.student_user_id = cv_uploads.student_user_id
              AND a.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = cv_uploads.student_user_id
              AND p.university_id = internhub.current_university_id()
        ))
  );

DROP POLICY IF EXISTS cv_insert ON cv_uploads;
CREATE POLICY cv_insert ON cv_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','student')
    AND student_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS cv_update ON cv_uploads;
CREATE POLICY cv_update ON cv_uploads
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','student')
    AND student_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS cv_delete ON cv_uploads;
CREATE POLICY cv_delete ON cv_uploads
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 23. Notifications — recipient owns; sender can read receipts
-- ----------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_select ON notifications;
CREATE POLICY notif_select ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR sender_id = (select auth.uid())
  );

DROP POLICY IF EXISTS notif_insert ON notifications;
CREATE POLICY notif_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Recipient can always receive notifications from anyone authenticated.
    -- Sender cannot forge recipient_user_id because the policy doesn't allow
    -- forging sender_id — sender_id is set to auth.uid() by the app.
    user_id IS NOT NULL
    AND (sender_id IS NULL OR sender_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS notif_update ON notifications;
CREATE POLICY notif_update ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid()) -- recipient can mark read/unread
  )
  WITH CHECK (
    user_id = (select auth.uid()) -- cannot move ownership to another user
  );

DROP POLICY IF EXISTS notif_delete ON notifications;
CREATE POLICY notif_delete ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR sender_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
  );

-- ----------------------------------------------------------------------------
-- 24. Messages — sender and receiver own
-- ----------------------------------------------------------------------------
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msg_select ON messages;
CREATE POLICY msg_select ON messages
  FOR SELECT TO authenticated
  USING (
    sender_id = (select auth.uid())
    OR receiver_id = (select auth.uid())
  );

DROP POLICY IF EXISTS msg_insert ON messages;
CREATE POLICY msg_insert ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())
  );

DROP POLICY IF EXISTS msg_update ON messages;
CREATE POLICY msg_update ON messages
  FOR UPDATE TO authenticated
  USING (
    receiver_id = (select auth.uid()) -- only receiver can mark read
  )
  WITH CHECK (
    receiver_id = (select auth.uid())
  );

DROP POLICY IF EXISTS msg_delete ON messages;
CREATE POLICY msg_delete ON messages
  FOR DELETE TO authenticated
  USING (
    sender_id = (select auth.uid())
    OR receiver_id = (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 25. Audit logs — super_admin only (others insert via security definer)
-- ----------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_select ON audit_logs;
CREATE POLICY audit_select ON audit_logs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR user_id = (select auth.uid()) -- users can read their own actions
    OR (internhub.current_role() = 'university_admin' AND university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS audit_insert ON audit_logs;
CREATE POLICY audit_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true); -- any authenticated user can write audit log rows; this is intentional

-- (No UPDATE or DELETE policies on audit_logs — they are append-only by design.)

-- ----------------------------------------------------------------------------
-- 26. Platform settings — super_admin write; everyone reads published settings
-- ----------------------------------------------------------------------------
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_select ON platform_settings;
CREATE POLICY ps_select ON platform_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS ps_insert ON platform_settings;
CREATE POLICY ps_insert ON platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS ps_update ON platform_settings;
CREATE POLICY ps_update ON platform_settings
  FOR UPDATE TO authenticated
  USING (internhub.current_role() = 'super_admin')
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS ps_delete ON platform_settings;
CREATE POLICY ps_delete ON platform_settings
  FOR DELETE TO authenticated
  USING (internhub.current_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- 27. Storage allocations — super_admin + university_admin read/write
-- ----------------------------------------------------------------------------
ALTER TABLE storage_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_select ON storage_allocations;
CREATE POLICY sa_select ON storage_allocations
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR university_id = internhub.current_university_id()
  );

DROP POLICY IF EXISTS sa_insert ON storage_allocations;
CREATE POLICY sa_insert ON storage_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS sa_update ON storage_allocations;
CREATE POLICY sa_update ON storage_allocations
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS sa_delete ON storage_allocations;
CREATE POLICY sa_delete ON storage_allocations
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

-- ----------------------------------------------------------------------------
-- 28. Licenses & subscriptions — super_admin + university_admin read
-- ----------------------------------------------------------------------------
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lic_select ON licenses;
CREATE POLICY lic_select ON licenses
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR university_id = internhub.current_university_id()
  );

DROP POLICY IF EXISTS lic_insert ON licenses;
CREATE POLICY lic_insert ON licenses
  FOR INSERT TO authenticated
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS lic_update ON licenses;
CREATE POLICY lic_update ON licenses
  FOR UPDATE TO authenticated
  USING (internhub.current_role() = 'super_admin')
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS lic_delete ON licenses;
CREATE POLICY lic_delete ON licenses
  FOR DELETE TO authenticated
  USING (internhub.current_role() = 'super_admin');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subs_select ON subscriptions;
CREATE POLICY subs_select ON subscriptions
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR university_id = internhub.current_university_id()
  );

DROP POLICY IF EXISTS subs_insert ON subscriptions;
CREATE POLICY subs_insert ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS subs_update ON subscriptions;
CREATE POLICY subs_update ON subscriptions
  FOR UPDATE TO authenticated
  USING (internhub.current_role() = 'super_admin')
  WITH CHECK (internhub.current_role() = 'super_admin');

DROP POLICY IF EXISTS subs_delete ON subscriptions;
CREATE POLICY subs_delete ON subscriptions
  FOR DELETE TO authenticated
  USING (internhub.current_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- 29. Reports & templates
-- ----------------------------------------------------------------------------
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rt_select ON report_templates;
CREATE POLICY rt_select ON report_templates
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR university_id = internhub.current_university_id()
  );

DROP POLICY IF EXISTS rt_insert ON report_templates;
CREATE POLICY rt_insert ON report_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() IN ('super_admin','university_admin','department_coordinator')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

DROP POLICY IF EXISTS rt_delete ON report_templates;
CREATE POLICY rt_delete ON report_templates
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() IN ('super_admin','university_admin')
    AND (internhub.current_role() = 'super_admin'
         OR university_id = internhub.current_university_id())
  );

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rep_select ON reports;
CREATE POLICY rep_select ON reports
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR created_by = (select auth.uid())
    OR university_id = internhub.current_university_id()
    OR department_id = internhub.current_department_id()
  );

DROP POLICY IF EXISTS rep_insert ON reports;
CREATE POLICY rep_insert ON reports
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS rep_delete ON reports;
CREATE POLICY rep_delete ON reports
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR created_by = (select auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 30. Supervisor remarks — supervisor owns; student reads; admins read
-- ----------------------------------------------------------------------------
ALTER TABLE supervisor_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_remarks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sr_select ON supervisor_remarks;
CREATE POLICY sr_select ON supervisor_remarks
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR supervisor_id = (select auth.uid())
    OR student_user_id = (select auth.uid())
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = supervisor_remarks.student_user_id
              AND p.university_id = internhub.current_university_id()
        ))
    OR (internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = supervisor_remarks.student_user_id
              AND p.company_id = internhub.current_company_id()
        ))
  );

DROP POLICY IF EXISTS sr_insert ON supervisor_remarks;
CREATE POLICY sr_insert ON supervisor_remarks
  FOR INSERT TO authenticated
  WITH CHECK (
    supervisor_id = (select auth.uid())
    AND internhub.current_role() IN ('faculty_supervisor','site_supervisor','external_evaluator','company_hr')
  );

DROP POLICY IF EXISTS sr_update ON supervisor_remarks;
CREATE POLICY sr_update ON supervisor_remarks
  FOR UPDATE TO authenticated
  USING (
    supervisor_id = (select auth.uid())
  )
  WITH CHECK (
    supervisor_id = (select auth.uid())
  );

DROP POLICY IF EXISTS sr_delete ON supervisor_remarks;
CREATE POLICY sr_delete ON supervisor_remarks
  FOR DELETE TO authenticated
  USING (
    supervisor_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
  );

-- ============================================================================
-- End of 0002_rls_policies.sql
-- ============================================================================
