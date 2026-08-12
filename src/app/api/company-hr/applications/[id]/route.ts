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

// GET /api/company-hr/applications/[id] - single application detail
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

    const { data: app, error } = await supabase
      .from("internship_applications")
      .select(
        `
        *,
        internships:internship_id (*),
        profiles:student_user_id (*)
      `
      )
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (error || !app) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Application not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: app });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PATCH /api/company-hr/applications/[id] — single application status update
// body: { status, reason? }
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
    const { status, reason } = body;
    const validStatuses = ["pending", "reviewing", "accepted", "rejected", "withdrawn"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `status must be one of: ${validStatuses.join(", ")}` } },
        { status: 400 }
      );
    }

    // Verify ownership and grab current state
    const { data: existing } = await supabase
      .from("internship_applications")
      .select("id, internship_id, student_user_id, status, internships!inner(company_id, title, start_date)")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Application not found" } },
        { status: 404 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("internship_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating application:", updateError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update application" } },
        { status: 500 }
      );
    }

    // On accept, create student_internships row (idempotent)
    if (status === "accepted" && existing.status !== "accepted") {
      const internship = Array.isArray(existing.internships) ? existing.internships[0] : existing.internships;
      const startDate = internship?.start_date || new Date().toISOString().slice(0, 10);
      await supabase
        .from("student_internships")
        .upsert(
          {
            student_user_id: existing.student_user_id,
            internship_id: existing.internship_id,
            application_id: existing.id,
            company_id: profile.company_id,
            start_date: startDate,
            status: "assigned",
          },
          { onConflict: "student_user_id,internship_id", ignoreDuplicates: true }
        );
    }

    // Notify student
    await supabase.from("notifications").insert({
      user_id: existing.student_user_id,
      sender_id: user.id,
      title:
        status === "accepted"
          ? "Application accepted!"
          : status === "rejected"
          ? "Application update"
          : "Application status updated",
      message:
        status === "accepted"
          ? "Congratulations! Your application has been accepted. You'll receive onboarding instructions shortly."
          : status === "rejected"
          ? `Your application has been declined. ${reason ? `Reason: ${reason}` : ""}`.trim()
          : `Your application status is now: ${status}.`,
      category: "application",
      priority: status === "accepted" ? "high" : "medium",
      is_read: false,
    });

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `update_application_status_${status}`,
      entity_type: "application",
      entity_id: id,
      new_values: { status, reason },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Application ${status}`,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
