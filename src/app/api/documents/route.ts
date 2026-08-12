import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  DocumentSchema,
  PaginationSchema,
  FilterSchema,
} from "@/lib/validations";
import type {
  ApiResponse,
  PaginatedResponse,
  Document,
  UserRole,
} from "@/types";

// Allowed file types for upload
const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Roles that can view documents
const VIEW_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
];

/**
 * GET /api/documents
 * List documents - filtered by user role
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !VIEW_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    const filterResult = FilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;
    const filters = filterResult.success ? filterResult.data : FilterSchema.parse({});
    const entityType = searchParams.get("entity_type");
    const entityId = searchParams.get("entity_id");
    const documentType = searchParams.get("document_type");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Build query
    let query = supabase
      .from("documents")
      .select("*", { count: "exact" });

    // Apply entity filter
    if (entityType && entityId) {
      query = query.eq("entity_type", entityType).eq("entity_id", entityId);
    }

    // Apply document type filter
    if (documentType) {
      query = query.eq("document_type", documentType);
    }

    // Apply uploaded_by filter
    if (filters.student_id) {
      query = query.eq("uploaded_by", filters.student_id);
    }

    // Role-based filtering
    if (
      ["student", "company_hr"].includes(profile.role!) &&
      !entityId
    ) {
      // Students and company HR can only see their own uploaded documents
      query = query.eq("uploaded_by", user.id);
    }

    // Get total count
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: documents, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching documents:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<Document> = {
      data: documents as Document[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Document>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/documents:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 * Upload document to Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

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

    // Check user role
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      );
    }

    // Validate metadata
    const entityType = formData.get("entity_type") as string;
    const entityId = formData.get("entity_id") as string;
    const documentType = formData.get("document_type") as string;

    const metadataValidation = DocumentSchema.safeParse({
      entity_type: entityType,
      entity_id: entityId,
      document_type: documentType,
    });

    if (!metadataValidation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Invalid document metadata",
          message: metadataValidation.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    // Generate unique file path
    const fileExtension = file.name.split(".").pop() || "";
    const timestamp = Date.now();
    const filePath = `${entityType}/${entityId}/${timestamp}_${file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      
      if (uploadError.message?.includes("already exists")) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "A file with this name already exists" },
          { status: 409 }
        );
      }
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(filePath);

    // Create document record in database
    const { data: document, error: dbError } = await supabase
      .from("documents")
      .insert({
        entity_type: entityType as Document["entity_type"],
        entity_id: entityId,
        document_type: documentType as Document["document_type"],
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
        is_verified: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error creating document record:", dbError);
      
      // Clean up uploaded file if database insert fails
      await supabase.storage.from("documents").remove([filePath]);
      
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create document record" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Document>>({
      success: true,
      data: document as Document,
      message: "Document uploaded successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/documents:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
