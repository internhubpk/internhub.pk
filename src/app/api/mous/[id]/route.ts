/**
 * PATCH/DELETE /api/mous/[id]
 *
 * Update MOU status (approve/suspend/terminate) or delete.
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
      .select("role, university_id, company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 403 }
      );
    }

    // Only super_admin, university_admin, and company_hr can update MOUs
    if (!["super_admin", "university_admin", "company_hr"].includes(profile.role)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      updateFields.status = body.status;
      // Set status-specific timestamps
      if (body.status === "active") {
        updateFields.approved_at = new Date().toISOString();
        updateFields.approved_by = user.id;
      } else if (body.status === "suspended") {
        updateFields.suspended_at = new Date().toISOString();
      } else if (body.status === "terminated") {
        updateFields.terminated_at = new Date().toISOString();
      }
    }
    if (body.notes !== undefined) updateFields.notes = body.notes;
    if (body.ends_at !== undefined) updateFields.ends_at = body.ends_at;
    if (body.mou_document_url !== undefined) updateFields.mou_document_url = body.mou_document_url;

    // RLS ensures university_admin can only update their own university's MOUs
    const { data: mou, error } = await supabase
      .from("company_university_mous")
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

    return NextResponse.json<ApiResponse<typeof mou>>({
      success: true,
      data: mou,
      message: "MOU updated successfully",
    });
  } catch (err) {
    console.error("[/api/mous PATCH] error:", err);
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
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || !["super_admin", "university_admin"].includes(profile.role)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("company_university_mous")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ ok: true }>>({
      success: true,
      data: { ok: true },
      message: "MOU deleted",
    });
  } catch (err) {
    console.error("[/api/mous DELETE] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
