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
import { audit } from "@/lib/audit";
import type { ApiResponse, PaginatedResponse } from "@/types";
import { z } from "zod";

// ============ ZOD VALIDATION SCHEMAS ============

const CreateLicenseSchema = z.object({
  university_id: z.string().uuid("Invalid university ID"),
  plan: z.enum(["free", "basic", "professional", "enterprise"], {
    errorMap: () => ({ message: "Invalid license plan" }),
  }),
  user_limit: z.number()
    .int("User limit must be an integer")
    .min(1, "Minimum 1 user required")
    .max(100000, "Maximum 100,000 users"),
  storage_limit_mb: z.number()
    .int("Storage limit must be in MB")
    .min(100, "Minimum 100 MB")
    .max(1024000, "Maximum 1 TB (1024000 MB)"),
  validity_days: z.number()
    .int("Validity must be in days")
    .min(1, "Minimum 1 day")
    .max(365 * 5, "Maximum 5 years"),
  price: z.number().nonnegative("Price cannot be negative").default(0),
  auto_renew: z.boolean().default(false),
});

const LicenseFilterSchema = z.object({
  status: z.enum(["active", "expired", "cancelled", "trial", "all"]).default("all"),
  plan: z.enum(["free", "basic", "professional", "enterprise"]).optional(),
  university_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Helper function to generate a license key
function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = 4;
  const segmentLength = 4;
  
  let key = "";
  for (let i = 0; i < segments; i++) {
    if (i > 0) key += "-";
    for (let j = 0; j < segmentLength; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return `IH-${key}`;
}

/**
 * GET /api/licenses
 * List all licenses - Super Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Only super admin can access this endpoint
    const authContext = await requireRole(["super_admin"]);

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    const filterResult = LicenseFilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const filters = filterResult.success ? filterResult.data : {};
    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;

    // Build query
    let query = supabase
      .from("licenses")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters.plan) {
      query = query.eq("plan", filters.plan);
    }

    if (filters.university_id) {
      query = query.eq("university_id", filters.university_id);
    }

    if (filters.search) {
      query = query.or(`license_key.ilike.%${filters.search}%,universities(name).ilike.%${filters.search}%`);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: licenses, error } = await query.range(start, end);

    if (error) {
      console.error("Error fetching licenses:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch licenses" },
        { status: 500 }
      );
    }

    // Enrich with university information
    const enrichedLicenses = await Promise.all(
      (licenses || []).map(async (license) => {
        let universityInfo = null;
        
        if (license.university_id) {
          const { data: university } = await supabase
            .from("universities")
            .select("id, name, slug")
            .eq("id", license.university_id)
            .single();
          
          universityInfo = university;
        }

        // Calculate days remaining
        let daysRemaining = null;
        if (license.expires_at) {
          const expiryDate = new Date(license.expires_at);
          const now = new Date();
          daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          ...license,
          university: universityInfo,
          days_remaining: daysRemaining,
          // Don't expose full key in list view
          license_key_preview: license.license_key 
            ? `${license.license_key.substring(0, 7)}...${license.license_key.substring(license.license_key.length - 4)}`
            : null,
        };
      })
    );

    const response: PaginatedResponse<typeof enrichedLicenses[0]> = {
      data: enrichedLicenses,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<typeof enrichedLicenses[0]>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/licenses:", error);
    
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
 * POST /api/licenses
 * Create/generate a new license - Super Admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Only super admin can create licenses
    const authContext = await requireRole(["super_admin"]);

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateLicenseSchema.safeParse(body);

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

    const licenseData = validation.data;

    // Verify university exists
    const { data: university, error: uniError } = await supabase
      .from("universities")
      .select("id, name, is_active")
      .eq("id", licenseData.university_id)
      .single();

    if (uniError || !university) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "University not found" },
        { status: 404 }
      );
    }

    // Check for existing active license for this university
    const { data: existingLicense } = await supabase
      .from("licenses")
      .select("id, license_key, expires_at, status")
      .eq("university_id", licenseData.university_id)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Generate dates
    const now = new Date();
    const startDate = now.toISOString();
    const expiryDate = new Date(
      now.getTime() + licenseData.validity_days * 24 * 60 * 60 * 1000
    ).toISOString();

    // Generate unique license key
    let licenseKey = generateLicenseKey();
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      const { data: existingKey } = await supabase
        .from("licenses")
        .select("id")
        .eq("license_key", licenseKey)
        .maybeSingle();
      
      if (!existingKey) {
        isUnique = true;
      } else {
        licenseKey = generateLicenseKey();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to generate unique license key" },
        { status: 500 }
      );
    }

    // Create the license
    const { data: license, error: insertError } = await supabase
      .from("licenses")
      .insert({
        license_key: licenseKey,
        university_id: licenseData.university_id,
        plan: licenseData.plan,
        status: "active",
        user_limit: licenseData.user_limit,
        storage_limit_mb: licenseData.storage_limit_mb,
        starts_at: startDate,
        expires_at: expiryDate,
        price: licenseData.price,
        auto_renew: licenseData.auto_renew,
        created_by: authContext.user!.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating license:", insertError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create license" },
        { status: 500 }
      );
    }

    // Update or create subscription record
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("university_id", licenseData.university_id)
      .maybeSingle();

    if (existingSubscription) {
      await supabase
        .from("subscriptions")
        .update({
          plan: licenseData.plan,
          status: "active",
          start_date: startDate,
          end_date: expiryDate,
          student_limit: licenseData.user_limit,
          storage_limit_mb: licenseData.storage_limit_mb,
          price: licenseData.price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSubscription.id);
    } else {
      await supabase
        .from("subscriptions")
        .insert({
          university_id: licenseData.university_id,
          plan: licenseData.plan,
          status: "active",
          start_date: startDate,
          end_date: expiryDate,
          student_limit: licenseData.user_limit,
          storage_limit_mb: licenseData.storage_limit_mb,
          price: licenseData.price,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    }

    // Log audit entry
    await auditLog({
      action: "settings.change",
      entityType: "license",
      entityId: license!.id,
      universityId: licenseData.university_id,
      details: {
        action: "create",
        plan: licenseData.plan,
        university_id: licenseData.university_id,
      },
    });

    return NextResponse.json<ApiResponse<typeof license>>({
      success: true,
      data: license,
      message: "License created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/licenses:", error);
    
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

// Import auditLog directly since we need it here
async function auditLog(entry: {
  action: string;
  entityType: string;
  entityId: string | null;
  universityId: string | null;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    const cookieStore = await cookies();
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
