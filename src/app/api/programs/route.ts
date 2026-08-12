import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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
  "faculty_supervisor",
  "student",
];

// Roles that can create/edit programs
// University Admin can only VIEW programs (see migration 0002 RLS + the
// university-admin/programs page which is view-only). Programs are created
// and managed by Department Coordinators, with super_admin as override.
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
        universities:university_id(name, slug)
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

    // Enrich programs with student counts
    const enrichedPrograms = (programs || []).map(p => ({
      ...p,
      student_count: studentCounts[p.id] || 0,
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
 * Create new program - University Admin or Super Admin only
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { name, code, description, duration_weeks, department_id, is_active } = body;

    // Validate required fields
    if (!name || !code || !duration_weeks || !department_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing required fields: name, code, duration_weeks, department_id" },
        { status: 400 }
      );
    }

    const userRole = authContext.profile.role;
    const userUniversityId = authContext.profile.university_id;
    const userDepartmentId = authContext.profile.department_id;

    // Determine university_id based on role.
    // University Admin is NOT in MANAGE_PROGRAM_ROLES (they can only
    // view programs). Only super_admin and department_coordinator reach
    // this point.
    let universityId = body.university_id;

    if (userRole === "department_coordinator") {
      // Department coordinator can only create in their own department
      if (department_id !== userDepartmentId) {
        return authorizationError("Can only create programs in your own department");
      }
      universityId = userUniversityId;
    }
    // super_admin: use body.university_id (must be passed by caller)

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

    // Create program
    const { data: program, error } = await supabase
      .from("programs")
      .insert({
        name,
        code,
        description: description || null,
        duration_weeks,
        university_id: universityId,
        department_id,
        is_active: is_active !== undefined ? is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating program:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create program" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof program>>({
      success: true,
      data: program!,
      message: "Program created successfully",
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
 * Delete program - Super Admin only
 *
 * University Admin can VIEW programs but cannot create/edit/delete them.
 * Programs are created and managed by Department Coordinators. The
 * university-admin/programs page is view-only.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authContext = await requireAuth();

    if (authContext.profile?.role !== "super_admin") {
      return authorizationError("Only super admins can delete programs");
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Program ID is required" },
        { status: 400 }
      );
    }

    // Check if program has enrolled students
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("program_id", id)
      .limit(1);

    if (students && students.length > 0) {
      return NextResponse.json<ApiResponse<never>>(
        { 
          success: false, 
          error: "Cannot delete program with enrolled students. Please reassign students first." 
        },
        { status: 409 }
      );
    }

    // Delete program
    const { error } = await supabase
      .from("programs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting program:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to delete program" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
      message: "Program deleted successfully",
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
