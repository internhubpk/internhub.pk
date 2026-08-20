/**
 * PATCH/DELETE /api/holidays/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.holiday_date !== undefined) updateFields.holiday_date = body.holiday_date;
    if (body.end_date !== undefined) updateFields.end_date = body.end_date;
    if (body.is_active !== undefined) updateFields.is_active = body.is_active;
    if (body.restrict_submissions !== undefined) updateFields.restrict_submissions = body.restrict_submissions;

    // RLS will ensure university_admin can only update holidays in their own university.
    const { data: holiday, error } = await supabase
      .from("holidays")
      .update(updateFields)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof holiday>>({
      success: true,
      data: holiday,
      message: "Holiday updated successfully",
    });
  } catch (err) {
    console.error("[/api/holidays PATCH] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // RLS will filter to ensure university_admin can only delete their own.
    const { error } = await supabase.from("holidays").delete().eq("id", id);

    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ ok: true }>>({
      success: true,
      data: { ok: true },
      message: "Holiday deleted",
    });
  } catch (err) {
    console.error("[/api/holidays DELETE] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
