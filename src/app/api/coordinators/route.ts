import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Profile,
  UserRole,
  Department,
} from "@/types";

// Roles that can view coordinators
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
];

// Roles that can create coordinators
const CREATE_ROLES: UserRole[] = ["super_admin", "university_admin"];

// Coordinator creation schema
const CreateCoordinatorSchema = {
  email: (v: string) => typeof v === 'string' && v.length > 0 && v.includes('@'),
  full_name: (v: string) => typeof v === 'string' && v.length >= 2,
  password: (v: string) => typeof v === 'string' && v.length >= 8,
  department_id: (v: string) => typeof v === 'string',
};

/**
 * GET /api/coordinators
 * List department coordinators - university-scoped
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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

    // Get user profile with role info
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    const filterResult = FilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;
    const filters = filterResult.success ? filterResult.data : {};
    const search = searchParams.get("search");
    const isActive = searchParams.get("is_active");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query - get profiles with coordinator role
    let query = supabase
      .from("profiles")
      .select(`
        *,
        departments:department_id(id, name, code)
      `, { count: "exact" })
      .eq("role", "department_coordinator");

    // Apply university scope based on role
    if (
      ["university_admin"].includes(profile.role) &&
      profile.university_id
    ) {
      query = query.eq("university_id", profile.university_id);
    }

    // Super admins can optionally filter by university
    if (profile.role === "super_admin" && filters.university_id) {
      query = query.eq("university_id", filters.university_id);
    }

    // Filter by department
    if (filters.department_id) {
      query = query.eq("department_id", filters.department_id);
    }

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Filter by active status
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

    const { data: coordinators, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching coordinators:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch coordinators" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Profile> = {
      data: (coordinators || []) as unknown as Profile[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Profile>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/coordinators:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coordinators
 * Create new coordinator account - University Admin only
 * Creates both auth.user and profiles entries
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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

    // Check user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !CREATE_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin access required to create coordinators" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { email, full_name, password, department_id } = body;

    // Basic validation
    if (!email || !email.includes('@')) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!full_name || full_name.length < 2) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Full name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // University admins must use their university
    const universityId = profile.role === "university_admin" 
      ? profile.university_id 
      : body.university_id;

    if (!universityId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "University ID is required" },
        { status: 400 }
      );
    }

    // If department_id provided, verify it exists and belongs to this university
    if (department_id) {
      const { data: dept } = await supabase
        .from("departments")
        .select("id, university_id")
        .eq("id", department_id)
        .single();

      if (!dept) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Department not found" },
          { status: 404 }
        );
      }

      if (dept.university_id !== universityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Department does not belong to your university" },
          { status: 400 }
        );
      }
    }

    // Check if email already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // Create the auth user using admin API
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: "department_coordinator",
      },
    });

    if (createUserError) {
      console.error("Error creating auth user:", createUserError);
      
      if (createUserError.message?.includes("already registered")) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A user with this email already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create user account: " + createUserError.message },
        { status: 500 }
      );
    }

    if (!newUser?.user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create profile entry
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        email,
        full_name,
        first_name: full_name.split(' ')[0],
        last_name: full_name.split(' ').slice(1).join(' ') || null,
        role: "department_coordinator",
        university_id: universityId,
        department_id: department_id || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Clean up the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(newUser.user.id);
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create coordinator profile" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Profile>>({
      success: true,
      data: newProfile as Profile,
      message: "Coordinator account created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/coordinators:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
