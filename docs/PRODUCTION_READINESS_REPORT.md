# InternHub.pk (CareerStep) — Production Readiness Audit, Testing & Remediation Report

**Date:** 2026-08-23
**Repo:** github.com/internhubpk/internhub.pk (main @ `9a73722` → branch `production-readiness-audit` @ `6bd44e1`, pushed)
**Supabase:** `wqvbmjlloxsrvwhtdskv` (project *internhubpk*, region ap-northeast-1, PostgreSQL 17.6)

---

## 1. Executive Summary

This is a well-engineered Next.js 16 + Supabase multi-tenant system: 321 TS/TSX files, 40 tables, 182 RLS policies, and 9 role dashboards. The dashboards render real data, the service-role key is confined to server-side code, and no secrets exist in git history.

**However, live exploitation proved the system was NOT production-ready at audit start.** The database authorization helpers trusted user-writable JWT metadata fallbacks. Via the public `PUT /auth/v1/user` endpoint, this audit:

1. **Escalated a controlled test account to FULL super_admin** — read all 39 profiles, 9 audit_logs, 5 students, and 15 weekly_logs across tenants, and modified another user's profile (restored afterwards).
2. **Performed tenant hopping** — `user_metadata.university_id` was forged, a trigger wrote it into `profiles.university_id` AND laundered it into `app_metadata`, granting foreign-university department/program reads.
3. **Found the real `superadmin@internhub.pk` account running on that spoofable fallback** (`app_metadata.role` NULL).

**All of this was remediated during the audit** (migration 0084 applied LIVE to production + 7 code commits pushed). Every attack was re-executed post-fix and **BLOCKED**; legitimate scoping was regression-verified.

**Remaining blockers:** password reset is broken end-to-end (no SMTP), email confirmation is disabled, and a medium RLS/storage hygiene set remains → verdict **NOT PRODUCTION READY** (a narrow, enumerated gap).

### Pre/Post Status Table

| # | Area | At audit start | After remediation |
|---|------|----------------|-------------------|
| 1 | Role escalation via user-writable metadata fallback (`current_role()` etc.) | **CRITICAL — live-proven** (test account became full super_admin; T3/W6) | **Fixed live (migration 0084) + branch; re-attacked → BLOCKED** |
| 2 | Tenant hopping via forged `user_metadata.university_id` (trigger laundering) | **CRITICAL — live-proven** (foreign dept/program reads; T8) | **Fixed live (0084); re-attacked → BLOCKED** |
| 3 | Real superadmin account on spoofable fallback | Exposed (app_metadata.role NULL) | Protected (DB no longer honors user metadata) |
| 4 | Admin API routes with JWT-metadata role fallback (4 routes) | HIGH | Fixed on branch (DB-verified `profiles.role`) |
| 5 | Open redirects (`redirect_to` / `next`) | HIGH | Fixed on branch (`src/lib/safe-redirect.ts`) |
| 6 | No rate limiting on auth endpoints | HIGH (zero call sites) | Fixed on branch (in-memory, per-instance) |
| 7 | `/api/coordinators` calling `auth.admin.*` on publishable client | HIGH (workflow dead) | Fixed on branch (service-role client) |
| 8 | PC Settings fake save (lying UI) | Defect | Fixed on branch (real persist) |
| 9 | Password reset end-to-end | **HIGH — broken (no SMTP, no update mode)** | **OPEN** |
| 10 | Email confirmation disabled + weak server password policy (min 6) | **HIGH — OPEN** | **OPEN (platform config)** |
| 11 | RLS/storage hygiene set (audit_logs check, view invoker, anon DML, public buckets, unscoped deletes, student cert update) | MEDIUM | OPEN (documented) |
| 12 | Verdict | NOT PRODUCTION READY | **NOT PRODUCTION READY** (gap narrowed to items 9–11 + API/dashboard polish) |

---

## 2. Architecture Findings

- **Stack:** Next.js 16.1.3 App Router/webpack, React 19, `@supabase/ssr` 0.12, Tailwind 4, shadcn/ui, Serwist PWA, web-push.
- **Routing:** `middleware.ts` → `src/proxy.ts` (Next 16 proxy pattern); the proxy **skips `/api/*`**, so API routes self-authorize (verified).
- **Role source of truth** was 3 disagreeing layers (JWT `app_metadata`, `profiles.role`, `internhub.*` SQL helpers with a `user_metadata` fallback) — now aligned, and `user_metadata` is untrusted everywhere.
- **Tenancy:** University tenants (subdomain routing, apex-scoped cookies) + company tenants; isolation is DB-enforced.
- **Debt:** 3 overlapping security helper libraries; `resource-auth.ts` is dead code; only 11/90 routes use `authorization.ts`; migration 0069/0070 revokes were silently undone by later ALL-FUNCTIONS grants (re-revoked in 0084).
- **Observation:** a second audit session hit the same DB at 12:06 (12 `production-audit-*@test.internhub.pk` accounts, cleaned up in §15). GoTrue-level signup role sanitization was observed live but is unattributable to repo code (platform-level).

