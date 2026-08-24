import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ApiResponse, UserRole } from "@/types";

// ============================================================================
// POST /api/department-coordinator/students/bulk
// ----------------------------------------------------------------------------
// Bulk-create students via CSV upload. Department coordinators only.
//
// CSV format (header row required, case-insensitive):
//   first_name,last_name,email,student_id_number
//
// - first_name, last_name, email, student_id_number: required
// - program_id is NOT in the CSV. It is selected ONCE via a dropdown in the
//   import dialog and passed as a top-level body field. The selected program
//   applies to ALL rows in the CSV. This prevents per-row program code
//   typos and makes the import flow much simpler.
// - password is NOT in the CSV. It is entered ONCE via a password field in
//   the import dialog and passed as a top-level body field. The same
//   password is used for EVERY account created from this CSV. The
//   coordinator can choose any password (min 6 chars) and share it with
//   students out-of-band; students can change it after first login.
//
// The route:
//   1. Authenticates the caller via cookie-bound SSR client.
//   2. Verifies role = university_admin or super_admin (DC removed 2026-08-24).
//   3. Fetches the caller's profile (university_id, department_id).
//   4. Validates the optional program_id (must belong to caller's university).
//   5. Validates the password (required, min 6 chars).
//   6. Parses the CSV (sent as JSON: { csv, program_id, password } or
//      as text/plain with program_id + password in query string).
//   7. For each row:
//      a. Validates required fields.
//      b. Creates auth.users row (admin.createUser, email_confirm: true).
//      c. Calls internhub.ensure_profile_exists to guarantee the profile row.
//      d. Inserts students row (user_id, university_id, department_id,
//         program_id, student_id_number).
//   8. Returns per-row results: { created: [...], errors: [...] }.
//
// The route uses the service_role key for all DB writes so RLS doesn't
// block cross-user inserts. The caller's university_id / department_id
// are FORCED from their profile — body values are ignored.
// ============================================================================

interface BulkRowInput {
  first_name: string;
  last_name: string;
  email: string;
  student_id_number: string;
}

interface BulkRowResult {
  row: number;
  email: string;
  success: boolean;
  error?: string;
}

// Minimal CSV parser — handles quoted fields, embedded commas, embedded
// quotes (escaped as ""). Does NOT handle embedded newlines inside quoted
// fields (students don't have multi-line names in practice).
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
        // Handle \r\n
        if (ch === "\r" && text[i + 1] === "\n") i++;
        current.push(field);
        field = "";
        // Only push non-empty rows (skip blank lines)
        if (current.some((c) => c.trim() !== "")) {
          rows.push(current);
        }
        current = [];
      } else {
        field += ch;
      }
    }
  }
  // Last field
  if (field !== "" || current.length > 0) {
    current.push(field);
    if (current.some((c) => c.trim() !== "")) {
      rows.push(current);
    }
  }
  return rows;
}

