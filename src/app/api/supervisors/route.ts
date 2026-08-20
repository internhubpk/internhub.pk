import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  CreateSupervisorSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Supervisor,
  UserRole,
} from "@/types";

// Roles that can view supervisors
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "program_coordinator",
  "faculty_supervisor",
];

// Roles that can create supervisors.
// IMPORTANT: department_coordinator is INTENTIONALLY EXCLUDED per InternHub
// spec section 14 — only program_coordinator (and higher) can create supervisors.
const CREATE_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "program_coordinator",
];

/**
 * GET /api/supervisors
 * List supervisors - filtered by user role
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

    // Get user profile with university info
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
    const filters = filterResult.success ? filterResult.data : FilterSchema.parse({});
    const search = searchParams.get("search");
    const supervisorType = searchParams.get("type");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query with related data.
    // NOTE: `phone` is added to the profiles join so the page can display it.
    // The `supervisors` table also has its own `first_name`/`last_name`/`email`/
    // `specialization` columns (added in migration 0024), so the `.or()` search
    // below filters on those directly (the previous code used `title`, which
    // never existed on this table and silently broke search).
    let query = supabase
      .from("supervisors")
      .select(`
        *,
        universities:university_id(name, slug),
        departments:department_id(name, code),
        profiles:user_id(first_name, last_name, email, avatar_url, phone)
      `, { count: "exact" });

    // Apply university scope based on role
    if (
      ["university_admin", "department_coordinator"].includes(profile.role) &&
      profile.university_id
    ) {
      query = query.eq("university_id", profile.university_id);
    }

    if (profile.role === "faculty_supervisor" && profile.university_id) {
      // Faculty supervisors can see other supervisors in their university
      query = query.eq("university_id", profile.university_id);
    }

    // Department coordinators further filter by their department.
    // SKIP this filter for external evaluators (type='external') — they are
    // cross-department / cross-institution industry experts and may have
    // `department_id = NULL`. Applying the filter here would silently hide
    // every external evaluator in the system from the coordinator's
    // Students-page "Assign External Evaluator" dropdown, defeating the
    // whole feature.
    if (
      profile.role === "department_coordinator" &&
      profile.department_id &&
      supervisorType !== "external"
    ) {
      query = query.eq("department_id", profile.department_id);
    }

    // Apply additional filters
    if (filters.university_id) {
      if (profile.role !== "super_admin") {
        if (filters.university_id !== profile.university_id) {
          return NextResponse.json<ApiResponse<never>>(
            { success: false, error: "Cannot access supervisors from another university" },
            { status: 403 }
          );
        }
      }
      query = query.eq("university_id", filters.university_id);
    }

    if (filters.department_id) {
      query = query.eq("department_id", filters.department_id);
    }

    // Filter by supervisor type
    if (supervisorType && ["faculty", "site", "external"].includes(supervisorType)) {
      query = query.eq("type", supervisorType);
    }

    // Apply search filter on name fields and specialization.
    // `supervisors` has `specialization`, `first_name`, `last_name`, `email`
    // columns (the latter three added in migration 0024); the legacy `title`
    // column never existed and silently broke search.
    if (search) {
      query = query.or(
        `specialization.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Filter by active status
    const isActive = searchParams.get("is_active");
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

    const { data: supervisors, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching supervisors:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch supervisors" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Supervisor> = {
      data: supervisors as unknown as Supervisor[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Supervisor>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/supervisors:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/supervisors
 * Add supervisor - University Admin or Department Coordinator only.
 *
 * WHY SERVICE ROLE:
 *   The previous version used the cookie-bound (publishable key) client for
 *   all DB operations. This caused 400 "Referenced user not found" errors
 *   when the newly-created faculty_supervisor's profile row wasn't visible
 *   to the coordinator via RLS (e.g., the on_auth_user_created trigger
 *   failed to create the profile, or created it with department_id=NULL).
 *
 *   Now: we authenticate the caller with the cookie-bound client (read-only
 *   session check), but use the SERVICE ROLE client for all subsequent DB
 *   operations. Service role bypasses RLS, so we can always read the target
 *   user's profile and insert the supervisor row reliably.
 *
 *   Authorization is enforced EXPLICITLY in the route logic:
 *     - Caller must be super_admin / university_admin / department_coordinator.
 *     - University_admin: target university_id must match caller's.
 *     - Department_coordinator: target university_id AND department_id must
 *       match caller's (department_id is FORCED from caller's profile).
 */
