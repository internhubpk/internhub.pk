import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { ApiResponse, PaginatedResponse, Profile, UserRole } from "@/types";

/**
 * GET /api/super-admin/users
 * List all users across the platform - Super Admin only
 * Supports pagination, filtering by role/status, and search
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

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Super Admin access required" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const roleFilter = searchParams.get("role") || "";
    const statusFilter = searchParams.get("status") || "";

    // Build query
    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply role filter
    if (roleFilter && roleFilter !== "all") {
      query = query.eq("role", roleFilter);
    }

    // Apply status filter
    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    // Apply search filter (client-side for complex search)
    // Note: Supabase doesn't support OR across multiple columns easily in all cases

    // Get total count first
    const { count } = await query;

    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = page + pageSize - 1;

    const { data: users, error } = await query.range(start, end);

    if (error) {
      console.error("Error fetching users:", error);
      
      // Check if table doesn't exist
      if (error.code === "42P01") {
        return NextResponse.json<ApiResponse<PaginatedResponse<Profile>>>({
          success: true,
          data: {
            items: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Apply search filter on results if provided
    let filteredUsers = users || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (u) =>
          `${u.full_name} ${u.first_name || ""} ${u.last_name || ""} ${u.email || ""}`
            .toLowerCase()
            .includes(searchLower)
      );
    }

    // Enrich with university names
    const enrichedUsers = await Promise.all(
      filteredUsers.map(async (userProfile) => {
        let universityName = null;
        if (userProfile.university_id) {
          const { data: uni } = await supabase
            .from("universities")
            .select("name")
            .eq("id", userProfile.university_id)
            .single();
          universityName = uni?.name || null;
        }
        return { ...profile, university_name: universityName };
      })
    );

    const response: PaginatedResponse<Profile> = {
      items: enrichedUsers as Profile[],
      total: filteredUsers.length,
      page,
      pageSize,
      totalPages: Math.ceil((filteredUsers.length) / pageSize),
      hasNextPage: end < (filteredUsers.length - 1),
      hasPrevPage: page > 1,
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Profile>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/super-admin/users:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/users
 * Create a new user (admin accounts) - Super Admin only
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

    // Check if user is super admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (adminProfile?.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Super Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, password, full_name, role, university_id, company_id } = body;

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Email, password, and role are required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: UserRole[] = [
      "university_admin",
      "department_coordinator",
      "faculty_supervisor",
      "company_hr",
      "site_supervisor",
      "external_evaluator",
    ];

    if (!validRoles.includes(role)) {
      return NextResponse.json<ApiResponse<never>>(
        { 
          success: false, 
          error: `Invalid role. Super Admin can only create: ${validRoles.join(", ")}` 
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Create auth user using admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: authError.message || "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authUser.user.id,
      email,
      full_name: full_name || null,
      first_name: full_name?.split(" ")[0] || null,
      last_name: full_name?.split(" ").slice(1).join(" ") || null,
      role,
      university_id: university_id || null,
      company_id: company_id || null,
      status: "active",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      // Rollback - delete auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      console.error("Error creating profile:", profileError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ id: string; email: string; role: string }>>({
      success: true,
      data: {
        id: authUser.user.id,
        email,
        role,
      },
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/super-admin/users:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
