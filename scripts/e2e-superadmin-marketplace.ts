/**
 * E2E test: Super-Admin cascade delete/suspend + internship marketplace
 * MOU/department visibility rules (migrations 0097/0098/0099).
 *
 * Run: node_modules/.bin/tsx scripts/e2e-superadmin-marketplace.ts
 *
 * Creates a full throwaway dataset (universities, departments, users,
 * company, MOU, internships) directly against the live Supabase project via
 * the service-role key, then verifies:
 *
 *   A. Marketplace RLS (migration 0099):
 *      1. student with targeted dept + MOU            → sees the internship
 *      2. student same uni, non-targeted dept         → does NOT see it
 *      3. student other uni (no MOU)                  → does NOT see it
 *      4. university admin with MOU                   → sees it
 *      5. university admin without MOU                → does NOT see it
 *      6. drafts hidden from university members       → only company HR sees drafts
 *      7. student can SUBMIT an application (trigger 0097 fix)
 *
 *   B. Suspend cascade (migration 0098):
 *      8.  suspend university admin → ALL university accounts suspended
 *      9.  suspended student cannot sign in (auth ban)
 *      10. reactivate → all accounts active again, sign-in works
 *
 *   C. Hard-delete cascades (migration 0098):
 *      11. hard_delete_university removes the university, ALL its accounts
 *          (profiles + auth.users), departments, MOU, and its sub-company
 *          (with the sub-company's accounts + internships)
 *      12. hard_delete_company removes the company, its accounts,
 *          internships and applications
 *
 * Cleans up everything it created at the end (and any leftovers from a
 * previous failed run).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const RUN = Date.now().toString(36);
const PW = "QaTest!12345678";
let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function mkUser(email: string, fullName: string, role: string, opts: {
  university_id?: string; department_id?: string; program_id?: string; company_id?: string;
}): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser(${email}) failed: ${error?.message}`);
  const { error: perr } = await admin.from("profiles").upsert({
    user_id: data.user.id,
    email,
    full_name: fullName,
    role,
    status: "active",
    is_active: true,
    university_id: opts.university_id ?? null,
    department_id: opts.department_id ?? null,
    program_id: opts.program_id ?? null,
    company_id: opts.company_id ?? null,
  });
  if (perr) throw new Error(`profile(${email}) failed: ${perr.message}`);
  return data.user.id;
}

async function userClient(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error || !data.session) throw new Error(`signIn(${email}) failed: ${error?.message}`);
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function cleanup() {
  // Delete leftovers from previous runs (universities + companies by slug prefix).
  const { data: unis } = await admin
    .from("universities").select("id").like("slug", `qa-e2e-%`);
  for (const u of unis || []) {
    await admin.rpc("hard_delete_university", { p_university_id: u.id });
  }
  const { data: comps } = await admin
    .from("companies").select("id").like("slug", `qa-e2e-%`);
  for (const c of comps || []) {
    await admin.rpc("hard_delete_company", { p_company_id: c.id });
  }
}

async function main() {
  console.log(`\n=== E2E setup (run ${RUN}) ===`);
  await cleanup();

  // ---- University U1 (with MOU) + departments + program ----
  const { data: u1 } = await admin.from("universities").insert({
    name: `QA E2E University ${RUN}`,
    slug: `qa-e2e-uni-${RUN}`,
    is_active: true,
  }).select("id").single();
  if (!u1) throw new Error("failed to create U1");

  const { data: d1 } = await admin.from("departments").insert({
    university_id: u1.id, name: "QA Computer Science", code: `QACS${RUN.slice(-4)}`,
  }).select("id").single();
  const { data: d2 } = await admin.from("departments").insert({
    university_id: u1.id, name: "QA Business", code: `QABUS${RUN.slice(-4)}`,
  }).select("id").single();
  const { data: p1 } = await admin.from("programs").insert({
    university_id: u1.id, department_id: d1!.id, name: "QA BSCS", code: `BSCS${RUN.slice(-4)}`,
  }).select("id").single();

  // ---- University U2 (NO MOU) ----
  const { data: u2 } = await admin.from("universities").insert({
    name: `QA E2E Other University ${RUN}`,
    slug: `qa-e2e-uni2-${RUN}`,
    is_active: true,
  }).select("id").single();
  const { data: d3 } = await admin.from("departments").insert({
    university_id: u2!.id, name: "QA Other CS", code: `QAOCS${RUN.slice(-4)}`,
  }).select("id").single();

  // ---- Company C1 (independent) + HR ----
  const { data: c1 } = await admin.from("companies").insert({
    name: `QA E2E Company ${RUN}`,
    slug: `qa-e2e-comp-${RUN}`,
    contact_email: `hr-${RUN}@qa-e2e-test.pk`,
    is_active: true,
    is_verified: true,
  }).select("id").single();
  if (!c1) throw new Error("failed to create C1");

  // ---- Sub-company C2 registered UNDER U1 (tests university sub-company cascade) ----
  const { data: c2 } = await admin.from("companies").insert({
    name: `QA E2E SubCompany ${RUN}`,
    slug: `qa-e2e-sub-${RUN}`,
    contact_email: `sub-${RUN}@qa-e2e-test.pk`,
    university_id: u1.id,
    is_active: true,
  }).select("id").single();

  // ---- MOU between C1 and U1 (active) ----
  const { data: mou } = await admin.from("company_university_mous").insert({
    company_id: c1!.id,
    university_id: u1.id,
    status: "active",
    starts_at: new Date().toISOString(),
  }).select("id").single();

  // ---- Users ----
  const admin1 = await mkUser(`qa-admin1-${RUN}@internhub-test.pk`, "QA Uni Admin", "university_admin", { university_id: u1.id });
  const coord1 = await mkUser(`qa-coord1-${RUN}@internhub-test.pk`, "QA Coordinator", "department_coordinator", { university_id: u1.id, department_id: d1!.id });
  const student1 = await mkUser(`qa-student1-${RUN}@internhub-test.pk`, "QA Student One", "student", { university_id: u1.id, department_id: d1!.id, program_id: p1!.id });
  const student2 = await mkUser(`qa-student2-${RUN}@internhub-test.pk`, "QA Student Two", "student", { university_id: u1.id, department_id: d2!.id });
  const admin2 = await mkUser(`qa-admin2-${RUN}@internhub-test.pk`, "QA Other Admin", "university_admin", { university_id: u2!.id });
  const student3 = await mkUser(`qa-student3-${RUN}@internhub-test.pk`, "QA Student Three", "student", { university_id: u2!.id, department_id: d3!.id });
  const hr1 = await mkUser(`qa-hr1-${RUN}@internhub-test.pk`, "QA Company HR", "company_hr", { company_id: c1!.id });
  const hr2 = await mkUser(`qa-hr2-${RUN}@internhub-test.pk`, "QA SubCompany HR", "company_hr", { company_id: c2!.id });

  // student rows for students
  await admin.from("students").insert([
    { user_id: student1, university_id: u1.id, department_id: d1!.id, program_id: p1!.id, student_id_number: `QA-${RUN}-1` },
    { user_id: student2, university_id: u1.id, department_id: d2!.id, student_id_number: `QA-${RUN}-2` },
    { user_id: student3, university_id: u2!.id, department_id: d3!.id, student_id_number: `QA-${RUN}-3` },
  ]);

  // ---- Internships by hr1 ----
  const { data: i1 } = await admin.from("internships").insert({
    title: `QA Marketplace Internship ${RUN}`,
    description: "E2E test internship targeting QA Computer Science at U1.",
    company_id: c1!.id,
    created_by: hr1,
    status: "open",
    university_id: null,
    duration_weeks: 8,
  }).select("id").single();
  await admin.from("internship_target_departments").insert({
    internship_id: i1!.id, university_id: u1.id, department_id: d1!.id,
  });

  const { data: i2 } = await admin.from("internships").insert({
    title: `QA Draft Internship ${RUN}`,
    description: "Draft — should be invisible to university members.",
    company_id: c1!.id,
    created_by: hr1,
    status: "draft",
    university_id: null,
    duration_weeks: 6,
  }).select("id").single();

  // ---- Internship by sub-company's hr2 ----
  const { data: i3 } = await admin.from("internships").insert({
    title: `QA SubCompany Internship ${RUN}`,
    description: "Belongs to the sub-company under U1 — dies with U1.",
    company_id: c2!.id,
    created_by: hr2,
    status: "open",
    university_id: u1.id,
    duration_weeks: 4,
  }).select("id").single();

  console.log("\n=== A. Marketplace RLS (migration 0099) ===");

  const s1 = await userClient(`qa-student1-${RUN}@internhub-test.pk`);
  const s2 = await userClient(`qa-student2-${RUN}@internhub-test.pk`);
  const s3 = await userClient(`qa-student3-${RUN}@internhub-test.pk`);
  const a1 = await userClient(`qa-admin1-${RUN}@internhub-test.pk`);
  const a2 = await userClient(`qa-admin2-${RUN}@internhub-test.pk`);
  const h1 = await userClient(`qa-hr1-${RUN}@internhub-test.pk`);

  const titles = async (c: SupabaseClient) =>
    (await c.from("internships").select("title").eq("status", "open")).data?.map((r: any) => r.title) || [];

  const s1Titles = await titles(s1);
  check("student (targeted dept + MOU) SEES the internship", s1Titles.includes(`QA Marketplace Internship ${RUN}`));

  const s2Titles = await titles(s2);
  check("student (same uni, non-targeted dept) does NOT see it", !s2Titles.includes(`QA Marketplace Internship ${RUN}`));

  const s3Titles = await titles(s3);
  check("student (other uni, no MOU) does NOT see it", !s3Titles.includes(`QA Marketplace Internship ${RUN}`));

  const a1Titles = await titles(a1);
  check("university admin (MOU) SEES it", a1Titles.includes(`QA Marketplace Internship ${RUN}`));

  const a2Titles = await titles(a2);
  check("university admin (no MOU) does NOT see it", !a2Titles.includes(`QA Marketplace Internship ${RUN}`));
  check("university admin (no MOU) does NOT see U1's targeted internship either", !a2Titles.includes(`QA SubCompany Internship ${RUN}`));

  const h1All = (await h1.from("internships").select("title")).data?.map((r: any) => r.title) || [];
  check("company HR sees own draft", h1All.includes(`QA Draft Internship ${RUN}`));
  const a1All = (await a1.from("internships").select("title")).data?.map((r: any) => r.title) || [];
  check("university admin does NOT see drafts", !a1All.includes(`QA Draft Internship ${RUN}`));

  // Apply flow (trigger fix 0097)
  const { error: applyErr } = await s1.from("internship_applications").insert({
    internship_id: i1!.id,
    student_user_id: student1,
    company_id: c1!.id,
    status: "pending",
    applied_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  check("student CAN submit an application (trigger 0097)", !applyErr, applyErr?.message);

  console.log("\n=== B. Suspend cascade (migration 0098) ===");

  // The API route computes the cascade scope (all profiles of the target's
  // university) and passes the full ID list to the SQL function — mirror
  // that here.
  const { data: u1UserRows } = await admin
    .from("profiles").select("user_id").eq("university_id", u1.id);
  const u1UserIds = (u1UserRows || []).map((r: any) => r.user_id);

  const { data: affCount } = await admin.rpc("cascade_set_users_suspended", {
    p_user_ids: u1UserIds, p_suspended: true,
  });
  check("suspending university accounts via SQL cascades to whole university", Number(affCount) === 4, `affected=${affCount} (admin+coord+2 students)`);

  const { data: statuses } = await admin.from("profiles")
    .select("email, status, is_active")
    .in("user_id", [admin1, coord1, student1, student2]);
  const allSuspended = (statuses || []).every((p: any) => p.status === "suspended" && p.is_active === false);
  check("all U1 profiles suspended + inactive", allSuspended);

  const { data: authRows } = await admin.auth.admin.listUsers({ perPage: 200 });
  // banned_until is a string when banned; null/undefined when not. Only a
  // real (truthy, non-"null") value counts as banned.
  const isBanned = (u: any) => typeof u.banned_until === "string" && u.banned_until > "2000";
  const banned = (authRows?.users || []).filter(u =>
    [admin1, coord1, student1, student2].includes(u.id) && isBanned(u)
  );
  check("all U1 auth users banned (banned_until set)", banned.length === 4, `banned=${banned.length}/4`);

  // Sign-in should fail while banned
  const bannedClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: bannedErr } = await bannedClient.auth.signInWithPassword({
    email: `qa-student1-${RUN}@internhub-test.pk`, password: PW,
  });
  check("suspended student CANNOT sign in", !!bannedErr, bannedErr?.message);

  // Reactivate
  const { data: reactivCount } = await admin.rpc("cascade_set_users_suspended", {
    p_user_ids: u1UserIds, p_suspended: false,
  });
  check("reactivation cascades to whole university", Number(reactivCount) === 4, `affected=${reactivCount}`);

  const { error: loginOk } = await bannedClient.auth.signInWithPassword({
    email: `qa-student1-${RUN}@internhub-test.pk`, password: PW,
  });
  check("reactivated student CAN sign in again", !loginOk, loginOk?.message);

  console.log("\n=== C. Hard-delete cascades (migration 0098) ===");

  // Delete U1 — should take: U1, its departments/program, its 4 accounts, MOU,
  // sub-company C2 (+ hr2 + I3), itd rows pointing at U1. C1/I1/I2 SURVIVE.
  const { data: delUni, error: delUniErr } = await admin.rpc("hard_delete_university", {
    p_university_id: u1.id,
  });
  check("hard_delete_university runs", !delUniErr, delUniErr?.message || JSON.stringify(delUni));

  const { count: u1Profiles } = await admin.from("profiles")
    .select("user_id", { count: "exact", head: true }).eq("university_id", u1.id);
  check("all U1 profiles deleted", Number(u1Profiles) === 0);

  const { count: u1Depts } = await admin.from("departments")
    .select("id", { count: "exact", head: true }).eq("university_id", u1.id);
  check("U1 departments deleted", Number(u1Depts) === 0);

  const { count: mouCount } = await admin.from("company_university_mous")
    .select("id", { count: "exact", head: true }).eq("university_id", u1.id);
  check("MOUs with U1 deleted", Number(mouCount) === 0);

  const { data: c2row } = await admin.from("companies").select("id").eq("id", c2!.id).maybeSingle();
  check("sub-company under U1 deleted", !c2row);

  const { data: i3row } = await admin.from("internships").select("id").eq("id", i3!.id).maybeSingle();
  check("sub-company internship deleted", !i3row);

  const { data: i1row } = await admin.from("internships").select("id").eq("id", i1!.id).maybeSingle();
  check("independent company's marketplace internship SURVIVES university delete", !!i1row);

  const { count: itdCount } = await admin.from("internship_target_departments")
    .select("id", { count: "exact", head: true }).eq("internship_id", i1!.id);
  check("itd rows pointing at deleted university removed", Number(itdCount) === 0);

  // auth users truly gone?
  const { data: afterUsers } = await admin.auth.admin.listUsers({ perPage: 500 });
  const goneIds = [admin1, coord1, student1, student2, hr2];
  const stillThere = (afterUsers?.users || []).filter(u => goneIds.includes(u.id));
  check("auth.users rows deleted (admin, coord, students, sub-company HR)", stillThere.length === 0, `remaining=${stillThere.length}`);

  // Delete C1 — should take: C1, hr1, I1, I2, and the application
  const { error: delCompErr } = await admin.rpc("hard_delete_company", { p_company_id: c1!.id });
  check("hard_delete_company runs", !delCompErr, delCompErr?.message);

  const { data: c1row } = await admin.from("companies").select("id").eq("id", c1!.id).maybeSingle();
  check("company deleted", !c1row);
  const { data: i1row2 } = await admin.from("internships").select("id").eq("id", i1!.id).maybeSingle();
  check("company internships deleted", !i1row2);
  const { count: appCount } = await admin.from("internship_applications")
    .select("id", { count: "exact", head: true }).eq("company_id", c1!.id);
  check("applications to company deleted", Number(appCount) === 0);
  const { data: hr1row } = await admin.from("profiles").select("user_id").eq("user_id", hr1).maybeSingle();
  check("company HR profile deleted", !hr1row);

  // Cleanup U2
  await admin.rpc("hard_delete_university", { p_university_id: u2!.id });
  const { count: u2left } = await admin.from("universities").select("id", { count: "exact", head: true }).like("slug", `qa-e2e-%`);
  check("cleanup: no QA universities remain", Number(u2left) === 0);
  const { count: compsLeft } = await admin.from("companies").select("id", { count: "exact", head: true }).like("slug", `qa-e2e-%`);
  check("cleanup: no QA companies remain", Number(compsLeft) === 0);

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("E2E fatal:", e);
  process.exit(1);
});
