import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// GET: List company's internship programs
// POST: Create new internship program
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
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("internships")
      .select("*", { count: "exact" })
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: internships, count, error } = await query;

    if (error) {
      console.error("Error fetching internships:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch internships" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: internships || [],
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
      title,
      description,
      location_type = "on_site",
      location,
      remote = false,
      is_paid = false,
      stipend,
      duration_weeks = 8,
      target_departments = [],
      university_id,
      max_applicants,
      start_date,
      end_date,
      application_deadline,
      required_skills = [],
      requirements = [],
      benefits = [],
    } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Title is required", details: [{ field: "title", message: "Title cannot be empty" }] } },
        { status: 400 }
      );
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Description is required", details: [{ field: "description", message: "Description cannot be empty" }] } },
        { status: 400 }
      );
    }

    // Create internship
    const { data: internship, error: insertError } = await supabase
      .from("internships")
      .insert({
        company_id: profile.company_id,
        title: title.trim(),
        description: description.trim(),
        location_type,
        location: location || null,
        remote,
        is_paid,
        stipend: stipend || null,
        duration_weeks,
        target_departments,
        university_id: university_id || null,
        max_applicants: max_applicants || null,
        current_applicants: 0,
        start_date: start_date || null,
        end_date: end_date || null,
        application_deadline: application_deadline || null,
        required_skills,
        requirements,
        benefits,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating internship:", insertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create internship program" } },
        { status: 500 }
      );
    }

    // Log audit action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_internship",
      entity_type: "internship",
      entity_id: internship.id,
      new_values: { ...internship },
    });

    return NextResponse.json({
      success: true,
      data: internship,
      message: "Internship program created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
