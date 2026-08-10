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

const UpdateSettingsSchema = z.object({
  settings: z.record(z.string(), z.any()).refine((val) => Object.keys(val).length > 0, {
    message: "At least one setting is required",
  }),
});

const SettingsFilterSchema = z.object({
  scope: z.enum(["platform", "university", "all"]).default("all"),
  category: z.string().optional(),
  keys: z.string().optional(), // Comma-separated list of specific keys
});

// ============ INTERFACES ============

interface SettingItem {
  key: string;
  value: any;
  scope: "platform" | "university";
  university_id: string | null;
  category: string;
  description?: string;
  updated_at: string;
}

interface SettingsResponse {
  settings: Record<string, any>;
  scope: string;
  last_updated: string | null;
}

// Default platform settings (used when no custom settings exist)
const DEFAULT_PLATFORM_SETTINGS: Record<string, {
  value: any;
  description: string;
  category: string;
}> = {
  // General Platform Settings
  "platform.name": {
    value: "InternHub",
    description: "Platform display name",
    category: "general",
  },
  "platform.tagline": {
    value: "Enterprise Internship Management Platform",
    description: "Platform tagline",
    category: "general",
  },
  "platform.logo_url": {
    value: "",
    description: "Platform logo URL",
    category: "general",
  },
  "platform.favicon_url": {
    value: "",
    description: "Favicon URL",
    category: "general",
  },

  // Feature Flags
  "features.self_registration": {
    value: false,
    description: "Allow self-registration for students",
    category: "features",
  },
  "features.company_self_service": {
    value: true,
    description: "Allow companies to register themselves",
    category: "features",
  },
  "features.evaluations_enabled": {
    value: true,
    description: "Enable evaluation system",
    category: "features",
  },
  "features.certificates_enabled": {
    value: true,
    description: "Enable certificate generation",
    category: "features",
  },
  "features.weekly_logs_required": {
    value: true,
    description: "Require weekly logs from interns",
    category: "features",
  },

  // Email Settings
  "email.from_name": {
    value: "InternHub",
    description: "Sender name for emails",
    category: "email",
  },
  "email.from_address": {
    value: "noreply@internhub.com",
    description: "Sender email address",
    category: "email",
  },
  "email.notifications_enabled": {
    value: true,
    description: "Enable email notifications",
    category: "email",
  },

  // Security Settings
  "security.session_timeout_minutes": {
    value: 480,
    description: "Session timeout in minutes",
    category: "security",
  },
  "security.max_login_attempts": {
    value: 5,
    description: "Maximum login attempts before lockout",
    category: "security",
  },
  "security.password_min_length": {
    value: 8,
    description: "Minimum password length",
    category: "security",
  },
  "security.require_2fa_admins": {
    value: false,
    description: "Require 2FA for admin accounts",
    category: "security",
  },

  // Integration Settings
  "integrations.storage_provider": {
    value: "supabase",
    description: "Storage provider (supabase, aws, gcp)",
    category: "integrations",
  },
};

// Default university-level settings
const DEFAULT_UNIVERSITY_SETTINGS: Record<string, {
  value: any;
  description: string;
  category: string;
}> = {
  // University Branding
  "branding.primary_color": {
    value: "#2563eb",
    description: "Primary brand color",
    category: "branding",
  },
  "branding.secondary_color": {
    value: "#64748b",
    description: "Secondary brand color",
    category: "branding",
  },
  "branding.custom_logo_url": {
    value: "",
    description: "Custom logo URL (overrides default)",
    category: "branding",
  },

  // Internship Settings
  "internship.max_duration_weeks": {
    value: 52,
    description: "Maximum internship duration in weeks",
    category: "internship",
  },
  "internship.min_duration_weeks": {
    value: 4,
    description: "Minimum internship duration in weeks",
    category: "internship",
  },
  "internship.require_approval": {
    value: true,
    description: "Require coordinator approval for internships",
    category: "internship",
  },
  "internship.allow_multiple_active": {
    value: false,
    description: "Allow multiple active internships per student",
    category: "internship",
  },

  // Evaluation Settings
  "evaluation.passing_score_percent": {
    value: 60,
    description: "Minimum passing score percentage",
    category: "evaluation",
  },
  "evaluation.auto_calculate": {
    value: true,
    description: "Auto-calculate final scores",
    category: "evaluation",
  },

  // Notification Settings
  "notifications.new_application": {
    value: true,
    description: "Notify on new application submission",
    category: "notifications",
  },
  "notifications.status_change": {
    value: true,
    description: "Notify on application status change",
    category: "notifications",
  },
  "notifications.weekly_log_reminder": {
    value: true,
    description: "Send weekly log reminders",
    category: "notifications",
  },
};

