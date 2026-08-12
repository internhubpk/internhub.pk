/**
 * InternHub API Security Utilities
 * 
 * Reusable security utilities for API routes to ensure consistent
 * security practices across all endpoints.
 * 
 * FEATURES:
 * - Tenant access verification
 * - Role-based authorization helpers
 * - Input sanitization (XSS prevention)
 * - Pagination validation
 * - Client info extraction for audit logging
 */

import { NextRequest } from "next/server";
import { requireAuth, requireUniversityAccess, requireRole, authorizationError, authenticationError } from "@/lib/authorization";
import { validateTenantOwnership, getServerTenantContext } from "@/lib/tenant-server";
import type { UserRole } from "@/types";

/**
 * Security verification result interface
 */
export interface SecurityVerificationResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
  };
  profile?: {
    id: string;
    role: UserRole | null;
    university_id: string | null;
    department_id: string | null;
  };
  universityId?: string;
}

/**
 * Verify tenant access for a request
 * Ensures the authenticated user has access to the specified resource's university
 * 
 * @param request - The incoming NextRequest
 * @param resourceUniversityId - Optional university ID of the resource being accessed
 * @returns SecurityVerificationResult with access determination
 */
export async function verifyTenantAccess(
  request: Request,
  resourceUniversityId?: string
): Promise<SecurityVerificationResult> {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.isAuthenticated || !authContext.user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const userRole = authContext.profile?.role;
    
    // Super admins can access any tenant
    if (userRole === "super_admin") {
      return {
        success: true,
        user: authContext.user,
        profile: authContext.profile!,
        universityId: resourceUniversityId,
      };
    }

    // Get user's university context
    const userUniversityId = authContext.profile?.university_id;

    if (!userUniversityId) {
      return {
        success: false,
        error: "No university assigned to user",
        user: authContext.user,
        profile: authContext.profile!,
      };
    }

    // If specific university requested, verify match
    if (resourceUniversityId && userUniversityId !== resourceUniversityId) {
      // Log potential cross-tenant access attempt
      console.warn(
        `Cross-tenant access attempt: User ${authContext.user.id} with university ${userUniversityId} tried to access ${resourceUniversityId}`
      );
      
      return {
        success: false,
        error: "Access denied: Resource belongs to different university",
        user: authContext.user,
        profile: authContext.profile!,
        universityId: userUniversityId,
      };
    }

    return {
      success: true,
      user: authContext.user,
      profile: authContext.profile!,
      universityId: userUniversityId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Verify that the user has one of the required roles
 * 
 * @param request - The incoming NextRequest
 * @param requiredRoles - Array of roles that are authorized
 * @returns SecurityVerificationResult with role verification
 */
export async function verifyRole(
  request: Request,
  requiredRoles: UserRole[]
): Promise<SecurityVerificationResult> {
  try {
    const authContext = await requireAuth();
    
    if (!authContext.isAuthenticated || !authContext.user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const userRole = authContext.profile?.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      console.warn(
        `Unauthorized role access: User ${authContext.user.id} with role ${userRole} attempted action requiring [${requiredRoles.join(", ")}]`
      );
      
      return {
        success: false,
        error: `Insufficient privileges. Required roles: ${requiredRoles.join(", ")}`,
        user: authContext.user,
        profile: authContext.profile!,
      };
    }

    return {
      success: true,
      user: authContext.user,
      profile: authContext.profile!,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Sanitize input string to prevent XSS attacks
 * Removes or escapes potentially dangerous HTML/JS content
 * 
 * @param input - The raw input string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string safe for display/storage
 */
export function sanitizeInput(
  input: string,
  options?: {
    maxLength?: number;
    allowHTML?: boolean;
    preserveLineBreaks?: boolean;
  }
): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  let sanitized = input;

  // Apply length limit to prevent DoS via huge strings
  const maxLength = options?.maxLength ?? 10000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    console.warn(`Input truncated: exceeded max length of ${maxLength}`);
  }

  // If HTML is not allowed, escape all HTML entities
  if (!options?.allowHTML) {
    // Escape HTML special characters
    const htmlEscapeMap: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
      "`": "&#96;",
    };

    sanitized = sanitized.replace(/[&<>"'`/]/g, (char) => htmlEscapeMap[char]);
  }

  // Remove null bytes and other control characters (except newlines/tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Handle line breaks based on option
  if (options?.preserveLineBreaks) {
    // Keep newlines and convert \r\n to \n
    sanitized = sanitized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  } else {
    // Replace newlines with spaces
    sanitized = sanitized.replace(/[\r\n]/g, " ");
  }

  // Collapse multiple whitespace
  sanitized = sanitized.replace(/\s{2,}/g, " ").trim();

  return sanitized;
}

/**
 * Validate pagination parameters ensuring they're within safe bounds
 * Prevents abuse through extremely large page sizes or negative values
 * 
 * @param params - URLSearchParams containing pagination values
 * @param defaults - Default values if not provided
 * @returns Validated pagination parameters
 */
export function validatePaginationParams(
  params: URLSearchParams,
  defaults?: {
    defaultPage?: number;
    defaultPageSize?: number;
    maxPageSize?: number;
  }
): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const defaultPage = defaults?.defaultPage ?? 1;
  const defaultPageSize = defaults?.defaultPageSize ?? 20;
  const maxPageSize = defaults?.maxPageSize ?? 100;

  // Parse page parameter
  let page = parseInt(params.get("page") || String(defaultPage), 10);
  
  // Validate page bounds
  if (isNaN(page) || page < 1) {
    page = defaultPage;
  }
  
  // Prevent excessively large page numbers (could indicate abuse)
  const MAX_PAGE = 10000;
  if (page > MAX_PAGE) {
    console.warn(`Page number ${page} exceeds maximum, capping at ${MAX_PAGE}`);
    page = MAX_PAGE;
  }

  // Parse pageSize parameter
  let pageSize = parseInt(params.get("page_size") || params.get("pageSize") || String(defaultPageSize), 10);
  
  // Validate pageSize bounds
  if (isNaN(pageSize) || pageSize < 1) {
    pageSize = defaultPageSize;
  }
  
  // Enforce maximum page size to prevent data exfiltration
  if (pageSize > maxPageSize) {
    console.warn(`Page size ${pageSize} exceeds maximum, capping at ${maxPageSize}`);
    pageSize = maxPageSize;
  }

  // Calculate offset
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    offset,
  };
}

/**
 * Extract client information from request for audit logging
 * Safely extracts IP address and user agent
 * 
 * @param request - The incoming NextRequest
 * @returns Object with client information
 */
export function extractClientInfo(request: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
  origin: string | null;
  referer: string | null;
} {
  // Try to get real IP from various headers (for reverse proxy setups)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  
  let ipAddress: string | null = null;
  
  if (cfConnectingIp) {
    // Cloudflare header (most reliable if using CF)
    ipAddress = cfConnectingIp.split(",")[0].trim();
  } else if (forwardedFor) {
    // Standard X-Forwarded-For header
    ipAddress = forwardedFor.split(",")[0].trim();
  } else if (realIp) {
    // Nginx/Apache style header
    ipAddress = realIp;
  }
  
  // Basic IP format validation (prevent header injection)
  if (ipAddress && !/^[\d.:a-fA-F]+$/.test(ipAddress)) {
    console.warn(`Invalid IP address format detected: ${ipAddress}`);
    ipAddress = null;
  }

  // Get user agent
  const userAgent = request.headers.get("user-agent");
  
  // Sanitize user agent (limit length)
  const safeUserAgent = userAgent 
    ? userAgent.substring(0, 500)
    : null;

  // Get origin and referer for CSRF validation hints
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  return {
    ipAddress,
    userAgent: safeUserAgent,
    origin,
    referer,
  };
}

/**
 * Validate that a sort field is in the allowed list
 * Prevents SQL injection via sort parameters
 * 
 * @param sortBy - The requested sort field
 * @param allowedFields - Array of allowed field names
 * @param defaultField - Default field if invalid
 * @returns Validated sort field
 */
export function validateSortField<T extends string>(
  sortBy: string | null | undefined,
  allowedFields: readonly T[],
  defaultField: T = allowedFields[0]
): T {
  if (!sortBy) {
    return defaultField;
  }

  // Check if the sort field is in the allowed list
  if (allowedFields.includes(sortBy as T)) {
    return sortBy as T;
  }

  // Log suspicious activity
  console.warn(`Invalid sort field attempted: ${sortBy}`);

  return defaultField;
}

/**
 * Validate sort order parameter
 * 
 * @param sortOrder - The requested sort order ("asc" or "desc")
 * @param defaultOrder - Default order if invalid
 * @returns Boolean where true = ascending, false = descending
 */
export function validateSortOrder(
  sortOrder: string | null | undefined,
  defaultOrder: boolean = false
): boolean {
  if (!sortOrder) {
    return defaultOrder;
  }

  return sortOrder.toLowerCase() === "asc" ? true : false;
}

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

/**
 * Simple in-memory rate limiter for API routes
 * Note: For production with multiple instances, use Redis or similar
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if request is allowed under rate limit
   */
  check(key: string, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    const existing = this.requests.get(key);

    if (!existing || now > existing.resetTime) {
      // New window
      this.requests.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    if (existing.count >= config.maxRequests) {
      // Rate limited
      return {
        allowed: false,
        remaining: 0,
        resetTime: existing.resetTime,
        retryAfter: Math.ceil((existing.resetTime - now) / 1000),
      };
    }

    // Increment counter
    existing.count++;

    return {
      allowed: true,
      remaining: config.maxRequests - existing.count,
      resetTime: existing.resetTime,
    };
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // General API limits
  general: { windowMs: 60_000, maxRequests: 100 }, // 100 requests per minute
  
  // Strict limits for sensitive operations
  authentication: { windowMs: 15 * 60_000, maxRequests: 10 }, // 10 attempts per 15 minutes
  studentCreate: { windowMs: 60_000, maxRequests: 5 }, // 5 creates per minute
  applicationSubmit: { windowMs: 60_000, maxRequests: 10 }, // 10 applications per minute
  evaluationSubmit: { windowMs: 60_000, maxRequests: 20 }, // 20 evaluations per minute
  
  // File upload limits
  fileUpload: { windowMs: 60_000, maxRequests: 10 }, // 10 uploads per minute
} as const;

/**
 * Create a rate-limited response when limit is exceeded
 */
export function rateLimitedResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Too many requests. Please try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": "true",
      },
    }
  );
}

/**
 * Validate UUID format
 * Prevents injection via malformed IDs
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate ULID format (if used instead of UUID)
 */
export function isValidULID(id: string): boolean {
  const ulidRegex = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
  return ulidRegex.test(id);
}

/**
 * Generic ID validator (UUID or ULID)
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== "string") {
    return false;
  }
  
  // Check for reasonable ID length
  if (id.length < 10 || id.length > 50) {
    return false;
  }
  
  // Only allow alphanumeric characters and hyphens/underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return false;
  }
  
  return true;
}