---

## 3. Database Findings

- **40 tables, all RLS-enabled** (evaluations/tasks/task_* additionally FORCE RLS); **182 policies**.
- `internhub` helper schema is SECURITY DEFINER with `row_security = off` (migrations 0063–0065 anti-recursion design).
- **Migration state:** deployed migrations 0000–0083 = repo HEAD; **0084 applied + recorded live**.
- **Integrity:** 0 orphans; clean 1:1 `auth.users` ↔ `profiles` post-cleanup; FK graph (27 tables) surveyed before deletion; production internship row preserved.
- **Post-cleanup volumes:** 25 users (4 students; 3 each company_hr / faculty_supervisor / department_coordinator / university_admin; 2 each program_coordinator / site_supervisor / super_admin / pending_assignment; 1 external_evaluator), 4 universities, 6 departments, 6 programs, 12 companies, 7 internships, 4 applications, 10 weekly_logs, 0 certificates, 1 MOU.
- **Open issues (documented):** `audit_logs` INSERT `WITH CHECK(true)` forgeable; `weekly_logs_with_names` view not `security_invoker`; anon DML grants from 0007; public buckets `certificates`/`avatars`/`signatures`/`internship_images`; `cert_delete`/`sup_delete` lack tenant predicates; students can UPDATE their own certificates (all **MEDIUM**, documented).
- **Performance:** client-side full-table aggregation on super-admin dashboards; `limit(500)`/`limit(50)` truncation caps.

---

## 4. RLS Findings (tested directly, live)

**Harness:** `set_config('role','authenticated')` + `request.jwt.claims` impersonation, plus real signed-in REST calls. **Identities:** audit accounts per role + the real `university_admin`.

### Pre-remediation

| Test | Identity → Target | Result | Verdict |
|------|-------------------|--------|---------|
| T1 | anon → sensitive tables | 0 rows (internships 7 = marketplace open/active, by design) | **PASS** |
| T2 | pending → other profiles | own only (1) | **PASS** |
| T3 | pending + forged `user_metadata.role=super_admin` (app role NULL) | `current_role()` = super_admin; **39 profiles, 9 audit_logs, 5 students, 15 weekly_logs** | **FAIL — CRITICAL** |
| W6 | same forged identity UPDATE another user's profile | 1 row changed (`AUDIT-PROBE-HACKED`, restored) | **FAIL — CRITICAL** |
| T4 | student@MyU → cross-tenant student list | 0 | **PASS** |
| T5/W1 | student UPDATE foreign weekly_log | 0 rows, unchanged | **PASS** |
| T6 | company_hr@TechCorp → internships | own only (1); Systems Ltd 0 | **PASS** |
| W2 | company_hr UPDATE foreign internship | 0 rows (PostgREST 204 = 0-row update, verified against DB) | **PASS** |
| W3 | company_hr DELETE foreign internship | blocked | **PASS** |
| W4 | pending INSERT foreign department | 42501 blocked | **PASS** |
| T8 | self-signup + forged `user_metadata.university_id` | `profiles.university_id` rewritten + `app_metadata` laundered; foreign dept/program reads | **FAIL — CRITICAL** |
| R | real university_admin@MyU | 10 profiles, 1 dept, 2 students (correct subset) | **PASS** |

### Post-remediation

| Re-attack | Result | Verdict |
|-----------|--------|---------|
| Forged `super_admin` on backfilled no-role account | pending; 1 profile, 0 audit, 0 students | **BLOCKED** |
| Fresh re-forge via `PUT /auth/v1/user` (role accepted into user_metadata) | still pending; no elevated reads | **BLOCKED** |
| Tenant hop re-attack (COMSATS) | profile unchanged; pollution reverted; 0 foreign depts/programs | **BLOCKED** |
| HR company hop + role forge | company_id stayed TechCorp; `current_role()` = company_hr; Systems internships 0 | **BLOCKED** |
| Regression: student@MyU + university_admin@MyU | correct scoping | **PASS** |

**Verdict:** boundaries hold; the escapes were metadata-trust issues, not policy-logic defects.

---

