import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ============================================================================
// POST /api/student/weekly-logs/[id]/evidence
//   Uploads one supporting-evidence file (attendance record, screenshots,
//   code commits, design docs, photos, certificates, etc.) to the `documents`
//   bucket. Returns the file metadata so the client can append it to the
//   weekly_log.supporting_evidence jsonb array on submit.
//
//   The `documents` bucket allows pdf/png/jpeg/txt/docx/xlsx up to 10MB.
//
// Request: multipart/form-data with `file`
// Returns: { success, data: { name, url, size, type } }
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

    // Allowed types per documents bucket policy.
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.ms-excel",
    ];
    if (!allowed.includes(file.type) && !file.type.startsWith("image/")) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: `File type ${file.type} not allowed` } },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "File size must be ≤10MB" } },
        { status: 400 }
      );
    }

    // Verify ownership.
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

    // Upload to `documents` bucket. Path: <user_id>/weekly_evidence_<logId>_<timestamp>_<filename>
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
    const filePath = `${user.id}/weekly_evidence_${logId}_${Date.now()}_${safeName}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[evidence upload] storage error:", uploadError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: uploadError.message } },
        { status: 500 }
      );
    }

    // The `documents` bucket is private — generate a signed URL (7-day TTL)
    // so the returned URL is fetchable by the client without a storage
    // session. (`getPublicUrl` would return a URL that 400s on a private
    // bucket.)
    const { data: urlData, error: signedUrlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    if (signedUrlError || !urlData?.signedUrl) {
      console.error("[evidence upload] signed URL error:", signedUrlError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: "Failed to create signed URL" } },
        { status: 500 }
      );
    }

    const evidenceItem = {
      name: file.name,
      url: urlData.signedUrl,
      size: file.size,
      type: file.type,
      uploaded_at: new Date().toISOString(),
    };

    // Append the file metadata to weekly_logs.supporting_evidence (jsonb
    // array) so the Word report generation (assembleWeeklyReportData →
    // supportingEvidence summary) includes it. Without this the upload was
    // orphaned — the file sat in storage but never reached the .docx.
    const { data: currentLog } = await supabase
      .from("weekly_logs")
      .select("supporting_evidence")
      .eq("id", logId)
      .eq("student_user_id", user.id)
      .single();

    const existing: unknown[] = Array.isArray(
      (currentLog as any)?.supporting_evidence
    )
      ? (currentLog as any).supporting_evidence
      : [];

    const { error: updateError } = await supabase
      .from("weekly_logs")
      .update({
        supporting_evidence: [...existing, evidenceItem],
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId)
      .eq("student_user_id", user.id);

    if (updateError) {
      console.error("[evidence upload] db update error:", updateError);
      // Non-fatal — file is already in storage; return metadata anyway.
    }

    return NextResponse.json<ApiResponse<{ name: string; url: string; size: number; type: string }>>({
      success: true,
      data: {
        name: evidenceItem.name,
        url: evidenceItem.url,
        size: evidenceItem.size,
        type: evidenceItem.type,
      },
      message: "Evidence file uploaded.",
    });
  } catch (error: any) {
    console.error("[evidence upload] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
