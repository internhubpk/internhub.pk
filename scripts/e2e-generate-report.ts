/**
 * Generate the QA student's weekly report through the real API (as the
 * student), download the DOCX, and verify contents: program checklist,
 * evidence ticks, signature images + printed names, supervisor remarks.
 */
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const BASE = "http://qa-demo-uni.127.0.0.1.nip.io:3000";
const PW = "QaTest!12345678";
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function main() {
  const { data: studentProfile } = await admin.from("profiles").select("user_id").eq("email", "qa-student@internhub-test.pk").single();
  const { data: log } = await admin.from("weekly_logs").select("id,week_number")
    .eq("student_user_id", studentProfile!.user_id).order("created_at", { ascending: false }).limit(1).single();
  console.log("log:", log!.id, "week", log!.week_number);

  // Login as student
  const loginRes = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qa-student@internhub-test.pk", password: PW }),
  });
  if (!loginRes.ok) { console.log("LOGIN FAIL", loginRes.status, await loginRes.text()); return; }
  const cookiePairs = (loginRes.headers.get("set-cookie") || "").split(", ").map(c => c.split(";")[0]).filter(c => c.includes("="));
  const cookie = cookiePairs.join("; ");

  // Generate
  const genRes = await fetch(`${BASE}/api/reports/weekly-logs/${log!.id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  const genJson = await genRes.json().catch(() => null);
  console.log("generate status:", genRes.status);
  if (!genRes.ok || !genJson?.success) { console.log(JSON.stringify(genJson).slice(0, 400)); return; }
  const reportId = genJson.data?.reportId;
  console.log("report id:", reportId);

  // Download
  const dlRes = await fetch(`${BASE}/api/reports/generated/${reportId}/download`, { headers: { Cookie: cookie } });
  console.log("download status:", dlRes.status);
  if (!dlRes.ok) { console.log(await dlRes.text().catch(() => "")); return; }
  const buf = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync("/home/z/my-project/download/weekly-report-e2e-signed.docx", buf);
  console.log("saved", buf.length, "bytes");

  // Verify contents
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  const texts = Array.from(xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)).map(m => m[1]).join(" ~ ");

  const checks: Record<string, unknown> = {
    emptyBoxes: (xml.match(/☐/g) || []).length,
    checkedBoxes: (xml.match(/☑/g) || []).length,
    evidenceTabStops: (xml.match(/<w:tab w:val="right" w:pos="9000"\/>/g) || []).length,
    programRowCount: (xml.match(/QA Demo (BSCS|BBA|Software Engineering)/g) || []).length,
    siteSupervisorName: texts.includes("QA Site Supervisor"),
    facultySupervisorName: texts.includes("QA Faculty Supervisor"),
    studentName: texts.includes("QA Demo Student"),
    noXireaLinks: !xml.includes("xirea.tech"),
  };
  // signature images embedded?
  const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith("word/media/"));
  checks.mediaCount = mediaFiles.length;
  checks.mediaTypes = mediaFiles.map(f => f.split(".").pop()).join(",");

  console.log(JSON.stringify(checks, null, 1));
  const i = texts.indexOf("Program ~");
  console.log("PROGRAM AREA:", texts.slice(i, i + 200));
  const j = texts.indexOf("Supporting Evidence");
  console.log("EVIDENCE AREA:", texts.slice(j, j + 120));
}
main().catch(e => { console.error(e); process.exit(1); });
