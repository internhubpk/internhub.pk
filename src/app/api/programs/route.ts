import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type {
  ApiResponse,
  PaginatedResponse,
  UserRole,
} from "@/types";
import {
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";

// Roles that can view programs
const VIEW_PROGRAM_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "program_coordinator",
  "faculty_supervisor",
  "student",
];

// Roles that can create/edit programs.
// Per InternHub spec section 14: Department Coordinators create programs.
// Program Coordinators CANNOT create programs (they manage students/supervisors).
const MANAGE_PROGRAM_ROLES: UserRole[] = [
  "super_admin",
  "department_coordinator",
];

/**
 * GET /api/programs
 * List programs - filtered by department for coordinators
 * SECURITY: Department-scoped queries for department_coordinator role
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.profile || !VIEW_PROGRAM_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to view programs");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search");
    const isActive = searchParams.get("is_active");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data
    let query = supabase
      .from("programs")
      .select(`
        *,
        departments:department_id(name, code),
        universities:university_id(name, slug),
        supervisor:default_faculty_supervisor_id(full_name, email),
        external_evaluator:default_external_evaluator_id(full_name, email)
      `, { count: "exact" });

    // Apply role-based filtering - CRITICAL SCOPING
    const userRole = authContext.profile.role;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    if (userRole === "department_coordinator") {
      // Department coordinators can ONLY see their department's programs
      if (userDepartmentId) {
        query = query.eq("department_id", userDepartmentId);

        // Also enforce university scope
        if (userUniversityId) {
          query = query.eq("university_id", userUniversityId);
        }
      } else {
        // Department coordinator without department assignment gets empty results
        return NextResponse.json<ApiResponse<PaginatedResponse<any>>>({
          success: true,
          data: {
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          },
        });
      }
    } else if (userRole === "university_admin" && userUniversityId) {
      // University admins see all programs in their university
      query = query.eq("university_id", userUniversityId);
    } else if (userRole === "faculty_supervisor" && userUniversityId) {
      // Faculty supervisors see programs in their university
      query = query.eq("university_id", userUniversityId);
    }
    // Super admins can see all programs

    // Apply additional filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    if (isActive === "true") {
      query = query.eq("is_active", true);
    } else if (isActive === "false") {
      query = query.eq("is_active", false);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: programs, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching programs:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch programs" },
        { status: 500 }
      );
    }

    // Get student counts for each program
    const programIds = programs?.map(p => p.id) || [];
    let studentCounts: Record<string, number> = {};
    
    if (programIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select("program_id")
        .in("program_id", programIds);

      studentCounts = (students || []).reduce((acc, s) => {
        if (s.program_id) {
          acc[s.program_id] = (acc[s.program_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
    }

    // Fetch Program Coordinator info for each program (PC is linked
    // via profiles.program_id, not a column on programs).
    let pcMap: Record<string, { full_name: string | null; email: string }> = {};
    if (programIds.length > 0) {
      const { data: pcProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, program_id")
        .eq("role", "program_coordinator")
        .in("program_id", programIds);

      for (const pc of pcProfiles || []) {
        if (pc.program_id) {
          pcMap[pc.program_id] = {
            full_name: pc.full_name,
            email: pc.email,
          };
        }
      }
    }

    // Enrich programs with student counts and PC info
    const enrichedPrograms = (programs || []).map(p => ({
      ...p,
      student_count: studentCounts[p.id] || 0,
      program_coordinator: pcMap[p.id] || null,
    }));

    const response: PaginatedResponse<typeof enrichedPrograms[0]> = {
      data: enrichedPrograms,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<typeof enrichedPrograms[0]>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/programs:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programs
 * Create new program — Department Coordinator or Super Admin only.
 *
 * Per InternHub spec section 14:
 *   - The Program record must NOT REQUIRE a `duration_weeks` field.
 *     (We still accept it for back-compat with the existing column, but
 *      it is NOT a required field.)
 *   - When a program is created, the corresponding Program Coordinator
 *     account MUST be created according to the application's existing
 *     authentication/role architecture. We use the SAME pattern as
 *     /api/coordinators (Supabase auth.admin.createUser + profiles insert),
 *     with role = "program_coordinator" and program_id = the new program.
 *   - Do NOT create a second authentication system.
 *
 * The auto-created Program Coordinator receives:
 *   - email = caller-supplied (or auto-generated from program code)
 *   - password = random 16-char password (Supabase will email a recovery link
 *     if email_confirm is false; for now we set email_confirm=true and rely
 *     on Supabase's "invite user" pattern)
 *   - role metadata = "program_coordinator"
 *   - university_id = the program's university
 *   - department_id = the program's department
 *   - program_id = the new program's id
 */
