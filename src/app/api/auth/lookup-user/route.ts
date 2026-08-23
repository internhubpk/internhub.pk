import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { rateLimiter, RATE_LIMITS, extractClientInfo } from "@/lib/api-security";

// Roles permitted to look up arbitrary users (staff who need this for
// sending notifications, assigning supervisors, etc.). Students may
// only look up their own username — see auth check below.
const ALLOWED_LOOKUP_ROLES = new Set([
  "faculty_supervisor",
  "department_coordinator",
  "university_admin",
  "super_admin",
  "company_hr",
  "site_supervisor",
]);

/**
 * POST /api/auth/lookup-user
 *
 * Looks up a username in the profiles table and returns the associated email.
 * Used for username-based login for staff accounts (university_admin, department_coordinator,
 * faculty_supervisor, company_hr, site_supervisor).
 *
 * Auth: caller must be signed in. Students may only look up their own
 * username/email — all other lookups return 403 to prevent enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: authenticated callers could otherwise enumerate
    // usernames/emails at high frequency (2026-08-23 audit).
    const { ipAddress: ip } = extractClientInfo(request);
    const rl = rateLimiter.check(`lookup-user:${ip}`, RATE_LIMITS.general);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter ?? 60) },
        }
      );
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }
    // Validate shape: username must be a plain token (no PostgREST filter
    // injection characters). 2026-08-23 audit.
    const uname = username.trim();
    if (uname.length > 100 || !/^[A-Za-z0-9@._\- ]+$/.test(uname)) {
      return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
    }

    const supabase = await createClient();

    // Require authentication — prevents anonymous enumeration.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", found: false },
        { status: 401 }
      );
    }

    // Fetch the caller's profile so we can enforce role-based access.
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, username, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const callerRole = callerProfile?.role;
    const trimmedUsername = username.trim();
    const requestedLower = trimmedUsername.toLowerCase();

    // Students may only look up their own username/email (no enumeration).
    if (callerRole === "student") {
      const ownUsername = callerProfile?.username;
      const ownEmail = callerProfile?.email;
      const isOwn =
        (typeof ownUsername === "string" && ownUsername.toLowerCase() === requestedLower) ||
        (typeof ownEmail === "string" && ownEmail.toLowerCase() === requestedLower);

      if (!isOwn) {
        return NextResponse.json(
          { error: "Forbidden: students may only look up their own username", found: false },
          { status: 403 }
        );
      }

      return NextResponse.json({
        email: ownEmail,
        userId: user.id,
        role: callerRole,
        found: true,
      });
    }

    // Staff roles (and super_admin) are allowed to look up arbitrary users.
    if (!callerRole || !ALLOWED_LOOKUP_ROLES.has(callerRole)) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to look up users", found: false },
        { status: 403 }
      );
    }

    // Look up user by username in profiles table using a structured filter
    // (no string interpolation → no PostgREST filter-injection vector).
    let { data: profile, error } = await supabase
      .from("profiles")
      .select("email, user_id, role")
      .eq("username", trimmedUsername)
      .maybeSingle();

    // If not found, try looking up by email (in case they entered their email)
    if (!profile && !error) {
      const { data: emailProfile } = await supabase
        .from("profiles")
        .select("email, user_id, role")
        .eq("email", username.trim().toLowerCase())
        .maybeSingle();
      
      if (emailProfile) {
        profile = emailProfile;
      }
    }

    // If still not found, try checking supervisors table for username
    if (!profile && !error) {
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select(`
          user_id,
          type,
          profile:user_id (
            email,
            role
          )
        `)
        .or(`username.eq.${username.trim()},email.eq.${username.trim()}`)
        .maybeSingle();

      if (supervisor?.profile) {
        // Supabase returns FK joins as arrays; pick the first item.
        const profile = Array.isArray(supervisor.profile)
          ? supervisor.profile[0]
          : supervisor.profile;
        if (profile) {
          return NextResponse.json({
            email: profile.email,
            userId: supervisor.user_id,
            role: profile.role,
            found: true,
          });
        }
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User not found", found: false },
        { status: 404 }
      );
    }

    if (error) {
      console.error("Profile lookup error:", error);
      return NextResponse.json(
        { error: "Lookup failed", found: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email: profile.email,
      userId: profile.user_id,
      role: profile.role,
      found: true,
    });

  } catch (error) {
    console.error("Username lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error", found: false },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
