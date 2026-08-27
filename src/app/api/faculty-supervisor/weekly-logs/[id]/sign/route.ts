import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ============================================================================
// POST /api/faculty-supervisor/weekly-logs/[id]/sign
//
// Faculty supervisor signs a weekly log:
//   - Uploads their drawn/typed signature PNG to the `signatures` bucket
//   - Persists the URL on weekly_logs.faculty_supervisor_signature_url
//   - Sets faculty_supervisor_remarks + faculty_supervisor_signed_at + faculty_supervisor_id
//   - Updates status:
//       * If site supervisor has already signed → status = "approved"
//       * Otherwise → status = "faculty_signed" (awaiting site supervisor)
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

    const { data: log, error: logError } = await supabase
      .from("weekly_logs")
      .select(
        `id, student_user_id, student_internship_id, status, site_supervisor_signature_url,
         student_internships:student_internship_id ( faculty_supervisor_id )`
      )
      .eq("id", logId)
      .maybeSingle();

    if (logError || !log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found" } },
        { status: 404 }
      );
    }

    const si = Array.isArray(log.student_internships)
      ? log.student_internships[0]
      : log.student_internships;
    const assignedFacultySupervisorId = si?.faculty_supervisor_id;

    if (assignedFacultySupervisorId && assignedFacultySupervisorId !== user.id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "You are not the assigned faculty supervisor for this student" },
        },
        { status: 403 }
      );
    }

    const ext = file.name.split(".").pop() || "png";
    const filePath = `${user.id}/faculty_sign_${logId}_${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from("signatures")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[faculty sign] storage error:", uploadError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: uploadError.message } },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("signatures")
      .getPublicUrl(filePath);

    const signatureUrl = urlData?.publicUrl || null;

    // Determine new status: if site supervisor has already signed → approved.
    // Otherwise → faculty_signed (awaiting site supervisor).
    const newStatus = log.site_supervisor_signature_url ? "approved" : "faculty_signed";

    // BUG FIX 2026-08-27 ("make sure supervisor remarks are added" to the Word
    // report): signing WITHOUT typing new remarks used to overwrite
    // faculty_supervisor_remarks / supervisor_feedback with NULL — wiping the
    // feedback written during review, so the generated report's "Supervisor
    // Remarks" section went empty. Remarks columns are now only written when
    // the signer actually supplied remarks; otherwise the review-time
    // feedback is preserved.
    const updatePayload: Record<string, any> = {
      faculty_supervisor_id: user.id,
      faculty_supervisor_signature_url: signatureUrl,
      faculty_supervisor_signed_at: new Date().toISOString(),
      // Back-compat: keep supervisor_id / reviewed_at in sync.
      supervisor_id: user.id,
      reviewed_at: new Date().toISOString(),
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (remarks && remarks.trim().length > 0) {
      updatePayload.faculty_supervisor_remarks = remarks;
      updatePayload.supervisor_feedback = remarks;
    }

    const { data: updatedLog, error: updateError } = await supabase
      .from("weekly_logs")
      .update(updatePayload)
      .eq("id", logId)
      .select()
      .single();

    if (updateError) {
      console.error("[faculty sign] db update error:", updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    // Notify student — uses the shared sendNotification helper so the
    // notification is also delivered via web push to subscribed devices.
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(supabase, {
      userId: log.student_user_id,
      senderId: user.id,
      title:
        newStatus === "approved"
          ? "Weekly Log Fully Signed & Approved"
          : "Weekly Log Signed by Faculty Supervisor",
      message:
        newStatus === "approved"
          ? `Your weekly log has been signed by both supervisors and is now fully approved.`
          : `Your weekly log has been signed by your faculty supervisor. It is now awaiting site supervisor sign-off.`,
      category: "evaluation",
      priority: newStatus === "approved" ? "high" : "medium",
      actionUrl: "/student/weekly-logs",
      metadata: { type: "weekly_log_signed", log_id: logId, action: "faculty_signed", sent_by: "faculty_supervisor" },
    });

    if (newStatus === "approved") {
      const { data: siRow } = await supabase
        .from("student_internships")
        .select("site_supervisor_id")
        .eq("id", log.student_internship_id || "")
        .maybeSingle();
      if (siRow?.site_supervisor_id) {
        await sendNotification(supabase, {
          userId: siRow.site_supervisor_id,
          senderId: user.id,
          title: "Weekly Log Fully Approved",
          message: `A weekly log you signed has now also been signed by the faculty supervisor. It is fully approved.`,
          category: "evaluation",
          priority: "low",
          actionUrl: "/site-supervisor/weekly-logs",
          metadata: { type: "weekly_log_approved", log_id: logId, action: "approved", sent_by: "faculty_supervisor" },
        });
      }
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "weekly_log_faculty_signed",
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
          : "Signed. Awaiting site supervisor sign-off.",
    });
  } catch (error: any) {
    console.error("[faculty sign] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
