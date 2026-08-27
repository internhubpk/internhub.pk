import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

async function getCompanyProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
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

// PUT /api/company-hr/documents/[id] — rename / re-type a document
// body: { name?, type?, status? }
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
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
    const { name, type, status } = body;

    if (name === undefined && type === undefined && status === undefined) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Provide name, type or status to update" } },
        { status: 400 }
      );
    }
    if (name !== undefined && (typeof name !== "string" || name.trim().length < 1)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Name cannot be empty" } },
        { status: 400 }
      );
    }

    // Look up the document and verify company scope (same as DELETE).
    const { data: doc } = await supabase
      .from("documents")
      .select("id, entity_id, entity_type, name, type, status")
      .eq("id", id)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found" } },
        { status: 404 }
      );
    }
    if (doc.entity_type !== "student" || !doc.entity_id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Document is not linked to a student" } },
        { status: 403 }
      );
    }

    const { data: si } = await supabase
      .from("student_internships")
      .select("id")
      .eq("student_user_id", doc.entity_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!si) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Document does not belong to your company" } },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (status !== undefined) updates.status = status;

    const { data: updated, error: updateError } = await supabase
      .from("documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating document:", updateError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update document" } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "company_hr.update_document",
      entity_type: "document",
      entity_id: id,
      new_values: updates,
    });

    return NextResponse.json({ success: true, data: updated, message: "Document updated" });
  } catch (error) {
    console.error("Unexpected error in PUT document:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// DELETE /api/company-hr/documents/[id] — remove a document
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server unavailable" }, { status: 500 });
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

    // Look up the document and the student it belongs to, then verify the
    // student is part of one of this company's student_internships rows.
    const { data: doc } = await supabase
      .from("documents")
      .select("id, entity_id, entity_type, url, type")
      .eq("id", id)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found" } },
        { status: 404 }
      );
    }
    if (doc.entity_type !== "student" || !doc.entity_id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Document is not linked to a student" } },
        { status: 403 }
      );
    }

    // Verify the student belongs to this company
    const { data: si } = await supabase
      .from("student_internships")
      .select("id")
      .eq("student_user_id", doc.entity_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!si) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Document does not belong to your company" } },
        { status: 403 }
      );
    }

    // Delete the file from storage if it was uploaded there
    try {
      const url = doc.url || "";
      if (url.includes("supabase.co/storage/v1/object/")) {
        // Best-effort extract path — won't throw on failure
        const m = url.match(/\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/);
        if (m) {
          const bucket = m[1];
          const path = m[2];
          await supabase.storage.from(bucket).remove([path]);
        }
      }
    } catch (e) {
      // ignore — DB delete is the source of truth
    }

    const { error: deleteError } = await supabase.from("documents").delete().eq("id", id);
    if (deleteError) {
      console.error("Error deleting document:", deleteError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to delete document" } },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `delete_${doc.type || "document"}`,
      entity_type: "document",
      entity_id: id,
    });

    return NextResponse.json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
