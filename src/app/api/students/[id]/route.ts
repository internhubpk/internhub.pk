import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { UpdateStudentSchema } from "@/lib/validations";
import { getCaller, isCallerError, callerErrorBody, canManageTarget } from "@/lib/user-admin";
import type { ApiResponse, Student, UserRole } from "@/types";

// Roles that can view student details
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
];

/**
 * GET /api/students/[id]
 * Get student profile by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !VIEW_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch student with related data
    const { data: student, error } = await supabase
      .from("students")
      .select(`
        *,
        profiles:user_id(*),
        departments:department_id(*),
        programs:program_id(*),
        universities:university_id(name, slug)
      `)
      .eq("user_id", id)
      .single();

    if (error || !student) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Check access permissions
    // Students can only view their own profile
    if (profile.role === "student") {
      const { data: ownRecord } = await supabase
        .from("students")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("user_id", id)
        .maybeSingle();

      if (!ownRecord) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Can only view your own profile" },
          { status: 403 }
        );
      }
    }

    // Department coordinators can only view students in their department
    if (profile.role === "department_coordinator" && profile.department_id) {
      if ((student as Student).department_id !== profile.department_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot view students from other departments" },
          { status: 403 }
        );
      }
    }

    // Uni admins and faculty can only view students in their university
    if (
      (profile.role === "university_admin" || profile.role === "faculty_supervisor") &&
      profile.university_id
    ) {
      if ((student as Student).university_id !== profile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot view students from other universities" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json<ApiResponse<Student>>({
      success: true,
      data: student as unknown as Student,
    });
  } catch (error) {
    console.error("Error in GET /api/students/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/students/[id]
 * Update student information
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if student exists
    const { data: existingStudent } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

    if (!existingStudent) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Check update permissions
    const isOwnProfile = existingStudent.user_id === user.id;
    const isAdmin = ["super_admin", "university_admin"].includes(profile.role);
    const isDepartmentCoordinator =
      profile.role === "department_coordinator" &&
      existingStudent.department_id === profile.department_id;
    // Program coordinators manage the students of their own university
    // (the PC dashboard creates/edits/deletes students). Scope: the PC's
    // university must match the student's university.
    const isProgramCoordinator =
      profile.role === "program_coordinator" &&
      !!profile.university_id &&
      (existingStudent as Student).university_id === profile.university_id;

    if (!isOwnProfile && !isAdmin && !isDepartmentCoordinator && !isProgramCoordinator) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Cannot update this student" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateStudentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    // Only real `students` columns may be written. The zod schema also
    // accepts identity fields (email / password / full_name / first_name /
    // last_name / user_id) because it is shared with the CREATE route
    // (where they build the auth user + profile). Writing them to the
    // `students` table would fail with PGRST204 ("column not found"), so
    // strip them here — identity edits belong to the profiles table.
    const STUDENT_COLUMNS = new Set([
      "university_id",
      "department_id",
      "program_id",
      "enrollment_year",
      "expected_graduation",
      "cgpa",
      "student_id_number",
      "faculty_supervisor_id",
      "semester",
    ]);
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      validation.data as Record<string, unknown>
    )) {
      if (STUDENT_COLUMNS.has(key)) updateData[key] = value;
    }

    // Students can only update limited fields
    if (isOwnProfile && !isAdmin) {
      // Students can update very limited info - most fields require admin
      for (const key of Object.keys(updateData)) {
        if (key !== "cgpa") delete updateData[key];
      }
    }

    // If student_id_number is being changed, check uniqueness
    if (updateData.student_id_number && updateData.student_id_number !== existingStudent.student_id_number) {
      const { data: duplicateEnrollment } = await supabase
        .from("students")
        .select("user_id")
        .eq("student_id_number", updateData.student_id_number)
        .eq("university_id", existingStudent.university_id)
        .neq("user_id", id)
        .maybeSingle();

      if (duplicateEnrollment) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A student with this student ID number already exists" },
          { status: 409 }
        );
      }
    }

    // Update student
    const { data: student, error } = await supabase
      .from("students")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating student:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Duplicate student ID number" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update student" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Student>>({
      success: true,
      data: student as Student,
      message: "Student updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/students/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/students/[id]
 * Permanently delete a student account.
 *
 * Permissions: super_admin (any) OR university_admin / department_coordinator /
 * program_coordinator limited to students of THEIR OWN university.
 *
 * Runs public.hard_delete_user(uuid) (migration 0100): removes the profile +
 * auth.users row + everything the student owns (applications, weekly logs,
 * evaluations, submissions, attendance, certificates, documents, …).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ctx = await getCaller();
    if (isCallerError(ctx)) {
      const err = callerErrorBody(ctx.error);
      return NextResponse.json<ApiResponse<never>>(err.body, { status: err.status });
    }
    const { callerUserId, caller, admin } = ctx;

    if (!admin) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfigured (missing service role key)" },
        { status: 500 }
      );
    }

    if (id === callerUserId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Fetch the student's scope (students table row carries university_id).
    const { data: studentRow } = await admin
      .from("students")
      .select("user_id, university_id, department_id, program_id")
      .eq("user_id", id)
      .maybeSingle();

    if (!studentRow) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Verify the caller's profile row as well (the students table could be
    // stale) — target university must match the caller's scope.
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("user_id, role, university_id")
      .eq("user_id", id)
      .maybeSingle();

    const targetUniversity =
      studentRow.university_id || targetProfile?.university_id || null;

    if (!canManageTarget(caller, { university_id: targetUniversity })) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: you can only delete students of your own university" },
        { status: 403 }
      );
    }

    // Department coordinators can only delete students of their department.
    if (
      caller.role === "department_coordinator" &&
      caller.department_id &&
      studentRow.department_id &&
      caller.department_id !== studentRow.department_id
    ) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: this student belongs to another department" },
        { status: 403 }
      );
    }

    const { data: rpcResult, error: rpcError } = await admin.rpc("hard_delete_user", {
      p_user_id: id,
    });

    if (rpcError) {
      console.error("Error in DELETE /api/students/[id] RPC:", rpcError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Failed to delete student: ${rpcError.message}` },
        { status: 500 }
      );
    }

    const result = (rpcResult ?? {}) as Record<string, unknown>;
    if (result.error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: String(result.error) },
        { status: 400 }
      );
    }

    // Audit trail
    await admin.from("audit_logs").insert({
      user_id: callerUserId,
      action: `${caller.role}.delete_student`,
      entity_type: "student",
      entity_id: id,
      new_values: null,
    });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      success: true,
      data: result,
      message: "Student and all their personal data were permanently deleted",
    });
  } catch (error) {
    console.error("Error in DELETE /api/students/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