// Roles that can view settings
const VIEW_ROLES: UserRole[] = ["super_admin", "university_admin"];

// Roles that can edit platform settings
const EDIT_PLATFORM_ROLES: UserRole[] = ["super_admin"];

// Roles that can edit university settings
const EDIT_UNIVERSITY_ROLES: UserRole[] = ["super_admin", "university_admin"];

/**
 * GET /api/settings
 * Get settings - platform or university level based on role and query params
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const authContext = await getServerAuthContext();

    if (!authContext.isAuthenticated || !authContext.user) {
      return authenticationError();
    }

    // Check role permissions
    if (!VIEW_ROLES.includes(authContext.profile?.role as UserRole)) {
      return authorizationError("Insufficient permissions to view settings");
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    const filterResult = SettingsFilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const filters = filterResult.success ? filterResult.data : {};
    const userRole = authContext.profile?.role as UserRole;
    const universityId = authContext.profile?.university_id;

    let settingsData: Record<string, any> = {};

    if (userRole === "super_admin") {
      // Super Admin can access both platform and university settings
      if (filters.scope === "platform" || filters.scope === "all") {
        const platformSettings = await fetchSettings(
          supabase,
          null, // null means platform level
          filters.category,
          filters.keys ? filters.keys.split(",") : undefined
        );
        
        // Merge with defaults
        settingsData = {
          ...Object.fromEntries(
            Object.entries(DEFAULT_PLATFORM_SETTINGS).map(([k, v]) => [k, v.value])
          ),
          ...platformSettings,
        };
      }

      if ((filters.scope === "university" || filters.scope === "all") && filters.scope !== "platform") {
        if (filters.university_id) {
          const uniSettings = await fetchSettings(
            supabase,
            filters.university_id,
            filters.category,
            filters.keys ? filters.keys.split(",") : undefined
          );
          
          settingsData._university = {
            ...Object.fromEntries(
              Object.entries(DEFAULT_UNIVERSITY_SETTINGS).map(([k, v]) => [k, v.value])
            ),
            ...uniSettings,
          };
        }
      }
    } else if (userRole === "university_admin" && universityId) {
      // University Admin can only access their own university's settings
      const uniSettings = await fetchSettings(
        supabase,
        universityId,
        filters.category,
        filters.keys ? filters.keys.split(",") : undefined
      );
      
      settingsData = {
        ...Object.fromEntries(
          Object.entries(DEFAULT_UNIVERSITY_SETTINGS).map(([k, v]) => [k, v.value])
        ),
        ...uniSettings,
      };
    }

    return NextResponse.json<ApiResponse<SettingsResponse>>({
      success: true,
      data: {
        settings: settingsData,
        scope: userRole === "super_admin" ? (filters.scope || "platform") : "university",
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/settings:", error);
    
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
 * PUT /api/settings
 * Update settings - authorized roles only
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const authContext = await requireAuth();

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateSettingsSchema.safeParse(body);

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

    const { settings } = validation.data;
    const userRole = authContext.profile?.role as UserRole;
    const universityId = authContext.profile?.university_id;
    const userId = authContext.user!.id;

    // Parse scope from request or determine from role
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") as "platform" | "university" | null;
    const targetUniversityId = searchParams.get("university_id");

    // Determine target scope and validate permissions
    let effectiveScope: "platform" | "university";
    let effectiveUniversityId: string | null = null;

    if (scope === "platform") {
      // Only super admin can update platform settings
      if (!EDIT_PLATFORM_ROLES.includes(userRole)) {
        return authorizationError("Only super administrators can modify platform settings");
      }
      effectiveScope = "platform";
    } else {
      // University settings
      if (!EDIT_UNIVERSITY_ROLES.includes(userRole)) {
        return authorizationError("Insufficient permissions to modify settings");
      }

      // Super admin can update any university; others only their own
      if (userRole === "super_admin" && targetUniversityId) {
        effectiveUniversityId = targetUniversityId;
      } else if (universityId) {
        effectiveUniversityId = universityId;
      } else {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "No university context available" },
          { status: 400 }
        );
      }

      effectiveScope = "university";
    }

    // Validate that settings keys are allowed
    const allowedKeys = effectiveScope === "platform"
      ? Object.keys(DEFAULT_PLATFORM_SETTINGS)
      : Object.keys(DEFAULT_UNIVERSITY_SETTINGS);

    const invalidKeys = Object.keys(settings).filter(key => !allowedKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Invalid setting key(s): ${invalidKeys.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Process each setting update
    const updates: Array<{
      key: string;
      value: any;
      scope: string;
      university_id: string | null;
      updated_by: string;
    }> = [];

    for (const [key, value] of Object.entries(settings)) {
      updates.push({
        key,
        value,
        scope: effectiveScope,
        university_id: effectiveUniversityId,
        updated_by: userId,
      });
    }

    // Batch upsert settings
    const { error: upsertError } = await supabase
      .from("settings")
      .upsert(updates, {
        onConflict: "key,university_id,scope",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Error updating settings:", upsertError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update settings" },
        { status: 500 }
      );
    }

    // Log audit entries for sensitive settings changes
    const sensitivePatterns = [
      "password", "security", "auth", "2fa", "token", "secret", "api_key"
    ];
    
    const hasSensitiveChanges = Object.keys(settings).some(key =>
      sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))
    );

    if (hasSensitiveChanges) {
      try {
        await supabase.from("audit_logs").insert({
          action: "settings.change",
          entity_type: "settings",
          entity_id: null,
          university_id: effectiveUniversityId,
          user_id: userId,
          details: {
            action: "update_settings",
            scope: effectiveScope,
            changed_keys: Object.keys(settings),
            university_id: effectiveUniversityId,
          },
        });
      } catch (auditError) {
        console.error("Audit log error:", auditError);
        // Don't fail the request
      }
    }

    return NextResponse.json<ApiResponse<{ updated: boolean; count: number }>>({
      success: true,
      data: {
        updated: true,
        count: updates.length,
      },
      message: `${updates.length} setting(s) updated successfully`,
    });
  } catch (error) {
    console.error("Error in PUT /api/settings:", error);
    
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
 * Fetch settings from database
 */
async function fetchSettings(
  supabase: ReturnType<typeof createClient>,
  universityId: string | null,
  category?: string,
  keys?: string[]
): Promise<Record<string, any>> {
  try {
    let query = supabase
      .from("settings")
      .select("*")
      .eq("scope", universityId ? "university" : "platform");

    if (universityId) {
      query = query.eq("university_id", universityId);
    } else {
      query = query.is("university_id", null);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (keys && keys.length > 0) {
      query = query.in("key", keys);
    }

    const { data: settingsRows, error } = await query;

    if (error || !settingsRows) {
      return {};
    }

    // Convert array to key-value object
    const settingsMap: Record<string, any> = {};
    
    for (const row of settingsRows) {
      settingsMap[row.key] = row.value;
    }

    return settingsMap;
  } catch (error) {
    console.error("Error fetching settings:", error);
    return {};
  }
}
