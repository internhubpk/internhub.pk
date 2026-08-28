/**
 * Creator-CRUD + FS-task-restriction E2E sweep.
 *
 * Covers (against the live dev server + live Supabase):
 *  A. Faculty supervisor CANNOT create/edit/delete tasks (API)
 *  B. FS GET tasks?scope=assigned sees the Site Supervisor's tasks
 *  I. RLS: FS direct task INSERT is rejected by the database (0104)
 *  C. FS fills a pending evaluation + deletes own; cannot delete SS's
 *  D. SS creates + edits (PUT) + deletes own evaluation
 *  E. DC creates + edits (PATCH) + deletes a Program Coordinator
 *  F. DC edits (PUT) + deletes a student
 *  G. HR hard-deletes a certificate they issued
 *  H. HR deletes an intern placement at their company (not another's)
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)![1].trim();
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const TBASE = "http://qa-demo-uni.127.0.0.1.nip.io:3000";
const PW = "QaTest!12345678";

const results: string[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);

async function login(email: string): Promise<string> {
  const res = await fetch(`${TBASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return (res.headers.get("set-cookie") || "").split(", ").map((c) => c.split(";")[0]).filter((c) => c.includes("=")).join("; ");
}

async function api(cookie: string, method: string, path: string, body?: any) {
  const res = await fetch(`${TBASE}${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const { data: uni } = await admin.from("universities").select("id").eq("slug", "qa-demo-uni").single();
  const { data: deptL } = await admin.from("departments").select("id").eq("code", "QDCS").limit(1);
  const dept = deptL![0];
  const { data: comp } = await admin.from("companies").select("id").eq("slug", "qa-demo-comp").single();
  const { data: internship } = await admin.from("internships").select("id").eq("title", "QA Demo Frontend Internship").single();

  const P = (email: string) => admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
  const fsP = (await P("qa-fs@internhub-test.pk")).data!;
  const ssP = (await P("qa-ss@internhub-test.pk")).data!;
  const stP = (await P("qa-student@internhub-test.pk")).data!;

  const fsCookie = await login("qa-fs@internhub-test.pk");
  const ssCookie = await login("qa-ss@internhub-test.pk");
  const dcCookie = await login("qa-dc@internhub-test.pk");
  const hrCookie = await login("qa-hr@internhub-test.pk");

  // ---------------------------------------------------------------
  // A. FS cannot create / edit / delete tasks via the API
  // ---------------------------------------------------------------
  {
    const post = await api(fsCookie, "POST", "/api/faculty-supervisor/tasks", {
      title: "FS Should Not Create", description: "x", student_user_ids: [stP.user_id],
    });
    check("A1 FS POST task → 403", post.status === 403, `${post.status}`);

    const put = await api(fsCookie, "PUT", "/api/faculty-supervisor/tasks", {
      task_id: "89c9882a-077e-4d56-9e10-d80ff03f94cf", title: "FS Should Not Edit",
    });
    check("A2 FS PUT task → 403", put.status === 403, `${put.status}`);

    const del = await api(fsCookie, "DELETE", "/api/faculty-supervisor/tasks?id=89c9882a-077e-4d56-9e10-d80ff03f94cf");
    check("A3 FS DELETE task → 403", del.status === 403, `${del.status}`);
  }

  // ---------------------------------------------------------------
  // B. FS GET ?scope=assigned sees the SS's tasks
  // ---------------------------------------------------------------
  {
    const res = await api(fsCookie, "GET", "/api/faculty-supervisor/tasks?scope=assigned");
    const titles: string[] = (res.json?.data || []).map((t: any) => t.title);
    check("B1 FS GET tasks?scope=assigned → 200", res.status === 200 && res.json?.success, `${res.status}`);
    check("B2 FS sees the site-supervisor task", titles.includes("E2E: Write project README"), titles.join(", ").slice(0, 60));
  }

  // ---------------------------------------------------------------
  // I. RLS: FS direct task INSERT rejected (migration 0104)
  // NOTE: signOut uses scope 'local' so the FS cookie session used
  // elsewhere in this sweep is NOT revoked.
  // ---------------------------------------------------------------
  {
    const userClient = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: sessFs, error: loginErr } = await userClient.auth.signInWithPassword({ email: "qa-fs@internhub-test.pk", password: PW });
    if (!loginErr && sessFs?.user) {
      const { error: insErr } = await userClient.from("tasks").insert({
        title: "RLS FS blocked task",
        description: "should fail",
        created_by: sessFs.user.id,
        status: "published",
        priority: "medium",
        university_id: uni!.id,
      });
      check("I1 RLS blocks FS direct task INSERT", !!insErr, insErr ? insErr.message.slice(0, 70) : "no error!");
      // cleanup just in case RLS somehow allowed it
      if (!insErr) await admin.from("tasks").delete().eq("title", "RLS FS blocked task");
      await userClient.auth.signOut({ scope: "local" });
    } else {
      check("I1 RLS blocks FS direct task INSERT", false, "login failed");
    }
  }

  // ---------------------------------------------------------------
  // C. FS pending evaluation flow + delete own; cannot delete SS's
  // ---------------------------------------------------------------
  let fsEvalId = "";
  {
    // seed a pending evaluation owned by the FS (as service-role)
    const { data: ev, error: evErr } = await admin.from("evaluations").insert({
      evaluator_id: fsP.user_id,
      evaluator_role: "faculty_supervisor",
      student_user_id: stP.user_id,
      type: "task",
      status: "pending",
      scores: {},
    }).select("id").single();
    if (!evErr && ev) {
      fsEvalId = ev.id;
      const post = await api(fsCookie, "POST", "/api/faculty-supervisor/evaluations", {
        evaluation_id: ev.id,
        decision: "approve",
        rating: 4,
        criteria_scores: { quality: 8, communication: 7 },
        evaluator_comments: "creator-crud test eval",
      });
      const { data: row } = await admin.from("evaluations").select("status, rating").eq("id", ev.id).maybeSingle();
      check("C1 FS POST evaluation (fill pending) → 2xx + approved", post.status >= 200 && post.status < 300 && row?.status === "approved" && row?.rating === 4, `${post.status} st=${row?.status}`);
    } else check("C1 FS POST evaluation (fill pending)", false, evErr?.message || "seed failed");
  }

  let ssEvalId = "";
  {
    const post = await api(ssCookie, "POST", "/api/site-supervisor/evaluations", {
      student_user_id: stP.user_id,
      type: "task",
      scores: { quality: 8, communication: 7 },
      rating: 4,
      comments: "ss creator-crud test eval",
    });
    ssEvalId = post.json?.data?.id || "";
    check("D1 SS POST own evaluation → 2xx", post.status >= 200 && post.status < 300 && !!ssEvalId, `${post.status} id=${ssEvalId ? "yes" : "no"}`);
    if (!ssEvalId) {
      const { data: e } = await admin.from("evaluations").select("id")
        .eq("evaluator_id", ssP.user_id).eq("student_user_id", stP.user_id)
        .like("comments", "%ss creator-crud test eval%").limit(1);
      if (e && e[0]) ssEvalId = e[0].id;
    }
  }

  {
    if (ssEvalId) {
      const res = await api(fsCookie, "DELETE", `/api/faculty-supervisor/evaluations?id=${ssEvalId}`);
      const { data: still } = await admin.from("evaluations").select("id").eq("id", ssEvalId).maybeSingle();
      check("C2 FS cannot delete SS's evaluation", res.status === 403 && !!still, `${res.status}`);
    } else check("C2 FS cannot delete SS's evaluation", false, "no ss eval id");
  }

  {
    if (ssEvalId) {
      const res = await api(ssCookie, "PUT", "/api/site-supervisor/evaluations", {
        evaluationId: ssEvalId, rating: 5, comments: "ss edited",
      });
      const { data: row } = await admin.from("evaluations").select("rating, comments").eq("id", ssEvalId).maybeSingle();
      check("D2 SS PUT own evaluation → applied", res.status >= 200 && res.status < 300 && row?.rating === 5 && row?.comments === "ss edited", `${res.status} r=${row?.rating}`);
    } else check("D2 SS PUT own evaluation", false, "no id");
  }

  {
    if (fsEvalId) {
      const res = await api(fsCookie, "DELETE", `/api/faculty-supervisor/evaluations?id=${fsEvalId}`);
      const { data: still } = await admin.from("evaluations").select("id").eq("id", fsEvalId).maybeSingle();
      check("C3 FS DELETE own evaluation → gone", res.status >= 200 && res.status < 300 && !still, `${res.status}`);
    } else check("C3 FS DELETE own evaluation", false, "no id");
  }

  {
    if (ssEvalId) {
      const res = await api(ssCookie, "DELETE", `/api/site-supervisor/evaluations?id=${ssEvalId}`);
      const { data: still } = await admin.from("evaluations").select("id").eq("id", ssEvalId).maybeSingle();
      check("D3 SS DELETE own evaluation → gone", res.status >= 200 && res.status < 300 && !still, `${res.status}`);
    } else check("D3 SS DELETE own evaluation", false, "no id");
  }

  // ---------------------------------------------------------------
  // E. DC creates a PC (via program creation — the DC flow) then
  //    edits + deletes the Program Coordinator
  // ---------------------------------------------------------------
  {
    const pcEmail = `crud-pc-${stamp}@internhub-test.pk`;
    const post = await api(dcCookie, "POST", "/api/programs", {
      name: `CRUD Program ${stamp}`,
      code: `CRUD${stamp}`,
      description: "creator-crud test program",
      is_active: true,
      department_id: dept.id,
      coordinator_full_name: "CRUD PC",
      coordinator_email: pcEmail,
      coordinator_password: PW,
    });
    const { data: pcProf } = await admin.from("profiles").select("user_id").eq("email", pcEmail).maybeSingle();
    check("E1 DC creates PC via program → 2xx + PC exists", post.status >= 200 && post.status < 300 && !!pcProf, `${post.status} ${JSON.stringify(post.json).slice(0, 60)}`);

    if (pcProf) {
      // the DC edit dialog sends PUT {full_name, phone} (email/password optional)
      const patch = await api(dcCookie, "PUT", `/api/coordinators/${pcProf.user_id}`, {
        full_name: "CRUD PC Edited",
        phone: "+92 300 0000001",
      });
      const { data: row } = await admin.from("profiles").select("full_name, phone").eq("user_id", pcProf.user_id).maybeSingle();
      check("E2 DC PUT coordinator → applied", patch.status >= 200 && patch.status < 300 && row?.full_name === "CRUD PC Edited" && row?.phone === "+92 300 0000001", `${patch.status} ${JSON.stringify(patch.json).slice(0, 60)}`);

      const del = await api(dcCookie, "DELETE", `/api/coordinators/${pcProf.user_id}`);
      const { data: still } = await admin.from("profiles").select("user_id").eq("user_id", pcProf.user_id).maybeSingle();
      check("E3 DC DELETE coordinator → gone", del.status >= 200 && del.status < 300 && !still, `${del.status}`);
    }
    // cleanup the test program
    await admin.from("programs").delete().eq("code", `CRUD${stamp}`);
  }

  // ---------------------------------------------------------------
  // F. DC edits + deletes a student
  // ---------------------------------------------------------------
  {
    const stuEmail = `crud-stu-${stamp}@internhub-test.pk`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email: stuEmail, password: PW, email_confirm: true, user_metadata: { full_name: "CRUD Student" },
    });
    if (!error) {
      await admin.from("profiles").upsert({ user_id: created.user!.id, email: stuEmail, full_name: "CRUD Student", role: "student", status: "active", is_active: true, university_id: uni!.id, department_id: dept.id });
      await admin.from("students").upsert({ user_id: created.user!.id, university_id: uni!.id, department_id: dept.id, student_id_number: `CRUD-${stamp}` });

      const put = await api(dcCookie, "PUT", `/api/students/${created.user!.id}`, {
        student_id_number: `CRUD2-${stamp}`,
        cgpa: 3.2,
        full_name: "CRUD Student Edited", // identity field — must be ignored, not 500
      });
      const { data: row } = await admin.from("students").select("student_id_number, cgpa").eq("user_id", created.user!.id).maybeSingle();
      check("F1 DC PUT student → applied (identity field ignored)", put.status >= 200 && put.status < 300 && row?.student_id_number === `CRUD2-${stamp}` && Number(row?.cgpa) === 3.2, `${put.status} ${JSON.stringify(put.json).slice(0, 60)}`);

      const del = await api(dcCookie, "DELETE", `/api/students/${created.user!.id}`);
      const { data: still } = await admin.from("profiles").select("user_id").eq("user_id", created.user!.id).maybeSingle();
      check("F2 DC DELETE student → gone", del.status >= 200 && del.status < 300 && !still, `${del.status}`);
    } else check("F1/F2 DC student CRUD", false, error.message);
  }

  // ---------------------------------------------------------------
  // G. HR hard-deletes a certificate they issued
  // ---------------------------------------------------------------
  {
    // pre-clean any leftover cert for (student, internship) — the API is
    // idempotent per pair and older E2E runs may have left one.
    await admin.from("certificates").delete()
      .eq("student_user_id", stP.user_id).eq("internship_id", internship!.id);

    const post = await api(hrCookie, "POST", "/api/company-hr/certificates", {
      student_user_id: stP.user_id, internship_id: internship!.id, title: "CRUD Cert",
    });
    check("G1 HR POST certificate → 2xx", post.status >= 200 && post.status < 300, `${post.status} ${JSON.stringify(post.json).slice(0, 60)}`);

    const { data: cert } = await admin.from("certificates").select("id")
      .eq("student_user_id", stP.user_id).eq("internship_id", internship!.id).order("created_at", { ascending: false }).limit(1);
    if (cert && cert[0]) {
      const del = await api(hrCookie, "DELETE", `/api/company-hr/certificates/${cert[0].id}?hard=true`);
      const { data: still } = await admin.from("certificates").select("id").eq("id", cert[0].id).maybeSingle();
      check("G2 HR hard-DELETE certificate → gone", del.status >= 200 && del.status < 300 && !still, `${del.status}`);
    } else check("G2 HR hard-DELETE certificate", false, "cert not found");
  }

  // ---------------------------------------------------------------
  // H. HR deletes an intern placement at their company
  // ---------------------------------------------------------------
  {
    const stuEmail = `crud-intern-${stamp}@internhub-test.pk`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email: stuEmail, password: PW, email_confirm: true, user_metadata: { full_name: "CRUD Intern" },
    });
    if (!error) {
      await admin.from("profiles").upsert({ user_id: created.user!.id, email: stuEmail, full_name: "CRUD Intern", role: "student", status: "active", is_active: true, university_id: uni!.id, department_id: dept.id });
      const { data: si, error: siErr } = await admin.from("student_internships").insert({
        student_user_id: created.user!.id, internship_id: internship!.id,
        company_id: comp!.id, faculty_supervisor_id: fsP.user_id, site_supervisor_id: ssP.user_id,
        status: "active", start_date: "2026-08-01", end_date: "2026-12-01",
      }).select("id").single();
      if (!siErr && si) {
        const del = await api(hrCookie, "DELETE", `/api/company-hr/interns/${si.id}`);
        const { data: still } = await admin.from("student_internships").select("id").eq("id", si.id).maybeSingle();
        check("H1 HR DELETE intern placement → gone", del.status >= 200 && del.status < 300 && !still, `${del.status}`);
      } else check("H1 HR DELETE intern placement", false, siErr?.message || "seed failed");

      // H2 negative: qa-hr cannot delete a placement belonging to ANOTHER company
      const { data: otherComp } = await admin.from("companies").select("id").neq("id", comp!.id).limit(1);
      if (otherComp && otherComp[0]) {
        const { data: si2 } = await admin.from("student_internships").insert({
          student_user_id: created.user!.id, internship_id: internship!.id,
          company_id: otherComp[0].id, status: "active", start_date: "2026-08-01", end_date: "2026-12-01",
        }).select("id").single();
        if (si2) {
          const del = await api(hrCookie, "DELETE", `/api/company-hr/interns/${si2.id}`);
          const { data: still } = await admin.from("student_internships").select("id").eq("id", si2.id).maybeSingle();
          check("H2 HR cannot delete OTHER company's placement", (del.status === 403 || del.status === 404) && !!still, `${del.status}`);
          await admin.from("student_internships").delete().eq("id", si2.id);
        }
      } else {
        // only one company exists — skip the negative test gracefully
        check("H2 HR cannot delete OTHER company's placement", true, "skipped (single company)");
      }
      // cleanup throwaway user
      await admin.from("students").delete().eq("user_id", created.user!.id);
      await admin.from("profiles").delete().eq("user_id", created.user!.id);
      await admin.auth.admin.deleteUser(created.user!.id);
    } else check("H1/H2 HR placement CRUD", false, error.message);
  }

  console.log(results.join("\n"));
  const fails = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n=== ${results.length - fails}/${results.length} passed ===`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
