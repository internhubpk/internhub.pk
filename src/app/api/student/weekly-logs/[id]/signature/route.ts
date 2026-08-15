import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ============================================================================
// POST /api/student/weekly-logs/[id]/signature
//   Uploads the student's drawn/typed signature PNG to the `signatures`
//   bucket (path: signatures/<user_id>/<filename>) and persists the public
//   URL on weekly_logs.student_signature_url + student_signed_at.
//
// Request: multipart/form-data with:
//   - file:     PNG/JPEG image (≤1MB per bucket policy)
//   - logId:    (optional — if provided, also updates the weekly_log row)
//
// Returns: { success, data: { signature_url } }
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

    if (!file) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "No file provided" } },
        { status: 400 }
      );
    }

    // Validate type — bucket allows png/jpeg only.
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "File must be PNG or JPEG" } },
        { status: 400 }
      );
    }

    // Validate size — 1MB cap per bucket policy.
    if (file.size > 1024 * 1024) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "File size must be ≤1MB" } },
        { status: 400 }
      );
    }

    // Verify ownership of the weekly_log.
    const { data: log } = await supabase
      .from("weekly_logs")
      .select("id, student_user_id")
      .eq("id", logId)
      .eq("student_user_id", user.id)
      .maybeSingle();

    if (!log) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "NOT_FOUND", message: "Weekly log not found or not owned by you" } },
        { status: 404 }
      );
    }

    // Upload to `signatures` bucket. Path: <user_id>/<filename>.
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${user.id}/weekly_log_${logId}_${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from("signatures")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[signature upload] storage error:", uploadError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: uploadError.message } },
        { status: 500 }
      );
    }

    // Get the public URL. The bucket is private, but we still expose the
    // path — the URL works for authenticated users with RLS access.
    const { data: urlData } = supabase.storage
      .from("signatures")
      .getPublicUrl(filePath);

    const signatureUrl = urlData?.publicUrl || null;
    if (!signatureUrl) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: "Could not resolve public URL" } },
        { status: 500 }
      );
    }

    // Update the weekly_log row.
    const { error: updateError } = await supabase
      .from("weekly_logs")
      .update({
        student_signature_url: signatureUrl,
        student_signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId)
      .eq("student_user_id", user.id);

    if (updateError) {
      console.error("[signature upload] db update error:", updateError);
      // Non-fatal — file is already in storage; the client can still
      // proceed and the URL can be re-saved on submit.
    }

    return NextResponse.json<ApiResponse<{ signature_url: string }>>({
      success: true,
      data: { signature_url: signatureUrl },
      message: "Signature uploaded.",
    });
  } catch (error: any) {
    console.error("[signature upload] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
