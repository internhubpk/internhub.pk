import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ============================================================================
// PATCH /api/student/weekly-logs/[id]
//   Update a weekly log with the uploaded supporting_evidence array and
//   university_logo_url. Called by the student dialog AFTER the initial POST
//   creates the log AND after the signature / logo / evidence files have
//   been uploaded to storage.
//
//   Body: { supporting_evidence?: EvidenceFile[], university_logo_url?: string }
// ============================================================================

export async function PATCH(
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

    // Verify ownership.
    const { data: log } = await supabase
      .from("weekly_logs")
      .select("id, student_user_id, status")
      .eq("id", logId)
      .eq("student_user_id", user.id)
      .maybeSingle();

    if (!log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found or not owned by you" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build the patch payload — only allow these fields to be updated.
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (Array.isArray(body.supporting_evidence)) {
      patch.supporting_evidence = body.supporting_evidence;
    }
    if (typeof body.university_logo_url === "string") {
      patch.university_logo_url = body.university_logo_url || null;
    }
    if (typeof body.student_signature_url === "string") {
      patch.student_signature_url = body.student_signature_url || null;
      if (body.student_signature_url) {
        patch.student_signed_at = new Date().toISOString();
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("weekly_logs")
      .update(patch)
      .eq("id", logId)
      .eq("student_user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("[student/weekly-logs PATCH] db error:", updateError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: updated,
      message: "Weekly log updated.",
    });
  } catch (error: any) {
    console.error("[student/weekly-logs PATCH] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/student/weekly-logs/[id]
//   Delete ONE of the student's own weekly logs (by id — never by student,
//   so other weeks can never be affected).
//
//   Approved logs are part of the academic record and are rejected with a
//   clear message (a supervisor/DC can request a revision instead).
// ============================================================================

export async function DELETE(
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

    // Ownership check — scoped to this exact log id.
    const { data: log } = await supabase
      .from("weekly_logs")
      .select("id, student_user_id, status, week_number")
      .eq("id", logId)
      .eq("student_user_id", user.id)
      .maybeSingle();

    if (!log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found or not owned by you" } },
        { status: 404 }
      );
    }

    if (log.status === "approved") {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message:
              "This weekly log has been approved and is part of the academic record. Ask your supervisor to request a revision if something needs to change.",
          },
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("weekly_logs")
      .delete()
      .eq("id", logId)
      .eq("student_user_id", user.id);

    if (deleteError) {
      console.error("[student/weekly-logs DELETE] db error:", deleteError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "DB_ERROR", message: deleteError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
      message: `Weekly log for week ${log.week_number ?? ""} deleted.`,
    });
  } catch (error: any) {
    console.error("[student/weekly-logs DELETE] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
