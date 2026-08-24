import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { rateLimiter, RATE_LIMITS, extractClientInfo } from "@/lib/api-security";
import type { ApiResponse, UserRole } from "@/types";

// ============================================================================
// POST /api/program-coordinator/supervisors/bulk
// ----------------------------------------------------------------------------
// CSV BULK FACULTY SUPERVISOR IMPORT — Program Coordinator only.
//
// Mirrors /api/program-coordinator/students/bulk EXACTLY: same CSV parser,
// same two-phase dry_run/commit pattern, same per-row validation + rollback.
//
// SECURITY MODEL — nothing client-supplied is trusted for authorization:
//   - Caller role is read from the profiles table (DB truth).
//   - university_id / department_id / program_id are FORCED from the
//     caller's own profile. Any university_id/department_id/program_id
//     columns in the CSV body are IGNORED.
//   - The program is additionally verified to belong to the caller's
//     university AND department (defense in depth).
//   - Each new supervisor's `program_ids` (jsonb array) is set to
//     [pcProgramId] so the supervisor is scoped to the PC's program.
//
// TWO-PHASE IMPORT:
//   { csv, password?, dry_run: true }  -> validate everything, create
//                                        nothing; returns per-row report.
//   { csv, password?, dry_run: false } -> validate + create valid rows;
//                                        invalid rows are skipped and
//                                        reported. Per-row rollback keeps
//                                        accounts/profiles/supervisors
//                                        consistent.
//
// PASSWORD POLICY:
//   Each row carries its own `password` column (min 8). If the column
//   is absent, a top-level body `password` is used as a shared fallback.
//   If neither is present, 400.
//
// CSV COLUMNS (header row required, case-insensitive):
//   first_name*, last_name*, email*, password*
//   phone, specialization   (optional)
//   (* = required)
// ============================================================================

interface CsvRowInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string | null; // null => fall back to body.password
  phone: string | null;
  specialization: string | null;
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
// quotes (""). Same parser as the PC students bulk route (proven in
// production).
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

