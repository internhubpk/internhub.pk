import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      ),
    };
  }
  if (profile.role !== "company_hr") {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      ),
    };
  }
  if (!profile.company_id) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      ),
    };
  }
  return { profile, errorResponse: null };
}

// PATCH /api/company-hr/attendance/[id] — correct attendance record
// body: { status, notes? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();
    const { status, notes } = body;
    const validStatuses = ["present", "absent", "late", "half_day", "leave", "holiday"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `status must be one of: ${validStatuses.join(", ")}` } },
        { status: 400 }
      );
    }

    // Verify ownership via internship_id → company_id
    const { data: record } = await supabase
      .from("attendance")
      .select("id, internship_id, internships!inner(company_id)")
      .eq("id", id)
      .maybeSingle();

    if (!record) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Attendance record not found" } },
        { status: 404 }
      );
    }

    const internship = Array.isArray(record.internships) ? record.internships[0] : record.internships;
    if (internship?.company_id !== profile.company_id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Attendance record does not belong to your company" } },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      verified: true, // mark as corrected/verified by HR
      notes: notes ?? null,
    };

    const { data: updated, error: updateError } = await supabase
      .from("attendance")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating attendance:", updateError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update attendance" } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "correct_attendance",
      entity_type: "attendance",
      entity_id: id,
      new_values: { status, notes },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Attendance corrected",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// DELETE /api/company-hr/attendance/[id] — remove a (manually created or
// erroneous) attendance record. Company scope verified like PATCH.
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

    // Verify ownership via internship_id → company_id
    const { data: record } = await supabase
      .from("attendance")
      .select("id, internship_id, internships!inner(company_id)")
      .eq("id", id)
      .maybeSingle();

    if (!record) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Attendance record not found" } },
        { status: 404 }
      );
    }

    const internship = record.internships as { company_id?: string } | null;
    if (!internship || internship.company_id !== profile.company_id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "This attendance record belongs to another company" } },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting attendance record:", deleteError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to delete attendance record" } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "company_hr.delete_attendance",
      entity_type: "attendance",
      entity_id: id,
      new_values: null,
    });

    return NextResponse.json({ success: true, message: "Attendance record deleted" });
  } catch (error) {
    console.error("Unexpected error in DELETE attendance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
