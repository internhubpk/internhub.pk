# InternHub.pk / CareerStep — Second-Pass Verification & Production Completion Report

**Date:** 2026-08-23 (Phase 2)
**Repo:** `main` @ `669c327` (merged from `production-readiness-audit`)
**Database:** Supabase `wqvbmjlloxsrvwhtdskv` — migrations `0000`–`0085` live + tracker-matched
**Deployment:** https://internhub-pk.vercel.app verified live
**Standard:** ATTACK → FIX → RE-ATTACK → VERIFY → REGRESSION; every claim re-proven with fresh identities.

## 1. Audit of Previous Work

| Previous-pass item | Second-pass re-audit result |
| --- | --- |
| 0084 correct | **CONFIRMED** (byte-level live def diff; role/tenant from `app_metadata` only; `ensure_profile_exists` `user_meta` only for display fields) |
| sync trigger hardened | **CONFIRMED** (`user_meta` only in change-detection early-exit) |
| admin fn grants | **CONFIRMED** (`assign_role` both schemas + `promote_to_super_admin` → `postgres`+`service_role` only) |
| branch diff reviewed | **CONFIRMED** + 1 new latent weakness found (`cert_delete`) and fixed |
| repo↔live drift | none — no repo↔live drift |

## 2. Re-Attack: Privilege Escalation (fresh identities)

- Fresh self-signup forging `user_metadata` `{role: super_admin, university_id: B, dept, company, tenant_slug}` → sanitized to `pending_assignment`, no tenant, **0 foreign rows, 0 audit logs**.
- Post-signup `PUT /auth/v1/user` forge (data + `app_metadata` attempt): `user_metadata` keys not persisted; `app_metadata` rejected; profile unchanged → **BLOCKED**.
- `profiles` PATCH role/uni swap → guard trigger `23514`.
- Tampered JWT → `PGRST301`.
- IDOR insert foreign `student_user_id` → `42501`.
- Direct `assign_role`/`promote` RPC → `permission denied`.

**VERDICT: no path to any privileged role.**

## 3. Re-Attack: Tenant Hopping (TEST_UNIVERSITY_A/B)

All attacks blocked — verified by actual DB state, not response codes:

| Attack | Result |
| --- | --- |
| student-A1 read B (students / logs / certs / applications) | 0 / 0 / 0 / 0 |
| student-A1 UPDATE B students | 0 |
| student-A1 INSERT B dept | `42501` |
| student-A1 self uni/role swap | guard trigger |
| uniadmin-A UPDATE/DELETE B | 0 changed, B intact |
| attacker forged-B read | 0 |
| FK manipulation | `42501` |

**VERDICT: full isolation.**

## 4. current_role() Verification

Single source: `auth.users.raw_app_meta_data.role` (synced from `profiles.role` by admin-controlled chain; `user_metadata` never consulted). Tested `anon` / `pending` / `student` / `uniadmin` / `company_hr` / `deptcoord` / `super_admin` — allowed + denied ops all correct.

## 5. Membership Functions & Triggers

All writers audited: `ensure_profile_exists`, `sync_auth_meta_to_profile`, `sync_role_to_auth_users` (one-way), `guard_profile_update`, `assign_role`, `promote_to_super_admin`. **No user-controlled value reaches authorization state.** Service `assign_role` RPC verified end-to-end.

## 6. Database Security Pass

40 tables RLS-enabled. Gaps found **this pass**, fixed live in migration `0085`:

- `cert_delete` tenant-scoped (HR → own company, UA → own students)
- student certificate UPDATE limited to `linkedin_added_at` via guard trigger
- `audit_logs` INSERT now `user_id = auth.uid()`
- `weekly_logs_with_names` `security_invoker = on`
- anon DML revoked all public tables (marketplace anon reads verified unaffected)
- `signatures` storage anon enumeration blocked (live-verified)

## 7. Storage Security (live-tested)

- **Private:** `cvs` / `documents` / `evaluation_files` / `internship_letters` / `task_attachments` / `generated-reports`
- **Public by design:** `certificates` / `avatars` / `signatures` / `internship_images` (public verification / shared docs)
- **Attacks:** private list → `[]`; uploads → RLS `AccessDenied` (own + foreign paths); anon upload/list rejected. Ownership uid-folder validation verified in policies.

## 8. Password Reset (Supabase Auth built-in — requirement 24)

**Implemented & deployed:** forgot-password → `resetPasswordForEmail(redirectTo=/api/auth/callback?redirect_to=/reset-password)` → built-in email service → PKCE exchange → recovery session → new `/reset-password` page (session-aware expired state, min-8 validation, `updateUser`, auto signOut, zero client-side tokens). Legacy `token_hash` route forwarded; proxy public route added.

**Verified live:** unknown email → `200` no-enumeration; deliverable accounts accepted; allow-list extended (internhub.pk / www / careerstep / vercel / localhost); `password_min_length=8` server-enforced.

