import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { UserRole, ApiResponse } from "@/types";

// Role-based dashboard paths
const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  super_admin: "/super-admin",
  university_admin: "/university-admin",
  department_coordinator: "/department-coordinator",
  faculty_supervisor: "/faculty-supervisor",
  student: "/student",
  company_hr: "/company-hr",
  site_supervisor: "/site-supervisor",
  external_evaluator: "/external-evaluator",
};

/**
 * POST /api/auth
 * 
 * Handles user login and returns user info with redirect path
 * Request body: { email: string, password: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Attempt to sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Return appropriate error message based on error type
      let errorMessage = authError.message;
      
      if (authError.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password";
      } else if (authError.message.includes("Email not confirmed")) {
        errorMessage = "Please verify your email address before signing in";
      }

      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: errorMessage,
        },
        { status: 401 }
      );
    }

    // Fetch user profile to get role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", authData.user.id)
      .single();

    if (profileError || !profile) {
      // User exists but no profile - might need onboarding
      return NextResponse.json<ApiResponse<{
        user: typeof authData.user;
        redirectPath: string;
        needsOnboarding: true;
      }>>(
        {
          success: true,
          message: "Login successful. Profile setup required.",
          data: {
            user: authData.user,
            redirectPath: "/onboarding",
            needsOnboarding: true,
          },
        }
      );
    }

    // Determine redirect path based on role
    const redirectPath = ROLE_DASHBOARD_PATHS[profile.role as UserRole] ?? "/student";

    // Return success response with user info and redirect path
    return NextResponse.json<ApiResponse<{
      user: typeof authData.user;
      profile: typeof profile;
      redirectPath: string;
    }>>(
      {
        success: true,
        message: "Login successful",
        data: {
          user: authData.user,
          profile,
          redirectPath,
        },
      }
    );

  } catch (error) {
    console.error("Auth API error:", error);
    
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: "An unexpected error occurred during authentication",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth
 * 
 * Returns current authenticated user info if session exists
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json<ApiResponse<{
      user: typeof user;
      profile?: typeof profile;
    }>>(
      {
        success: true,
        data: {
          user,
          profile: profileError ? undefined : profile,
        },
      }
    );

  } catch (error) {
    console.error("Auth GET API error:", error);
    
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
