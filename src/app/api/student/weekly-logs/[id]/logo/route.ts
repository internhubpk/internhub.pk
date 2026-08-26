import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ============================================================================
// POST /api/student/weekly-logs/[id]/logo
//   Uploads the university logo the student chose for this weekly report.
//   Stored in the public `internship_images` bucket (which already allows
//   image uploads and exposes a public URL).
//
//   Per the user's spec: the template is universal (no IIUI logo baked in).
//   The student uploads their own university's logo per report, which then
//   renders in the report header.
//
// Request: multipart/form-data with `file` (image, ≤5MB)
// Returns: { success, data: { logo_url } }
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

    if (!file.type.startsWith("image/")) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "File must be an image" } },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "File size must be ≤5MB" } },
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

    // Upload to the public `internship_images` bucket. We reuse it because
    // it already allows image uploads of up to 5MB and exposes public URLs.
    // Path: <user_id>/weekly_log_logo_<logId>_<timestamp>.<ext>
    //
    // NOTE: do NOT use `upsert: true` here. The path embeds Date.now(), so
    // every upload targets a fresh object — upsert is unnecessary, and the
    // ON CONFLICT path trips an RLS "new row violates row-level security
    // policy" error on this bucket's storage policies (verified live: the
    // same plain INSERT succeeds while the upsert variant is denied).
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${user.id}/weekly_log_logo_${logId}_${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from("internship_images")
      .upload(filePath, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[logo upload] storage error:", uploadError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: uploadError.message } },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("internship_images")
      .getPublicUrl(filePath);

    const logoUrl = urlData?.publicUrl || null;
    if (!logoUrl) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: { code: "STORAGE_ERROR", message: "Could not resolve public URL" } },
        { status: 500 }
      );
    }

    // Persist the logo URL on the weekly_log row so the Word report
    // generation (assembleWeeklyReportData → universityLogoBuffer) picks it
    // up. Without this update the upload was orphaned — the file sat in
    // storage but the generated .docx fell back to universities.logo_url.
    const { error: updateError } = await supabase
      .from("weekly_logs")
      .update({
        university_logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId)
      .eq("student_user_id", user.id);

    if (updateError) {
      console.error("[logo upload] db update error:", updateError);
      // Non-fatal — file is already in storage; the client can still
      // proceed and the URL can be re-saved on submit.
    }

    return NextResponse.json<ApiResponse<{ logo_url: string }>>({
      success: true,
      data: { logo_url: logoUrl },
      message: "Logo uploaded.",
    });
  } catch (error: any) {
    console.error("[logo upload] unexpected:", error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
