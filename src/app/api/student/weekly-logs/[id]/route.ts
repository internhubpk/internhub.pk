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
