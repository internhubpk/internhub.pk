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

// GET /api/company-hr/internships/[id] - Fetch a single internship (scoped to company, with target departments)
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
      .select(`
        *,
        internship_target_departments(
          id,
          university_id,
          department_id,
          departments:department_id(id, name),
          universities:university_id(id, name)
        )
      `)
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
      target_departments: newTargetDepartments,
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

    // Handle new-style target_departments: [{university_id, department_id}]
    const newStyleTargets: Array<{ university_id: string; department_id: string }> =
      Array.isArray(newTargetDepartments) && newTargetDepartments.length > 0 &&
      typeof newTargetDepartments[0] === "object" && newTargetDepartments[0] !== null
        ? newTargetDepartments
        : [];

    if (newStyleTargets.length > 0) {
      const uniIds = [...new Set(newStyleTargets.map(t => t.university_id))];
      const now = new Date().toISOString();

      // Validate each university has an active MoU
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

      // Verify departments belong to their universities
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

    // If new-style target_departments provided, replace them (delete + insert)
    if (newStyleTargets.length >= 0 && newTargetDepartments !== undefined) {
      // Delete existing target departments
      await supabase
        .from("internship_target_departments")
        .delete()
        .eq("internship_id", id);

      // Insert new ones (if any)
      if (newStyleTargets.length > 0) {
        const targetRows = newStyleTargets.map(t => ({
          internship_id: id,
          university_id: t.university_id,
          department_id: t.department_id,
        }));

        const { error: tdError } = await supabase
          .from("internship_target_departments")
          .insert(targetRows);

        if (tdError) {
          console.error("Error updating target departments:", tdError);
        }
      }
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

    // Delete target departments first (they have CASCADE, but let's be explicit)
    await supabase
      .from("internship_target_departments")
      .delete()
      .eq("internship_id", id);

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
