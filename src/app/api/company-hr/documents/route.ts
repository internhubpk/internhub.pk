import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// GET: List documents
// POST: Upload document (letter, certificate)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Get user profile with company_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      );
    }

    if (profile.role !== "company_hr") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      );
    }

    if (!profile.company_id) {
      return NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get("type"); // offer_letter, certificate
    const internId = searchParams.get("intern_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query - get documents for company's interns
    let query = supabase
      .from("documents")
      .select("*", { count: "exact" })
      .eq("entity_type", "student") // Intern documents are linked to students
      .in("type", ["offer_letter", "certificate", "other"])
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (documentType && documentType !== "all") {
      query = query.eq("type", documentType);
    }

    if (internId) {
      query = query.eq("entity_id", internId);
    }

    const { data: documents, count, error } = await query;

    if (error) {
      console.error("Error fetching documents:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch documents" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: documents || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Get user profile with company_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } },
        { status: 404 }
      );
    }

    if (profile.role !== "company_hr") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied. Company HR role required." } },
        { status: 403 }
      );
    }

    if (!profile.company_id) {
      return NextResponse.json(
        { error: { code: "NO_COMPANY", message: "No company associated with this account" } },
        { status: 400 }
      );
    }

    // Check for file upload in form data
    const contentType = request.headers.get("content-type") || "";
    
    let documentData;
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData();
      file = formData.get("file") as File | null;
      
      documentData = {
        intern_id: formData.get("intern_id") as string,
        type: formData.get("type") as "offer_letter" | "certificate",
        name: formData.get("name") as string,
      };
    } else {
      // Handle JSON body (for template-based generation)
      documentData = await request.json();
    }

    const { intern_id, type, name } = documentData;

    // Validate required fields
    if (!intern_id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Intern ID is required" } },
        { status: 400 }
      );
    }

    if (!type || !["offer_letter", "certificate"].includes(type)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Document type must be 'offer_letter' or 'certificate'" } },
        { status: 400 }
      );
    }

    // Verify intern belongs to company's program
    const { data: internApplication, error: appError } = await supabase
      .from("applications")
      .select(`
        student_id,
        internship_id,
        internships!inner (
          id,
          company_id,
          title
        ),
        profiles:student_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq("student_id", intern_id)
      .eq("status", "accepted")
      .eq("internships.company_id", profile.company_id)
      .single();

    if (appError || !internApplication) {
      return NextResponse.json(
        { error: { code: "INTERN_NOT_FOUND", message: "Intern not found or does not belong to your company's programs" } },
        { status: 404 }
      );
    }

    let fileUrl: string | null = null;
    let fileSize: number = 0;
    let fileName: string = name || `${type}_${internApplication.profiles?.first_name}_${internApplication.profiles?.last_name}.pdf`;

    if (file) {
      // Upload file to storage
      const fileExt = file.name.split(".").pop() || "pdf";
      const filePath = `${profile.company_id}/${intern_id}/${type}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        return NextResponse.json(
          { error: { code: "UPLOAD_ERROR", message: "Failed to upload file" } },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      fileUrl = urlData.publicUrl;
      fileSize = file.size;
      fileName = file.name;
    } else {
      // Generate document from template (placeholder logic)
      // In production, this would use a PDF generation library
      const generatedPath = `generated/${profile.company_id}/${intern_id}/${type}_${Date.now()}.pdf`;
      fileUrl = `/api/documents/download?path=${generatedPath}`;
      fileSize = 50000; // Approximate size for generated PDF
    }

    // Create document record
    const { data: document, error: insertError } = await supabase
      .from("documents")
      .insert({
        name: fileName,
        type,
        url: fileUrl,
        size: fileSize,
        mime_type: file?.type || "application/pdf",
        uploaded_by: user.id,
        entity_type: "student",
        entity_id: intern_id,
        status: "verified", // Company HR uploads are auto-verified
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating document record:", insertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to save document record" } },
        { status: 500 }
      );
    }

    // Log audit action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `upload_${type}`,
      entity_type: "document",
      entity_id: document.id,
      new_values: {
        document_id: document.id,
        intern_id,
        type,
        file_name: fileName,
      },
    });

    return NextResponse.json({
      success: true,
      data: document,
      message: `${type === "offer_letter" ? "Offer letter" : "Certificate"} ${file ? "uploaded" : "generated"} successfully`,
    }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
