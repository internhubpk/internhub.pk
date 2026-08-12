import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { UpdateStudentSchema } from "@/lib/validations";
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

    if (!isOwnProfile && !isAdmin && !isDepartmentCoordinator) {
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

    const updateData = validation.data;

    // Students can only update limited fields
    if (isOwnProfile && !isAdmin) {
      const allowedFields = {} as typeof updateData;
      // Students can update very limited info - most fields require admin
      if (updateData.cgpa !== undefined) allowedFields.cgpa = updateData.cgpa;
      Object.keys(updateData).forEach((key) => {
        if (!(key in allowedFields)) {
          delete (updateData as Record<string, unknown>)[key];
        }
      });
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
