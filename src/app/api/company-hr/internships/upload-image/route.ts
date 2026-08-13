import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// ============================================================================
// POST /api/company-hr/internships/upload-image
// ----------------------------------------------------------------------------
// Multipart upload endpoint for an internship cover/banner image.
//
// Form fields:
//   - file:          File (required) — image/png, image/jpeg, image/webp, image/gif
//                    Max 5 MB (enforced by bucket config; we also pre-check here).
//   - internship_id: string (optional) — when editing an existing internship,
//                    the file is stored under that internship's prefix. When
//                    creating a new internship (no id yet), the file is stored
//                    under a `drafts/` prefix; the URL is just a string on the
//                    internships.image_url column so the drafts/ path is harmless.
//
// Returns:
//   { success: true, data: { url, path } } — url is the public Supabase Storage
//   URL to persist on internships.image_url. path is the storage object path
//   (useful if we later want to delete/replace the file).
//
// Auth: requires authenticated company_hr with an active company_id. The
// storage bucket `internship_images` is PUBLIC (anyone can read), but writes
// are RLS-scoped to company_hr (own company_id prefix only) or super_admin.
// ============================================================================

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — matches bucket file_size_limit

// Sanitize an arbitrary filename down to a safe storage object name component.
// Strips path separators, collapses whitespace, lowercases extension.
function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return base.length > 80 ? base.slice(-80) : base;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // ----- Auth: must be company_hr with a company_id -----
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      );
    }

    if (profile.role !== "company_hr" && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      );
    }

    // super_admin has no company_id; for super_admin we use a special "_admin"
    // prefix so the RLS policy on the bucket won't block the write (super_admin
    // is allowed to write anywhere on internship_images). company_hr must have
    // a company_id and will be scoped to that prefix.
    const companyPrefix = profile.company_id || "_admin";
    if (!profile.company_id && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      );
    }

    // ----- Parse multipart form -----
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Expected multipart/form-data" } },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const internshipId = (formData.get("internship_id") as string | null) || "";

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No file provided (field name must be 'file')" } },
        { status: 400 }
      );
    }

    // ----- Validate MIME + size -----
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 5 MB.`,
          },
        },
        { status: 400 }
      );
    }

    // ----- Build storage path -----
    // Path convention: <company_id>/<internship_id_or_drafts>/<timestamp>_<sanitized>
    // The timestamp prefix prevents filename collisions when HR uploads the
    // same filename twice and ensures the path is unique even across re-uploads.
    const safeInternshipSegment = internshipId
      ? internshipId.replace(/[^a-zA-Z0-9_-]/g, "")
      : "drafts";
    const ts = Date.now();
    const safeName = sanitizeFilename(file.name) || `upload_${ts}`;
    const extension = safeName.includes(".") ? safeName.split(".").pop() : "bin";
    const basePath = `${companyPrefix}/${safeInternshipSegment}`;
    const objectPath = `${basePath}/${ts}_${safeName}`;

    // ----- Upload to Supabase Storage -----
    // The bucket is PUBLIC, so we can use the standard upload + getPublicUrl
    // flow — no signed URLs needed for reads.
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("internship_images")
      .upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false, // never overwrite — timestamps make collisions impossible
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Error uploading internship image:", uploadError);
      return NextResponse.json(
        { error: { code: "UPLOAD_ERROR", message: uploadError.message || "Failed to upload image" } },
        { status: 500 }
      );
    }

    // ----- Resolve public URL -----
    const { data: urlData } = supabase.storage
      .from("internship_images")
      .getPublicUrl(objectPath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      // Defensive: upload succeeded but URL resolution failed — clean up the orphan.
      await supabase.storage.from("internship_images").remove([objectPath]);
      return NextResponse.json(
        { error: { code: "UPLOAD_ERROR", message: "Failed to resolve public URL for uploaded image" } },
        { status: 500 }
      );
    }

    // ----- Audit log -----
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "upload_internship_image",
      entity_type: "internship",
      entity_id: internshipId || null,
      new_values: {
        path: objectPath,
        url: publicUrl,
        size: file.size,
        mime_type: file.type,
        bucket: "internship_images",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          url: publicUrl,
          path: objectPath,
          size: file.size,
          mime_type: file.type,
        },
        message: "Image uploaded successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in upload-image:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
