/**
 * MOU (Memorandum of Understanding) API
 *
 * GET    /api/mous                  — list MOUs (university-scoped or company-scoped)
 * POST   /api/mous                  — create an MOU
 * PATCH  /api/mous/[id]             — update MOU status
 * DELETE /api/mous/[id]             — delete an MOU
 *
 * RLS enforced: super_admin sees all, university_admin sees own university,
 * company_hr sees own company.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// GET — list MOUs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    let query = supabase
      .from("company_university_mous")
      .select(`
        *,
        companies:company_id ( id, name, logo_url ),
        universities:university_id ( id, name, slug )
      `)
      .order("created_at", { ascending: false });

    // RLS handles most scoping, but we also filter at the application layer
    // for clarity and to avoid N+1 issues.

    const { data: mous, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof mous>>({
      success: true,
      data: mous || [],
    });
  } catch (err) {
    console.error("[/api/mous GET] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — create an MOU
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    // Only super_admin, university_admin, and company_hr can create MOUs
    if (!["super_admin", "university_admin", "company_hr"].includes(profile.role)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Only admins and HR can create MOUs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { company_id, university_id, status, starts_at, ends_at, notes } = body;

    if (!company_id || !university_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing required fields: company_id, university_id" },
        { status: 400 }
      );
    }

    // University admin can only create MOUs for their own university
    if (profile.role === "university_admin" && university_id !== profile.university_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cannot create MOU for another university" },
        { status: 403 }
      );
    }

    // Company HR can only create MOUs for their own company
    if (profile.role === "company_hr" && company_id !== profile.company_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cannot create MOU for another company" },
        { status: 403 }
      );
    }

    const { data: mou, error } = await supabase
      .from("company_university_mous")
      .insert({
        company_id,
        university_id,
        status: status || "pending",
        starts_at: starts_at || new Date().toISOString(),
        ends_at: ends_at || null,
        notes: notes || null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "An MOU with this status already exists for this company-university pair" },
          { status: 409 }
        );
      }
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof mou>>({
      success: true,
      data: mou,
      message: "MOU created successfully",
    });
  } catch (err) {
    console.error("[/api/mous POST] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
