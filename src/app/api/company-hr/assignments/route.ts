import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// GET: Get intern-supervisor assignments
// POST: Assign supervisor to intern(s)
// PUT: Reassignment
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
    const supervisorId = searchParams.get("supervisor_id");
    const internId = searchParams.get("intern_id");
    const programId = searchParams.get("program_id");
    const activeOnly = searchParams.get("active_only") !== "false";

    // Build base query - get assignments for company's interns
    let query = supabase
      .from("intern_supervisor_assignments")
      .select(`
        *,
        profiles:intern_id (
          id,
          first_name,
          last_name,
          email,
          avatar_url
        ),
        supervisors:supervisor_id (
          id,
          first_name,
          last_name,
          email,
          department_focus,
          specialization
        ),
        internships:internship_id (
          id,
          title,
          company_id
        )
      `)
      .order("assigned_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    if (supervisorId) {
      query = query.eq("supervisor_id", supervisorId);
    }

    if (internId) {
      query = query.eq("intern_id", internId);
    }

    const { data: assignments, error } = await query;

    if (error) {
      console.error("Error fetching assignments:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch assignments" } },
        { status: 500 }
      );
    }

    // Filter by company (ensure we only return company's data)
    const filteredAssignments = (assignments || []).filter(
      assignment => assignment.internships?.company_id === profile.company_id
    );

    return NextResponse.json({
      success: true,
      data: filteredAssignments,
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

    // Parse request body
    const body = await request.json();
    const {
      supervisor_id,
      intern_ids, // Array of intern IDs for batch assignment
      internship_id,
    } = body;

    // Validate required fields
    if (!supervisor_id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Supervisor ID is required" } },
        { status: 400 }
      );
    }

    if (!intern_ids || !Array.isArray(intern_ids) || intern_ids.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "At least one intern ID is required" } },
        { status: 400 }
      );
    }

    // Verify supervisor belongs to this company
    const { data: supervisor, error: supervisorError } = await supabase
      .from("supervisors")
      .select("*")
      .eq("id", supervisor_id)
      .eq("company_id", profile.company_id)
      .single();

    if (supervisorError || !supervisor) {
      return NextResponse.json(
        { error: { code: "SUPERVISOR_NOT_FOUND", message: "Supervisor not found or does not belong to your company" } },
        { status: 404 }
      );
    }

    if (!supervisor.is_active) {
      return NextResponse.json(
        { error: { code: "SUPERVISOR_INACTIVE", message: "Cannot assign to an inactive supervisor" } },
        { status: 400 }
      );
    }

    // Verify all interns belong to company's programs
    const { data: internApplications, error: appsError } = await supabase
      .from("applications")
      .select(`
        student_id,
        internship_id,
        internships!inner (
          id,
          company_id,
          title
        )
      `)
      .in("student_id", intern_ids)
      .eq("status", "accepted");

    if (appsError) {
      console.error("Error verifying interns:", appsError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to verify interns" } },
        { status: 500 }
      );
    }

    // Filter to only company's accepted applications
    const validInterns = (internApplications || []).filter(
      app => app.internships?.company_id === profile.company_id
    );

    if (validInterns.length === 0) {
      return NextResponse.json(
        { error: { code: "NO_VALID_INTERNS", message: "No valid interns found for assignment" } },
        { status: 400 }
      );
    }

    // Create assignments
    const assignmentsToCreate = validInterns.map(app => ({
      intern_id: app.student_id,
      supervisor_id,
      internship_id: app.internship_id || internship_id,
      assigned_by: user.id,
      is_active: true,
    }));

    const { data: createdAssignments, error: insertError } = await supabase
      .from("intern_supervisor_assignments")
      .upsert(assignmentsToCreate, {
        onConflict: "intern_id,supervisor_id",
        ignoreDuplicates: false,
      })
      .select();

    if (insertError) {
      console.error("Error creating assignments:", insertError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to create assignments" } },
        { status: 500 }
      );
    }

    // Log audit action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "assign_supervisor_to_interns",
      entity_type: "intern_supervisor_assignment",
      new_values: {
        supervisor_id,
        intern_count: createdAssignments?.length,
        intern_ids: validInterns.map(i => i.student_id),
      },
    });

    return NextResponse.json({
      success: true,
      data: createdAssignments,
      message: `Successfully assigned ${createdAssignments?.length || 0} intern(s) to supervisor`,
    }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// Handle reassignments via PUT
export async function PUT(request: NextRequest) {
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

    if (profileError || !profile || profile.role !== "company_hr" || !profile.company_id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { intern_id, new_supervisor_id } = body;

    if (!intern_id || !new_supervisor_id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Intern ID and new supervisor ID are required" } },
        { status: 400 }
      );
    }

    // Deactivate existing assignment
    const { error: deactivateError } = await supabase
      .from("intern_supervisor_assignments")
      .update({ 
        is_active: false, 
        unassigned_at: new Date().toISOString(),
        unassigned_by: user.id 
      })
      .eq("intern_id", intern_id)
      .eq("is_active", true);

    if (deactivateError) {
      console.error("Error deactivating old assignment:", deactivateError);
    }

    // Create new assignment
    const { data: newAssignment, error: createError } = await supabase
      .from("intern_supervisor_assignments")
      .insert({
        intern_id,
        supervisor_id: new_supervisor_id,
        assigned_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating new assignment:", createError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to reassign intern" } },
        { status: 500 }
      );
    }

    // Log audit action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "reassign_intern",
      entity_type: "intern_supervisor_assignment",
      entity_id: newAssignment.id,
      new_values: { intern_id, new_supervisor_id },
    });

    return NextResponse.json({
      success: true,
      data: newAssignment,
      message: "Intern reassigned successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
