import { NextRequest, NextResponse } from "next/server";
// Use service role client for PUBLIC endpoint - bypasses RLS so public pages can show data
import { createServiceRoleClient } from "@/utils/supabase/service-role";
// Use regular server client for authenticated operations (POST) AND for
// detecting the caller's identity on the GET route (we can't call
// auth.getUser() on the service-role client now that it no longer
// attaches cookies — that's the whole point of the 2026-08-25 fix).
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateCompanySchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Company,
  UserRole,
} from "@/types";

// Roles that can view companies
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

// Roles that can create companies
const CREATE_ROLES: UserRole[] = ["super_admin", "university_admin", "company_hr"];

/**
 * GET /api/companies
 * List companies - filtered by user role
 */
export async function GET(request: NextRequest) {
  try {
    // Two clients:
    //   - authClient (cookie-bound) — for detecting the caller's identity.
    //     The service-role client no longer attaches cookies (2026-08-25
    //     fix), so we can't call auth.getUser() on it. The cookie-bound
    //     client gives us the user + their profile/role.
    //   - serviceClient (service-role) — for the actual companies query.
    //     Bypasses RLS so public marketplace pages see data even when
    //     no anon RLS policy would match.
    let authUser: { id: string } | null = null;
    let authProfile: { role: string; university_id: string | null } | null = null;
    try {
      const cookieStore = await cookies();
      const authClient = await createClient(cookieStore);
      if (authClient) {
        const { data: { user } } = await authClient.auth.getUser();
        if (user) {
          authUser = user;
          const { data: profile } = await authClient
            .from("profiles")
            .select("role, university_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile) authProfile = profile;
        }
      }
    } catch {
      // Anonymous / unauthenticated — fall through with authUser=null.
    }

    const supabase = await createServiceRoleClient();
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // For public company listings (marketplace), allow unauthenticated access with limited data
    const user = authUser;

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
    const filters = filterResult.success ? filterResult.data : FilterSchema.parse({});
    const search = searchParams.get("search");
    const industry = searchParams.get("industry");
    const isVerified = searchParams.get("is_verified");
    const isMarketplace = searchParams.get("marketplace") === "true";
    const sortBy = searchParams.get("sort_by") || "name";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query
    let query = supabase
      .from("companies")
      .select("*", { count: "exact" });

    // Marketplace mode: only show verified, active companies
    if (isMarketplace && !user) {
      query = query.eq("is_verified", true).eq("is_active", true);
    }

    // Authenticated users get role-based filtering
    if (user && authProfile) {
      // Company HR sees only their company
      if (authProfile.role === "company_hr") {
        const { data: companyUser } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (companyUser) {
          query = query.eq("id", companyUser.company_id);
        }
      }

      // University staff see companies associated with their university
      if (
        ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
          authProfile.role
        ) &&
        authProfile.university_id &&
        !isMarketplace
      ) {
        query = query.eq("university_id", authProfile.university_id);
      }
    }

    // Apply additional filters
    if (filters.university_id) {
      query = query.eq("university_id", filters.university_id);
    }

    if (industry) {
      query = query.ilike("industry", `%${industry}%`);
    }

    if (isVerified === "true") {
      query = query.eq("is_verified", true);
    } else if (isVerified === "false") {
      query = query.eq("is_verified", false);
    }

    // Apply search filter on name and description
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: companies, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching companies:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch companies" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Company> = {
      data: companies as Company[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Company>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/companies:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies
 * Register/create company
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
        { success: false, error: "Forbidden: Insufficient permissions to register companies" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateCompanySchema.safeParse(body);

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

    const companyData = validation.data;

    // Role-based restrictions
    if (profile.role === "university_admin") {
      // University admins can only create companies for their university
      if (companyData.university_id !== profile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot create company for another university" },
          { status: 403 }
        );
      }
    }

    if (profile.role === "company_hr") {
      // Company HR registering new company - set their university based on context
      // This would typically come from a specific university context or invitation
      if (!companyData.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "University ID is required" },
          { status: 400 }
        );
      }
    }

    // Verify university exists
    const { data: university } = await supabase
      .from("universities")
      .select("id")
      .eq("id", companyData.university_id)
      .eq("is_active", true)
      .single();

    if (!university) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced university does not exist or is not active" },
        { status: 400 }
      );
    }

    // Check if company name already exists in this university
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("name", companyData.name)
      .eq("university_id", companyData.university_id)
      .single();

    if (existingCompany) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "A company with this name already exists in this university" },
        { status: 409 }
      );
    }

    // Create company
    const { data: company, error } = await supabase
      .from("companies")
      .insert({
        ...companyData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating company:", error);
      
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A company with this name already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create company" },
        { status: 500 }
      );
    }

    // If user is company HR, automatically add them to the company.
    // NOTE: `company_users` columns are: id, company_id, user_id, role, is_active,
    // created_at. There is NO `first_name`, `last_name`, `email`, or `status` —
    // any of those would cause the insert to fail with column-not-found.
    if (profile.role === "company_hr") {
      const { error: companyUserError } = await supabase
        .from("company_users")
        .insert({
          company_id: company!.id,
          user_id: user.id,
          role: "company_hr",
          is_active: true,
        });

      if (companyUserError) {
        console.error("Error adding user to company:", companyUserError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json<ApiResponse<Company>>({
      success: true,
      data: company as Company,
      message: "Company registered successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/companies:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
