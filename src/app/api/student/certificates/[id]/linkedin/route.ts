import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * /api/student/certificates/[id]/linkedin
 *
 * POST — marks the certificate as "added to LinkedIn" by setting
 *        linkedin_added_at = now(). Called when the student clicks the
 *        "Add to LinkedIn" button and is redirected to LinkedIn.
 *
 *        Body: { } (no parameters)
 *
 *        This is purely a tracking signal — we don't actually verify
 *        that the student completed the LinkedIn flow (LinkedIn doesn't
 *        send a callback). We just record that they clicked through.
 *
 *        The timestamp is shown on the student's certificate card as
 *        "Added to LinkedIn on <date>" and on the company HR dashboard
 *        so they can see how many students are actually using the
 *        certificates they issue.
 *
 * PATCH — same as POST (alias for convenience).
 */

async function markLinkedInAdded(certId: string, userId: string) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
  }

  // Verify the certificate belongs to this student.
  const { data: cert, error: certErr } = await supabase
    .from("certificates")
    .select("id, student_user_id, status, verification_code, verification_url, certificate_number, title, linkedin_added_at")
    .eq("id", certId)
    .maybeSingle();

  if (certErr) {
    console.error("[/api/student/certificates/[id]/linkedin] fetch error:", certErr);
    return NextResponse.json(
      { success: false, error: `Lookup failed: ${certErr.message}` },
      { status: 500 }
    );
  }
  if (!cert) {
    return NextResponse.json(
      { success: false, error: "Certificate not found" },
      { status: 404 }
    );
  }
  if (cert.student_user_id !== userId) {
    return NextResponse.json(
      { success: false, error: "You can only mark your own certificates" },
      { status: 403 }
    );
  }
  if (cert.status !== "issued") {
    return NextResponse.json(
      { success: false, error: `Cannot add a ${cert.status} certificate to LinkedIn` },
      { status: 400 }
    );
  }

  // Idempotent: if already marked, return the existing timestamp.
  if (cert.linkedin_added_at) {
    return NextResponse.json({
      success: true,
      data: {
        linkedin_added_at: cert.linkedin_added_at,
        already_marked: true,
      },
      message: "Certificate was already marked as added to LinkedIn",
    });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("certificates")
    .update({ linkedin_added_at: now, updated_at: now })
    .eq("id", certId);

  if (updErr) {
    console.error("[/api/student/certificates/[id]/linkedin] update error:", updErr);
    return NextResponse.json(
      { success: false, error: `Failed to update: ${updErr.message}` },
      { status: 500 }
    );
  }

  // Audit log (best-effort).
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "add_certificate_to_linkedin",
    entity_type: "certificate",
    entity_id: certId,
    new_values: { linkedin_added_at: now, certificate_number: cert.certificate_number },
  });

  return NextResponse.json({
    success: true,
    data: { linkedin_added_at: now, already_marked: false },
    message: "Certificate marked as added to LinkedIn",
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    return await markLinkedInAdded(id, user.id);
  } catch (err) {
    console.error("[/api/student/certificates/[id]/linkedin] POST unhandled:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    return await markLinkedInAdded(id, user.id);
  } catch (err) {
    console.error("[/api/student/certificates/[id]/linkedin] PATCH unhandled:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
