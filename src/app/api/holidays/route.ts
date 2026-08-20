/**
 * Holidays API — University Admin management of official holidays.
 *
 * GET    /api/holidays                  — list holidays (university-scoped)
 * POST   /api/holidays                  — create a holiday
 * PATCH  /api/holidays/[id]             — update a holiday
 * DELETE /api/holidays/[id]             — delete a holiday
 *
 * All operations enforce RLS (super_admin sees all, university_admin only own).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

// ----------------------------------------------------------------------------
// GET — list holidays for the caller's university (or all if super_admin)
// ----------------------------------------------------------------------------
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
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 403 }
      );
    }

    // All university-scoped roles can VIEW holidays for their own university.
    // (Students, supervisors, coordinators, admins all need to see holidays.)
    if (!profile.university_id && profile.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "No university assigned" },
        { status: 403 }
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const activeOnly = searchParams.get("active_only") !== "false";

    let query = supabase
      .from("holidays")
      .select("*")
      .order("holiday_date", { ascending: true });

    if (profile.role !== "super_admin") {
      query = query.eq("university_id", profile.university_id);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (fromDate) {
      query = query.gte("holiday_date", fromDate);
    }
    if (toDate) {
      query = query.lte("holiday_date", toDate);
    }

    const { data: holidays, error } = await query;
    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof holidays>>({
      success: true,
      data: holidays || [],
    });
  } catch (err) {
    console.error("[/api/holidays GET] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// POST — create a new holiday (university_admin or super_admin only)
// ----------------------------------------------------------------------------
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
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["super_admin", "university_admin"].includes(profile.role)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: University Admin or Super Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, holiday_date, end_date, restrict_submissions } = body;

    if (!name || !holiday_date) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing required fields: name, holiday_date" },
        { status: 400 }
      );
    }

    // university_admin uses their own university; super_admin must specify it.
    const universityId =
      profile.role === "university_admin"
        ? profile.university_id
        : body.university_id;

    if (!universityId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "university_id is required" },
        { status: 400 }
      );
    }

    const { data: holiday, error } = await supabase
      .from("holidays")
      .insert({
        university_id: universityId,
        name,
        description: description || null,
        holiday_date,
        end_date: end_date || null,
        restrict_submissions: restrict_submissions ?? true,
        is_active: true,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A holiday already exists for this university on this date" },
          { status: 409 }
        );
      }
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof holiday>>({
      success: true,
      data: holiday,
      message: "Holiday created successfully",
    });
  } catch (err) {
    console.error("[/api/holidays POST] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
