import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { rateLimiter, RATE_LIMITS, extractClientInfo } from "@/lib/api-security";
import type { ApiResponse } from "@/types";
import type { UserRole } from "@/types";

// ============================================================================
// POST /api/program-coordinator/students/bulk
// ----------------------------------------------------------------------------
// CSV BULK STUDENT IMPORT — Program Coordinator only.
//
// Business rule (2026-08-24): student creation belongs to the Program
// Coordinator workflow. Department Coordinators have no path to create
// students (UI removed; /api/students denies DC; RLS students INSERT has no
// DC branch; the DC bulk route gate no longer includes DC).
//
// SECURITY MODEL — nothing client-supplied is trusted for authorization:
//   - Caller role is read from the profiles table (DB truth).
//   - university_id / department_id / program_id are FORCED from the
//     caller's own profile. Any university_id/department_id/program_id
//     columns in the CSV body are IGNORED.
//   - The program is additionally verified to belong to the caller's
//     university AND department (defense in depth).
//   - The students row is written with the caller's scope; the RLS
//     students_pc_insert policy (department-scoped) matches this shape.
//
// TWO-PHASE IMPORT:
//   { csv, password, dry_run: true }  -> validate everything, create
//                                        nothing; returns per-row report.
//   { csv, password, dry_run: false } -> validate + create valid rows;
//                                        invalid rows are skipped and
//                                        reported. Per-row rollback keeps
//                                        accounts/profiles/students
//                                        consistent.
//
// CSV COLUMNS (header row required, case-insensitive):
//   first_name*, last_name*, email*, student_id_number*
//   semester, enrollment_year, expected_graduation, cgpa   (optional)
//   (* = required)
// ============================================================================

interface CsvRowInput {
  first_name: string;
  last_name: string;
  email: string;
  student_id_number: string;
  semester: string | null;
  enrollment_year: string | null;
  expected_graduation: string | null;
  cgpa: string | null;
}

interface RowReport {
  row: number; // 1-based CSV row number (row 1 = header)
  email: string;
  name: string;
  valid: boolean;
  error?: string;
  created?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Max rows per import — protects the service-role loop and DB.
const MAX_ROWS = 500;

// Minimal CSV parser — handles quoted fields, embedded commas, escaped
// quotes (""). Same parser as the DC bulk route (proven in production).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        current.push(field);
        field = "";
        if (current.some((c) => c.trim() !== "")) {
          rows.push(current);
        }
        current = [];
      } else {
        field += ch;
      }
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    if (current.some((c) => c.trim() !== "")) {
      rows.push(current);
    }
  }
  return rows;
}

