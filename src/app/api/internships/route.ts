import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateInternshipSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Internship,
  UserRole,
} from "@/types";

// Roles that can view internships
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

// Roles that can create internships
const CREATE_ROLES: UserRole[] = ["company_hr", "super_admin", "university_admin"];

/**
 * GET /api/internships
 * List internships - public for marketplace, filtered for dashboards
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // For marketplace, allow unauthenticated access to published internships
    // For dashboard views, require authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const status = searchParams.get("status");
    const isMarketplace = searchParams.get("marketplace") === "true";
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query - select with company info for display
    let query = supabase
      .from("internships")
      .select(`
        *,
        companies:company_id(name, logo_url, industry),
        universities:university_id(name, slug)
      `, { count: "exact" });

    // Marketplace mode: only show published/active internships
    if (isMarketplace) {
      query = query.in("status", ["published", "active"]);
    }

    // Authenticated users get role-based filtering
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, university_id, department_id")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        // Company HR sees their company's internships
        if (profile.role === "company_hr") {
          // Get company ID for this user
          const { data: companyUser } = await supabase
            .from("company_users")
            .select("company_id")
            .eq("user_id", user.id)
            .single();

          if (companyUser) {
            query = query.eq("company_id", companyUser.company_id);
          }
        }

        // University staff see their university's internships
        if (
          ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
            profile.role
          ) &&
          profile.university_id &&
          !isMarketplace
        ) {
          query = query.eq("university_id", profile.university_id);
        }

        // Department coordinators filter by their department
        if (
          profile.role === "department_coordinator" &&
          profile.department_id &&
          !isMarketplace
        ) {
          query = query.contains("department_ids", [profile.department_id]);
        }
      }
    }

    // Apply additional filters
    if (filters.university_id) {
      query = query.eq("university_id", filters.university_id);
    }
    if (filters.company_id) {
      query = query.eq("company_id", filters.company_id);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Apply search filter on title and description
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Filter by skills
    const skillsFilter = searchParams.get("skills");
    if (skillsFilter) {
      const skillsArray = skillsFilter.split(",").map((s) => s.trim());
      query = query.overlaps("skills", skillsArray);
    }

    // Filter by location
    const location = searchParams.get("location");
    if (location) {
      query = query.ilike("location", `%${location}%`);
    }

    // Filter by remote/paid options
    const isRemote = searchParams.get("is_remote");
    if (isRemote === "true") {
      query = query.eq("is_remote", true);
    } else if (isRemote === "false") {
      query = query.eq("is_remote", false);
    }

    const isPaid = searchParams.get("is_paid");
    if (isPaid === "true") {
      query = query.eq("is_paid", true);
    } else if (isPaid === "false") {
      query = query.eq("is_paid", false);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: internships, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching internships:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch internships" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Internship> = {
      data: internships as unknown as Internship[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Internship>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/internships:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/internships
 * Create internship - Company HR primarily
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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
        { success: false, error: "Forbidden: Insufficient permissions to create internships" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateInternshipSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.errors[0]?.message,
        },
        { status: 400 }
      );
    }

    const internshipData = validation.data;

    // If user is company HR, verify they belong to the specified company
    if (profile.role === "company_hr") {
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id, role")
        .eq("user_id", user.id)
        .eq("company_id", internshipData.company_id)
        .single();

      if (!companyUser || !["admin", "hr"].includes(companyUser.role)) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "You don't have permission to create internships for this company" },
          { status: 403 }
        );
      }
    }

    // Verify referenced entities exist
    const [companyCheck, universityCheck] = await Promise.all([
      supabase.from("companies").select("id").eq("id", internshipData.company_id).single(),
      supabase.from("universities").select("id").eq("id", internshipData.university_id).single(),
    ]);

    if (!companyCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced company does not exist" },
        { status: 400 }
      );
    }
    if (!universityCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced university does not exist" },
        { status: 400 }
      );
    }

    // Validate date range if provided
    if (internshipData.start_date && internshipData.end_date) {
      const start = new Date(internshipData.start_date);
      const end = new Date(internshipData.end_date);
      if (end <= start) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "End date must be after start date" },
          { status: 400 }
        );
      }
    }

    // Create internship
    const { data: internship, error } = await supabase
      .from("internships")
      .insert({
        ...internshipData,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating internship:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create internship" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Internship>>({
      success: true,
      data: internship as Internship,
      message: "Internship created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/internships:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
