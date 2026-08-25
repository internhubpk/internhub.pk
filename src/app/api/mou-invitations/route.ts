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

    // Guard against the service-role client silently falling back to the
    // anon key (see utils/supabase/service-role.ts). If that happens here,
    // RLS hides the invitee's profile (it belongs to a different tenant)
    // and every invite — even for a real, registered account — would
    // incorrectly report "No account found with that email." Fail loudly
    // instead so this misconfiguration is obvious rather than silently
    // masquerading as a user error.
    //
    // The check uses .trim() so a whitespace-only env value is also
    // rejected — the service-role client itself throws on missing/blank
    // keys, but failing here produces a clearer API response than the
    // generic 500 from the throw.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      console.error(
        "[/api/mou-invitations POST] SUPABASE_SERVICE_ROLE_KEY is not set or blank — " +
          "cross-tenant invitee lookups will be blocked by RLS and every " +
          "invite will incorrectly report 'no account found'. Set it in " +
          "the deployment's environment variables."
      );
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Server misconfiguration: service role key is not set. Contact the platform administrator.",
        },
        { status: 500 }
      );
    }

    // ── Validate invitee exists in profiles with correct role ───────
    // Use service-role client to bypass RLS: the invitee belongs to a
    // different tenant (university admin → company HR or vice-versa)
    // so the regular client's RLS would hide their profile.
    const serviceRole = await createServiceRoleClient();

    // Normalize the email: trim + lowercase for matching.
    // Supabase Auth normalizes emails to lowercase on signup, but rows
    // created before that enforcement may have mixed case. We search
    // with multiple strategies for maximum compatibility.
    const normalizedEmail = invitee_email.trim().toLowerCase();
    const escapedEmail = normalizedEmail.replace(/[%_]/g, (m: string) => `\\${m}`);

    // Strategy 1: ilike (case-insensitive) — matches the normalized form
    // and any legacy mixed-case rows.
    let { data: inviteeProfiles, error: inviteeError } = await serviceRole
      .from("profiles")
      .select("user_id, email, role, full_name, company_id, university_id")
      .ilike("email", escapedEmail)
      .limit(1);
    let inviteeProfile = inviteeProfiles?.[0] ?? null;

    // Strategy 2: exact eq on lowercased email — catches edge cases where
    // ilike behaves unexpectedly with certain special characters.
    if (!inviteeProfile && !inviteeError) {
      const eqResult = await serviceRole
        .from("profiles")
        .select("user_id, email, role, full_name, company_id, university_id")
        .eq("email", normalizedEmail)
        .limit(1);
      inviteeProfile = eqResult.data?.[0] ?? null;
    }

    // Strategy 3: search auth.users directly (service-role can access it).
    // This catches the edge case where the profiles row is missing but the
    // auth account exists (e.g. trigger failure on account creation).
    if (!inviteeProfile && !inviteeError) {
      try {
        const { data: authUsers } = await serviceRole.auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });
        const authUser = (authUsers?.users || []).find(
          (u: any) => u.email?.toLowerCase() === normalizedEmail
        );
        if (authUser) {
          // The auth account exists but profiles row is missing — try to
          // ensure the profile exists via the safety-net RPC, then retry.
          try {
            await serviceRole.rpc("ensure_profile_exists", { p_user_id: authUser.id });
          } catch { /* non-fatal */ }
          const retryResult = await serviceRole
            .from("profiles")
            .select("user_id, email, role, full_name, company_id, university_id")
            .eq("user_id", authUser.id)
            .maybeSingle();
          inviteeProfile = retryResult.data ?? null;
        }
      } catch { /* admin.listUsers may fail in some environments — non-fatal */ }
    }

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
              "No account found with that email. Please verify the email is correct and the person has registered with the company_hr role.",
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
              "No account found with that email. Please verify the email is correct and the person has registered with the company_hr role.",
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
    const { data: existingInvitation } = await serviceRole
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
    const { data: existingMou } = await serviceRole
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
