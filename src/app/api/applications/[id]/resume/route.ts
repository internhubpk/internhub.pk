import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// ============================================================
// GET /api/applications/[id]/resume
// ------------------------------------------------------------
// Returns a short-lived SIGNED URL for the resume file attached to
// an internship application. The `cvs` Supabase Storage bucket is
// PRIVATE — without this endpoint, the HR dashboard's
// `<a href={resume_url}>` link would either 404 (path is not a URL)
// or fail with permission denied (bucket is not public).
//
// Authorization (server-side, RLS-enforced):
//   - The application's student (owner of the CV) — always allowed.
//   - The company HR of the internship's company — allowed (the
//     `cvs_read` storage RLS policy verifies the HR's company_id
//     matches an internship_application row for the CV owner).
//   - super_admin — always allowed.
//   - The assigned faculty_supervisor or site_supervisor for the
//     student — allowed by the `cvs_read` storage RLS policy.
//
// The signed URL expires after 60 seconds — long enough for the
// browser to follow the redirect, short enough to prevent link
// sharing. The HR dashboard uses this endpoint as the `href` of the
// "Resume" download button, so the redirect happens transparently
// when the user clicks it.
//
// `resume_url` stored in the DB can be either:
//   1. A bare storage PATH inside the `cvs` bucket
//      (e.g. `<user_id>/1234567890-resume.pdf`) — the new format
//      written by the marketplace apply modal after this fix.
//   2. A full https URL (legacy / externally hosted) — passed through
//      unchanged.
// ============================================================

const RESUME_BUCKET = "cvs";
const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Authenticate the requester. Unlike /api/notifications/inbox
    // (which returns 200 on unauth to avoid console-spam from polling),
    // this endpoint SHOULD return 401 when unauthenticated — it is
    // only ever fetched on a user click, not polled, so a 401 is the
    // correct signal that the user needs to sign in.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: applicationId } = await params;
    if (!applicationId) {
      return NextResponse.json(
        { error: "Application id is required" },
        { status: 400 }
      );
    }

    // Fetch the application row. RLS will automatically restrict this
    // to rows the requester is allowed to see (the student themselves,
    // the company HR, assigned supervisors, super_admin).
    const { data: application, error: appError } = await supabase
      .from("internship_applications")
      .select("id, student_user_id, company_id, resume_url")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError) {
      console.error("[/api/applications/[id]/resume] fetch error:", appError);
      return NextResponse.json(
        { error: "Failed to load application" },
        { status: 500 }
      );
    }
    if (!application) {
      return NextResponse.json(
        { error: "Application not found (or you don't have access)" },
        { status: 404 }
      );
    }

    const resumeUrl = application.resume_url;
    if (!resumeUrl) {
      return NextResponse.json(
        { error: "No resume attached to this application" },
        { status: 404 }
      );
    }

    // Case 1: legacy / external URL — pass through unchanged.
    if (/^https?:\/\//i.test(resumeUrl)) {
      return NextResponse.redirect(resumeUrl, { status: 302 });
    }

    // Case 2: bare storage path inside the `cvs` bucket. Generate a
    // short-lived signed URL. The storage RLS policies enforce
    // authorization at the bucket level — `createSignedUrl` returns a
    // URL that works only for users who pass the `cvs_read` policy.
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from(RESUME_BUCKET)
      .createSignedUrl(resumeUrl, SIGNED_URL_TTL_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(
        "[/api/applications/[id]/resume] signed URL error:",
        signedUrlError
      );
      return NextResponse.json(
        {
          error:
            signedUrlError?.message ||
            "Failed to generate resume URL. You may not have access to this file.",
        },
        { status: 403 }
      );
    }

    // 302 redirect to the signed URL — the browser follows it
    // transparently when the user clicks the "Resume" link in the HR
    // dashboard.
    return NextResponse.redirect(signedUrlData.signedUrl, { status: 302 });
  } catch (err) {
    console.error("[/api/applications/[id]/resume] unhandled:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