export async function POST(request: NextRequest) {
  const requestId = `prog-post-${Date.now()}`;
  try {
    const authContext = await requireAuth();

    if (!authContext.profile || !MANAGE_PROGRAM_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to create programs");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse request body.
    const body = await request.json();
    let {
      name,
      code,
      description,
      department_id,
      is_active,
      default_faculty_supervisor_id,
      default_external_evaluator_id,
      // Program Coordinator credentials (required for program creation)
      coordinator_email,
      coordinator_full_name,
      coordinator_password,
    } = body;

    const userRole = authContext.profile.role;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    // Department coordinators don't see a department picker in the form
    // (they only manage their own department), so default department_id
    // from their profile when not provided in the body.
    if (!department_id && userRole === "department_coordinator" && userDepartmentId) {
      department_id = userDepartmentId;
    }

    // Validate required fields.
    // NOTE: duration_weeks was REMOVED from the programs table in migration
    // 0076 — programs no longer have a fixed week count.
    if (!name || !code || !department_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing required fields: name, code, department_id" },
        { status: 400 }
      );
    }

    // Validate Program Coordinator credentials.
    if (!coordinator_full_name || !coordinator_email) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing required fields: coordinator_full_name, coordinator_email" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(coordinator_email)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid coordinator email format" },
        { status: 400 }
      );
    }

    // Validate password (minimum 8 characters)
    const pcPassword = coordinator_password || '';
    if (pcPassword.length < 8) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Coordinator password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Determine university_id based on role.
    let universityId = body.university_id;

    if (userRole === "department_coordinator") {
      // Department coordinator can only create in their own department
      if (department_id !== userDepartmentId) {
        return authorizationError("Can only create programs in your own department");
      }
      universityId = userUniversityId;
    }
    // super_admin: use body.university_id (must be passed by caller)

    if (!universityId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "university_id is required" },
        { status: 400 }
      );
    }

    // Check if code is unique within the university
    const { data: existingProgram } = await supabase
      .from("programs")
      .select("id")
      .eq("code", code)
      .eq("university_id", universityId)
      .single();

    if (existingProgram) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A program with this code already exists in your university" },
        { status: 409 }
      );
    }

    // Create program (duration_weeks column was DROPPED in migration 0076)
    const programInsert: Record<string, unknown> = {
      name,
      code,
      description: description || null,
      university_id: universityId,
      department_id,
      default_faculty_supervisor_id: default_faculty_supervisor_id || null,
      default_external_evaluator_id: default_external_evaluator_id || null,
      is_active: is_active !== undefined ? is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: program, error } = await supabase
      .from("programs")
      .insert(programInsert)
      .select()
      .single();

    if (error || !program) {
      console.error(`[${requestId}] program INSERT error:`, error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to create program: ${error?.message || "unknown"}` },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------------------
    // AUTO-CREATE Program Coordinator account (per InternHub spec section 14)
    // ----------------------------------------------------------------------
    // Use the SAME authentication pattern as /api/coordinators:
    //   1. Build service-role client (supabase.auth.admin.createUser
    //      requires the service role key — the publishable key cannot
    //      create new auth users without establishing a session for them,
    //      which would log the calling coordinator OUT).
    //   2. Create the auth user with email_confirm=true and a random
    //      password. Supabase will send a "confirm your account" email
    //      if SMTP is configured; the new Program Coordinator can then
    //      use "Forgot Password" to set their own password.
    //   3. Insert a profile row with role=program_coordinator, university_id,
    //      department_id, and program_id (linking them to the just-created
    //      program).
    //
    // The trigger `profiles_sync_auth_metadata` (migration 0011/0038) will
    // automatically keep the new user's app_metadata.role in sync with
    // their profiles.role, so the proxy/JWT can read the role.
    // ----------------------------------------------------------------------

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      // Service role not configured — return success but warn.
      // The program was created; the PC account creation can be retried
      // via /api/programs/[id]/create-coordinator later.
      console.warn(`[${requestId}] SUPABASE_SERVICE_ROLE_KEY not set — skipping PC auto-creation`);
      return NextResponse.json<ApiResponse<typeof program>>({
        success: true,
        data: program!,
        message:
          "Program created successfully, but the Program Coordinator account could not be auto-created (server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set). Use the 'Create Program Coordinator' action on the program to create one manually.",
        warning: "PC_AUTO_CREATE_SKIPPED",
      });
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Determine the PC's email and full name from caller-supplied values.
    const pcEmail = coordinator_email;
    const pcFullName = coordinator_full_name;

    // Check if a user with this email already exists.
    const { data: existingUser } = await admin
      .from("profiles")
      .select("user_id, role, program_id")
      .eq("email", pcEmail)
      .maybeSingle();

    let pcUserId: string | null = null;
    if (existingUser) {
      // Reuse the existing user — update their profile to point to this program.
      pcUserId = existingUser.user_id;
      await admin
        .from("profiles")
        .update({
          role: "program_coordinator",
          university_id: universityId,
          department_id: department_id,
          program_id: program.id,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", pcUserId);
    } else {
      // Create a new auth user with the CALLER-SUPPLIED password.
      const { data: newUser, error: createUserErr } = await admin.auth.admin.createUser({
        email: pcEmail,
        password: pcPassword,
        email_confirm: true,
        user_metadata: {
          full_name: pcFullName,
          role: "program_coordinator",
          program_id: program.id,
          university_id: universityId,
        },
      });

      if (createUserErr) {
        console.error(`[${requestId}] PC auth user creation failed:`, createUserErr);
        return NextResponse.json<ApiResponse<typeof program>>({
          success: true,
          data: program!,
          message: `Program created, but the Program Coordinator account could not be created: ${createUserErr.message}. The program exists but has no coordinator.`,
          warning: "PC_AUTO_CREATE_FAILED",
        });
      }

      pcUserId = newUser.user?.id || null;
    }

    if (pcUserId) {
      // Ensure profile row exists with role=program_coordinator.
      const { error: profileErr } = await admin
        .from("profiles")
        .upsert(
          {
            user_id: pcUserId,
            email: pcEmail,
            full_name: pcFullName,
            first_name: pcFullName.split(" ")[0] || pcFullName,
            last_name: pcFullName.split(" ").slice(1).join(" ") || null,
            role: "program_coordinator",
            university_id: universityId,
            department_id: department_id,
            program_id: program.id,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (profileErr) {
        console.error(`[${requestId}] PC profile upsert failed:`, profileErr);
        // Don't fail the whole request — the program was created.
      }
    }

    return NextResponse.json<ApiResponse<typeof program>>({
      success: true,
      data: program!,
      message: `Program created successfully. Program Coordinator account ${pcEmail} has been provisioned.`,
    });
  } catch (error) {
    console.error("Error in POST /api/programs:", error);

    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }

    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/programs
 * Update program - University Admin or Super Admin only
 */
export async function PUT(request: NextRequest) {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.profile || !MANAGE_PROGRAM_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to update programs");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse request body
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Program ID is required" },
        { status: 400 }
      );
    }

    // Fetch existing program
    const { data: existingProgram } = await supabase
      .from("programs")
      .select("*")
      .eq("id", id)
      .single();

    if (!existingProgram) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Program not found" },
        { status: 404 }
      );
    }

    // Verify access based on role.
    // University Admin is NOT in MANAGE_PROGRAM_ROLES (view-only).
    const userRole = authContext.profile.role;
    const userDepartmentId = authContext.profile.department_id;

    if (userRole === "department_coordinator") {
      if (existingProgram.department_id !== userDepartmentId) {
        return authorizationError("Cannot modify programs from another department");
      }
    }
    // super_admin: no additional check

    // Check code uniqueness if changing
    if (updateData.code && updateData.code !== existingProgram.code) {
      const { data: duplicateCode } = await supabase
        .from("programs")
        .select("id")
        .eq("code", updateData.code)
        .eq("university_id", existingProgram.university_id)
        .neq("id", id)
        .single();

      if (duplicateCode) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A program with this code already exists" },
          { status: 409 }
        );
      }
    }

    // Update program
    const { data: program, error } = await supabase
      .from("programs")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating program:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update program" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof program>>({
      success: true,
      data: program!,
      message: "Program updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/programs:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/programs
 * Delete program - Super Admin or the owning Department Coordinator
 *
 * University Admin can VIEW programs but cannot create/edit/delete them.
 * Programs are created and managed by Department Coordinators. The
 * university-admin/programs page is view-only.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authContext = await requireAuth();

    if (!authContext.profile || !MANAGE_PROGRAM_ROLES.includes(authContext.profile.role as UserRole)) {
      return authorizationError("Forbidden: Insufficient permissions to delete programs");
    }

    // Use service role for delete operations to bypass RLS and handle cascades
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfiguration" },
        { status: 500 }
      );
    }
    
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Program ID is required" },
        { status: 400 }
      );
    }

    // Department coordinators can only delete programs in their own department
    if (authContext.profile.role === "department_coordinator") {
      const { data: existingProgram } = await admin
        .from("programs")
        .select("department_id")
        .eq("id", id)
        .single();

      if (!existingProgram) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Program not found" },
          { status: 404 }
        );
      }

      if (existingProgram.department_id !== authContext.profile.department_id) {
        return authorizationError("Cannot delete programs from another department");
      }
    }

    // Cascade: Unlink students from this program before deleting
    // This handles the FK constraint that would otherwise block deletion
    const { error: unlinkError } = await admin
      .from("students")
      .update({ program_id: null, updated_at: new Date().toISOString() })
      .eq("program_id", id);

    if (unlinkError) {
      console.error("Error unlinking students from program:", unlinkError);
      // Continue anyway - non-critical error
    }

    // Also clear program_coordinator_id reference on the program itself if it exists
    // (though we're deleting the program, this helps with any triggers)
    
    // Delete any task assignments linked to this program's tasks
    const { data: tasksToDelete } = await admin
      .from("tasks")
      .select("id")
      .eq("program_id", id);
    
    if (tasksToDelete && tasksToDelete.length > 0) {
      const taskIds = tasksToDelete.map(t => t.id);
      await admin
        .from("task_assignments")
        .delete()
        .in("task_id", taskIds);
      
      await admin
        .from("tasks")
        .delete()
        .in("id", taskIds);
    }

    // Delete the program
    const { error } = await admin
      .from("programs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting program:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete program: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
      message: "Program deleted successfully. Students have been unlinked from this program.",
    });
  } catch (error) {
    console.error("Error in DELETE /api/programs:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
