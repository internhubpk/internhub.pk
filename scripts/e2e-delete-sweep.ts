/**
 * Delete sweep: exercise the main delete endpoints across dashboards with
 * throwaway data, verifying 2xx + DB removal. API-level (fast, reliable).
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const TBASE = "http://qa-demo-uni.127.0.0.1.nip.io:3000";
const PW = "QaTest!12345678";

const results: string[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " (" + detail + ")" : ""}`);

async function login(email: string): Promise<string> {
  const res = await fetch(`${TBASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return (res.headers.get("set-cookie") || "").split(", ").map((c) => c.split(";")[0]).filter((c) => c.includes("=")).join("; ");
}

async function main() {
  const { data: uni } = await admin.from("universities").select("id").eq("slug", "qa-demo-uni").single();
  const { data: dept } = await admin.from("departments").select("id").eq("code", "QDCS").limit(1);
  const { data: prog } = await admin.from("programs").select("id").eq("code", "QDBSCS").maybeSingle();
  const { data: comp } = await admin.from("companies").select("id").eq("slug", "qa-demo-comp").single();
  const stamp = Date.now().toString().slice(-6);

  // ---------- University admin deletes a student ----------
  const stuEmail = `sweep-stu-${stamp}@internhub-test.pk`;
  {
    const cookie = await login("qa-uniadmin@internhub-test.pk");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: stuEmail, password: PW, email_confirm: true, user_metadata: { full_name: "Sweep Student" },
    });
    if (!error) {
      await admin.from("profiles").upsert({ user_id: created.user!.id, email: stuEmail, full_name: "Sweep Student", role: "student", status: "active", is_active: true, university_id: uni!.id, department_id: dept![0].id, program_id: prog?.id });
      await admin.from("students").upsert({ user_id: created.user!.id, university_id: uni!.id, department_id: dept![0].id, program_id: prog?.id, student_id_number: `SWEEP-${stamp}` });
      const res = await fetch(`${TBASE}/api/students/${created.user!.id}`, { method: "DELETE", headers: { Cookie: cookie } });
      const { data: prof } = await admin.from("profiles").select("user_id").eq("email", stuEmail).maybeSingle();
      check("uni-admin delete student", res.ok && !prof, `${res.status}`);
    } else check("uni-admin delete student (create failed)", false, error.message);
  }

  // ---------- Super admin deletes a company-hr ----------
  const hrEmail = `sweep-hr-${stamp}@internhub-test.pk`;
  {
    const cookie = await login("qa-superadmin@internhub-test.pk");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: hrEmail, password: PW, email_confirm: true, user_metadata: { full_name: "Sweep HR" },
    });
    if (!error) {
      await admin.from("profiles").upsert({ user_id: created.user!.id, email: hrEmail, full_name: "Sweep HR", role: "company_hr", status: "active", is_active: true, company_id: comp!.id });
      const res = await fetch(`${TBASE}/api/super-admin/users/${created.user!.id}`, { method: "DELETE", headers: { Cookie: cookie } });
      const { data: prof } = await admin.from("profiles").select("user_id").eq("email", hrEmail).maybeSingle();
      check("super-admin delete company_hr", res.ok && !prof, `${res.status}`);
    } else check("super-admin delete company_hr (create failed)", false, error.message);
  }

  // ---------- Company HR deletes a document ----------
  {
    const cookie = await login("qa-hr@internhub-test.pk");
    const { data: studentProfile } = await admin.from("profiles").select("user_id").eq("email", "qa-student@internhub-test.pk").single();
    const { data: hrProfile } = await admin.from("profiles").select("user_id").eq("email", "qa-hr@internhub-test.pk").maybeSingle();
    const { data: doc, error: docErr } = await admin.from("documents").insert({
      name: "Sweep Doc", type: "other", url: "https://example.com/sweep.pdf",
      mime_type: "application/pdf", size: 1024,
      uploaded_by: hrProfile!.user_id,
      entity_type: "student", entity_id: studentProfile!.user_id,
    } as any).select("id").single();
    if (!docErr && doc) {
      const res = await fetch(`${TBASE}/api/company-hr/documents/${doc.id}`, { method: "DELETE", headers: { Cookie: cookie } });
      const { data: still } = await admin.from("documents").select("id").eq("id", doc.id).maybeSingle();
      check("HR delete document", res.ok && !still, `${res.status}`);
    } else check("HR delete document (seed failed)", false, docErr?.message || "unknown");
  }

  // ---------- Student deletes a notification ----------
  {
    const cookie = await login("qa-student@internhub-test.pk");
    const { data: studentProfile } = await admin.from("profiles").select("user_id").eq("email", "qa-student@internhub-test.pk").single();
    const { data: notif, error } = await admin.from("notifications").insert({
      user_id: studentProfile!.user_id, title: "Sweep notif", message: "delete me", category: "system",
    } as any).select("id").single();
    if (!error && notif) {
      const res = await fetch(`${TBASE}/api/notifications/inbox?id=${notif.id}`, { method: "DELETE", headers: { Cookie: cookie } });
      const { data: still } = await admin.from("notifications").select("id").eq("id", notif.id).maybeSingle();
      check("student delete notification", res.ok && !still, `${res.status}`);
    } else check("student delete notification (seed failed)", false, error?.message || "unknown");
  }

  // ---------- University admin deletes a coordinator ----------
  const dcEmail = `sweep-dc-${stamp}@internhub-test.pk`;
  {
    const cookie = await login("qa-uniadmin@internhub-test.pk");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: dcEmail, password: PW, email_confirm: true, user_metadata: { full_name: "Sweep DC" },
    });
    if (!error) {
      await admin.from("profiles").upsert({ user_id: created.user!.id, email: dcEmail, full_name: "Sweep DC", role: "department_coordinator", status: "active", is_active: true, university_id: uni!.id, department_id: dept![0].id });
      const res = await fetch(`${TBASE}/api/coordinators/${created.user!.id}`, { method: "DELETE", headers: { Cookie: cookie } });
      const { data: prof } = await admin.from("profiles").select("user_id").eq("email", dcEmail).maybeSingle();
      check("uni-admin delete coordinator", res.ok && !prof, `${res.status}`);
    } else check("uni-admin delete coordinator (create failed)", false, error.message);
  }

  console.log(results.join("\n"));
  const fails = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n=== ${results.length - fails}/${results.length} passed ===`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
