/**
 * Creates the persistent QA accounts used for browser E2E testing:
 *   - qa-superadmin@internhub-test.pk  (super_admin)
 * Plus a demo university/company/MOU/internship dataset for UI testing.
 *
 * Run: node_modules/.bin/tsx scripts/setup-qa-accounts.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const PW = "QaTest!12345678";
const RUN = "qa";

async function upsertUser(email: string, fullName: string, role: string, opts: {
  university_id?: string; department_id?: string; program_id?: string; company_id?: string;
}): Promise<string> {
  // Find or create the auth user
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

async function findOrCreate(table: string, match: Record<string, unknown>, insert: Record<string, unknown>) {
  let q = admin.from(table).select("id");
  for (const [k, v] of Object.entries(match)) {
    q = q.eq(k, v as string);
  }
  const { data: existing } = await q.maybeSingle();
  if (existing) return existing as { id: string };
  const { data: created, error } = await admin.from(table).insert(insert).select("id").single();
  if (error || !created) throw new Error(`${table} insert: ${error?.message}`);
  return created as { id: string };
}

async function main() {
  // 1. QA super admin (sign in via the normal login page)
  await upsertUser("qa-superadmin@internhub-test.pk", "QA Super Admin", "super_admin", {});
  console.log("super admin ready: qa-superadmin@internhub-test.pk / " + PW);

  // 2. Demo dataset: university + dept + company + MOU + internship + student
  const uniRes = await admin.from("universities")
    .upsert({ name: "QA Demo University", slug: "qa-demo-uni", is_active: true }, { onConflict: "slug" })
    .select("id").single();
  if (uniRes.error) throw new Error("universities upsert: " + uniRes.error.message);
  const uni = uniRes.data;
  const dept = await findOrCreate(
    "departments",
    { university_id: uni!.id, code: "QDCS" },
    { university_id: uni!.id, name: "QA Demo Computer Science", code: "QDCS" }
  );
  const prog = await findOrCreate(
    "programs",
    { university_id: uni!.id, code: "QDBSCS" },
    { university_id: uni!.id, department_id: dept!.id, name: "QA Demo BSCS", code: "QDBSCS" }
  );
  const { data: comp } = await admin.from("companies")
    .upsert({ name: "QA Demo Company", slug: "qa-demo-comp", contact_email: "hr@qa-demo-test.pk", is_active: true, is_verified: true }, { onConflict: "slug" })
    .select("id").single();

  const hrId = await upsertUser("qa-hr@internhub-test.pk", "QA Demo HR", "company_hr", { company_id: comp!.id });
  const studentId = await upsertUser("qa-student@internhub-test.pk", "QA Demo Student", "student", {
    university_id: uni!.id, department_id: dept!.id, program_id: prog!.id,
  });

  await admin.from("students").upsert({
    user_id: studentId, university_id: uni!.id, department_id: dept!.id,
    program_id: prog!.id, student_id_number: "QA-DEMO-001",
  }, { onConflict: "user_id" });

  // MOU
  const { data: mou } = await admin.from("company_university_mous")
    .select("id").eq("company_id", comp!.id).eq("university_id", uni!.id).maybeSingle();
  if (!mou) {
    await admin.from("company_university_mous").insert({
      company_id: comp!.id, university_id: uni!.id, status: "active", starts_at: new Date().toISOString(),
    });
  }

  // Internship (open, targets the dept)
  const { data: existingInternship } = await admin.from("internships")
    .select("id").eq("title", "QA Demo Frontend Internship").maybeSingle();
  if (!existingInternship) {
    const { data: internship } = await admin.from("internships").insert({
      title: "QA Demo Frontend Internship",
      description: "A demo internship for E2E testing of the marketplace.",
      company_id: comp!.id, created_by: hrId, status: "open", university_id: null, duration_weeks: 8,
    }).select("id").single();
    await admin.from("internship_target_departments").insert({
      internship_id: internship!.id, university_id: uni!.id, department_id: dept!.id,
    });
  }

  console.log("demo dataset ready:");
  console.log("  - qa-hr@internhub-test.pk / " + PW + " (company HR)");
  console.log("  - qa-student@internhub-test.pk / " + PW + " (student, sees the demo internship)");
}

main().catch(e => { console.error(e); process.exit(1); });
