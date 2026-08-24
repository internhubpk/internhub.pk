import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// GET: List company's internship programs (with target departments)
// POST: Create new internship program (with target departments)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    
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

    // Build query — include target departments
    let query = supabase
      .from("internships")
      .select(`
        *,
        internship_target_departments(
          id,
          university_id,
          department_id,
          departments:department_id(id, name),
          universities:university_id(id, name)
        )
      `, { count: "exact" })
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
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    
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
      target_departments: oldTargetDepartments = [],
      target_departments: newTargetDepartments = [],
      university_id,
      max_applicants,
      start_date,
      end_date,
      application_deadline,
      required_skills = [],
      requirements = [],
      benefits = [],
      image_url,
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

    // Validate new-style target_departments: [{university_id, department_id}]
    const newStyleTargets: Array<{ university_id: string; department_id: string }> =
      Array.isArray(newTargetDepartments) && newTargetDepartments.length > 0 &&
      typeof newTargetDepartments[0] === "object" && newTargetDepartments[0] !== null
        ? newTargetDepartments
        : [];

    // If new-style targets provided, validate MoU and department ownership
    if (newStyleTargets.length > 0) {
      // Collect unique university IDs
      const uniIds = [...new Set(newStyleTargets.map(t => t.university_id))];
      const now = new Date().toISOString();

      // Check each university has an active MoU with this company
      for (const uniId of uniIds) {
        const { count: mouCount } = await supabase
          .from("company_university_mous")
          .select("id", { count: "exact", head: true })
          .eq("company_id", profile.company_id)
          .eq("university_id", uniId)
          .eq("status", "active")
          .or(`ends_at.gt.${now},ends_at.is.null`);

        if ((mouCount || 0) === 0) {
          return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: `No active MoU found for university ${uniId}` } },
            { status: 400 }
          );
        }
      }

      // Verify each department belongs to its specified university
      for (const target of newStyleTargets) {
        const { data: dept } = await supabase
          .from("departments")
          .select("id, university_id")
          .eq("id", target.department_id)
          .eq("university_id", target.university_id)
          .single();

        if (!dept) {
          return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: `Department ${target.department_id} does not belong to university ${target.university_id}` } },
            { status: 400 }
          );
        }
      }
    }

    // Defensive: keep stipend_currency consistent — default to PKR
    const stipend_currency = "PKR";

    // Build the legacy target_departments jsonb (for backward compatibility)
    // Keep the old free-text column populated alongside the new table.
    const legacyTargetDepartments = oldTargetDepartments.length > 0 &&
      typeof oldTargetDepartments[0] === "string"
      ? oldTargetDepartments
      : []; // We don't backfill from new-style to old-style

    // Create internship
    const insertPayload: Record<string, unknown> = {
      company_id: profile.company_id,
      title: title.trim(),
      description: description.trim(),
      location: location || null,
      remote: Boolean(remote),
      is_paid: Boolean(is_paid),
      stipend: stipend || null,
      stipend_currency,
      duration_weeks: duration_weeks ?? 8,
      max_applicants: max_applicants || null,
      current_applicants: 0,
      start_date: start_date || null,
      end_date: end_date || null,
      application_deadline: application_deadline || null,
      required_skills: Array.isArray(required_skills) ? required_skills : [],
      requirements: Array.isArray(requirements) ? requirements : [],
      benefits: Array.isArray(benefits) ? benefits : [],
      image_url: typeof image_url === "string" && image_url.trim() ? image_url.trim() : null,
      status: "draft",
      created_by: user.id,
    };
    if (location_type !== undefined) insertPayload.location_type = location_type;
    // Keep legacy column for backward compat
    if (legacyTargetDepartments.length > 0) insertPayload.target_departments = legacyTargetDepartments;
    else insertPayload.target_departments = [];
    if (university_id !== undefined) insertPayload.university_id = university_id || null;

    const { data: internship, error: insertError } = await supabase
      .from("internships")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating internship:", insertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create internship program" } },
        { status: 500 }
      );
    }

    // Insert target department rows
    if (newStyleTargets.length > 0) {
      const targetRows = newStyleTargets.map(t => ({
        internship_id: internship.id,
        university_id: t.university_id,
        department_id: t.department_id,
      }));

      const { error: tdError } = await supabase
        .from("internship_target_departments")
        .insert(targetRows);

      if (tdError) {
        console.error("Error inserting target departments:", tdError);
        // Non-fatal: internship was created, just the target depts failed
      }
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