## 5. Authentication Findings

- **Fixed:** proxy + auth-provider no longer use `user_metadata` fallbacks; 4 admin routes (`assign-role`, `create-user`, `update-admin-account`, `students/bulk`) now DB-verify `profiles.role`; open redirects (`redirect_to`/`next`) fixed via new `src/lib/safe-redirect.ts`; rate limiting wired into `lookup-user`, handoff create/consume, `reset-password`, cert verify (in-memory, per-instance).
- **OPEN HIGH — password reset broken end-to-end:** links route to `/auth/confirm`, which handles only `type=email`; update mode unimplemented; **no SMTP configured** (`smtp_admin_email` = null).
- **OPEN HIGH:** `mailer_autoconfirm=true` + open signup + server-side minimum password of 6 (client zod policy is bypassable via direct API).
- **Sound:** 60s single-use atomic handoff tokens; `lookup-user` enumeration surface is staff-only and now rate-limited/validated.
- Signup `user_metadata.role` forgery is blocked at the GoTrue layer (live-verified, platform-level), and the DB no longer honors it (0084).

---

## 6. API Findings

- **90 routes audited**; 74 use inline `getUser()` + profile checks; company-hr family (17 routes) role+company scoped; student routes have ownership checks; site-supervisor routes have assignment checks; cert verify exposes curated fields only.
- **Fixed on branch:** 4 privileged routes' metadata fallbacks; `/api/coordinators` POST used `auth.admin.*` on the publishable client (always failed — the UA create-coordinator workflow was dead) → now uses the service-role client + `app_metadata` role; rate limits; `lookup-user` validation.
- **Remaining MEDIUM:**
  - ~15 routes leak raw `error.message`.
  - `/api/universities` + `/api/companies` broad anon column exposure (public-directory data, but should be curated/capped).
  - `/api/notifications` cross-tenant `target_role` broadcasts.
  - reports `downloadUrl` → nonexistent route (**LOW**).
  - dead `resource-auth.ts` (**LOW**).

---

## 7. Dashboard Verification (traced to live queries)

- **No hardcoded statistics anywhere** (`mock|dummy|fake|sample|placeholder` sweep + static chart arrays + fake-async sweep all clean).
- **Super-admin:** role distribution, 4 universities, 12 companies, 7 internships (1 open / 6 active), **446.50 hours over 15 logs** — all match SQL ground truth at audit time.
- **University-admin@MyU:** 2 students, 1 dept, 1 program, 0 internships — match.
- **Company-hr@TechCorp:** 1 own internship; Systems Ltd 0 — match.
- **Student@MyU:** 1 — match.
- **FIXED:** program-coordinator Settings save was a fake `setTimeout` + success toast → now persists `full_name` via RLS-scoped `profiles.update`.
- **Remaining:** uni-admin per-company internship counts not university-scoped; student internship browse relies on RLS without an explicit university filter (safe); PC reports `limit(500)`; super-admin client-side aggregation.

---

## 8. Functional Test Results

- **Full role matrix at DB/REST level:** signup → pending; admin creation + role assignment (DB + admin API); student/HR/supervisor scoping + write boundaries; negative tests per §4.
- An earlier same-day session executed E2E workflows (week-99 log, "AUDIT E2E" task, attendance — found & removed in cleanup).
- **UNVERIFIED — ACCESS/TESTING LIMITATION:** browser click-through of the 9 dashboards, forms UX, uploads, certificate PDF generation, and PWA/push runtime were not executed (sandbox tool failures, §17). Static review found no blockers; exercise before launch.

---

## 9. UI/UX Findings

- Consistent loading skeletons / empty states / error UI; mock data previously purged (self-documenting comments remain).
- The fake-save PC settings page was the one "lying UI" defect (fixed).
- Minor: cosmetic upload progress bars; marketplace Save is localStorage-only; `/unauthorized` claims logging that doesn't exist.
- No redesign recommended.

---

## 10. Responsive Testing

**UNVERIFIED — ACCESS/TESTING LIMITATION** (no 320–1440px pass this session). Static review: responsive Tailwind primitives throughout; risk areas: wide tables/dialogs at 320–375px.

---

## 11. Accessibility

Static review: Radix/shadcn primitives (focus/dialog semantics/labels) platform-wide; no unnecessary ARIA. **UNVERIFIED:** keyboard walkthrough, screen-reader, contrast, reduced-motion.

---

## 12. Security Summary

