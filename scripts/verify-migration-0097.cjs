#!/usr/bin/env node
/**
 * verify-migration-0097.cjs
 * ----------------------------------------------------------------------------
 * Verifies that migration 0097 (fix_internship_apply_and_hr_dept_visibility)
 * has been applied to the live database.
 *
 * HOW IT WORKS (non-destructive):
 *   It attempts to INSERT a row into `internship_applications` using the
 *   SERVICE ROLE key with a NON-EXISTENT internship_id. Because BEFORE ROW
 *   triggers run before foreign-key constraint checks, the result tells us
 *   exactly which state the database is in:
 *
 *     - "column \"vacancies\" does not exist" (42703)
 *         → the BROKEN capacity trigger is still live.
 *           Migration 0097 has NOT been applied.
 *
 *     - foreign key violation (23503) on internship_id
 *         → the trigger ran cleanly and the insert was rejected by the FK
 *           constraint. Migration 0097 IS applied. Nothing was inserted.
 *
 * USAGE (from the repo root, after filling .env.local):
 *   node scripts/verify-migration-0097.cjs
 *
 * Optional secondary check — verify a company_hr account can now see
 * departments of MoU-linked universities directly via PostgREST (RLS):
 *   node scripts/verify-migration-0097.cjs --hr-email you@corp.com --hr-password 'secret'
 * ----------------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("✗ .env.local not found. Copy env.example to .env.local and fill it in first.");
    process.exit(1);
  }
  const env = fs.readFileSync(envPath, "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
  const publishableKey =
    env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/)?.[1]?.trim() ||
    env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
  if (!url) {
    console.error("✗ .env.local must define NEXT_PUBLIC_SUPABASE_URL.");
    process.exit(1);
  }
  return { url, serviceKey, publishableKey };
}

// Sign in as a regular user and return the access token — used as a
// fallback when no service-role key is configured.
async function signIn({ url, publishableKey }, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const { access_token } = await res.json();
  return access_token;
}

async function checkTrigger({ url, serviceKey }) {
  console.log("\n[1/2] Checking the internship application capacity trigger…");
  const res = await fetch(`${url}/rest/v1/internship_applications`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    // Fake UUIDs on purpose — see header comment. Nothing gets inserted.
    body: JSON.stringify({
      internship_id: "00000000-0000-0000-0000-000000000000",
      student_user_id: "00000000-0000-0000-0000-000000000000",
      company_id: "00000000-0000-0000-0000-000000000000",
      status: "pending",
    }),
  });

  let err = null;
  try {
    const body = await res.json();
    err = body;
  } catch {
    err = { message: `HTTP ${res.status}` };
  }

  const msg = String(err?.message || "");
  if (msg.includes("vacancies")) {
    console.log("  ✗ BROKEN trigger still active (42703: column \"vacancies\" does not exist).");
    console.log("    → Apply supabase/migrations/0097_fix_internship_apply_and_hr_dept_visibility.sql");
    console.log("      in the Supabase Dashboard → SQL Editor, then re-run this script.");
    return false;
  }
  if (res.status === 400 || res.status === 409 || msg.includes("foreign key") || res.status === 201) {
    if (res.status === 201) {
      // Should not happen with the fake UUIDs — but if it did, clean it up.
      console.log("  ! Unexpected 201 — the fake row was inserted. Please delete it manually.");
      return false;
    }
    console.log("  ✓ Trigger is healthy (insert reached the FK check and was rejected as expected).");
    console.log(`    DB said: ${msg || res.statusText}`);
    return true;
  }
  console.log(`  ? Unexpected response (${res.status}): ${msg}`);
  console.log("    If this mentions RLS, check that you used the SERVICE ROLE key in .env.local.");
  return false;
}

// Fallback check for environments WITHOUT the service-role key: any
// authenticated user can run the same probe insert — the BEFORE trigger
// still fires before RLS, so:
//   42703 "vacancies"        → migration NOT applied
//   42501 row-level security → trigger healthy, RLS correctly blocked us
async function checkTriggerWithUser({ url, publishableKey }, email, password) {
  console.log("\n[1/2] Checking the capacity trigger (user-token fallback)…");
  const token = await signIn({ url, publishableKey }, email, password);
  if (!token) {
    console.log("  ? Could not sign in with the given user — skipping.");
    return null;
  }
  const res = await fetch(`${url}/rest/v1/internship_applications`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      internship_id: "00000000-0000-0000-0000-000000000000",
      student_user_id: "00000000-0000-0000-0000-000000000000",
      company_id: "00000000-0000-0000-0000-000000000000",
      status: "pending",
    }),
  });
  let msg = "";
  try {
    msg = String((await res.json())?.message || "");
  } catch {
    msg = `HTTP ${res.status}`;
  }
  if (msg.includes("vacancies")) {
    console.log("  ✗ BROKEN trigger still active (42703: column \"vacancies\" does not exist).");
    console.log("    → Apply migration 0097 in the Supabase SQL Editor, then re-run this script.");
    return false;
  }
  if (res.status === 403 || msg.includes("row-level security")) {
    console.log("  ✓ Trigger is healthy (RLS blocked the probe insert as expected).");
    return true;
  }
  console.log(`  ? Unexpected response (${res.status}): ${msg}`);
  return false;
}

async function checkHrRls({ url, publishableKey }, email, password) {
  console.log("\n[2/2] Checking company_hr department visibility via RLS…");
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) {
    console.log("  ? Could not sign in as the given company_hr user — skipping this check.");
    return null;
  }
  const { access_token } = await login.json();

  // Find the HR's active MoU universities
  const mouRes = await fetch(`${url}/rest/v1/company_university_mous?select=university_id&status=eq.active&limit=1`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${access_token}` },
  });
  const mous = await mouRes.json();
  if (!Array.isArray(mous) || mous.length === 0) {
    console.log("  ? No active MoUs visible to this account — skipping the departments check.");
    return null;
  }
  const uniId = mous[0].university_id;

  const deptRes = await fetch(`${url}/rest/v1/departments?select=id,name&university_id=eq.${uniId}&limit=5`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${access_token}` },
  });
  const depts = await deptRes.json();
  const count = Array.isArray(depts) ? depts.length : 0;
  if (deptRes.ok && count > 0) {
    console.log(`  ✓ company_hr can see ${count}+ departments of the MoU university via RLS.`);
    console.log(`    Sample: ${depts.slice(0, 3).map((d) => d.name).join(", ")}`);
    return true;
  }
  console.log(`  ✗ company_hr still sees ${count} departments (HTTP ${deptRes.status}).`);
  console.log("    → The dept_select policy in migration 0097 has not been applied yet.");
  return false;
}

(async () => {
  const env = loadEnv();
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const hrEmail = getArg("--hr-email");
  const hrPassword = getArg("--hr-password");
  const userEmail = getArg("--user-email");
  const userPassword = getArg("--user-password");

  console.log(`Supabase: ${env.url}`);

  let triggerOk;
  if (env.serviceKey) {
    triggerOk = await checkTrigger(env);
  } else if (userEmail && userPassword) {
    triggerOk = await checkTriggerWithUser(env, userEmail, userPassword);
  } else {
    console.log("\n[1/2] No SUPABASE_SERVICE_ROLE_KEY in .env.local and no --user-email/--user-password given.");
    console.log("       Cannot probe the trigger. Add the service key or pass a user account.");
    triggerOk = null;
  }

  let rlsOk = null;
  if (hrEmail && hrPassword) {
    rlsOk = await checkHrRls(env, hrEmail, hrPassword);
  } else {
    console.log("\n[2/2] Skipped RLS check (pass --hr-email and --hr-password to include it).");
  }

  console.log("\n──────────────────────────────────────────────────────────────");
  if (triggerOk === null) {
    console.log("RESULT: UNKNOWN — re-run with service key or user credentials (see above).");
  } else if (triggerOk && (rlsOk === null || rlsOk)) {
    console.log("RESULT: Migration 0097 is applied — students can submit applications.");
    console.log("        Publish an internship (status=open) and apply as a student to confirm E2E.");
  } else {
    console.log("RESULT: Migration 0097 is NOT fully applied yet.");
    console.log("        Apply supabase/migrations/0097_fix_internship_apply_and_hr_dept_visibility.sql");
    console.log("        in Supabase Dashboard → SQL Editor, then re-run: node scripts/verify-migration-0097.cjs");
  }
})();
