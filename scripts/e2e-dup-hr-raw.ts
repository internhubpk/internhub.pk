/**
 * Test duplicate-email behavior of /api/admin/create-user as university admin.
 * Creates the same email twice and inspects raw responses + DB state.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const BASE = "http://qa-demo-uni.127.0.0.1.nip.io:3000";
const PW = "QaTest!12345678";
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function main() {
  const { data: uni } = await admin.from("universities").select("id").eq("slug", "qa-demo-uni").single();
  const { data: comp } = await admin.from("companies").select("id").eq("slug", "qa-demo-comp").single();

  const email = "qa-hr@internhub-test.pk"; // ALREADY EXISTS
  const loginRes = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qa-uniadmin@internhub-test.pk", password: PW }),
  });
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookiePairs = setCookie.split(", ").map(c => c.split(";")[0]).filter(c => c.includes("="));
  console.log("login:", loginRes.status);

  const res = await fetch(`${BASE}/api/admin/create-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookiePairs.join("; ") },
    body: JSON.stringify({
      email, password: "HrTest!12345678", full_name: "Dup HR", role: "company_hr", company_id: comp!.id,
    }),
  });
  const json = await res.json();
  console.log("DUP ATTEMPT status:", res.status);
  console.log(JSON.stringify(json).slice(0, 400));

  // DB state: how many auth users + profiles with this email?
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const matches = users!.users.filter(u => u.email === email);
  console.log("auth users with this email:", matches.length, matches.map(u => u.id));
  const { data: profs } = await admin.from("profiles").select("user_id,role,company_id").eq("email", email);
  console.log("profiles with this email:", JSON.stringify(profs));
}
main().catch(e => { console.error(e); process.exit(1); });