function rowsToObjects(rows: string[][]): BulkRowInput[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const firstNameIdx = idx("first_name");
  const lastNameIdx = idx("last_name");
  const emailIdx = idx("email");
  const studentIdIdx = idx("student_id_number");

  // Also accept common aliases
  const firstNameAlt = firstNameIdx < 0 ? idx("firstname") : firstNameIdx;
  const lastNameAlt = lastNameIdx < 0 ? idx("lastname") : lastNameIdx;
  const emailAlt = emailIdx < 0 ? idx("email_address") : emailIdx;
  const studentIdAlt = studentIdIdx < 0 ? idx("student_id") : studentIdIdx;

  const out: BulkRowInput[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    out.push({
      first_name: (firstNameAlt >= 0 ? row[firstNameAlt] : "")?.trim() || "",
      last_name: (lastNameAlt >= 0 ? row[lastNameAlt] : "")?.trim() || "",
      email: (emailAlt >= 0 ? row[emailAlt] : "")?.trim().toLowerCase() || "",
      student_id_number: (studentIdAlt >= 0 ? row[studentIdAlt] : "")?.trim() || "",
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    // ==========================================================
    // 1. Authenticate caller via cookie-bound SSR client.
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
    // 2. Fetch caller's profile (role, university_id, department_id).
    // SECURITY (2026-08-23 audit): the role check uses the DB profile —
    // JWT user_metadata is user-writable and must never authorize.
    // ==========================================================
    const { data: callerProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("university_id, department_id, role")
      .eq("user_id", user.id)
      .single();

    const callerRole = callerProfile?.role as UserRole | undefined;

    // SECURITY (2026-08-24): department_coordinator REMOVED from this gate.
    // Business rule: student creation belongs to the Program Coordinator
    // workflow (see /api/program-coordinator/students/bulk). Department
    // Coordinators must not be able to create students through any path —
    // the RLS policies on `students` already deny DC INSERT, and this
    // service-role route must not widen it.
    if (
      profileErr ||
      !callerRole ||
      (callerRole !== "university_admin" && callerRole !== "super_admin")
    ) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin or Super Admin access required" },
        { status: 403 }
      );
    }

    if (!callerProfile?.university_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Your account is not linked to a university." },
        { status: 403 }
      );
    }

    const effectiveUniversityId = callerProfile.university_id;
    let effectiveDepartmentId: string | null = callerProfile.department_id;

    // ==========================================================
    // 3. Build admin client (service_role).
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
    // 4. Parse the CSV + program_id + password from the request body.
    //    Two content types are supported:
    //      - application/json: { csv: "...", program_id: "...", password: "..." }
    //      - text/plain: raw CSV text; program_id and password read from query string.
    // ==========================================================
    const contentType = request.headers.get("content-type") || "";
    let csvText = "";
    let bodyProgramId: string | null = null;
    let bodyPassword: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      csvText = body.csv || body.text || "";
      bodyProgramId = body.program_id || null;
      bodyPassword = body.password || null;
    } else {
      csvText = await request.text();
      // Read program_id + password from query string for text/plain requests.
      const url = new URL(request.url);
      bodyProgramId = url.searchParams.get("program_id");
      bodyPassword = url.searchParams.get("password");
    }

    if (!csvText.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "CSV content is empty." },
        { status: 400 }
      );
    }

    // Password is REQUIRED — it's used for every account created from this CSV.
    // Min 6 chars matches Supabase's default password policy.
    if (!bodyPassword || bodyPassword.trim().length < 6) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A password of at least 6 characters is required. It will be used for every account created from this CSV." },
        { status: 400 }
      );
    }
    const sharedPassword: string = bodyPassword.trim();

    const rows = parseCsv(csvText);
    const inputs = rowsToObjects(rows);

    if (inputs.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "CSV has no data rows. Expected header: first_name,last_name,email,student_id_number" },
        { status: 400 }
      );
    }

    // ==========================================================
    // 5. Validate the optional program_id (selected from dropdown in UI).
    //    Must belong to the caller's university. If invalid, return 400.
    // ==========================================================
    let effectiveProgramId: string | null = null;
    let programDepartmentId: string | null = null;

    if (bodyProgramId) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
      if (!uuidRegex.test(bodyProgramId)) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: `Invalid program_id format: '${bodyProgramId}'. Expected a UUID.` },
          { status: 400 }
        );
      }

      const { data: program, error: progErr } = await adminClient
        .from("programs")
        .select("id, university_id, department_id, name")
        .eq("id", bodyProgramId)
        .maybeSingle();

      if (progErr || !program) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Selected program does not exist." },
          { status: 400 }
        );
      }

      if (program.university_id !== effectiveUniversityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Selected program does not belong to your university." },
          { status: 400 }
        );
      }

      effectiveProgramId = program.id;
      programDepartmentId = program.department_id;
    }

    // ==========================================================
    // 6. Process each row.
    // ==========================================================
    const created: BulkRowResult[] = [];
    const errors: BulkRowResult[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const rowNum = i + 2; // +2 because row 1 is the header
      const baseResult: BulkRowResult = {
        row: rowNum,
        email: input.email,
        success: false,
      };

      // Validate required fields
      if (!input.first_name || !input.last_name || !input.email || !input.student_id_number) {
        errors.push({
          ...baseResult,
          error: "Missing required field (first_name, last_name, email, or student_id_number)",
        });
        continue;
      }

      if (!input.email.includes("@")) {
        errors.push({ ...baseResult, error: "Invalid email format" });
        continue;
      }

      // Use the program_id selected from the dropdown (applies to ALL rows).
      const programId: string | null = effectiveProgramId;

      // Determine the department_id for this student.
      // University admin / super_admin: use the program's department if
      // available, otherwise the caller's own department (may be NULL).
      let studentDepartmentId: string | null = programDepartmentId || effectiveDepartmentId;

      // Check for duplicate email
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .ilike("email", input.email)
        .maybeSingle();

      if (existingProfile) {
        errors.push({ ...baseResult, error: "Email already registered" });
        continue;
      }

      // Check for duplicate student_id_number within the university
      const { data: existingStudent } = await adminClient
        .from("students")
        .select("user_id")
        .eq("student_id_number", input.student_id_number)
        .eq("university_id", effectiveUniversityId)
        .maybeSingle();

      if (existingStudent) {
        errors.push({ ...baseResult, error: "Student ID number already exists in your university" });
        continue;
      }

      // Use the shared password provided in the request body (validated above).
      // The coordinator chooses this password once and shares it with all
      // students from this CSV — students can change it after first login.
      const password = sharedPassword;

      // Create auth user
      const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email: input.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: `${input.first_name} ${input.last_name}`,
          first_name: input.first_name,
          last_name: input.last_name,
          role: "student",
          university_id: effectiveUniversityId,
          department_id: studentDepartmentId || undefined,
        },
        app_metadata: {
          role: "student",
          university_id: effectiveUniversityId,
          department_id: studentDepartmentId || undefined,
        },
      });

      if (authErr || !authData?.user) {
        errors.push({ ...baseResult, error: authErr?.message || "Failed to create auth account" });
        continue;
      }

      const newUserId = authData.user.id;

      // Ensure the profile row exists (idempotent — the
      // on_auth_user_created trigger may have already created it; if not,
      // this creates it from auth.users metadata). Then explicitly UPDATE
      // the profile with the fields we know (in case the trigger's version
      // is missing department_id, etc.).
      try {
        await adminClient.rpc("ensure_profile_exists", { p_user_id: newUserId });
      } catch (ensureErr: any) {
        // Non-fatal — we'll try the upsert below as a fallback.
        console.warn(`[bulk] ensure_profile_exists failed for ${newUserId}:`, ensureErr?.message);
      }

      const { error: profileUpsertErr } = await adminClient
        .from("profiles")
        .upsert({
          user_id: newUserId,
          email: input.email,
          full_name: `${input.first_name} ${input.last_name}`,
          first_name: input.first_name,
          last_name: input.last_name,
          role: "student",
          status: "active",
          is_active: true,
          university_id: effectiveUniversityId,
          department_id: studentDepartmentId || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (profileUpsertErr) {
        // Don't rollback the auth user — the profile may have been created
        // by ensure_profile_exists. Surface the error and continue.
        errors.push({ ...baseResult, error: `Profile upsert warning: ${profileUpsertErr.message}. Auth account was created.` });
        // Continue to try the student record insert — the profile may be good enough.
      }

      // Insert students row
      const { error: studentErr } = await adminClient
        .from("students")
        .insert({
          user_id: newUserId,
          university_id: effectiveUniversityId,
          department_id: studentDepartmentId,
          program_id: programId,
          student_id_number: input.student_id_number,
          enrollment_year: new Date().getFullYear(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (studentErr) {
        // Rollback profile + auth user
        await adminClient.from("profiles").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        errors.push({ ...baseResult, error: `Student record failed: ${studentErr.message}` });
        continue;
      }

      created.push({ ...baseResult, success: true });
    }

    return NextResponse.json({
      success: true,
      data: {
        created: created.length,
        errors: errors.length,
        details: { created, errors },
      },
      message: `Imported ${created.length} student(s), ${errors.length} error(s)`,
    });
  } catch (error) {
    console.error("Error in POST /api/department-coordinator/students/bulk:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
