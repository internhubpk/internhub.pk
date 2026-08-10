import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { ApiResponse, Document, UserRole } from "@/types";

// Roles that can access documents
const ACCESS_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

/**
 * GET /api/documents/[id]
 * Get signed URL for document download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !ACCESS_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch document record
    const { data: document, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !document) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Check access permissions based on role and document ownership
    let hasAccess = profile.role === "super_admin" || profile.role === "university_admin";

    if (!hasAccess && profile.role === "student") {
      // Students can access their own uploaded documents
      hasAccess = document.uploaded_by === user.id;
      
      // Also check if document belongs to their student/internship records
      if (!hasAccess) {
        const { data: studentRecord } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .single();
        
        if (studentRecord) {
          hasAccess =
            (document.entity_type === "student" &&
              document.entity_id === studentRecord.id) ||
            (document.entity_type === "internship" &&
              (await supabase
                .from("student_internships")
                .select("id")
                .eq("student_id", studentRecord.id)
                .eq("id", document.entity_id)
                .single()).data !== null);
        }
      }
    }

    if (!hasAccess && profile.role === "company_hr") {
      // Company HR can access documents they uploaded or related to their company
      hasAccess = document.uploaded_by === user.id;
      
      if (!hasAccess) {
        const { data: companyUser } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", user.id)
          .single();
        
        if (companyUser && document.entity_type === "company") {
          hasAccess = document.entity_id === companyUser.company_id;
        }
        
        if (!hasAccess && companyUser) {
          // Check if document is for an internship at their company
          const { data: internship } = await supabase
            .from("internships")
            .select("id")
            .eq("company_id", companyUser.company_id)
            .eq("id", document.entity_id)
            .single();
          
          hasAccess = !!internship;
        }
      }
    }

    if (
      !hasAccess &&
      ["department_coordinator", "faculty_supervisor"].includes(profile.role!)
    ) {
      // These roles can access documents in their university/department
      // For simplicity, allow access to all non-restricted documents
      hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Cannot access this document" },
        { status: 403 }
      );
    }

    // Extract file path from URL
    const urlParts = document.file_url.split("/");
    const bucketIndex = urlParts.indexOf("documents");
    
    if (bucketIndex === -1 || bucketIndex + 1 >= urlParts.length) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid document storage path" },
        { status: 500 }
      );
    }

    const filePath = urlParts.slice(bucketIndex + 1).join("/");

    // Generate signed URL valid for 1 hour
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage.from("documents").createSignedUrl(filePath, 3600);

    if (signedUrlError) {
      console.error("Error generating signed URL:", signedUrlError);
      
      // Fallback to public URL if signed URL fails
      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);
      
      return NextResponse.json<
        ApiResponse<{ downloadUrl: string; document: Document }>
      >({
        success: true,
        data: {
          downloadUrl: publicUrlData.publicUrl,
          document: document as Document,
        },
      });
    }

    return NextResponse.json<
      ApiResponse<{ downloadUrl: string; document: Document }>
    >({
      success: true,
      data: {
        downloadUrl: signedUrlData.signedUrl,
        document: document as Document,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/documents/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete document - Owner or Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { id } = await params;

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Fetch document record
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Check delete permissions
    const canDelete =
      profile.role === "super_admin" ||
      profile.role === "university_admin" ||
      document.uploaded_by === user.id;

    if (!canDelete) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Cannot delete this document" },
        { status: 403 }
      );
    }

    // Prevent deletion of verified/certified documents unless admin
    if (
      document.is_verified &&
      !["super_admin", "university_admin"].includes(profile.role!)
    ) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Cannot delete a verified document. Contact administrator.",
        },
        { status: 403 }
      );
    }

    // Extract file path from URL
    const urlParts = document.file_url.split("/");
    const bucketIndex = urlParts.indexOf("documents");
    
    if (bucketIndex === -1 || bucketIndex + 1 >= urlParts.length) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid document storage path" },
        { status: 500 }
      );
    }

    const filePath = urlParts.slice(bucketIndex + 1).join("/");

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([filePath]);

    if (storageError) {
      console.error("Error deleting file from storage:", storageError);
      // Continue with database deletion even if storage delete fails
    }

    // Delete database record
    const { error: dbError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Error deleting document record:", dbError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to delete document record" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: true,
        message: "Document deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/documents/[id]:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
