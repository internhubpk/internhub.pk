/**
 * PATCH/DELETE /api/mou-invitations/[id]
 *
 * PATCH  — accept or reject an invitation (invitee only)
 * DELETE — revoke an invitation (inviter or super_admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ── PATCH — accept / reject ────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id, company_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 403 }
      );
    }

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await supabase
      .from("mou_invitations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !invitation) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !["accepted", "rejected"].includes(status)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid status. Must be 'accepted' or 'rejected'." },
        { status: 400 }
      );
    }

    // ── Only the invitee (matched by email) can accept/reject ───────
    if (profile.email.toLowerCase() !== invitation.invitee_email.toLowerCase()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Only the invited user can respond to this invitation." },
        { status: 403 }
      );
    }

    // ── Prevent double-responding ───────────────────────────────────
    if (invitation.status !== "pending") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This invitation has already been " + invitation.status + "." },
        { status: 409 }
      );
    }

    // ── Prevent accepting expired invitations ───────────────────────
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // Mark as expired first
      await supabase
        .from("mou_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", id);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "This invitation has expired." },
        { status: 410 }
      );
    }

    // ── Build update payload ───────────────────────────────────────
    const updateFields: Record<string, unknown> = {
      status,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // ── On accept: create the MOU and link it ───────────────────────
    let mouId = invitation.mou_id;
    if (status === "accepted") {
      const { data: newMou, error: mouError } = await supabase
        .from("company_university_mous")
        .insert({
          company_id: invitation.company_id,
          university_id: invitation.university_id,
          status: "active",
          starts_at: new Date().toISOString(),
          notes: invitation.notes
            ? "Created from MoU invitation. " + invitation.notes
            : "Created from MoU invitation.",
          created_by: invitation.inviter_user_id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (mouError) {
        // Unique constraint violation means MOU already exists
        if (mouError.code === "23505") {
          return NextResponse.json<ApiResponse<never>>(
            {
              success: false,
              error:
                "An MOU already exists for this company-university pair. The invitation cannot be accepted.",
            },
            { status: 409 }
          );
        }
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Failed to create MOU: " + mouError.message },
          { status: 500 }
        );
      }

      mouId = newMou.id;
      updateFields.mou_id = mouId;
    }

    // ── Update the invitation ───────────────────────────────────────
    const { data: updatedInvitation, error: updateError } = await supabase
      .from("mou_invitations")
      .update(updateFields)
      .eq("id", id)
      .select(
        `
        *,
        inviter:profiles!mou_invitations_inviter_user_id_fkey ( user_id, email, full_name, role, company_id, university_id ),
        companies ( id, name, logo_url ),
        universities ( id, name, slug )
      `
      )
      .single();

    if (updateError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof updatedInvitation>>({
      success: true,
      data: updatedInvitation,
      message: status === "accepted" ? "Invitation accepted. MOU created." : "Invitation rejected.",
    });
  } catch (err) {
    console.error("[/api/mou-invitations PATCH] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── DELETE — revoke ────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id, company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 403 }
      );
    }

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await supabase
      .from("mou_invitations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !invitation) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Only the inviter or super_admin can revoke
    if (profile.role !== "super_admin" && invitation.inviter_user_id !== user.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Only the inviter or a super admin can revoke this invitation." },
        { status: 403 }
      );
    }

    // Only pending invitations can be revoked
    if (invitation.status !== "pending") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cannot revoke an invitation that has already been " + invitation.status + "." },
        { status: 409 }
      );
    }

    // Mark as revoked (soft delete)
    const { error: updateError } = await supabase
      .from("mou_invitations")
      .update({
        status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ ok: true }>>({
      success: true,
      data: { ok: true },
      message: "Invitation revoked",
    });
  } catch (err) {
    console.error("[/api/mou-invitations DELETE] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
