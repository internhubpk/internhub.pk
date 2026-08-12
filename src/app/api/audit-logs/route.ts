import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  getServerAuthContext,
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import { queryAuditLogs, auditLog, type AuditAction } from "@/lib/audit";
import type { ApiResponse, PaginatedResponse, UserRole } from "@/types";
import { z } from "zod";

// ============ ZOD VALIDATION SCHEMAS ============

const AuditLogFilterSchema = z.object({
  action_type: z.string().optional(),
  entity_type: z.string().optional(),
  user_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

const CreateAuditLogSchema = z.object({
  action: z.string().min(1),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid().nullable().optional(),
  university_id: z.string().uuid().nullable().optional(),
  details: z.record(z.any()).optional(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Roles that can view audit logs
const VIEW_ROLES: UserRole[] = ["super_admin", "university_admin"];

/**
 * GET /api/audit-logs
 * List audit logs with filtering and pagination
 * - Super Admin can see all logs
 * - University Admin can only see their university's logs
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Authenticate and authorize user
    const authContext = await getServerAuthContext();

    if (!authContext.isAuthenticated || !authContext.user) {
      return authenticationError();
    }

    if (!VIEW_ROLES.includes(authContext.profile?.role as UserRole)) {
      return authorizationError("Insufficient permissions to view audit logs");
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    
    const filterResult = AuditLogFilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const filters = filterResult.success ? filterResult.data : {};
    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;

    // University-scoped access for non-super-admins
    const universityId = 
      authContext.profile?.role === "super_admin" 
        ? filters as any  // Super admin can see all or filter by university
        : authContext.profile?.university_id;

    // Query audit logs using the audit system
    const result = await queryAuditLogs({
      universityId: universityId || undefined,
      action: filters.action_type as AuditAction | undefined,
      entityType: filters.entity_type,
      userId: filters.user_id,
      dateFrom: filters.date_from,
      dateTo: filters.date_to,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    // Enrich logs with user information
    const enrichedLogs = await Promise.all(
      result.data.map(async (log) => {
        let userInfo = null;
        
        if (log.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, role")
            .eq("user_id", log.user_id)
            .single();
          
          userInfo = profile;
        }

        return {
          ...log,
          user_info: userInfo,
        };
      })
    );

    const response: PaginatedResponse<typeof enrichedLogs[0]> = {
      data: enrichedLogs,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<typeof enrichedLogs[0]>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/audit-logs:", error);
    
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
 * POST /api/audit-logs
 * Create an audit log entry (internal use)
 * Requires authentication and appropriate permissions
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authContext = await requireAuth();

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateAuditLogSchema.safeParse(body);

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

    const logData = validation.data;

    // Non-super-admins can only create logs for their own university
    if (authContext.profile?.role !== "super_admin") {
      if (logData.university_id && logData.university_id !== authContext.profile?.university_id) {
        return authorizationError("Cannot create audit log for another university");
      }
      // Force university_id to user's university
      logData.university_id = authContext.profile?.university_id;
    }

    // Create the audit log entry
    await auditLog({
      action: logData.action as AuditAction,
      entityType: logData.entity_type,
      entityId: logData.entity_id || null,
      universityId: logData.university_id || null,
      details: logData.details,
    });

    return NextResponse.json<ApiResponse<{ success: boolean }>>({
      success: true,
      data: { success: true },
      message: "Audit log entry created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/audit-logs:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
