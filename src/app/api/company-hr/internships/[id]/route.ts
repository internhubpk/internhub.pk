import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("user_id", userId)
    .single();

  if (error || !profile) return { profile: null, errorResponse: NextResponse.json(
    { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
    { status: 404 }
  ) };

  if (profile.role !== "company_hr") return { profile: null, errorResponse: NextResponse.json(
    { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
    { status: 403 }
  ) };

  if (!profile.company_id) return { profile: null, errorResponse: NextResponse.json(
    { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
    { status: 400 }
  ) };

  return { profile, errorResponse: null };
}

// GET /api/company-hr/internships/[id] - Fetch a single internship (scoped to company)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const { data: internship, error } = await supabase
      .from("internships")
      .select("*")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .single();

    if (error || !internship) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Internship program not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: internship });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PUT /api/company-hr/internships/[id] - Update an internship (scoped to company)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    // Confirm the internship belongs to this company before updating
    const { data: existing } = await supabase
      .from("internships")
      .select("id, company_id")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Internship program not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      location_type,
      location,
      remote,
      is_paid,
      stipend,
      duration_weeks,
      university_id,
      max_applicants,
      start_date,
      end_date,
      application_deadline,
      required_skills,
      requirements,
      benefits,
      status,
      image_url,
    } = body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (location_type !== undefined) updateData.location_type = location_type;
    if (location !== undefined) updateData.location = location || null;
    if (remote !== undefined) updateData.remote = remote;
    if (is_paid !== undefined) updateData.is_paid = is_paid;
    if (stipend !== undefined) updateData.stipend = stipend || null;
    if (duration_weeks !== undefined) updateData.duration_weeks = duration_weeks;
    if (university_id !== undefined) updateData.university_id = university_id || null;
    if (max_applicants !== undefined) updateData.max_applicants = max_applicants || null;
    if (start_date !== undefined) updateData.start_date = start_date || null;
    if (end_date !== undefined) updateData.end_date = end_date || null;
    if (application_deadline !== undefined) updateData.application_deadline = application_deadline || null;
    if (required_skills !== undefined) updateData.required_skills = required_skills;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (benefits !== undefined) updateData.benefits = benefits;
    if (status !== undefined) updateData.status = status;
    // image_url: accept string (set) or null (clear). Only update when the
    // field is explicitly present in the payload so we don't blow away an
    // existing image when the caller only wants to change, e.g., the title.
    if (image_url !== undefined) {
      updateData.image_url = typeof image_url === "string" && image_url.trim() ? image_url.trim() : null;
    }

    const { data: internship, error } = await supabase
      .from("internships")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating internship:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update internship program" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: internship,
      message: "Internship program updated successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// DELETE /api/company-hr/internships/[id] - Delete an internship (scoped to company)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const { error } = await supabase
      .from("internships")
      .delete()
      .eq("id", id)
      .eq("company_id", profile.company_id);

    if (error) {
      console.error("Error deleting internship:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to delete internship program" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Internship program deleted successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
