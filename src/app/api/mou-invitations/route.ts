/**
 * MoU Invitations API
 *
 * GET    /api/mou-invitations          — list invitations visible to current user
 * POST   /api/mou-invitations          — create a new invitation
 *
 * Bidirectional flow:
 *   - University Admin invites Company HR by email → finds company from invitee profile
 *   - Company HR invites University Admin by email → finds university from invitee profile
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import type { ApiResponse } from "@/types";

// ── GET — list invitations ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
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

    // RLS handles visibility. We query all and let RLS filter.
    const query = supabase
      .from("mou_invitations")
      .select(
        `
        *,
        inviter:profiles!mou_invitations_inviter_user_id_fkey ( user_id, email, full_name, role, company_id, university_id ),
        companies ( id, name, logo_url ),
        universities ( id, name, slug )
      `
      )
      .order("created_at", { ascending: false });

    const { data: invitations, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof invitations>>({
      success: true,
      data: invitations || [],
    });
  } catch (err) {
    console.error("[/api/mou-invitations GET] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── POST — create invitation ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
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
      .select("role, university_id, company_id, email, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 403 }
      );
    }

    // Only university_admin, company_hr, and super_admin can create invitations
    if (
      !["super_admin", "university_admin", "company_hr"].includes(
        profile.role
      )
    ) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Forbidden: Only admins and HR can create MoU invitations",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { invitee_email, company_id, university_id, notes } = body;

    if (!invitee_email) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing required field: invitee_email" },
        { status: 400 }
      );
    }

    // ── Validate invitee exists in profiles with correct role ───────
    // Use service-role client to bypass RLS: the invitee belongs to a
    // different tenant (university admin → company HR or vice-versa)
    // so the regular client's RLS would hide their profile.
    const serviceRole = await createServiceRoleClient();
    const { data: inviteeProfile, error: inviteeError } = await serviceRole
      .from("profiles")
      .select("user_id, email, role, full_name, company_id, university_id")
      .eq("email", invitee_email.trim().toLowerCase())
      .maybeSingle();

    if (inviteeError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: inviteeError.message },
        { status: 500 }
      );
    }

    let targetCompanyId = company_id;
    let targetUniversityId = university_id;

    if (profile.role === "university_admin") {
      // University admin inviting a company HR
      if (!inviteeProfile) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "No account found with that email. The person must register first.",
          },
          { status: 404 }
        );
      }
      if (inviteeProfile.role !== "company_hr") {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "The email belongs to a " +
              inviteeProfile.role +
              ", not a company_hr. You can only invite company HR personnel.",
          },
          { status: 400 }
        );
      }
      if (!inviteeProfile.company_id) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "The invited user does not have a company assigned. Please contact support.",
          },
          { status: 400 }
        );
      }
      targetCompanyId = inviteeProfile.company_id;
      targetUniversityId = profile.university_id;

      if (!targetUniversityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Your profile does not have a university assigned." },
          { status: 400 }
        );
      }
    } else if (profile.role === "company_hr") {
      // Company HR inviting a university admin
      if (!inviteeProfile) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "No account found with that email. The person must register first.",
          },
          { status: 404 }
        );
      }
      if (inviteeProfile.role !== "university_admin") {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "The email belongs to a " +
              inviteeProfile.role +
              ", not a university_admin. You can only invite university admins.",
          },
          { status: 400 }
        );
      }
      if (!inviteeProfile.university_id) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "The invited user does not have a university assigned. Please contact support.",
          },
          { status: 400 }
        );
      }
      targetCompanyId = profile.company_id;
      targetUniversityId = inviteeProfile.university_id;

      if (!targetCompanyId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Your profile does not have a company assigned." },
          { status: 400 }
        );
      }
    } else if (profile.role === "super_admin") {
      // Super admin must provide both IDs explicitly
      if (!company_id || !university_id) {
        return NextResponse.json<ApiResponse<never>>(
          {
            success: false,
            error:
              "Super admin must provide company_id and university_id.",
          },
          { status: 400 }
        );
      }
      targetCompanyId = company_id;
      targetUniversityId = university_id;
    }

    // ── Check for duplicate pending invitation ─────────────────────
    const { data: existingInvitation } = await supabase
      .from("mou_invitations")
      .select("id")
      .eq("company_id", targetCompanyId!)
      .eq("university_id", targetUniversityId!)
      .eq("invitee_email", invitee_email.trim().toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "A pending invitation already exists for this company-university pair.",
        },
        { status: 409 }
      );
    }

    // ── Check if an active MOU already exists ───────────────────────
    const { data: existingMou } = await supabase
      .from("company_university_mous")
      .select("id, status")
      .eq("company_id", targetCompanyId!)
      .eq("university_id", targetUniversityId!)
      .in("status", ["pending", "approved", "active"])
      .maybeSingle();

    if (existingMou) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "An MOU already exists (status: " +
            existingMou.status +
            ") for this company-university pair.",
        },
        { status: 409 }
      );
    }

    // ── Create the invitation ──────────────────────────────────────
    const { data: invitation, error: insertError } = await supabase
      .from("mou_invitations")
      .insert({
        inviter_user_id: user.id,
        company_id: targetCompanyId!,
        university_id: targetUniversityId!,
        invitee_email: invitee_email.trim().toLowerCase(),
        notes: notes || null,
      })
      .select(
        `
        *,
        inviter:profiles!mou_invitations_inviter_user_id_fkey ( user_id, email, full_name, role, company_id, university_id ),
        companies ( id, name, logo_url ),
        universities ( id, name, slug )
      `
      )
      .single();

    if (insertError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof invitation>>({
      success: true,
      data: invitation,
      message: "Invitation sent successfully",
    });
  } catch (err) {
    console.error("[/api/mou-invitations POST] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
