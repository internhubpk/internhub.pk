/**
 * E2E: reproduce "university admin creates company HR" error.
 * 1. Ensure QA university + university_admin account exist.
 * 2. Sign in as the university admin (via /api/auth).
 * 3. POST /api/admin/create-user { role: company_hr, company_id }.
 * Prints full response to reveal the error.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)![1].trim();
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const BASE = "http://iiui.127.0.0.1.nip.io:3000";
const PW = "QaTest!12345678";

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function main() {
  // 1. Ensure QA uni + a company exist
  const { data: uni } = await admin.from("universities").upsert(
    { name: "QA Demo University", slug: "qa-demo-uni", is_active: true },
    { onConflict: "slug" }
  ).select("id").single();
  const { data: comp } = await admin.from("companies").upsert(
    { name: "QA Demo Company", slug: "qa-demo-comp", contact_email: "hr@qa-demo-test.pk", is_active: true, is_verified: true },
    { onConflict: "slug" }
  ).select("id").single();
  console.log("uni:", uni?.id, "company:", comp?.id);

  // 2. University admin account
  const email = "qa-uniadmin@internhub-test.pk";
  const { data: existing } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
  let uid: string;
  if (existing) {
    uid = existing.user_id;
    await admin.from("profiles").update({
      full_name: "QA Uni Admin", role: "university_admin", status: "active", is_active: true, university_id: uni!.id,
    }).eq("user_id", uid);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: "QA Uni Admin", role: "university_admin" },
      app_metadata: { app_role: "university_admin", university_id: uni!.id },
    });
    if (error) throw new Error("createUser: " + error.message);
    uid = created.user!.id;
    const { error: perr } = await admin.from("profiles").upsert({
      user_id: uid, email, full_name: "QA Uni Admin", role: "university_admin", status: "active", is_active: true, university_id: uni!.id,
    });
    if (perr) throw new Error("profile: " + perr.message);
  }
  console.log("uni admin:", email, uid);

  // 3. Sign in via the app's auth API
  const loginRes = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email, password: PW }),
  });
  const loginJson = await loginRes.json();
  console.log("login status:", loginRes.status);
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookies = setCookie.split(/(?<= Expires=[^;]+;|Path=\/;)|(?<=Expires=[^;]+)\s(?=[A-Za-z]+=)/ ).join(" ");
  // simpler: keep all sb cookies
  const cookiePairs = setCookie.split(", ").map(c => c.split(";")[0]).filter(c => c.includes("="));
  if (!loginRes.ok) {
    console.log("LOGIN FAILED:", JSON.stringify(loginJson).slice(0, 500));
    return;
  }
  console.log("login ok, cookies:", cookiePairs.map(c => c.split("=")[0]).join(","));

  // 4. Create company HR as university admin
  const res = await fetch(`${BASE}/api/admin/create-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookiePairs.join("; ") },
    body: JSON.stringify({
      email: `qa-hr-${Date.now()}@internhub-test.pk`,
      password: "HrTest!12345678",
      full_name: "E2E Created HR",
      role: "company_hr",
      company_id: comp!.id,
      job_title: "HR Manager",
    }),
  });
  const json = await res.json();
  console.log("=== CREATE-USER RESPONSE ===");
  console.log("status:", res.status);
  console.log(JSON.stringify(json, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
