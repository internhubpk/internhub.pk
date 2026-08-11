import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/auth/lookup-user
 * 
 * Looks up a username in the profiles table and returns the associated email.
 * Used for username-based login for staff accounts (university_admin, department_coordinator,
 * faculty_supervisor, company_hr, site_supervisor).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Look up user by username in profiles table
    // Username is stored differently depending on role:
    // - For email-based accounts: username might be null or same as email prefix
    // - For username-based accounts: stored in a custom field or derived
    
    // First, try to find by exact username match (if there's a username field)
    let { data: profile, error } = await supabase
      .from("profiles")
      .select("email, user_id, role")
      .or(`username.eq.${username.trim()}`)
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
        return NextResponse.json({
          email: supervisor.profile.email,
          userId: supervisor.user_id,
          role: supervisor.profile.role,
          found: true,
        });
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
