/**
 * Creates a full submitted weekly log for the QA demo student so the Word
 * report generation can be E2E-tested through the browser/API:
 *   - student_internships row (qa-student ↔ QA Demo internship)
 *   - weekly_logs row (submitted) with logo/signature URLs + PDF evidence
 *     (reusing the REAL public asset URLs from the existing live log)
 *   - five daily entries (Mon–Fri)
 *
 * Run: node_modules/.bin/tsx scripts/setup-qa-weekly-log.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function main() {
  const { data: student } = await admin.from("profiles")
    .select("user_id, university_id, department_id, program_id")
    .eq("email", "qa-student@internhub-test.pk").single();
  if (!student) throw new Error("qa-student not found — run setup-qa-accounts first");

  const { data: internship } = await admin.from("internships")
    .select("id, company_id").eq("title", "QA Demo Frontend Internship").single();
  if (!internship) throw new Error("demo internship not found");

  // student_internships row
  const { data: existingSi } = await admin.from("student_internships")
    .select("id").eq("student_user_id", student.user_id).eq("internship_id", internship.id).maybeSingle();
  let siId = existingSi?.id;
  if (!siId) {
    const { data: si, error } = await admin.from("student_internships").insert({
      student_user_id: student.user_id,
      internship_id: internship.id,
      company_id: internship.company_id,
      university_id: student.university_id,
      department_id: student.department_id,
      program_id: student.program_id,
      status: "active",
      start_date: "2026-08-24",
      end_date: "2026-10-16",
    }).select("id").single();
    if (error || !si) throw new Error("student_internships insert: " + error?.message);
    siId = si.id;
  }

  // Delete any previous QA weekly log for a clean run
  const { data: oldLogs } = await admin.from("weekly_logs")
    .select("id").eq("student_user_id", student.user_id);
  for (const l of oldLogs || []) {
    await admin.from("weekly_log_daily_entries").delete().eq("weekly_log_id", l.id);
    await admin.from("weekly_logs").delete().eq("id", l.id);
  }

  // weekly_logs row — reuse the REAL public asset URLs from the live log
  // (public bucket URLs never expire; the evidence signed URL is valid
  // until 2026-09-06).
  const logoUrl = "https://wqvbmjlloxsrvwhtdskv.supabase.co/storage/v1/object/public/internship_images/241201c1-e9a6-4822-bf9f-d72ef6786c7e/weekly_log_logo_1ce755b8-c4d7-41dd-9c6b-67d01ec4f6d3_1787764585290.jpeg";
  const signatureUrl = "https://wqvbmjlloxsrvwhtdskv.supabase.co/storage/v1/object/public/signatures/241201c1-e9a6-4822-bf9f-d72ef6786c7e/weekly_log_1ce755b8-c4d7-41dd-9c6b-67d01ec4f6d3_1787764588161.png";
  const evidenceSignedUrl = "https://wqvbmjlloxsrvwhtdskv.supabase.co/storage/v1/object/sign/documents/241201c1-e9a6-4822-bf9f-d72ef6786c7e/weekly_evidence_1ce755b8-c4d7-41dd-9c6b-67d01ec4f6d3_1787764591003_Settings.pdf?token=eyJraWQiOiIxNTdkYTcyYS1jY2Q3LTQyMWEtOGM3OS0wZTExNDEzMmJiZDEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJkb2N1bWVudHMvMjQxMjAxYzEtZTlhNi00ODIyLWJmOWYtZDcyZWY2Nzg2YzdlL3dlZWtseV9ldmlkZW5jZV8xY2U3NTViOC1jNGQ3LTQxZGQtOWM2Yi02N2QwMWVjNGY2ZDNfMTc4Nzc2NDU5MTAwM19TZXR0aW5ncy5wZGYiLCJzY29wZSI6ImRvd25sb2FkIiwiaWF0IjoxNzg3NzY0NTkxLCJleHAiOjE3ODgzNjkzOTF9.CtRie1WCmOoV7eN0onwXcBHv5w8j-YqCmCBT52JTlEw";

  const { data: log, error: logErr } = await admin.from("weekly_logs").insert({
    student_user_id: student.user_id,
    internship_id: internship.id,
    student_internship_id: siId,
    week_number: 1,
    week_start_date: "2026-08-24",
    week_end_date: "2026-08-28",
    status: "approved",
    submitted_at: new Date().toISOString(),
    hours_worked: 40,
    tasks_completed: ["Onboarding", "Data cleaning", "Report drafting", "QA", "Weekly review"],
    learning_outcomes: "Learned the internal publishing workflow and tooling.",
    challenges_solutions: "Tooling setup took longer than expected; resolved with help from the supervisor.",
    university_logo_url: logoUrl,
    student_signature_url: signatureUrl,
    site_supervisor_signature_url: "https://wqvbmjlloxsrvwhtdskv.supabase.co/storage/v1/object/public/signatures/qa/site-supervisor-signature.png",
    // Supervisor remarks — the Word report's "Supervisor Remarks" section
    // reads site_supervisor_remarks first (E2E assertion target).
    site_supervisor_remarks: "Great first week — consistent attendance, proactive questions, and a solid grasp of the publishing workflow already.",
    supervisor_feedback: "Great first week — consistent attendance, proactive questions, and a solid grasp of the publishing workflow already.",
    supporting_evidence: [{
      url: evidenceSignedUrl,
      name: "Settings.pdf",
      size: 109552,
      type: "application/pdf",
      uploaded_at: new Date().toISOString(),
    }],
  }).select("id").single();
  if (logErr || !log) throw new Error("weekly_logs insert: " + logErr?.message);

  // daily entries Mon-Fri
  const days = [
    { dow: 1, date: "2026-08-24", tasks: "Onboarding and environment setup", hours: 8 },
    { dow: 2, date: "2026-08-25", tasks: "Data cleaning and validation", hours: 8 },
    { dow: 3, date: "2026-08-26", tasks: "Report drafting", hours: 8 },
    { dow: 4, date: "2026-08-27", tasks: "QA testing of the pipeline", hours: 8 },
    { dow: 5, date: "2026-08-28", tasks: "Weekly review with supervisor", hours: 8 },
  ];
  for (const d of days) {
    await admin.from("weekly_log_daily_entries").insert({
      weekly_log_id: log.id,
      day_of_week: d.dow,
      entry_date: d.date,
      tasks_performed: d.tasks,
      hours_worked: d.hours,
      is_holiday: false,
    });
  }

  console.log("QA weekly log ready:", log.id);
  console.log("Generate via: POST /api/reports/weekly-logs/" + log.id + "/generate (as qa-student)");
}

main().catch(e => { console.error(e); process.exit(1); });
