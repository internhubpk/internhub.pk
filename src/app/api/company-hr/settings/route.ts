import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, company_id, role, full_name, first_name, last_name, email, phone, avatar_url")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      ),
    };
  }
  if (profile.role !== "company_hr") {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      ),
    };
  }
  if (!profile.company_id) {
    return {
      profile: null,
      errorResponse: NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      ),
    };
  }
  return { profile, errorResponse: null };
}

// GET /api/company-hr/settings — fetch company profile + HR user profile
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Company not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        company,
        profile: {
          user_id: profile.user_id,
          full_name: profile.full_name,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
        },
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PUT /api/company-hr/settings — update company profile (and/or HR profile)
// body: {
//   company?: { name, industry, website, size, description, address, city,
//               country, contact_person, contact_email, contact_phone, logo_url },
//   profile?: { first_name, last_name, phone, avatar_url }
// }
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { company: companyUpdates, profile: profileUpdates } = body;

    let updatedCompany: any = null;
    let updatedProfile: any = null;

    if (companyUpdates && typeof companyUpdates === "object") {
      // Allow-list of company fields that can be edited
      const allowedCompanyFields = [
        "name",
        "industry",
        "website",
        "size",
        "description",
        "address",
        "city",
        "country",
        "contact_person",
        "contact_email",
        "contact_phone",
        "logo_url",
      ];
      const companyPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowedCompanyFields) {
        if (k in companyUpdates) companyPayload[k] = companyUpdates[k];
      }
      const { data, error } = await supabase
        .from("companies")
        .update(companyPayload)
        .eq("id", profile.company_id)
        .select()
        .single();
      if (error) {
        console.error("Error updating company:", error);
        return NextResponse.json(
          { error: { code: "DATABASE_ERROR", message: "Failed to update company" } },
          { status: 500 }
        );
      }
      updatedCompany = data;
    }

    if (profileUpdates && typeof profileUpdates === "object") {
      const profilePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("first_name" in profileUpdates) profilePayload.first_name = profileUpdates.first_name;
      if ("last_name" in profileUpdates) profilePayload.last_name = profileUpdates.last_name;
      if ("first_name" in profileUpdates || "last_name" in profileUpdates) {
        profilePayload.full_name = `${profileUpdates.first_name || ""} ${
          profileUpdates.last_name || ""
        }`.trim();
      }
      if ("phone" in profileUpdates) profilePayload.phone = profileUpdates.phone;
      if ("avatar_url" in profileUpdates) profilePayload.avatar_url = profileUpdates.avatar_url;

      const { data, error } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("user_id", user.id)
        .select("user_id, full_name, first_name, last_name, email, phone, avatar_url")
        .single();
      if (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json(
          { error: { code: "DATABASE_ERROR", message: "Failed to update profile" } },
          { status: 500 }
        );
      }
      updatedProfile = data;
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update_company_settings",
      entity_type: "company",
      entity_id: profile.company_id,
      new_values: { company: !!updatedCompany, profile: !!updatedProfile },
    });

    return NextResponse.json({
      success: true,
      data: { company: updatedCompany, profile: updatedProfile },
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// POST /api/company-hr/settings — change HR user's own password
// body: { current_password, new_password }
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { profile, errorResponse } = await getCompanyProfile(supabase, user.id);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "current_password and new_password are required" } },
        { status: 400 }
      );
    }
    if (new_password.length < 8) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "New password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    // Verify the current password by re-signing in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || "",
      password: current_password,
    });
    if (signInError || !signInData.user) {
      return NextResponse.json(
        { error: { code: "INVALID_PASSWORD", message: "Current password is incorrect" } },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: new_password });
    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { error: { code: "AUTH_ERROR", message: updateError.message } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "change_password",
      entity_type: "profile",
      entity_id: user.id,
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
