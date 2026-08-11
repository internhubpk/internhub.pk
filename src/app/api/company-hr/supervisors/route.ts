import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// GET: List site supervisors for company
// POST: Create new site supervisor account
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Get user profile with company_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      );
    }

    if (profile.role !== "company_hr") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      );
    }

    if (!profile.company_id) {
      return NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("supervisors")
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email,
          phone,
          avatar_url
        )
      `, { count: "exact" })
      .eq("company_id", profile.company_id)
      .eq("type", "site")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: supervisors, count, error } = await query;

    if (error) {
      console.error("Error fetching supervisors:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch supervisors" } },
        { status: 500 }
      );
    }

    // Get intern counts for each supervisor
    const supervisorIds = (supervisors || []).map(s => s.id);
    
    let internCounts: Record<string, number> = {};
    if (supervisorIds.length > 0) {
      const { data: assignments } = await supabase
        .from("intern_supervisor_assignments")
        .select("supervisor_id")
        .in("supervisor_id", supervisorIds)
        .eq("is_active", true);

      internCounts = (assignments || []).reduce((acc, a) => {
        acc[a.supervisor_id] = (acc[a.supervisor_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }

    const supervisorsWithCounts = (supervisors || []).map(supervisor => ({
      ...supervisor,
      assigned_interns_count: internCounts[supervisor.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: supervisorsWithCounts,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Get user profile with company_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      );
    }

    if (profile.role !== "company_hr") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      );
    }

    if (!profile.company_id) {
      return NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      first_name,
      last_name,
      email,
      password,
      phone,
      department_focus,
      specialization,
      program_ids = [],
    } = body;

    // Validate required fields
    if (!first_name?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "First name is required" } },
        { status: 400 }
      );
    }

    if (!last_name?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Last name is required" } },
        { status: 400 }
      );
    }

    if (!email?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Email is required" } },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      filter: `email.eq.${email}`,
    });

    if (existingUser && existingUser.users.length > 0) {
      return NextResponse.json(
        { error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" } },
        { status: 409 }
      );
    }

    // Create auth user
    const { data: newUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        role: "site_supervisor",
      },
    });

    if (createAuthError || !newUser?.user) {
      console.error("Error creating auth user:", createAuthError);
      return NextResponse.json(
        { error: { code: "AUTH_ERROR", message: "Failed to create user account" } },
        { status: 500 }
      );
    }

    // Create profile
    const { data: newProfile, error: profileInsertError } = await supabase
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        email,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        full_name: `${first_name.trim()} ${last_name.trim()}`,
        phone: phone || null,
        role: "site_supervisor",
        company_id: profile.company_id,
        is_active: true,
      })
      .select()
      .single();

    if (profileInsertError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(newUser.user.id);
      
      console.error("Error creating profile:", profileInsertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create user profile" } },
        { status: 500 }
      );
    }

    // Create supervisor record
    const { data: supervisor, error: supervisorInsertError } = await supabase
      .from("supervisors")
      .insert({
        user_id: newUser.user.id,
        company_id: profile.company_id,
        type: "site",
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email,
        phone: phone || null,
        department_focus: department_focus || null,
        specialization: specialization || null,
        program_ids,
        is_active: true,
      })
      .select()
      .single();

    if (supervisorInsertError) {
      // Rollback
      await supabase.from("profiles").delete().eq("user_id", newUser.user.id);
      await supabase.auth.admin.deleteUser(newUser.user.id);
      
      console.error("Error creating supervisor record:", supervisorInsertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create supervisor record" } },
        { status: 500 }
      );
    }

    // Log audit action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_supervisor",
      entity_type: "supervisor",
      entity_id: supervisor.id,
      new_values: { 
        ...supervisor, 
        created_user_email: email 
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...supervisor,
        profile: newProfile,
      },
      message: "Site supervisor created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
