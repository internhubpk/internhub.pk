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

// PUT /api/company-hr/supervisors/[id] - Update a site supervisor (scoped to company)
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

    const { data: existing } = await supabase
      .from("supervisors")
      .select("id, user_id, company_id")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .eq("type", "site")
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Supervisor not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      phone,
      department_focus,
      specialization,
      program_ids,
      is_active,
    } = body;

    const supervisorUpdate: Record<string, any> = {};
    if (first_name !== undefined) supervisorUpdate.first_name = first_name.trim();
    if (last_name !== undefined) supervisorUpdate.last_name = last_name.trim();
    if (phone !== undefined) supervisorUpdate.phone = phone || null;
    if (department_focus !== undefined) supervisorUpdate.department_focus = department_focus || null;
    if (specialization !== undefined) supervisorUpdate.specialization = specialization || null;
    if (program_ids !== undefined) supervisorUpdate.program_ids = program_ids;
    if (is_active !== undefined) supervisorUpdate.is_active = is_active;

    const { data: supervisor, error } = await supabase
      .from("supervisors")
      .update(supervisorUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating supervisor:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update supervisor" } },
        { status: 500 }
      );
    }

    // Keep the linked profile in sync for name/phone changes
    if (first_name !== undefined || last_name !== undefined || phone !== undefined) {
      const profileUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (first_name !== undefined) profileUpdate.first_name = first_name.trim();
      if (last_name !== undefined) profileUpdate.last_name = last_name.trim();
      if (first_name !== undefined || last_name !== undefined) {
        profileUpdate.full_name = `${first_name?.trim() || ""} ${last_name?.trim() || ""}`.trim();
      }
      if (phone !== undefined) profileUpdate.phone = phone || null;

      await supabase.from("profiles").update(profileUpdate).eq("user_id", existing.user_id);
    }

    return NextResponse.json({
      success: true,
      data: supervisor,
      message: "Supervisor updated successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// DELETE /api/company-hr/supervisors/[id] - Deactivate a site supervisor (scoped to company)
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

    // Soft-delete: mark inactive rather than hard-delete, to preserve historical
    // assignment/evaluation records that reference this supervisor.
    const { error } = await supabase
      .from("supervisors")
      .update({ is_active: false })
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .eq("type", "site");

    if (error) {
      console.error("Error deactivating supervisor:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to remove supervisor" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Supervisor removed successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