export async function POST(request: NextRequest) {
  const requestId = `sup-post-${Date.now()}`;
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // 1. Authenticate caller (read-only session check).
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Build service role client for all DB operations.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error(`[${requestId}] SUPABASE_SERVICE_ROLE_KEY is not set`);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfiguration: service role key is not set" },
        { status: 500 }
      );
    }
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // 3. Fetch caller's profile using service role (bypasses RLS — handles
    //    the case where the caller's own profile.university_id is NULL
    //    but their app_metadata has the correct value).
    const { data: callerProfile, error: callerErr } = await admin
      .from("profiles")
      .select("user_id, role, university_id, department_id, program_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerErr || !callerProfile) {
      console.error(`[${requestId}] caller profile fetch failed`, callerErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Could not load your profile. Please sign out and back in, or contact a super admin." },
        { status: 500 }
      );
    }

    const callerRole = callerProfile.role as UserRole;
    if (!CREATE_ROLES.includes(callerRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin, Program Coordinator, or Super Admin access required to add supervisors. Department Coordinators cannot create supervisors." },
        { status: 403 }
      );
    }

    const userUniversityId = callerProfile.university_id;
    const userDepartmentId = callerProfile.department_id;

    // 4. Parse + validate request body.
    const body = await request.json().catch(() => ({}));
    const validation = CreateSupervisorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.issues[0]?.message,
          details: validation.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const supervisorData = validation.data;

    // 5. Authorization + tenant scoping.
    if (callerRole === "university_admin") {
      if (!userUniversityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Your admin account has no university_id. Ask a super admin to assign you to a university." },
          { status: 403 }
        );
      }
      if (supervisorData.university_id !== userUniversityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot add supervisor to another university" },
          { status: 403 }
        );
      }
    } else if (callerRole === "department_coordinator") {
      // REJECTED per InternHub spec section 14.
      // This branch is defensive — the CREATE_ROLES check above should
      // already have rejected department_coordinator callers.
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Department Coordinators cannot create supervisors. This responsibility belongs to the Program Coordinator of the relevant program.",
        },
        { status: 403 }
      );
    } else if (callerRole === "program_coordinator") {
      // Program coordinators can create supervisors ONLY within their own
      // program. They cannot create supervisors for other programs or
      // universities.
      if (!userUniversityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Your coordinator account has no university_id." },
          { status: 403 }
        );
      }
      if (supervisorData.university_id !== userUniversityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cannot add supervisor to another university" },
          { status: 403 }
        );
      }
      // Force program_id to caller's own program (cannot spoof).
      const userProgramId = (callerProfile as any).program_id;
      if (!userProgramId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Your coordinator account is not linked to a program. Ask a Department Coordinator to assign you to a program first." },
          { status: 403 }
        );
      }
      (supervisorData as any).program_id = userProgramId;
    }
    // super_admin: no additional scoping.

    // 6. Verify university exists.
    const { data: university } = await admin
      .from("universities")
      .select("id, name")
      .eq("id", supervisorData.university_id)
      .maybeSingle();

    if (!university) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced university does not exist" },
        { status: 400 }
      );
    }

    // 7. Verify target user exists. Use service role + maybeSingle (RLS may
    //    block the cookie-bound client; service role always returns the row).
    //    Also ensure the profile exists by calling ensure_profile_exists
    //    (idempotent — if profile already exists, returns FALSE; if missing,
    //    creates it from auth.users metadata).
    await admin.rpc("ensure_profile_exists", { p_user_id: supervisorData.user_id });

    const { data: userProfile, error: userErr } = await admin
      .from("profiles")
      .select("user_id, university_id, role, email, full_name")
      .eq("user_id", supervisorData.user_id)
      .maybeSingle();

    if (userErr || !userProfile) {
      console.error(`[${requestId}] target user profile fetch failed`, userErr);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Referenced user not found. The auth account may not exist or the profile could not be created." },
        { status: 400 }
      );
    }

    if (
      userProfile.university_id &&
      userProfile.university_id !== supervisorData.university_id
    ) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `User must belong to the same university. User's university: ${userProfile.university_id}, requested: ${supervisorData.university_id}` },
        { status: 400 }
      );
    }

    // 8. If department_id is provided, verify it's valid and in the same university.
    if (supervisorData.department_id) {
      const { data: department } = await admin
        .from("departments")
        .select("id, university_id, name")
        .eq("id", supervisorData.department_id)
        .maybeSingle();

      if (!department) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Referenced department not found" },
          { status: 400 }
        );
      }

      if (department.university_id !== supervisorData.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Department must belong to the same university" },
          { status: 400 }
        );
      }
    }

    // 9. Check if user is already a supervisor of the same type.
    const { data: existingSupervisor } = await admin
      .from("supervisors")
      .select("id")
      .eq("user_id", supervisorData.user_id)
      .eq("type", supervisorData.type)
      .eq("university_id", supervisorData.university_id)
      .maybeSingle();

    if (existingSupervisor) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This user is already registered as a supervisor of this type" },
        { status: 409 }
      );
    }

    // 10. Create supervisor row.
    const { data: supervisor, error } = await admin
      .from("supervisors")
      .insert({
        ...supervisorData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(`[${requestId}] supervisor INSERT error`, error);

      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "This user is already a supervisor of this type" },
          { status: 409 }
        );
      }

      // Surface the actual PostgREST error so the UI can show something useful.
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Failed to create supervisor: ${error.message} (code ${error.code})`,
        },
        { status: 500 }
      );
    }

    // 11. If the target user's role is 'student' or 'pending_assignment',
    //     upgrade their profile role to the appropriate supervisor role.
    //     This is done with service role to bypass RLS + guard_profile_update.
    const validRolesForType: Record<string, UserRole> = {
      faculty: "faculty_supervisor",
      site: "site_supervisor",
      external: "external_evaluator",
    };
    const expectedRole = validRolesForType[supervisorData.type];

    if (expectedRole && userProfile.role !== expectedRole && userProfile.role !== "super_admin") {
      const { error: roleUpdateErr } = await admin
        .from("profiles")
        .update({ role: expectedRole, updated_at: new Date().toISOString() })
        .eq("user_id", supervisorData.user_id);

      if (roleUpdateErr) {
        // Non-fatal — the supervisor row was created successfully.
        console.warn(`[${requestId}] failed to update profile role to ${expectedRole}`, roleUpdateErr);
      } else {
        // Sync role to auth.users app_metadata so current_role() returns
        // the right value for the new supervisor going forward.
        try {
          await admin.auth.admin.updateUserById(supervisorData.user_id, {
            app_metadata: { role: expectedRole },
            user_metadata: { role: expectedRole },
          });
        } catch (metaErr) {
          console.warn(`[${requestId}] failed to sync role to auth.users metadata (non-fatal)`, metaErr);
        }
      }
    }

    return NextResponse.json<ApiResponse<Supervisor>>({
      success: true,
      data: supervisor as Supervisor,
      message: "Supervisor added successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/supervisors:", error);
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Internal server error: ${detail}` },
      { status: 500 }
    );
  }
}
