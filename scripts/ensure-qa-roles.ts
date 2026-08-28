/**
 * Create the two missing QA accounts (program_coordinator + external_evaluator)
 * and reactivate qa-dc, reusing the existing QA Demo University dataset.
 *
 * Run: node_modules/.bin/tsx scripts/ensure-qa-roles.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)![1].trim();
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const PW = "QaTest!12345678";

async function upsertUser(email: string, fullName: string, role: string, opts: {
  university_id?: string; department_id?: string; program_id?: string; company_id?: string;
}): Promise<string> {
  const { data: existing } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
  if (existing) {
    await admin.from("profiles").update({
      full_name: fullName, role, status: "active", is_active: true,
      university_id: opts.university_id ?? null, department_id: opts.department_id ?? null,
      program_id: opts.program_id ?? null, company_id: opts.company_id ?? null,
    }).eq("user_id", existing.user_id);
    return existing.user_id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser(${email}): ${error?.message}`);
  const { error: perr } = await admin.from("profiles").upsert({
    user_id: data.user.id, email, full_name: fullName, role, status: "active", is_active: true,
    university_id: opts.university_id ?? null, department_id: opts.department_id ?? null,
    program_id: opts.program_id ?? null, company_id: opts.company_id ?? null,
  });
  if (perr) throw new Error(`profile(${email}): ${perr.message}`);
  return data.user.id;
}

async function main() {
  const { data: uni } = await admin.from("universities").select("id").eq("slug", "qa-demo-uni").maybeSingle();
  if (!uni) throw new Error("QA Demo University not found — run setup-qa-accounts.ts first");
  const { data: dept } = await admin.from("departments").select("id").eq("university_id", uni.id).eq("code", "QDCS").maybeSingle();

  // Reactivate qa-dc
  await upsertUser("qa-dc@internhub-test.pk", "QA Dept Coordinator", "department_coordinator", {
    university_id: uni.id, department_id: dept?.id,
  });
  console.log("dc ready");

  // Program coordinator (needs the QA program)
  const { data: prog } = await admin.from("programs").select("id").eq("university_id", uni.id).eq("code", "QDBSCS").maybeSingle();
  await upsertUser("qa-pc@internhub-test.pk", "QA Program Coordinator", "program_coordinator", {
    university_id: uni.id, department_id: dept?.id, program_id: prog?.id,
  });
  console.log("pc ready");

  // External evaluator (university-scoped)
  await upsertUser("qa-ee@internhub-test.pk", "QA External Evaluator", "external_evaluator", {
    university_id: uni.id, department_id: dept?.id,
  });
  console.log("ee ready");

  // External evaluator also needs an assignment row to see students.
  // Find the QA student and create an evaluation assignment if the table exists.
  const { data: student } = await admin.from("profiles").select("user_id").eq("email", "qa-student@internhub-test.pk").maybeSingle();
  const { data: ee } = await admin.from("profiles").select("user_id").eq("email", "qa-ee@internhub-test.pk").maybeSingle();
  if (student && ee) {
    // external_evaluators table: evaluator_id + student_id (+ university scope)
    const { data: existingAsg } = await admin.from("external_evaluators")
      .select("id").eq("evaluator_id", ee.user_id).eq("student_id", student.user_id).maybeSingle();
    if (!existingAsg) {
      const { error } = await admin.from("external_evaluators").insert({
        evaluator_id: ee.user_id, student_id: student.user_id,
        university_id: uni.id, department_id: dept?.id ?? null,
      });
      if (error) console.log("external_evaluators insert:", error.message);
      else console.log("ee assignment ready");
    } else {
      console.log("ee assignment exists");
    }
  }
  console.log("ALL DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