function rowsToObjects(rows: string[][]): { inputs: CsvRowInput[]; headerError?: string } {
  if (rows.length < 2) return { inputs: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const firstIdx = idx("first_name") >= 0 ? idx("first_name") : idx("firstname");
  const lastIdx = idx("last_name") >= 0 ? idx("last_name") : idx("lastname");
  const emailIdx = idx("email") >= 0 ? idx("email") : idx("email_address");
  const sidIdx = idx("student_id_number") >= 0 ? idx("student_id_number") : idx("student_id");
  const semesterIdx = idx("semester");
  const enrollIdx = idx("enrollment_year");
  const gradIdx = idx("expected_graduation");
  const cgpaIdx = idx("cgpa");

  if (firstIdx < 0 || lastIdx < 0 || emailIdx < 0 || sidIdx < 0) {
    return {
      inputs: [],
      headerError:
        "CSV header must include: first_name,last_name,email,student_id_number (optional: semester,enrollment_year,expected_graduation,cgpa)",
    };
  }

  const inputs: CsvRowInput[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    inputs.push({
      first_name: (row[firstIdx] || "").trim(),
      last_name: (row[lastIdx] || "").trim(),
      email: (row[emailIdx] || "").trim().toLowerCase(),
      student_id_number: (row[sidIdx] || "").trim(),
      semester: semesterIdx >= 0 ? (row[semesterIdx] || "").trim() || null : null,
      enrollment_year: enrollIdx >= 0 ? (row[enrollIdx] || "").trim() || null : null,
      expected_graduation: gradIdx >= 0 ? (row[gradIdx] || "").trim() || null : null,
      cgpa: cgpaIdx >= 0 ? (row[cgpaIdx] || "").trim() || null : null,
    });
  }
  return { inputs };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: bulk import is an expensive, privileged operation.
    const { ipAddress: ip } = extractClientInfo(request);
    const rl = rateLimiter.check(`pc-bulk-import:${ip}`, RATE_LIMITS.general);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    // ==========================================================
    // 1. Authenticate caller (cookie-bound SSR client).
    // ==========================================================
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ==========================================================
    // 2. DB-verified role + scope. ONLY program_coordinator may call.
    //    All tenant ids are taken from the caller's profile.
    // ==========================================================
    const { data: callerProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("university_id, department_id, program_id, role")
      .eq("user_id", user.id)
      .single();

    const callerRole = callerProfile?.role as UserRole | undefined;

    if (profileErr || !callerRole || callerRole !== "program_coordinator") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Program Coordinator access required" },
        { status: 403 }
      );
    }

    const { university_id: pcUniversityId, department_id: pcDepartmentId, program_id: pcProgramId } =
      callerProfile || {};

    if (!pcUniversityId || !pcDepartmentId || !pcProgramId) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Your account must be linked to a university, department, and program before importing students.",
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // 3. Service-role client for cross-user writes.
    // ==========================================================
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfiguration: service role key is not set." },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // ==========================================================
    // 4. Defense in depth: verify the PC's program actually belongs
    //    to their university + department in the programs table.
    // ==========================================================
    const { data: programRow, error: programErr } = await adminClient
      .from("programs")
      .select("id, university_id, department_id, name")
      .eq("id", pcProgramId)
      .maybeSingle();

    if (programErr || !programRow) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Your assigned program could not be found. Contact your administrator." },
        { status: 403 }
      );
    }
    if (programRow.university_id !== pcUniversityId || programRow.department_id !== pcDepartmentId) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Your profile's program does not match your university/department. Contact your administrator.",
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // 5. Parse request body: { csv, password, dry_run }.
    //    NOTE: university_id/department_id/program_id in the body or
    //    CSV are deliberately IGNORED.
    // ==========================================================
    const body = await request.json().catch(() => ({}));
    const csvText: string = (body.csv || body.text || "").toString();
    const password: string = (body.password || "").toString();
    const dryRun: boolean = body.dry_run === true;

    if (!csvText.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "CSV content is empty." },
        { status: 400 }
      );
    }

    // Password policy: must satisfy the platform minimum (8, enforced
    // server-side by Supabase auth config as of 2026-08-23).
    if (!password || password.length < 8) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "A password of at least 8 characters is required. It will be used for every account created from this CSV.",
        },
        { status: 400 }
      );
    }

    const parsed = rowsToObjects(parseCsv(csvText));
    if (parsed.headerError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: parsed.headerError },
        { status: 400 }
      );
    }
    const inputs = parsed.inputs;
    if (inputs.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "CSV has no data rows." },
        { status: 400 }
      );
    }
    if (inputs.length > MAX_ROWS) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `CSV exceeds the maximum of ${MAX_ROWS} rows per import.` },
        { status: 400 }
      );
    }

    // ==========================================================
    // 6. VALIDATE every row (dry run AND commit both run this).
    // ==========================================================
    const reports: RowReport[] = [];
    const seenEmails = new Set<string>();
    const seenStudentIds = new Set<string>();

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const rowNum = i + 2; // +2: row 1 is the header
      const report: RowReport = {
        row: rowNum,
        email: input.email,
        name: `${input.first_name} ${input.last_name}`.trim(),
        valid: false,
      };

      if (!input.first_name || !input.last_name || !input.email || !input.student_id_number) {
        report.error = "Missing required field (first_name, last_name, email, or student_id_number)";
        reports.push(report);
        continue;
      }
      if (!EMAIL_RE.test(input.email)) {
        report.error = "Invalid email format";
        reports.push(report);
        continue;
      }
      if (seenEmails.has(input.email)) {
        report.error = "Duplicate email within this CSV";
        reports.push(report);
        continue;
      }
      if (seenStudentIds.has(input.student_id_number)) {
        report.error = "Duplicate student_id_number within this CSV";
        reports.push(report);
        continue;
      }

      // Optional numeric validations
      if (input.enrollment_year && !/^\d{4}$/.test(input.enrollment_year)) {
        report.error = "enrollment_year must be a 4-digit year (e.g. 2026)";
        reports.push(report);
        continue;
      }
      if (input.semester !== null && input.semester !== "") {
        const sem = parseInt(input.semester, 10);
        if (Number.isNaN(sem) || sem < 1 || sem > 12) {
          report.error = "semester must be an integer between 1 and 12";
          reports.push(report);
          continue;
        }
      }
      if (input.cgpa !== null && input.cgpa !== "") {
        const cgpa = parseFloat(input.cgpa);
        if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 4) {
          report.error = "cgpa must be a number between 0 and 4";
          reports.push(report);
          continue;
        }
      }

      seenEmails.add(input.email);
      seenStudentIds.add(input.student_id_number);

      // Existing-account checks (DB)
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .ilike("email", input.email)
        .maybeSingle();
      if (existingProfile) {
        report.error = "Email already registered";
        reports.push(report);
        continue;
      }

      const { data: existingStudent } = await adminClient
        .from("students")
        .select("user_id")
        .eq("student_id_number", input.student_id_number)
        .eq("university_id", pcUniversityId)
        .maybeSingle();
      if (existingStudent) {
        report.error = "Student ID number already exists in your university";
        reports.push(report);
        continue;
      }

      report.valid = true;
      reports.push(report);
    }

    const validRows = reports.filter((r) => r.valid);

    // DRY RUN: stop here and return the full validation report.
    if (dryRun) {
      return NextResponse.json({
        success: true,
        data: {
          dry_run: true,
          total: inputs.length,
          valid: validRows.length,
          invalid: inputs.length - validRows.length,
          details: reports,
        },
        message: `Validation complete: ${validRows.length} valid row(s), ${inputs.length - validRows.length} with errors.`,
      });
    }

    // ==========================================================
    // 7. COMMIT: create accounts for valid rows only. Per-row
    //    rollback on failure keeps auth/profile/students consistent.
    // ==========================================================
    let createdCount = 0;
    const commitResults = new Map<number, RowReport>(); // row -> final report

    for (const report of validRows) {
      const input = inputs[report.row - 2]; // row number -> index
      const commitReport: RowReport = { ...report };

      // app_metadata carries the authoritative role + tenant scope.
      // (ensure_profile_exists reads ONLY app_metadata — migration 0084.)
      const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email: input.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: `${input.first_name} ${input.last_name}`,
          first_name: input.first_name,
          last_name: input.last_name,
        },
        app_metadata: {
          app_role: "student",  // migration 0090: app_role, not role

          university_id: pcUniversityId,
          department_id: pcDepartmentId,
          program_id: pcProgramId,
        },
      });

      if (authErr || !authData?.user) {
        commitReport.valid = false;
        commitReport.created = false;
        commitReport.error = authErr?.message || "Failed to create auth account";
        commitResults.set(commitReport.row, commitReport);
        continue;
      }

      const newUserId = authData.user.id;

      try {
        await adminClient.rpc("ensure_profile_exists", { p_user_id: newUserId });
      } catch {
        // Non-fatal — the explicit upsert below is the fallback.
      }

      const { error: profileUpsertErr } = await adminClient
        .from("profiles")
        .upsert(
          {
            user_id: newUserId,
            email: input.email,
            full_name: `${input.first_name} ${input.last_name}`,
            first_name: input.first_name,
            last_name: input.last_name,
            role: "student",
            status: "active",
            is_active: true,
            university_id: pcUniversityId,
            department_id: pcDepartmentId,
            // program_id on the profile keeps the weekly-log program_name
            // snapshot + report generation correct (they read
            // profiles.program_id first). Bug fix 2026-08-26: this was
            // previously only written to the students row, leaving the
            // profile NULL and reports showing "—" for Program.
            program_id: pcProgramId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (profileUpsertErr) {
        // Roll back the auth user — do not leave an orphan account.
        await adminClient.from("profiles").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        commitReport.valid = false;
        commitReport.created = false;
        commitReport.error = `Profile creation failed: ${profileUpsertErr.message}`;
        commitResults.set(commitReport.row, commitReport);
        continue;
      }

      const { error: studentErr } = await adminClient
        .from("students")
        .insert({
          user_id: newUserId,
          university_id: pcUniversityId,
          department_id: pcDepartmentId,
          program_id: pcProgramId, // ALWAYS the PC's own program
          student_id_number: input.student_id_number,
          semester: input.semester
            ? (() => {
                const s = parseInt(input.semester, 10);
                return Number.isNaN(s) || s < 1 || s > 12 ? null : s;
              })()
            : null,
          enrollment_year: input.enrollment_year
            ? parseInt(input.enrollment_year, 10)
            : new Date().getFullYear(),
          expected_graduation: input.expected_graduation || null,
          cgpa: input.cgpa ? parseFloat(input.cgpa) : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (studentErr) {
        // Roll back profile + auth user.
        await adminClient.from("profiles").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        commitReport.valid = false;
        commitReport.created = false;
        commitReport.error = `Student record failed: ${studentErr.message}`;
        commitResults.set(commitReport.row, commitReport);
        continue;
      }

      commitReport.created = true;
      commitResults.set(commitReport.row, commitReport);
      createdCount++;
    }

    // Merge commit-time results (successes AND failures) into the report.
    const finalReports = reports.map((r) => commitResults.get(r.row) ?? r);

    return NextResponse.json({
      success: true,
      data: {
        dry_run: false,
        total: inputs.length,
        created: createdCount,
        valid: validRows.length,
        invalid: inputs.length - createdCount,
        details: finalReports,
      },
      message: `Imported ${createdCount} student(s) into your program, ${inputs.length - createdCount} row(s) skipped.`,
    });
  } catch (error) {
    console.error("Error in POST /api/program-coordinator/students/bulk:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
