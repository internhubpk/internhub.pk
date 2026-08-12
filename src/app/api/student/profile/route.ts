import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/student/profile - Get student profile
// PUT /api/student/profile - Update student profile
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Get full profile with related data
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(`
        *,
        departments:department_id (
          id,
          name,
          code
        ),
        universities:university_id (
          id,
          name,
          slug
        )
      `)
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    if (!profile) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Profile not found" } },
        { status: 404 }
      );
    }

    // Get CV/resume document info
    const { data: cvDocument } = await supabase
      .from("documents")
      .select("id, name, url, size, created_at")
      .eq("uploaded_by", user.id)
      .eq("type", "resume")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        cv: cvDocument || null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to fetch profile",
          details: process.env.NODE_ENV === "development" ? error.message : undefined 
        } 
      },
      { status: 500 }
    );
  }
}

// PUT - Update student profile
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      first_name,
      last_name,
      phone,
      bio,
      major,
      gpa,
      graduation_year,
      skills,
      linkedin,
      github,
      website,
      avatar_url,
    } = body;

    // Build update data - only include provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Only add fields that are actually provided
    if (first_name !== undefined) updateData.first_name = first_name.trim();
    if (last_name !== undefined) updateData.last_name = last_name.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (bio !== undefined) updateData.bio = bio?.trim() || null;
    if (major !== undefined) updateData.major = major?.trim() || null;
    if (gpa !== undefined) updateData.gpa = parseFloat(gpa) || null;
    if (graduation_year !== undefined) updateData.graduation_year = parseInt(graduation_year) || null;
    if (skills !== undefined) updateData.skills = Array.isArray(skills) ? skills : [];
    if (linkedin !== undefined) updateData.linkedin = linkedin?.trim() || null;
    if (github !== undefined) updateData.github = github?.trim() || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url?.trim() || null;

    // Update full name based on first/last
    if (first_name !== undefined || last_name !== undefined) {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      const firstName = first_name?.trim() || currentProfile?.first_name || "";
      const lastName = last_name?.trim() || currentProfile?.last_name || "";
      updateData.full_name = `${firstName} ${lastName}`.trim();
    }

    // Perform update
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: profile,
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    
    // Handle specific error codes
    if (error.code === "23505") {
      return NextResponse.json(
        { error: { code: "DUPLICATE_ERROR", message: "A unique constraint was violated" } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to update profile",
          details: process.env.NODE_ENV === "development" ? error.message : undefined 
        } 
      },
      { status: 500 }
    );
  }
}

// POST /api/student/profile/avatar - Upload avatar
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No file provided" } },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "File must be an image" } },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "File size must be less than 5MB" } },
        { status: 400 }
      );
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `avatar_${user.id}_${Date.now()}.${ext}`;
    const filePath = `avatars/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        avatar_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: {
        avatar_url: urlData.publicUrl,
      },
      message: "Avatar uploaded successfully",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to upload avatar",
          details: process.env.NODE_ENV === "development" ? error.message : undefined 
        } 
      },
      { status: 500 }
    );
  }
}