function rowsToObjects(rows: string[][]): {
  inputs: CsvRowInput[];
  headerError?: string;
  hasPasswordColumn: boolean;
} {
  if (rows.length < 2) return { inputs: [], hasPasswordColumn: false };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const firstIdx = idx("first_name") >= 0 ? idx("first_name") : idx("firstname");
  const lastIdx = idx("last_name") >= 0 ? idx("last_name") : idx("lastname");
  const emailIdx = idx("email") >= 0 ? idx("email") : idx("email_address");
  const passwordIdx = idx("password");
  const phoneIdx = idx("phone");
  const specIdx = idx("specialization");

  if (firstIdx < 0 || lastIdx < 0 || emailIdx < 0) {
    return {
      inputs: [],
      hasPasswordColumn: false,
      headerError:
        "CSV header must include: first_name,last_name,email,password (optional: phone,specialization). password may also be supplied at the top level of the request body.",
    };
  }

  const inputs: CsvRowInput[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    inputs.push({
      first_name: (row[firstIdx] || "").trim(),
      last_name: (row[lastIdx] || "").trim(),
      email: (row[emailIdx] || "").trim().toLowerCase(),
      password: passwordIdx >= 0 ? (row[passwordIdx] || "").trim() : null,
      phone: phoneIdx >= 0 ? (row[phoneIdx] || "").trim() || null : null,
      specialization: specIdx >= 0 ? (row[specIdx] || "").trim() || null : null,
    });
  }
  return { inputs, hasPasswordColumn: passwordIdx >= 0 };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: bulk import is an expensive, privileged operation.
    const { ipAddress: ip } = extractClientInfo(request);
    const rl = rateLimiter.check(`pc-bulk-supervisors:${ip}`, RATE_LIMITS.general);
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
            "Your account must be linked to a university, department, and program before importing supervisors.",
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
    // 5. Parse request body: { csv, password?, dry_run }.
    //    NOTE: university_id/department_id/program_id in the body or
    //    CSV are deliberately IGNORED.
    // ==========================================================
    const body = await request.json().catch(() => ({}));
    const csvText: string = (body.csv || body.text || "").toString();
    const sharedPassword: string = typeof body.password === "string" ? body.password : "";
    const dryRun: boolean = body.dry_run === true;

    if (!csvText.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "CSV content is empty." },
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

    // Shared password fallback: if the CSV has no `password` column,
    // every row must use the top-level body.password (min 8). If
    // neither is supplied, 400.
    if (!parsed.hasPasswordColumn && (!sharedPassword || sharedPassword.length < 8)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "A password of at least 8 characters is required. Either include a `password` column in the CSV or supply a top-level `password` field in the request body.",
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // 6. VALIDATE every row (dry run AND commit both run this).
    // ==========================================================
    const reports: RowReport[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const rowNum = i + 2; // +2: row 1 is the header
      const report: RowReport = {
        row: rowNum,
        email: input.email,
        name: `${input.first_name} ${input.last_name}`.trim(),
        valid: false,
      };

      if (!input.first_name || !input.last_name || !input.email) {
        report.error = "Missing required field (first_name, last_name, or email)";
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

      // Resolve the effective password for this row.
      const rowPassword = input.password && input.password.length >= 1 ? input.password : null;
      const effectivePassword = rowPassword ?? (sharedPassword ? sharedPassword : null);

      if (!effectivePassword) {
        report.error = "Missing password (provide a per-row `password` column or a top-level `password`)";
        reports.push(report);
        continue;
      }
      if (effectivePassword.length < 8) {
        report.error = "Password must be at least 8 characters";
        reports.push(report);
        continue;
      }

      seenEmails.add(input.email);

      // Existing-account check (DB)
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
    //    rollback on failure keeps auth/profile/supervisors
    //    consistent.
    // ==========================================================
    let createdCount = 0;
    const commitResults = new Map<number, RowReport>(); // row -> final report

    for (const report of validRows) {
      const input = inputs[report.row - 2]; // row number -> index
      const commitReport: RowReport = { ...report };

      // Resolve the effective password for this row at commit time too
      // (the validation pass added it to seenEmails, but the value
      // itself wasn't stored on the report).
      const rowPassword = input.password && input.password.length >= 1 ? input.password : null;
      const effectivePassword = rowPassword ?? (sharedPassword ? sharedPassword : null);

      // If somehow the password is missing here, skip this row.
      if (!effectivePassword || effectivePassword.length < 8) {
        commitReport.valid = false;
        commitReport.created = false;
        commitReport.error = "Missing or invalid password at commit time";
        commitResults.set(commitReport.row, commitReport);
        continue;
      }

      const fullName = `${input.first_name} ${input.last_name}`;

      // app_metadata carries the authoritative role + tenant scope.
      // (ensure_profile_exists reads ONLY app_metadata — migration 0084.)
      const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: effectivePassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          first_name: input.first_name,
          last_name: input.last_name,
        },
        app_metadata: {
          app_role: "faculty_supervisor",  // migration 0090: app_role, not role

          university_id: pcUniversityId,
          department_id: pcDepartmentId,
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
            full_name: fullName,
            first_name: input.first_name,
            last_name: input.last_name,
            role: "faculty_supervisor",
            status: "active",
            is_active: true,
            university_id: pcUniversityId,
            department_id: pcDepartmentId,
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

      const { error: supervisorErr } = await adminClient
        .from("supervisors")
        .insert({
          user_id: newUserId,
          university_id: pcUniversityId,
          department_id: pcDepartmentId,
          type: "faculty",
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone,
          specialization: input.specialization,
          department_focus: null, // not in CSV; PC may edit post-import
          program_ids: [pcProgramId],
          is_active: true,
        });

      if (supervisorErr) {
        // Roll back profile + auth user.
        await adminClient.from("profiles").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        commitReport.valid = false;
        commitReport.created = false;
        commitReport.error = `Supervisor record failed: ${supervisorErr.message}`;
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
      message: `Imported ${createdCount} faculty supervisor(s) into your program, ${inputs.length - createdCount} row(s) skipped.`,
    });
  } catch (error) {
    console.error("Error in POST /api/program-coordinator/supervisors/bulk:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
