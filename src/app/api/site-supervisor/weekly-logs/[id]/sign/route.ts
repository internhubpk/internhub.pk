import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";
import { getSupervisorColumn, getSignatureColumn, getRemarksColumn, getSignedAtColumn, isSupervisorRole, getSupervisorRoleLabel } from "@/lib/supervisor-role";

// ============================================================================
// POST /api/site-supervisor/weekly-logs/[id]/sign
//
// Site supervisor signs a weekly log:
//   - Uploads their drawn/typed signature PNG to the `signatures` bucket
//   - Persists the URL on weekly_logs.site_supervisor_signature_url
//   - Sets site_supervisor_remarks + site_supervisor_signed_at + site_supervisor_id
//   - Updates status:
//       * If faculty supervisor has already signed → status = "approved"
//       * Otherwise → status = "site_signed" (awaiting faculty supervisor)
//
// Request: multipart/form-data with:
//   - file:     PNG/JPEG signature image (≤1MB)
//   - remarks:  (optional) string
//
// Returns: { success, data: updatedLog }
// ============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: logId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Look up caller's profile so we can use the right signature column
    // (site_supervisor_signature_url vs external_evaluator_signature_url)
    // and the right supervisor_id link column.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!profile || !isSupervisorRole(profile.role as any)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "FORBIDDEN", message: "Supervisor access required" } },
        { status: 403 }
      );
    }
    const supervisorColumn = getSupervisorColumn(profile.role as any);
    const signatureColumn = getSignatureColumn(profile.role as any);
    const remarksColumn = getRemarksColumn(profile.role as any);
    const signedAtColumn = getSignedAtColumn(profile.role as any);
    const roleLabel = getSupervisorRoleLabel(profile.role as any);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const remarks = (formData.get("remarks") as string | null) || "";

    if (!file) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Signature image is required" } },
        { status: 400 }
      );
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Signature must be PNG or JPEG" } },
        { status: 400 }
      );
    }

    if (file.size > 1024 * 1024) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Signature file must be ≤1MB" } },
        { status: 400 }
      );
    }

    // Fetch the log + verify the student is assigned to this supervisor.
    // We select BOTH supervisor_id columns so the assignment check works
    // regardless of which role the caller has.
    const { data: log, error: logError } = await supabase
      .from("weekly_logs")
      .select(
        `id, student_user_id, student_internship_id, status, faculty_supervisor_signature_url,
         student_internships:student_internship_id ( site_supervisor_id, external_evaluator_id )`
      )
      .eq("id", logId)
      .maybeSingle();

    if (logError || !log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found" } },
        { status: 404 }
      );
    }

    // Verify assignment via student_internships. RLS also enforces this but
    // we double-check to give a friendly 403 instead of a generic 500.
    const si = Array.isArray(log.student_internships)
      ? log.student_internships[0]
      : log.student_internships;
    const assignedSupervisorId =
      supervisorColumn === "external_evaluator_id"
        ? si?.external_evaluator_id
        : si?.site_supervisor_id;

    if (assignedSupervisorId && assignedSupervisorId !== user.id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: { code: "FORBIDDEN", message: `You are not the assigned ${roleLabel.toLowerCase()} for this student` },
        },
        { status: 403 }
      );
    }

    // Upload the signature.
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${user.id}/site_sign_${logId}_${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from("signatures")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[site sign] storage error:", uploadError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: uploadError.message } },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("signatures")
      .getPublicUrl(filePath);

    const signatureUrl = urlData?.publicUrl || null;

    // Determine new status: if faculty supervisor has already signed, the
    // log is now fully approved. Otherwise it's "site_signed" awaiting
    // faculty supervisor.
    const newStatus = log.faculty_supervisor_signature_url ? "approved" : "site_signed";

    // Build the update payload with the role-specific column names.
    // We use computed column names so external_evaluator writes to
    // external_evaluator_*_url etc., and site_supervisor writes to
    // site_supervisor_*_url as before.
    const updatePayload: Record<string, any> = {
      [supervisorColumn]: user.id,
      [signatureColumn]: signatureUrl,
      [remarksColumn]: remarks || null,
      [signedAtColumn]: new Date().toISOString(),
      // Maintain back-compat columns — keep supervisor_id / feedback in sync.
      supervisor_id: user.id,
      supervisor_feedback: remarks || null,
      reviewed_at: new Date().toISOString(),
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedLog, error: updateError } = await supabase
      .from("weekly_logs")
      .update(updatePayload)
      .eq("id", logId)
      .select()
      .single();

    if (updateError) {
      console.error("[site sign] db update error:", updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    // Notify the student — uses the shared sendNotification helper so the
    // notification is also delivered via web push to subscribed devices.
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(supabase, {
      userId: log.student_user_id,
      senderId: user.id,
      title:
        newStatus === "approved"
          ? "Weekly Log Fully Signed & Approved"
          : `Weekly Log Signed by ${roleLabel}`,
      message:
        newStatus === "approved"
          ? `Your weekly log has been signed by both supervisors and is now fully approved.`
          : `Your weekly log has been signed by your ${roleLabel.toLowerCase()}. It is now awaiting faculty supervisor sign-off.`,
      category: "evaluation",
      priority: newStatus === "approved" ? "high" : "medium",
      actionUrl: "/student/weekly-logs",
      metadata: {
        type: "weekly_log_signed",
        log_id: logId,
        action: "site_signed",
        supervisor_id: user.id,
        sent_by: profile.role,
      },
    });

    // If fully approved, also notify the faculty supervisor (best-effort).
    if (newStatus === "approved") {
      const { data: siRow } = await supabase
        .from("student_internships")
        .select("faculty_supervisor_id")
        .eq("id", log.student_internship_id || "")
        .maybeSingle();
      if (siRow?.faculty_supervisor_id) {
        await sendNotification(supabase, {
          userId: siRow.faculty_supervisor_id,
          senderId: user.id,
          title: "Weekly Log Fully Approved",
          message: `A weekly log you signed has now also been signed by the site supervisor. It is fully approved.`,
          category: "evaluation",
          priority: "low",
          actionUrl: "/faculty-supervisor/weekly-logs",
          metadata: { type: "weekly_log_approved", log_id: logId, action: "approved", sent_by: "site_supervisor" },
        });
      }
    }

    // Audit log.
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "weekly_log_site_signed",
      entity_type: "weekly_log",
      entity_id: logId,
      details: {
        new_status: newStatus,
        signature_uploaded: true,
        remarks_provided: Boolean(remarks),
      },
    });

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: updatedLog,
      message:
        newStatus === "approved"
          ? "Signed. Weekly log is now fully approved."
          : "Signed. Awaiting faculty supervisor sign-off.",
    });
  } catch (error: any) {
    console.error("[site sign] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
