import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  getServerAuthContext,
  requireAuth,
  requireRole,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import type { ApiResponse, UserRole } from "@/types";
import { z } from "zod";

// ============ ZOD VALIDATION SCHEMAS ============

const UpdateLicenseSchema = z.object({
  status: z.enum(["active", "expired", "cancelled"]).optional(),
  plan: z.enum(["free", "basic", "professional", "enterprise"]).optional(),
  user_limit: z.number()
    .int("User limit must be an integer")
    .min(1)
    .max(100000)
    .optional(),
  storage_limit_mb: z.number()
    .int("Storage limit must be in MB")
    .min(100)
    .max(1024000)
    .optional(),
  auto_renew: z.boolean().optional(),
  validity_days: z.number()
    .int("Validity must be in days")
    .min(1)
    .max(365 * 5)
    .optional(), // If provided, extends expiry
});

/**
 * GET /api/licenses/[id]
 * Get a single license by ID - Super Admin only (or own university for Uni Admin)
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

    // Authenticate user
    const authContext = await getServerAuthContext();

    if (!authContext.isAuthenticated || !authContext.user) {
      return authenticationError();
    }

    const { id } = await params;

    // Fetch license
    const { data: license, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !license) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }

    // Authorization check
    if (authContext.profile?.role !== "super_admin") {
      // University admin can only see their own university's license
      if (license.university_id !== authContext.profile?.university_id) {
        return authorizationError("Access denied to this license");
      }
    }

    // Enrich with university information
    let universityInfo = null;
    
    if (license.university_id) {
      const { data: university } = await supabase
        .from("universities")
        .select("*")
        .eq("id", license.university_id)
        .single();
      
      universityInfo = university;
    }

    // Calculate usage statistics
    const [userCountResult, storageResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("university_id", license.university_id)
        .eq("is_active", true),
      supabase
        .from("storage_allocations")
        .select("used_bytes, allocated_bytes")
        .eq("university_id", license.university_id)
        .maybeSingle(),
    ]);

    // Calculate days remaining
    let daysRemaining = null;
    let isExpiringSoon = false;
    
    if (license.expires_at) {
      const expiryDate = new Date(license.expires_at);
      const now = new Date();
      daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      isExpiringSoon = daysRemaining <= 30 && daysRemaining > 0;
    }

    return NextResponse.json<ApiResponse<typeof license & {
      university: typeof universityInfo;
      days_remaining: number | null;
      is_expiring_soon: boolean;
      current_users: number;
      usage_percentage: number;
      storage_used_mb: number;
      storage_percentage: number;
    }>>({
      success: true,
      data: {
        ...license,
        university: universityInfo,
        days_remaining: daysRemaining,
        is_expiring_soon: isExpiringSoon,
        current_users: userCountResult.count || 0,
        usage_percentage: license.user_limit > 0 
          ? Math.round(((userCountResult.count || 0) / license.user_limit) * 100) 
          : 0,
        storage_used_mb: storageResult ? Math.round(storageResult.used_bytes / (1024 * 1024)) : 0,
        storage_percentage: license.storage_limit_mb > 0 && storageResult
          ? Math.round((storageResult.used_bytes / (license.storage_limit_mb * 1024 * 1024)) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/licenses/[id]:", error);
    
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
 * PUT /api/licenses/[id]
 * Update a license - Super Admin only
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only super admin can update licenses
    const authContext = await requireRole(["super_admin"]);

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { id } = await params;

    // Fetch existing license
    const { data: existingLicense, error: fetchError } = await supabase
      .from("licenses")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingLicense) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateLicenseSchema.safeParse(body);

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

    const updateData = validation.data;

    // Build updates object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updateData.status !== undefined) {
      updates.status = updateData.status;
      
      // If cancelling or expiring, set appropriate dates
      if (updateData.status === "cancelled") {
        updates.cancelled_at = new Date().toISOString();
      }
    }

    if (updateData.plan !== undefined) {
      updates.plan = updateData.plan;
    }

    if (updateData.user_limit !== undefined) {
      updates.user_limit = updateData.user_limit;
    }

    if (updateData.storage_limit_mb !== undefined) {
      updates.storage_limit_mb = updateData.storage_limit_mb;
    }

    if (updateData.auto_renew !== undefined) {
      updates.auto_renew = updateData.auto_renew;
    }

    // Extend validity if days provided
    if (updateData.validity_days !== undefined) {
      const currentExpiry = existingLicense.expires_at 
        ? new Date(existingLicense.expires_at) 
        : new Date();
      
      // If already expired, extend from now; otherwise extend from current expiry
      const baseDate = currentExpiry.getTime() > new Date().getTime() 
        ? currentExpiry 
        : new Date();
      
      const newExpiry = new Date(
        baseDate.getTime() + updateData.validity_days * 24 * 60 * 60 * 1000
      );
      
      updates.expires_at = newExpiry.toISOString();
      
      // Reactivate if extending an expired/cancelled license
      if (existingLicense.status === "expired" || existingLicense.status === "cancelled") {
        updates.status = "active";
      }
    }

    // Perform update
    const { data: updatedLicense, error: updateError } = await supabase
      .from("licenses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating license:", updateError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update license" },
        { status: 500 }
      );
    }

    // Sync subscription if exists
    if (existingLicense.university_id) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("university_id", existingLicense.university_id)
        .maybeSingle();

      if (subscription) {
        const subUpdates: Record<string, any> = {};
        
        if (updateData.plan !== undefined) subUpdates.plan = updateData.plan;
        if (updateData.status !== undefined) subUpdates.status = updateData.status as any;
        if (updates.expires_at) {
          subUpdates.end_date = updates.expires_at;
        }
        if (updateData.user_limit !== undefined) subUpdates.student_limit = updateData.user_limit;
        if (updateData.storage_limit_mb !== undefined) subUpdates.storage_limit_mb = updateData.storage_limit_mb;
        
        if (Object.keys(subUpdates).length > 0) {
          subUpdates.updated_at = new Date().toISOString();
          
          await supabase
            .from("subscriptions")
            .update(subUpdates)
            .eq("id", subscription.id);
        }
      }
    }

    // Log audit entry
    await auditLogEntry(cookieStore, {
      action: "settings.change",
      entityType: "license",
      entityId: id,
      universityId: existingLicense.university_id,
      details: {
        action: "update",
        changes: Object.keys(updateData),
        previous_status: existingLicense.status,
        new_status: updates.status || existingLicense.status,
      },
    });

    return NextResponse.json<ApiResponse<typeof updatedLicense>>({
      success: true,
      data: updatedLicense,
      message: "License updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/licenses/[id]:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    if (error instanceof Error && error.message.includes("role")) {
      return authorizationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/licenses/[id]
 * Revoke/delete a license - Super Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only super admin can delete licenses
    const authContext = await requireRole(["super_admin"]);

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { id } = await params;

    // Fetch existing license
    const { data: existingLicense, error: fetchError } = await supabase
      .from("licenses")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingLicense) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }

    // Soft delete - mark as cancelled instead of hard delete
    const { error: updateError } = await supabase
      .from("licenses")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error revoking license:", updateError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to revoke license" },
        { status: 500 }
      );
    }

    // Log audit entry
    await auditLogEntry(cookieStore, {
      action: "settings.change",
      entityType: "license",
      entityId: id,
      universityId: existingLicense.university_id,
      details: {
        action: "revoke",
        previous_status: existingLicense.status,
        revoked_by: authContext.user!.id,
      },
    });

    return NextResponse.json<ApiResponse<{ revoked: boolean }>>({
      success: true,
      data: { revoked: true },
      message: "License revoked successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/licenses/[id]:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    if (error instanceof Error && error.message.includes("role")) {
      return authorizationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to log audit entries
async function auditLogEntry(
  cookieStore: any,
  entry: {
    action: string;
    entityType: string;
    entityId: string | null;
    universityId: string | null;
    details?: Record<string, any>;
  }
): Promise<void> {
  try {
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("audit_logs").insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      university_id: entry.universityId,
      user_id: user?.id || null,
      details: entry.details || {},
    });
    
    if (error) {
      console.error("Audit log error:", error);
    }
  } catch (error) {
    console.error("Audit log exception:", error);
  }
}