| Finding | Severity | Status |
|---|---|---|
| `current_role()`/tenant helpers trust user-writable metadata | **CRITICAL** | Fixed live (0084) + branch; re-tested |
| Trigger launders user-metadata tenant ids | **CRITICAL** | Fixed live (0084); re-tested |
| Admin API routes JWT-metadata role fallback | **HIGH** | Fixed on branch (needs merge) |
| Open redirects (`redirect_to`/`next`) | **HIGH** | Fixed on branch |
| No rate limiting on auth endpoints | **HIGH** | Fixed on branch |
| `/api/coordinators` admin-on-publishable | **HIGH** | Fixed on branch |
| Password reset broken; no SMTP | **HIGH** | **OPEN** |
| Signup w/o email confirmation; password policy min 6 | **HIGH** | **OPEN** (platform config) |
| `audit_logs` WITH CHECK(true); view security_invoker; anon DML (0007); public buckets; unscoped cert/sup DELETE; student-own cert UPDATE | **MEDIUM** | **OPEN** (documented) |
| `error.message` leaks; anon listings; notification broadcast | **MEDIUM** | **OPEN** |
| Secrets in git history | — | **PASS** (294 commits scanned; benign local SQLite `.env` path in initial commit only; service-role key in 19 server files, never client, never committed) |

---

## 13. Performance

Client-side full-table aggregation on super-admin dashboards; otherwise N+1-free; `limit()` caps; no missing-index evidence at current scale. No architectural changes recommended (measured-first rule).

---

## 14. Build/Deployment

- `next build --webpack`: compile ✓ **51s**; eslint ✓ **0 errors / 1 pre-existing warning** (`login/page.tsx:309`); `tsc --noEmit` ✓ **0 errors** including all audit patches.
- Combined build TS phase **OOM-killed** on the 4GB/2-core sandbox (exit 137) — resource-only; run the full build on CI / ≥8GB before merging.
- Branch `production-readiness-audit` **pushed** — 7 commits: `a0ca0d6` `cbec791` `bf75ae1` `5cbc349` `797beac` `c644e51` `6bd44e1`; **+214/−95**; secret-scan clean.
- **DB migration 0084 is ALREADY LIVE in production** — the deployed app is protected regardless of merge order (RLS is database-side).

---

## 15. Test Data Cleanup (verified)

Removed children-first with before/after counts:

- 15 audit auth users + profiles (10 from the 12:06 session, 5 from this session)
- 5 attendance, 5 weekly_logs (incl. week-99 probe), 1 task + 1 assignment + 1 submission, 2 students, 4 supervisors, 1 student_internships (**production internship row preserved**), 3 login_handoffs

**Post-cleanup:** 0 pattern matches (auth.users / profiles / supervisors / login_handoffs / identities / sessions); 0 orphans in both directions; probe-modified data restored.

---

## 16. Remaining Issues

1. **HIGH** — password reset unusable end-to-end (SMTP + `type` routing + update-mode form).
2. **HIGH** — email confirmation disabled + weak server password policy.
3. **MEDIUM** — RLS/storage hygiene set (audit_logs check, view invoker, anon DML revokes, cert/sup delete scoping, student cert update, bucket tightening).
4. **MEDIUM** — API polish (error leaks, anon listing curation, notification scoping).
5. **MEDIUM** — dashboard detail fixes.
6. **LOW** — dead libs, lint warning, downloadUrl route.
7. **INFO** — rate limiter is per-instance (Redis at scale).

---

## 17. Verification Limitations (explicit)

- Browser E2E / responsive / a11y / PWA / push / signed-URL runtime were **NOT executed** (Bash/Skill tool transport failures late in the session; DB/build verification completed; shell work finished via subagents).
- Full combined `next build` blocked by sandbox RAM only — run in CI.
- GoTrue signup sanitization was observed live, but the mechanism is unidentified (platform-level; the DB no longer trusts the input regardless).

---

## 18. Final Verdict

## NOT PRODUCTION READY

Two CRITICAL live-proven defects existed at audit start; both were fixed in-place and verified closed (the live migration protects the deployed app now). Per the acceptance criteria (no unresolved Critical OR High), the broken password reset, disabled email confirmation, and the hygiene set keep the system short of readiness. **The gap is narrow:** merge the branch, run a full CI build, configure SMTP + email confirmation, clear §16 items 3–5; re-verify with the preserved test battery (`audit/rls_*_results.jsonl`, `scripts/rls_as.sh`, etc.).

---

*Evidence artifacts: `worklog.md`, `audit/db_state/*`, `audit/rls_battery_results.jsonl`, `audit/rls_write_results.jsonl`, `scripts/rls_as.sh` + `rls_battery.sh` + `rls_write_tests.sh`.*
