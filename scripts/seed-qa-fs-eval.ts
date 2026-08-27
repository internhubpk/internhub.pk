/**
 * Seed QA data for the faculty-supervisor evaluations page E2E:
 * - faculty supervisor + site supervisor accounts (linked to QA Demo University)
 * - supervisors rows + student_internships links
 * - one PENDING task evaluation (for the Evaluate dialog)
 * - one submitted weekly log
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const PW = "QaTest!12345678";

async function main() {
  const { data: uni, error: uniErr } = await admin.from("universities").select("id").eq("slug", "qa-demo-uni").maybeSingle();
  if (uniErr || !uni) throw new Error("university: " + (uniErr?.message || "not found"));
  const { data: deptL } = await admin.from("departments").select("id").eq("code", "QDCS").limit(1);
  const dept = deptL?.[0];
  if (!dept) throw new Error("department QDCS not found");
  const { data: comp } = await admin.from("companies").select("id").eq("slug", "qa-demo-comp").maybeSingle();
  if (!comp) throw new Error("company not found");
  const { data: studentProfile } = await admin.from("profiles").select("user_id").eq("email", "qa-student@internhub-test.pk").maybeSingle();
  if (!studentProfile) throw new Error("student profile not found");

  async function upsertUser(email: string, fullName: string, role: string, opts: any = {}) {
    const { data: existing } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let uid: string;
    if (existing) {
      uid = existing.user_id;
      await admin.from("profiles").update({ full_name: fullName, role, status: "active", is_active: true, ...opts }).eq("user_id", uid);
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password: PW, email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw new Error(`${email}: ${error.message}`);
      uid = created.user!.id;
      await admin.from("profiles").upsert({
        user_id: uid, email, full_name: fullName, role, status: "active", is_active: true, ...opts,
      });
    }
    return uid;
  }

  const fsUid = await upsertUser("qa-fs@internhub-test.pk", "QA Faculty Supervisor", "faculty_supervisor", {
    university_id: uni!.id, department_id: dept!.id,
  });
  const ssUid = await upsertUser("qa-ss@internhub-test.pk", "QA Site Supervisor", "site_supervisor", { company_id: comp!.id });
  console.log("fs:", fsUid, "ss:", ssUid);

  // supervisors rows (real column: `type`, not supervisor_type)
  const { data: fsSupL } = await admin.from("supervisors").select("id").eq("user_id", fsUid).eq("type", "faculty").limit(1);
  let fsSupId = fsSupL?.[0]?.id as string | undefined;
  if (!fsSupId) {
    const { data: ins, error } = await admin.from("supervisors").insert({
      user_id: fsUid, university_id: uni!.id, department_id: dept.id, type: "faculty", is_active: true,
    }).select("id").single();
    if (error) throw new Error("supervisors fs insert: " + error.message);
    fsSupId = ins!.id;
  }
  const { data: ssSupL } = await admin.from("supervisors").select("id").eq("user_id", ssUid).eq("type", "site").limit(1);
  let ssSupId = ssSupL?.[0]?.id as string | undefined;
  if (!ssSupId) {
    const { data: ins, error } = await admin.from("supervisors").insert({
      user_id: ssUid, company_id: comp!.id, type: "site", is_active: true,
    }).select("id").single();
    if (error) throw new Error("supervisors ss insert: " + error.message);
    ssSupId = ins!.id;
  }
  console.log("fs supervisor row:", fsSupId, "ss supervisor row:", ssSupId);

  // internship
  const { data: internship } = await admin.from("internships")
    .select("id").eq("title", "QA Demo Frontend Internship").maybeSingle();

  // student_internships link — the *_supervisor_id FKs reference
  // profiles(user_id), so pass the supervisor PROFILE user ids.
  const { data: si, error: siErr } = await admin.from("student_internships").upsert({
    internship_id: internship!.id,
    student_user_id: studentProfile!.user_id,
    university_id: uni!.id,
    company_id: comp!.id,
    site_supervisor_id: ssUid,
    faculty_supervisor_id: fsUid,
    status: "active",
    start_date: new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10),
  }, { onConflict: "internship_id,student_user_id" }).select("id").single();
  if (siErr) throw new Error("student_internships: " + siErr.message);
  console.log("student_internship:", si?.id);

  // pending task evaluation (evaluator_id → profiles.user_id)
  const { data: existingEval } = await admin.from("evaluations")
    .select("id").eq("evaluator_id", fsUid).eq("status", "pending").maybeSingle();
  if (!existingEval) {
    await admin.from("evaluations").insert({
      evaluator_id: fsUid,
      student_user_id: studentProfile!.user_id,
      internship_id: internship!.id,
      type: "task",
      status: "pending",
      comments: "QA: please evaluate the submitted task.",
    });
    console.log("pending task evaluation inserted");
  }

  // submitted weekly log for this student
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = new Date(monday.getTime() + 4 * 864e5).toISOString().slice(0, 10);
  const { data: existingLog } = await admin.from("weekly_logs")
    .select("id").eq("student_user_id", studentProfile!.user_id).eq("week_start_date", weekStart).maybeSingle();
  if (!existingLog) {
    const { data: log } = await admin.from("weekly_logs").insert({
      student_user_id: studentProfile!.user_id,
      internship_id: internship!.id,
      week_number: 1,
      week_start_date: weekStart,
      week_end_date: weekEnd,
      status: "submitted",
      tasks_completed: ["Onboarding", "Setup dev environment"],
      learnings: "Learned the workflow.",
      challenges: "None.",
      program_name: "QA Demo BSCS",
      department_name: "QA Demo Computer Science",
      site_supervisor_id: ssUid,
      faculty_supervisor_id: fsUid,
      student_registration_no: "QA-DEMO-001",
    } as any).select("id").single();
    console.log("weekly log:", log?.id);
    // daily entries
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    for (let i = 0; i < 5; i++) {
      await admin.from("weekly_log_daily_entries").insert({
        weekly_log_id: log!.id,
        day_of_week: i + 1,
        entry_date: new Date(monday.getTime() + i * 864e5).toISOString().slice(0, 10),
        tasks_performed: i === 0 ? "Onboarding and environment setup" : `Task for day ${i + 1}`,
        hours_worked: 8,
        is_holiday: false,
      });
    }
  }
  console.log("QA seed complete");
}
main().catch(e => { console.error(e); process.exit(1); });
