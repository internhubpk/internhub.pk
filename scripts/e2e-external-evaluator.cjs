/**
 * E2E for Task 7-d: External Evaluator evaluate flow.
 *
 * Creates a throwaway external evaluator, assigns the QA demo student's
 * active placement to them, then exercises the real HTTP API against the
 * dev server (GET assignments → POST evaluate → POST revise (upsert) →
 * DELETE → GET). Cleans everything up afterwards.
 *
 * Run: node scripts/e2e-external-evaluator.cjs
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// --- load .env.local manually ---
const envFile = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PW = "QaTest!12345678";
const EE_EMAIL = "qa-ee@internhub-test.pk";

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let PASS = 0;
let FAIL = 0;
function check(name, cond, extra) {
  if (cond) {
    PASS++;
    console.log(`  ✓ ${name}`);
  } else {
    FAIL++;
    console.log(`  ✗ ${name}${extra ? " — " + JSON.stringify(extra).slice(0, 300) : ""}`);
  }
}

async function main() {
  console.log("E2E: external evaluator evaluate flow");

  // ---------- setup ----------
  // Find the QA demo student's ACTIVE placement.
  const { data: studentProfile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", "qa-student@internhub-test.pk")
    .maybeSingle();
  if (!studentProfile) throw new Error("qa-student profile not found — run setup-qa-accounts.ts first");

  const { data: placement } = await admin
    .from("student_internships")
    .select("id, student_user_id, internship_id, status, external_evaluator_id")
    .eq("student_user_id", studentProfile.user_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!placement) throw new Error("no active student_internships row for qa-student");
  console.log(`placement: ${placement.id} (prev evaluator: ${placement.external_evaluator_id})`);
  const prevEvaluator = placement.external_evaluator_id;

  // Create (or reuse) the throwaway evaluator.
  let eeId;
  const { data: existingEE } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", EE_EMAIL)
    .maybeSingle();
  if (existingEE) {
    eeId = existingEE.user_id;
    // Force the correct role in case a trigger created the row with a default.
    await admin.from("profiles").update({
      email: EE_EMAIL,
      full_name: "QA External Evaluator",
      role: "external_evaluator",
      status: "active",
      is_active: true,
    }).eq("user_id", eeId);
    console.log(`reusing evaluator ${eeId}`);
  } else {
    const { data: created, error: ce } = await admin.auth.admin.createUser({
      email: EE_EMAIL,
      password: PW,
      email_confirm: true,
      user_metadata: { full_name: "QA External Evaluator", role: "external_evaluator" },
    });
    if (ce || !created.user) throw new Error("createUser: " + (ce ? ce.message : "no user"));
    eeId = created.user.id;
    // A trigger on auth.users may auto-create the profile row — upsert.
    const { error: pe } = await admin.from("profiles").upsert({
      user_id: eeId,
      email: EE_EMAIL,
      full_name: "QA External Evaluator",
      role: "external_evaluator",
      status: "active",
      is_active: true,
    }, { onConflict: "user_id" });
    if (pe) throw new Error("profile insert: " + pe.message);
    console.log(`created evaluator ${eeId}`);
  }

  // Assign the placement to the evaluator.
  const { error: ae } = await admin
    .from("student_internships")
    .update({ external_evaluator_id: eeId })
    .eq("id", placement.id);
  if (ae) throw new Error("assign: " + ae.message);

  try {
    // ---------- login through the real API ----------
    const loginRes = await fetch(`${BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EE_EMAIL, password: PW }),
    });
    const loginJson = await loginRes.json();
    check("login as external evaluator", loginRes.ok && loginJson?.success, loginJson);
    const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
    const cookieHeader = setCookies
      .map((c) => c.split(";")[0])
      .filter((c) => c.startsWith("sb-"))
      .join("; ");
    check("session cookies set", cookieHeader.length > 0, setCookies);

    const H = { "Content-Type": "application/json", Cookie: cookieHeader };

    // ---------- 1. GET: assignments + empty evaluations ----------
    let res = await fetch(`${BASE}/api/external-evaluator/evaluations`, { headers: H });
    let json = await res.json();
    check("GET 200 + success", res.status === 200 && json?.success, json);
    const assignments = json?.data?.assignments || [];
    if (assignments[0]) console.log("  assignment sample:", JSON.stringify(assignments[0]).slice(0, 400));
    check(
      "GET returns the assigned placement",
      assignments.some((a) => a.id === placement.id && a.student?.full_name),
      assignments.map((a) => ({ id: a.id, status: a.status }))
    );
    check("GET evaluations empty at start", (json?.data?.evaluations || []).length === 0, json?.data?.evaluations);

    // ---------- 2. POST: create the evaluation ----------
    const scores = { overall: 4.5, technical: 4, attitude: 5, punctuality: 3.5, quality: 4 };
    res = await fetch(`${BASE}/api/external-evaluator/evaluations`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        student_internship_id: placement.id,
        student_user_id: placement.student_user_id,
        internship_id: placement.internship_id,
        type: "midterm",
        scores,
        comments: "E2E test evaluation",
      }),
    });
    json = await res.json();
    check("POST create → 201 + success", res.status === 201 && json?.success, json);
    const evalId = json?.data?.id;
    check("POST returns evaluation id", Boolean(evalId), json?.data);
    check("POST rating mirrors overall score", json?.data?.rating === 4.5, json?.data?.rating);

    // ---------- 3. GET: evaluation now listed ----------
    res = await fetch(`${BASE}/api/external-evaluator/evaluations`, { headers: H });
    json = await res.json();
    const evals = json?.data?.evaluations || [];
    check("GET lists 1 evaluation", evals.length === 1, evals.length);
    check(
      "evaluation scores persisted",
      evals[0]?.scores?.overall === 4.5 && evals[0]?.scores?.quality === 4 && evals[0]?.type === "midterm",
      evals[0]
    );

    // ---------- 4. POST again (revise) → upsert, not duplicate ----------
    const revised = { overall: 5, technical: 4.5, attitude: 5, punctuality: 4, quality: 4.5 };
    res = await fetch(`${BASE}/api/external-evaluator/evaluations`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        student_internship_id: placement.id,
        student_user_id: placement.student_user_id,
        internship_id: placement.internship_id,
        type: "final",
        scores: revised,
        comments: "E2E revised",
      }),
    });
    json = await res.json();
    check("POST revise → 201 + success", res.status === 201 && json?.success, json);

    res = await fetch(`${BASE}/api/external-evaluator/evaluations`, { headers: H });
    json = await res.json();
    const evals2 = json?.data?.evaluations || [];
    check("upsert kept a single row", evals2.length === 1, evals2.length);
    check(
      "revised scores + type persisted",
      evals2[0]?.scores?.overall === 5 && evals2[0]?.type === "final",
      evals2[0]
    );

    // ---------- 5. DELETE ----------
    if (!evals2[0]?.id) throw new Error("no evaluation id to delete");
    res = await fetch(`${BASE}/api/external-evaluator/evaluations?id=${encodeURIComponent(evals2[0].id)}`, {
      method: "DELETE",
      headers: H,
    });
    json = await res.json();
    check("DELETE → success", res.status === 200 && json?.success, json);

    res = await fetch(`${BASE}/api/external-evaluator/evaluations`, { headers: H });
    json = await res.json();
    check("evaluations empty after delete", (json?.data?.evaluations || []).length === 0, json?.data?.evaluations);

    // ---------- 6. Page renders ----------
    res = await fetch(`${BASE}/external-evaluator/evaluations`, { headers: H, redirect: "manual" });
    const html = await res.text();
    check("page renders 200", res.status === 200, res.status);
    check("page shows Assigned Students tab", html.includes("Assigned Students"), undefined);
    check("page shows My Evaluations tab", html.includes("My Evaluations"), undefined);
  } finally {
    // ---------- cleanup ----------
    console.log("cleanup…");
    await admin.from("notifications").delete().eq("sender_id", eeId);
    await admin.from("evaluations").delete().eq("evaluator_id", eeId);
    await admin
      .from("student_internships")
      .update({ external_evaluator_id: prevEvaluator ?? null })
      .eq("id", placement.id);
    await admin.from("profiles").delete().eq("user_id", eeId);
    await admin.auth.admin.deleteUser(eeId);
    console.log("cleanup done (evaluator removed, placement restored)");
  }

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E failed:", e);
  process.exit(1);
});
