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
//   first_name,last_name,email,student_id_number,program_code
//
// - first_name, last_name, email, student_id_number: required
// - program_code: optional (matches programs.code in the coordinator's
//   university). If omitted, the student is created without a program.
//
// The route:
//   1. Authenticates the caller via cookie-bound SSR client.
//   2. Verifies role = department_coordinator.
//   3. Fetches the caller's profile (university_id, department_id).
//   4. Parses the CSV (sent as JSON: { csv: "..." } or as text/plain).
//   5. For each row:
//      a. Validates required fields.
//      b. Looks up program_id by code (if program_code provided).
//      c. Creates auth.users row (admin.createUser, email_confirm: true).
//      d. Upserts profiles row (role=student, university_id, department_id).
//      e. Inserts students row (user_id, university_id, department_id,
//         program_id, student_id_number).
//   6. Returns per-row results: { created: [...], errors: [...] }.
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
  program_code?: string;
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
  const programCodeIdx = idx("program_code");

  // Also accept common aliases
  const firstNameAlt = firstNameIdx < 0 ? idx("firstname") : firstNameIdx;
  const lastNameAlt = lastNameIdx < 0 ? idx("lastname") : lastNameIdx;
  const emailAlt = emailIdx < 0 ? idx("email_address") : emailIdx;
  const studentIdAlt = studentIdIdx < 0 ? idx("student_id") : studentIdIdx;
  const programCodeAlt = programCodeIdx < 0 ? idx("program") : programCodeIdx;

  const out: BulkRowInput[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    out.push({
      first_name: (firstNameAlt >= 0 ? row[firstNameAlt] : "")?.trim() || "",
      last_name: (lastNameAlt >= 0 ? row[lastNameAlt] : "")?.trim() || "",
      email: (emailAlt >= 0 ? row[emailAlt] : "")?.trim().toLowerCase() || "",
      student_id_number: (studentIdAlt >= 0 ? row[studentIdAlt] : "")?.trim() || "",
      program_code: (programCodeAlt >= 0 ? row[programCodeAlt] : "")?.trim() || undefined,
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

    const callerRole =
      (user.app_metadata?.role as UserRole | undefined) ??
      (user.user_metadata?.role as UserRole | undefined);

    if (callerRole !== "department_coordinator" && callerRole !== "university_admin" && callerRole !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Department Coordinator, University Admin, or Super Admin access required" },
        { status: 403 }
      );
    }

    // ==========================================================
    // 2. Fetch caller's profile (university_id, department_id).
    // ==========================================================
    const { data: callerProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("university_id, department_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !callerProfile?.university_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Your account is not linked to a university." },
        { status: 403 }
      );
    }

    const effectiveUniversityId = callerProfile.university_id;
    let effectiveDepartmentId: string | null = callerProfile.department_id;

    // Coordinators MUST have a department. University admins / super_admin
    // can leave department_id NULL (students will be created without a
    // department — they can be assigned later).
    if (callerRole === "department_coordinator" && !effectiveDepartmentId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Your coordinator account is not linked to a department." },
        { status: 403 }
      );
    }

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
    // 4. Parse the CSV from the request body.
    // ==========================================================
    const contentType = request.headers.get("content-type") || "";
    let csvText = "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      csvText = body.csv || body.text || "";
    } else {
      csvText = await request.text();
    }

    if (!csvText.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "CSV content is empty." },
        { status: 400 }
      );
    }

    const rows = parseCsv(csvText);
    const inputs = rowsToObjects(rows);

    if (inputs.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "CSV has no data rows. Expected header: first_name,last_name,email,student_id_number,program_code" },
        { status: 400 }
      );
    }

    // ==========================================================
    // 5. Pre-fetch all programs for the university (so we can resolve
    //    program_code -> program_id without N+1 queries).
    // ==========================================================
    const { data: programs } = await adminClient
      .from("programs")
      .select("id, code, department_id")
      .eq("university_id", effectiveUniversityId);

    const programByCode = new Map<string, { id: string; department_id: string | null }>();
    for (const p of programs || []) {
      programByCode.set((p.code as string).toLowerCase(), { id: p.id, department_id: p.department_id });
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

      // Resolve program_id from program_code (if provided)
      let programId: string | null = null;
      let programDepartmentId: string | null = null;
      if (input.program_code) {
        const program = programByCode.get(input.program_code.toLowerCase());
        if (!program) {
          errors.push({ ...baseResult, error: `Program code '${input.program_code}' not found in your university` });
          continue;
        }
        programId = program.id;
        programDepartmentId = program.department_id;
      }

      // Determine the department_id for this student.
      // - Coordinator: always their own department.
      // - University admin / super_admin: use the program's department if
      //   available, otherwise leave NULL.
      let studentDepartmentId: string | null = effectiveDepartmentId;
      if (callerRole !== "department_coordinator") {
        studentDepartmentId = programDepartmentId || effectiveDepartmentId;
      }

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

      // Generate a random password (student will use password reset)
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + "A1!";

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

      // Upsert profiles row
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
        // Rollback auth user
        await adminClient.auth.admin.deleteUser(newUserId);
        errors.push({ ...baseResult, error: `Profile creation failed: ${profileUpsertErr.message}` });
        continue;
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