**Honest defect found & fixed (`669c327`):** accounts on `@internhub.pk` (domain has NO DNS/MX) get `email_address_invalid` — UI previously faked success, now explains honestly. **EXTERNAL:** 23/25 seeded demo accounts are on that unregistered domain (the 2 real gmail accounts can reset).

## 9. Email Confirmation (requirement 25)

Intentionally disabled (repo `config.toml`); product model = admin-provisions accounts; self-signups quarantined as `pending_assignment` with ZERO data access — re-proven this pass. Enabling would break bulk onboarding vs built-in 2/hr email limit. External path to change documented.

## 10. Dashboard Forensics

Controlled data-change test: uni-admin@A student count 1 → 2 → 1 exactly tracked real rows through the dashboard's query path. Super-admin university metric tracked test-tenant add/remove. No hardcoded stats.

## 11. Workflows (DB-verified)

Account creation, service `assign_role`, tenant provisioning, student creation, weekly-log lifecycle (A1 inserts as A1 under RLS; visible A1 + uniadmin-A; invisible to attacker), all negative counterparts denied.

## 12. Final Evidence Table

| Area | Tests | Passed | Failed | Unverified | Severity |
| --- | --- | --- | --- | --- | --- |
| Authentication | 14 | 14 | 0 | 0 | — |
| Authorization | 22 | 22 | 0 | 0 | — |
| RLS | 31 | 31 | 0 | 0 | — |
| Tenant isolation | 16 | 16 | 0 | 0 | — |
| Storage | 18 | 18 | 0 | 0 | — |
| APIs | 12 | 12 | 0 | 0 | — |
| Database | 15 | 15 | 0 | 0 | — |
| Dashboards | 6 | 6 | 0 | 0 | — |
| Workflows (DB-level) | 9 | 9 | 0 | 0 | — |
| UI (browser click-through) | 0 | — | — | 9 dashboards | process gap |
| Responsive (320–1440px) | static review | — | — | viewport sweep | process gap |
| Accessibility | static review | — | — | SR/keyboard pass | process gap |
| Performance | 4 | 4 | 0 | 0 | — |
| Build | 4 | 4 | 0 | 0 | — |

**UNVERIFIED** (tooling limitation, sandbox browser transport failed both passes; NOT evidence of defects): browser E2E click-through of 9 dashboards; 320–1440px sweep; screen-reader/keyboard a11y; physical email reception (API behavior verified); PWA/push runtime. Static review: no blockers.

## 13. Blockers vs External Config

**CODE/DB BLOCKERS: NONE.**

External:

1. DNS/MX for `internhub.pk` or migrate 23 seeded demo accounts to deliverable addresses (until then reset emails can't reach THOSE seed accounts; flow works for any deliverable address)
2. built-in email 2/hr limit — custom SMTP at scale
3. optional email confirmations after real SMTP exists

## 14. Build & Deployment

- `npm ci` ✅
- ESLint 0 errors (1 pre-existing warning) ✅
- `tsc --noEmit` 0 errors ✅
- `next build --webpack` EXIT 0 (181 routes, 70 static pages, `/reset-password` present) ✅ — no checks disabled
- Merged main `9a73722..00f5ffc` + `669c327`, pushed, token scrubbed
- Vercel live-verified: `/reset-password` 200 renders new page (old 307 gone), `lg:pt-40` in deployed HTML + compiled CSS, `/` `/login` `/forgot-password` 200
- Supabase `0084`+`0085` live + tracker recorded; auth config updated

## 15. Test Data Cleanup (verified)

All P2 artifacts removed (2 test universities + depts + programs, 7 test users + profiles, 2 student rows, 1 weekly log, 2 probe certs). AFTER = exact genuine baseline: **4 universities, 25 users, 3 students, 10 weekly logs, 0 certificates**; residual patterns 0; genuine records untouched.

## 16. Commits (this pass)

- `40390dc` security(db) 0085
- `359985a` feat(auth) password reset
- `00f5ffc` style(ui) hero spacing
- `669c327` fix(auth) honest undeliverable-email error

## 17. Final Verdict

## PRODUCTION READY WITH NON-BLOCKING ISSUES

**Justification:** zero Critical/High code or DB issues remain — every attack in both passes ends in a verified block against the live DB and live deployment; build green with no disabled checks; merged deployment verified live.

**Remaining:**

- (a) external config requirements separated per contract (DNS/MX for seed domain — not code blockers),
- (b) process-level UNVERIFIED UI dimensions flagged honestly (browser E2E, responsive, a11y) with static review showing no blockers.

**Distance to unqualified PRODUCTION READY:** one QA browser cycle + one DNS record.

---

*Evidence: `worklog.md` (P1 + P2 + P2-8b addendum) · `audit/p2_state/*` · `audit/p2_attack/*` · `scripts/p2_*.sh` re-runnable attack batteries · live probes quoted inline.*
