import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  CreateInternshipSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import {
  requireAuth,
  requireRole,
  hasPermission,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import { validateTenantOwnership, buildTenantQuery } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { sanitizeInput, extractClientInfo, validatePaginationParams } from "@/lib/api-security";
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

// Allowed sort fields to prevent SQL injection
const ALLOWED_SORT_FIELDS = [
  "created_at",
  "updated_at",
  "title",
  "status",
  "application_deadline",
  "start_date",
] as const;

/**
 * Validate and sanitize sort parameters
 */
function validateSortParam(sortBy: string | null, sortOrder: string | null): {
  sortBy: typeof ALLOWED_SORT_FIELDS[number];
  ascending: boolean;
} {
  const validSort = ALLOWED_SORT_FIELDS.includes(sortBy as any)
    ? (sortBy as typeof ALLOWED_SORT_FIELDS[number])
    : "created_at";
  
  return {
    sortBy: validSort,
    ascending: sortOrder === "asc",
  };
}

/**
 * GET /api/internships
 * List internships - public for marketplace, filtered for dashboards
 * SECURITY: University-scoped queries, company HR restrictions
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

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    const filterResult = FilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    // Validate pagination bounds
    const validatedPagination = validatePaginationParams(searchParams);
    const page = paginationResult.success ? paginationResult.data.page : validatedPagination.page;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : validatedPagination.pageSize;
    const filters = filterResult.success ? filterResult.data : {};
    
    // Sanitize inputs
    const search = searchParams.get("search") ? sanitizeInput(searchParams.get("search")!) : null;
    const status = searchParams.get("status");
    const isMarketplace = searchParams.get("marketplace") === "true";
    
    // Validate sort parameters
    const { sortBy, ascending } = validateSortParam(
      searchParams.get("sort_by"),
      searchParams.get("sort_order")
    );

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

    // Authenticated users get role-based filtering with security enforcement
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, university_id, department_id")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const userRole = profile.role as UserRole;

        // SECURITY: Company HR sees ONLY their company's internships
        if (userRole === "company_hr") {
          // Get company ID for this user
          const { data: companyUser } = await supabase
            .from("company_users")
            .select("company_id, role")
            .eq("user_id", user.id)
            .single();

          if (companyUser) {
            query = query.eq("company_id", companyUser.company_id);
          } else {
            // Company user record not found - return empty results
            return NextResponse.json<ApiResponse<PaginatedResponse<Internship>>>({
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
        }

        // SECURITY: University staff see their university's internships only
        if (
          ["university_admin", "department_coordinator", "faculty_supervisor"].includes(
            userRole
          ) &&
          profile.university_id &&
          !isMarketplace
        ) {
          query = query.eq("university_id", profile.university_id);
          
          // Security: Log if someone tries to filter by different university
          if (filters.university_id && filters.university_id !== profile.university_id) {
            console.warn(`User ${user.id} attempted cross-university internship access`);
          }
        }

        // Department coordinators further filter by their department
        if (
          userRole === "department_coordinator" &&
          profile.department_id &&
          !isMarketplace
        ) {
          query = query.contains("department_ids", [profile.department_id]);
        }

        // Students see all published internships in marketplace mode
        // In dashboard mode, they see internships they've applied to
        if (userRole === "student" && !isMarketplace) {
          // Get student's applications to show relevant internships
          const { data: studentRecord } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .single();
          
          if (studentRecord) {
            const { data: studentApplications } = await supabase
              .from("internship_applications")
              .select("internship_id")
              .eq("student_id", studentRecord.id);
            
            if (studentApplications && studentApplications.length > 0) {
              const appliedInternshipIds = studentApplications.map((a) => a.internship_id);
              query = query.in("id", appliedInternshipIds);
            } else {
              // No applications yet - return empty
              return NextResponse.json<ApiResponse<PaginatedResponse<Internship>>>({
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
          }
        }

        // Super admins can see everything but respect explicit filters
        if (userRole === "super_admin" && filters.university_id) {
          query = query.eq("university_id", filters.university_id);
        }
      }
    }

    // Apply additional filters with validation
    if (filters.company_id) {
      query = query.eq("company_id", filters.company_id);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Apply sanitized search filter on title and description
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Filter by skills (sanitize input)
    const skillsFilter = searchParams.get("skills");
    if (skillsFilter) {
      const skillsArray = skillsFilter.split(",").map((s) => sanitizeInput(s.trim())).filter(Boolean);
      if (skillsArray.length > 0) {
        query = query.overlaps("skills", skillsArray);
      }
    }

    // Filter by location (sanitize)
    const location = searchParams.get("location");
    if (location) {
      query = query.ilike("location", `%${sanitizeInput(location)}%`);
    }

    // Filter by remote/paid options (boolean validation)
    const isRemote = searchParams.get("is_remote");
    if (isRemote === "true" || isRemote === "false") {
      query = query.eq("is_remote", isRemote === "true");
    }

    const isPaid = searchParams.get("is_paid");
    if (isPaid === "true" || isPaid === "false") {
      query = query.eq("is_paid", isPaid === "true");
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: internships, error } = await query
      .order(sortBy, { ascending })
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
 * POST /api/internships
 * Create internship - Company HR primarily
 * SECURITY: Company ownership verification, audit logging
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication and appropriate role
    const authContext = await requireRole(CREATE_ROLES);
    
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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

    // SECURITY: If user is company HR, verify they belong to the specified company
    const userRole = authContext.profile?.role;
    
    if (userRole === "company_hr") {
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id, role, status")
        .eq("user_id", authContext.user!.id)
        .eq("company_id", internshipData.company_id)
        .single();

      if (!companyUser) {
        console.warn(`Company HR user ${authContext.user!.id} attempted to create internship for non-associated company`);
        return authorizationError("You don't have permission to create internships for this company");
      }

      // Check if user has admin/hr role in this company
      if (!["admin", "hr"].includes(companyUser.role)) {
        return authorizationError("Insufficient company privileges to create internships");
      }

      // Check if company user is active
      if (companyUser.status !== "active") {
        return authorizationError("Your company account is not active");
      }
    }

    // SECURITY: University admin creating internship - verify university ownership
    if (userRole === "university_admin") {
      const userUniversityId = authContext.profile?.university_id;
      
      if (!userUniversityId) {
        return authorizationError("No university assigned to your account");
      }
      
      if (internshipData.university_id !== userUniversityId) {
        console.warn(`Uni Admin ${authContext.user!.id} attempted cross-university internship creation`);
        return authorizationError("Can only create internships for your university");
      }
    }

    // Verify referenced entities exist
    const [companyCheck, universityCheck] = await Promise.all([
      supabase.from("companies").select("id, status").eq("id", internshipData.company_id).single(),
      supabase.from("universities").select("id, status").eq("id", internshipData.university_id).single(),
    ]);

    if (!companyCheck.data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced company does not exist" },
        { status: 400 }
      );
    }

    // Verify company is active/verified
    if (companyCheck.data.status === "suspended") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This company is currently suspended" },
        { status: 403 }
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

      // Validate dates are in the future or reasonable range
      const now = new Date();
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 2);

      if (start < now && !internshipData.id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Start date cannot be in the past" },
          { status: 400 }
        );
      }

      if (end > maxFutureDate) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Internship duration cannot exceed 2 years" },
          { status: 400 }
        );
      }
    }

    // Sanitize text fields to prevent XSS
    if (internshipData.title) {
      internshipData.title = sanitizeInput(internshipData.title);
    }
    if (internshipData.description) {
      internshipData.description = sanitizeInput(internshipData.description);
    }
    if (internshipData.location) {
      internshipData.location = sanitizeInput(internshipData.location);
    }

    // Get client info for audit logging
    const clientInfo = extractClientInfo(request);

    // Create internship
    const { data: internship, error } = await supabase
      .from("internships")
      .insert({
        ...internshipData,
        created_by: authContext.user!.id,
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

    // AUDIT LOG: Log internship creation for compliance
    await audit.internshipCreate(internship!.id, internshipData.university_id);

    return NextResponse.json<ApiResponse<Internship>>({
      success: true,
      data: internship as Internship,
      message: "Internship created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/internships:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    if (error instanceof Error && (error.message.includes("role") || error.message.includes("Access"))) {
      return authorizationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
