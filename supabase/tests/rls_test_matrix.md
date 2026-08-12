# InternHub.pk — RLS Test Matrix

This document describes the cross-tenant authorization tests that MUST pass
for the InternHub RLS layer to be considered secure. Every test expects the
operation to be **denied** (return zero rows, or a 403/permission error).

The matrix is organized by role pair. Each row describes the attempted access
and the expected result. Tests should be executed using the Supabase SQL
Editor or the PostgREST API with each user's access token.

## Test users

For the test matrix to be runnable, you need (at least) the following users in
`auth.users`, each with a corresponding `profiles` row:

| Username | Role | University | Department | Company | Notes |
|----------|------|------------|------------|---------|-------|
| `super_admin` | `super_admin` | — | — | — | Global |
| `ua_a` | `university_admin` | University A | — | — | |
| `ua_b` | `university_admin` | University B | — | — | |
| `dc_a` | `department_coordinator` | University A | Dept A1 | — | |
| `dc_b` | `department_coordinator` | University B | Dept B1 | — | |
| `fs_a` | `faculty_supervisor` | University A | Dept A1 | — | Assigned to Program A1 |
| `fs_b` | `faculty_supervisor` | University B | Dept B1 | — | Assigned to Program B1 |
| `student_a` | `student` | University A | Dept A1 | — | |
| `student_b` | `student` | University B | Dept B1 | — | |
| `hr_a` | `company_hr` | — | — | Company A | |
| `hr_b` | `company_hr` | — | — | Company B | |
| `ss_a` | `site_supervisor` | — | — | Company A | Assigned to Student A |
| `ss_b` | `site_supervisor` | — | — | Company B | Assigned to Student B |
| `ee_a` | `external_evaluator` | — | — | — | Assigned to evaluate Student A |

## Anonymous

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT from `profiles` | DENIED |
| 2 | SELECT from `internships` | DENIED |
| 3 | SELECT from `applications` | DENIED |
| 4 | SELECT from `notifications` | DENIED |
| 5 | INSERT into `profiles` | DENIED |
| 6 | SELECT from `storage.objects` (any private bucket) | DENIED |

## Student A → Student B

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT * FROM profiles WHERE user_id = student_b.id | 0 rows |
| 2 | SELECT * FROM weekly_logs WHERE student_user_id = student_b.id | 0 rows |
| 3 | SELECT * FROM evaluations WHERE student_user_id = student_b.id | 0 rows |
| 4 | SELECT * FROM attendance WHERE student_user_id = student_b.id | 0 rows |
| 5 | SELECT * FROM applications WHERE student_user_id = student_b.id | 0 rows |
| 6 | SELECT * FROM notifications WHERE user_id = student_b.id | 0 rows |
| 7 | UPDATE profiles SET full_name='X' WHERE user_id = student_b.id | 0 rows affected |
| 8 | DELETE FROM weekly_logs WHERE student_user_id = student_b.id | 0 rows affected |
| 9 | Attempt to read storage object at `cvs/<student_b.id>/file.pdf` | DENIED |
| 10 | Attempt to forge `user_id` on INSERT into `weekly_logs` (set to student_b.id) | DENIED by WITH CHECK |

## University Admin A → University B

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT * FROM departments WHERE university_id = univ_b.id | 0 rows |
| 2 | SELECT * FROM profiles WHERE university_id = univ_b.id | 0 rows |
| 3 | SELECT * FROM internships WHERE university_id = univ_b.id | 0 rows |
| 4 | UPDATE departments SET name='X' WHERE university_id = univ_b.id | 0 rows affected |
| 5 | DELETE FROM programs WHERE university_id = univ_b.id | 0 rows affected |
| 6 | INSERT into departments with university_id = univ_b.id | DENIED by WITH CHECK |

## Department Coordinator A → Department B

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT * FROM programs WHERE department_id = dept_b1.id | 0 rows |
| 2 | SELECT * FROM profiles WHERE department_id = dept_b1.id | 0 rows |
| 3 | SELECT * FROM tasks where program is in dept_b1 | 0 rows |
| 4 | UPDATE programs SET name='X' WHERE department_id = dept_b1.id | 0 rows |

## Faculty Supervisor A → Program B

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT * FROM student_internships WHERE faculty_supervisor_id != fs_a.id | Only own rows |
| 2 | SELECT * FROM evaluations WHERE student_user_id NOT IN (assigned) | 0 rows |
| 3 | SELECT * FROM weekly_logs WHERE student_user_id NOT IN (assigned) | 0 rows |
| 4 | INSERT into tasks with program_id in program_b | DENIED by WITH CHECK (created_by check) |

## Company HR A → Company B

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT * FROM internships WHERE company_id = company_b.id | 0 rows |
| 2 | SELECT * FROM applications WHERE company_id = company_b.id | 0 rows |
| 3 | SELECT * FROM student_internships WHERE company_id = company_b.id | 0 rows |
| 4 | UPDATE internships SET title='X' WHERE company_id = company_b.id | 0 rows affected |
| 5 | INSERT into internships with company_id = company_b.id | DENIED by WITH CHECK |

## Site Supervisor A → Student B (not assigned)

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT * FROM profiles WHERE user_id = student_b.id | 0 rows |
| 2 | SELECT * FROM weekly_logs WHERE student_user_id = student_b.id | 0 rows |
| 3 | SELECT * FROM evaluations WHERE student_user_id = student_b.id | 0 rows |
| 4 | INSERT into evaluations (student_user_id = student_b.id, evaluator_id = ss_a.id) | DENIED by WITH CHECK (is_assigned_supervisor returns false) |

## External Evaluator A → Student B

| # | Action | Expected |
|---|--------|----------|
| 1 | SELECT * FROM evaluations WHERE evaluator_id = ee_a.id AND student_user_id = student_b.id | 0 rows |
| 2 | SELECT * FROM profiles WHERE user_id = student_b.id | 0 rows |
| 3 | INSERT into evaluations (student_user_id = student_b.id, evaluator_id = ee_a.id) | DENIED by WITH CHECK |

## Cross-cutting forgery tests

| # | Action | Expected |
|---|--------|----------|
| 1 | Forged `role` in JWT (e.g. set role='super_admin' via raw_user_meta_data) | DENIED — RLS uses `internhub.current_role()` which reads from `profiles.role` (server-controlled) |
| 2 | Forged `university_id` in profiles row (student trying to set another uni) | DENIED by `profiles_update` WITH CHECK (only super_admin / uni_admin can change others) |
| 3 | Forged `sender_id` in notifications (try to send as another user) | DENIED by `notif_insert` WITH CHECK (sender_id must equal auth.uid()) |
| 4 | Direct REST API call to `applications` endpoint with another user's ID | DENIED — RLS applies to REST API too |
| 5 | Direct Storage API call to read another user's CV | DENIED by Storage RLS policy |

## Manual execution

Each test can be executed by signing in as the test user (using their email +
password) and running the SQL query in the SQL Editor or via the PostgREST
API. The expected behavior is documented in the "Expected" column.

For automated regression testing, see
[`run_rls_tests.sql`](./run_rls_tests.sql) for a starter script that runs the
matrix using `SET ROLE` (requires service-role access).
