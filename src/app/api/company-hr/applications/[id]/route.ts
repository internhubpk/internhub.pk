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

    // On accept, create student_internships row (idempotent).
    //
    // BUG FIX (0036): The previous upsert only set student_user_id,
    // internship_id, application_id, company_id, start_date, status —
    // leaving university_id, department_id, program_id as NULL. This made
    // the row invisible to university_admin and department_coordinator
    // dashboards (si_select used plain equality, no IS NULL fallback).
    //
    // Now: fetch the student's university_id/department_id/program_id from
    // the students table and include them in the upsert payload. The
    // trg_backfill_si_tenant trigger (migration 0036) also fills these
    // as a safety net, but setting them explicitly here is more reliable
    // (the trigger only fires on INSERT, not on conflict-update).
    if (status === "accepted" && existing.status !== "accepted") {
      const internship = Array.isArray(existing.internships) ? existing.internships[0] : existing.internships;
      const startDate = internship?.start_date || new Date().toISOString().slice(0, 10);

      // Fetch student's tenant IDs so the student_internships row is
      // visible to the owning university/dept coordinators.
      const { data: studentRow } = await supabase
        .from("students")
        .select("university_id, department_id, program_id")
        .eq("user_id", existing.student_user_id)
        .maybeSingle();

      await supabase
        .from("student_internships")
        .upsert(
          {
            student_user_id: existing.student_user_id,
            internship_id: existing.internship_id,
            application_id: existing.id,
            company_id: profile.company_id,
            university_id: studentRow?.university_id || null,
            department_id: studentRow?.department_id || null,
            program_id: studentRow?.program_id || null,
            start_date: startDate,
            status: "assigned",
          },
          { onConflict: "student_user_id,internship_id", ignoreDuplicates: true }
        );
    }

    // Notify student — uses the shared sendNotification helper so the
    // notification is also delivered via web push to subscribed devices.
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(supabase, {
      userId: existing.student_user_id,
      senderId: user.id,
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
      actionUrl: "/student/applications",
      metadata: {
        type: status === "accepted" ? "application_accepted" : status === "rejected" ? "application_rejected" : "application_status_update",
        application_id: existing.id,
        internship_id: existing.internship_id,
        new_status: status,
      },
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

// DELETE /api/company-hr/applications/[id] — permanently remove an
// application record (cleanup of test/spam/withdrawn applications).
// Blocked when the applicant has already been ACCEPTED and placed into the
// internship (a student_internships row exists) — remove the placement
// first.
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

    // Verify ownership
    const { data: existing } = await supabase
      .from("internship_applications")
      .select("id, internship_id, student_user_id, status, internships!inner(company_id)")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Application not found" } },
        { status: 404 }
      );
    }

    // Block removal when the applicant is already placed.
    const { data: placement } = await supabase
      .from("student_internships")
      .select("id")
      .eq("internship_id", existing.internship_id)
      .eq("student_user_id", existing.student_user_id)
      .maybeSingle();

    if (placement) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message:
              "This applicant was accepted and placed into the internship. Remove the intern placement first (Interns page).",
          },
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("internship_applications")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting application:", deleteError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to delete application" } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "company_hr.delete_application",
      entity_type: "internship_application",
      entity_id: id,
      old_values: { status: existing.status },
      new_values: null,
    });

    return NextResponse.json({ success: true, message: "Application deleted" });
  } catch (error) {
    console.error("Unexpected error in DELETE application:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
