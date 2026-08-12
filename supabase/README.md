# InternHub.pk — Database Setup

This document describes how to apply the InternHub database schema, RLS, storage
policies, and bootstrap the first super-admin.

## Files

All SQL migrations live in [`supabase/migrations/`](./supabase/migrations/):

| # | File | Purpose |
|---|------|---------|
| 0 | `0000_drop_legacy.sql` | Drops any pre-existing tables/types from older incompatible schema versions (DESTRUCTIVE — see warning inside the file). Safe on preview / fresh databases. |
| 1 | `0001_initial_schema.sql` | Tables, indexes, triggers, auto-profile on signup, auto-attendance on task submission. Includes defensive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` blocks so it is fully idempotent against partial prior deployments. |
| 2 | `0002_rls_policies.sql` | Row-Level Security on every tenant/private table |
| 3 | `0003_storage_policies.sql` | Private Storage buckets and Storage RLS policies |
| 4 | `0004_bootstrap_admin.sql` | Admin-only functions to promote the first super-admin / assign roles |
| 5 | `0005_seed.sql` | OPTIONAL — sample universities, departments, programs, companies |

## Apply order

Apply migrations **in order**. Each migration is idempotent.

### Option A — Supabase Dashboard (SQL Editor)

Open the SQL Editor in your Supabase project and run each file in order:
`0000` → `0001` → `0002` → `0003` → `0004` → (optionally) `0005`.

### Option B — Supabase CLI

```bash
supabase db push
# or, one at a time:
supabase db execute --file supabase/migrations/0001_initial_schema.sql
supabase db execute --file supabase/migrations/0002_rls_policies.sql
supabase db execute --file supabase/migrations/0003_storage_policies.sql
supabase db execute --file supabase/migrations/0004_bootstrap_admin.sql
supabase db execute --file supabase/migrations/0005_seed.sql   # optional
```

## Roles

The schema supports these roles (defined as the `user_role` enum):

| Role | Scope |
|------|-------|
| `super_admin` | Global |
| `university_admin` | One university |
| `department_coordinator` | One university + one department |
| `faculty_supervisor` | One university + one department + assigned program(s) |
| `student` | Own user only |
| `company_hr` | One company only |
| `site_supervisor` | Assigned students only |
| `external_evaluator` | Assigned evaluations only |
| `pending_assignment` | Newly registered users awaiting role assignment |

## Bootstrapping the first super_admin

The migration `0004_bootstrap_admin.sql` defines two admin-only functions.
They are `SECURITY DEFINER` and revoked from `anon`/`authenticated` — they can
only be invoked via the SQL Editor (using the service role) or via the
`postgres` role.

### Step 1 — Create the auth user

Use the Supabase Dashboard (Authentication → Users → Add user) or the CLI:

```bash
supabase auth admin create-user \
  --email admin@internhub.pk \
  --password 'CHANGE_ME_IMMEDIATELY' \
  --email-confirm
```

### Step 2 — Promote to super_admin

In the SQL Editor:

```sql
-- Option A: by UUID
SELECT internhub.promote_to_super_admin('<user-uuid>');

-- Option B: by email
SELECT internhub.promote_to_super_admin_by_email('admin@internhub.pk');
```

### Step 3 — Verify

The function will:
1. Insert/upsert a `profiles` row with `role='super_admin'`, `status='active'`.
2. Set `raw_app_meta_data.role='super_admin'` on the `auth.users` row so the
   JWT carries the role (used by `src/proxy.ts`).
3. Insert an `audit_logs` row.

After step 2, the user can sign in and will be redirected to `/super-admin`.

## Assigning scoped roles to other users

Once you have a super_admin, you can assign scoped roles (university_admin,
department_coordinator, etc.) to other users via:

```sql
SELECT internhub.assign_role(
  p_user_id      := '<user-uuid>',
  p_role         := 'university_admin',
  p_university_id := '<university-uuid>'
);
```

The function validates that the department belongs to the university, and the
program belongs to the department, before assigning. It refuses to assign
`super_admin` (use `promote_to_super_admin` for that) and refuses
`pending_assignment`.

## Authentication model

- Supabase Auth is the **only** authentication mechanism. No plaintext
  passwords are stored anywhere in the schema.
- A `profiles` row is auto-created by the `on_auth_user_created` trigger
  whenever a new `auth.users` row appears. The role is taken from
  `raw_user_meta_data.role` (set during signup) and defaults to
  `pending_assignment` if absent.
- The role assigned during signup is **advisory only** — a super_admin or
  university_admin must use `internhub.assign_role()` to grant scoped access.
- For staff accounts that need username login (university admins, coordinators,
  supervisors, HR), the platform stores a `username` column on `profiles` and
  resolves it to an email via the `/api/auth/lookup-user` route, then signs in
  with Supabase password auth. No custom password storage exists.

## Row-Level Security (RLS)

RLS is **enabled and forced** on every tenant/private table. The frontend
cannot bypass RLS — even with the publishable key, all queries are filtered by
the policies in `0002_rls_policies.sql`.

Quick summary of RLS scoping:

| Role | Reads | Writes |
|------|-------|--------|
| `super_admin` | Everything | Everything |
| `university_admin` | Same-university rows | Departments, coordinators in own university |
| `department_coordinator` | Same-department rows | Programs, supervisor assignments in own department |
| `faculty_supervisor` | Assigned students + own department | Tasks, evaluations for assigned students |
| `student` | Own data only | Own profile, tasks, weekly logs, applications, CV |
| `company_hr` | Own company rows | Internships, applications, certificates, evaluations in own company |
| `site_supervisor` | Assigned students only | Evaluations, weekly-log reviews for assigned students |
| `external_evaluator` | Assigned evaluations only | Evaluations assigned to them |

### Verifying RLS

A test matrix is documented in
[`supabase/tests/rls_test_matrix.md`](./tests/rls_test_matrix.md). The matrix
walks through cross-tenant read/write/delete attempts that MUST be denied.

## Storage buckets

Migration `0003_storage_policies.sql` creates these private buckets:

| Bucket | Purpose | Path convention |
|--------|---------|-----------------|
| `cvs` | Student CVs | `cvs/<student_user_id>/<filename>` |
| `task_attachments` | Files for tasks | `task_attachments/<task_id>/<user_id>/<filename>` |
| `internship_letters` | Offer/acceptance letters | `internship_letters/<student_user_id>/<filename>` |
| `certificates` | Completion certificates | `certificates/<student_user_id>/<filename>` |
| `evaluation_files` | Evaluation attachments | `evaluation_files/<student_user_id>/<evaluator_id>/<filename>` |
| `signatures` | Digital signatures | `signatures/<supervisor_user_id>/<filename>` |
| `documents` | General documents | `documents/<user_id>/<filename>` |
| `avatars` | User avatars | `avatars/<user_id>/<filename>` |

All buckets are **private**. Storage RLS policies enforce the same
authorization hierarchy as the database RLS.

## Attendance auto-trigger

The `on_task_submission_attendance` trigger (in `0001_initial_schema.sql`)
automatically creates an `attendance` row marked `present` whenever a student
submits a task. Constraints:

- Idempotent (skips if an attendance row already exists for the same
  student/internship/date).
- Respects internship `end_date` (no attendance after end).
- Uses `CURRENT_DATE` for the attendance date.

## Reporting bugs

If you discover a security issue with the RLS or Storage policies, please
email `security@internhub.pk` instead of opening a public issue.
