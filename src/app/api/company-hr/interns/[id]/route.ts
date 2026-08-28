import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// DELETE /api/company-hr/interns/[id] — remove an intern placement.
//
// The Company HR creates placements by accepting applications, so they can
// also remove them. Deleting the `student_internships` row:
//   - intern_supervisor_assignments → cascaded away
//   - weekly_logs / evaluations / attendance → preserved (FK SET NULL)
// This also unblocks deleting the accepted application record (the
// applications DELETE API refuses while a placement exists).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Server unavailable" },
        { status: 500 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, role, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
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

    // Verify the placement exists AND belongs to the HR's company
    // (via its internship).
    const { data: placement, error: fetchError } = await supabase
      .from("student_internships")
      .select(
        `
        id,
        student_user_id,
        internship_id,
        status,
        internships!inner(id, title, company_id)
        `
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !placement) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Intern placement not found" } },
        { status: 404 }
      );
    }

    const internship = Array.isArray(placement.internships)
      ? placement.internships[0]
      : placement.internships;
    if (!internship || internship.company_id !== profile.company_id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "This intern placement belongs to another company",
          },
        },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("student_internships")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting intern placement:", deleteError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to remove the placement" } },
        { status: 500 }
      );
    }

    // Notify the student that their placement was removed.
    try {
      await supabase.from("notifications").insert({
        user_id: placement.student_user_id,
        sender_id: user.id,
        title: "Internship Placement Removed",
        message: `Your placement for "${internship.title || "the internship"}" has been removed by the company.`,
        category: "internship",
        priority: "high",
        is_read: false,
        metadata: { type: "placement_removed", internship_id: placement.internship_id },
      });
    } catch (notifError) {
      // Non-fatal.
      console.warn("Failed to notify student of placement removal:", notifError);
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "company_hr.remove_intern_placement",
      entity_type: "student_internship",
      entity_id: id,
      old_values: { status: placement.status, internship_id: placement.internship_id },
      new_values: null,
    });

    return NextResponse.json({
      success: true,
      message: "Intern placement removed",
    });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/company-hr/interns/[id]:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
