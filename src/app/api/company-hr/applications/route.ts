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

// GET /api/company-hr/applications
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const internshipId = searchParams.get("internship_id");

    let query = supabase
      .from("internship_applications")
      .select(
        `
        id,
        internship_id,
        student_user_id,
        company_id,
        cover_letter,
        resume_url,
        additional_answers,
        status,
        applied_at,
        updated_at,
        internships:internship_id (
          id,
          title,
          duration_weeks,
          start_date,
          end_date
        ),
        profiles:student_user_id (
          user_id,
          full_name,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          university_id,
          department_id,
          program_id,
          student_id_number,
          bio,
          github_url,
          linkedin_url
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", profile.company_id)
      .order("applied_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);
    if (internshipId) query = query.eq("internship_id", internshipId);

    const { data: applications, count, error } = await query;
    if (error) {
      console.error("Error fetching applications:", error);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch applications" } },
        { status: 500 }
      );
    }

    // Enrich with university / department / program / cgpa / cv
    const uniIds = Array.from(
      new Set((applications || []).map((a: any) => a.profiles?.university_id).filter(Boolean) as string[])
    );
    const deptIds = Array.from(
      new Set((applications || []).map((a: any) => a.profiles?.department_id).filter(Boolean) as string[])
    );
    const progIds = Array.from(
      new Set((applications || []).map((a: any) => a.profiles?.program_id).filter(Boolean) as string[])
    );
    const studentUserIds = Array.from(
      new Set((applications || []).map((a: any) => a.student_user_id).filter(Boolean) as string[])
    );

    const [uniLookup, deptLookup, progLookup, studentRes, cvRes] = await Promise.all([
      uniIds.length
        ? supabase.from("universities").select("id, name").in("id", uniIds)
        : Promise.resolve({ data: [], error: null }),
      deptIds.length
        ? supabase.from("departments").select("id, name").in("id", deptIds)
        : Promise.resolve({ data: [], error: null }),
      progIds.length
        ? supabase.from("programs").select("id, name").in("id", progIds)
        : Promise.resolve({ data: [], error: null }),
      studentUserIds.length
        ? supabase
            .from("students")
            .select("user_id, cgpa, enrollment_year, expected_graduation")
            .in("user_id", studentUserIds)
        : Promise.resolve({ data: [], error: null }),
      studentUserIds.length
        ? supabase
            .from("cv_uploads")
            .select("student_user_id, file_url, file_name")
            .in("student_user_id", studentUserIds)
            .eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const uniMap = new Map((uniLookup.data || []).map((u: any) => [u.id, u]));
    const deptMap = new Map((deptLookup.data || []).map((d: any) => [d.id, d]));
    const progMap = new Map((progLookup.data || []).map((p: any) => [p.id, p]));
    const studentMap = new Map((studentRes.data || []).map((s: any) => [s.user_id, s]));
    const cvMap = new Map((cvRes.data || []).map((c: any) => [c.student_user_id, c]));

    const enriched = (applications || []).map((a: any) => {
      const p = a.profiles || {};
      const student = studentMap.get(a.student_user_id);
      const cv = cvMap.get(a.student_user_id);
      return {
        id: a.id,
        internship_id: a.internship_id,
        student_user_id: a.student_user_id,
        company_id: a.company_id,
        cover_letter: a.cover_letter,
        resume_url: a.resume_url,
        status: a.status,
        applied_at: a.applied_at,
        updated_at: a.updated_at,
        internship: a.internships,
        student: {
          user_id: p.user_id,
          full_name: p.full_name,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.phone,
          avatar_url: p.avatar_url,
          student_id_number: p.student_id_number,
          bio: p.bio,
          github_url: p.github_url,
          linkedin_url: p.linkedin_url,
          cgpa: student?.cgpa ?? null,
          enrollment_year: student?.enrollment_year ?? null,
          expected_graduation: student?.expected_graduation ?? null,
          university: uniMap.get(p.university_id)?.name || "",
          department: deptMap.get(p.department_id)?.name || "",
          program: progMap.get(p.program_id)?.name || "",
          cv_url: cv?.file_url || null,
          cv_name: cv?.file_name || null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: { total: count || 0 },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// PATCH /api/company-hr/applications — bulk or single status update
// body: { ids?: string[], id?: string, status, reason?: string }
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
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
    const { id, ids, status, reason } = body;

    const targetIds = Array.isArray(ids) && ids.length > 0 ? ids : id ? [id] : [];
    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "id or ids[] is required" } },
        { status: 400 }
      );
    }
    const validStatuses = ["pending", "reviewing", "accepted", "rejected", "withdrawn"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `status must be one of: ${validStatuses.join(", ")}` } },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: apps } = await supabase
      .from("internship_applications")
      .select(`
        id,
        internship_id,
        student_user_id,
        status,
        internships!inner (company_id, title, start_date, end_date, duration_weeks)
      `)
      .in("id", targetIds)
      .eq("company_id", profile.company_id);

    const ownedApps = (apps || []) as any[];
    if (ownedApps.length === 0) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No matching applications found for your company" } },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("internship_applications")
      .update({ status, updated_at: nowIso })
      .in("id", ownedApps.map((a) => a.id))
      .select();

    if (updateError) {
      console.error("Error updating applications:", updateError);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to update applications" } },
        { status: 500 }
      );
    }

    // When accepting, create student_internships record (idempotent).
    //
    // BUG FIX (0036): Include university_id, department_id, program_id
    // from the students table so the row is visible to university_admin
    // and department_coordinator dashboards. The trg_backfill_si_tenant
    // trigger also fills these as a safety net.
    if (status === "accepted") {
      const appsToAccept = ownedApps.filter((a) => a.status !== "accepted");

      // Fetch student tenant IDs in bulk (one query instead of N).
      let studentTenantMap: Record<string, { university_id: string | null; department_id: string | null; program_id: string | null }> = {};
      if (appsToAccept.length > 0) {
        const studentIds = appsToAccept.map((a) => a.student_user_id);
        const { data: studentRows } = await supabase
          .from("students")
          .select("user_id, university_id, department_id, program_id")
          .in("user_id", studentIds);
        for (const s of studentRows || []) {
          studentTenantMap[s.user_id] = {
            university_id: s.university_id,
            department_id: s.department_id,
            program_id: s.program_id,
          };
        }
      }

      const newSIs = appsToAccept.map((a) => {
        const internship = Array.isArray(a.internships) ? a.internships[0] : a.internships;
        const startDate = internship?.start_date || new Date().toISOString().slice(0, 10);
        const tenant = studentTenantMap[a.student_user_id] || { university_id: null, department_id: null, program_id: null };
        return {
          student_user_id: a.student_user_id,
          internship_id: a.internship_id,
          application_id: a.id,
          company_id: profile.company_id,
          university_id: tenant.university_id,
          department_id: tenant.department_id,
          program_id: tenant.program_id,
          start_date: startDate,
          status: "assigned" as const,
        };
      });

      if (newSIs.length > 0) {
        // ignoreDuplicates: false (the default) so that re-accepting an
        // application after a withdraw updates the existing row's status
        // back to 'assigned'. With ignoreDuplicates: true the upsert
        // silently no-op'd on conflict, leaving the row stuck at its
        // previous status (e.g. 'withdrawn').
        await supabase
          .from("student_internships")
          .upsert(newSIs, { onConflict: "student_user_id,internship_id", ignoreDuplicates: false });
      }
    }

    // Notify each student — uses the shared sendNotification helper so the
    // notification is also delivered via web push to subscribed devices.
    const { sendNotification } = await import("@/lib/notifications");
    await Promise.all(
      ownedApps.map((a) =>
        sendNotification(supabase, {
          userId: a.student_user_id,
          senderId: user.id,
          title:
            status === "accepted"
              ? "Application accepted!"
              : status === "rejected"
              ? "Application update"
              : "Application status updated",
          message:
            status === "accepted"
              ? "Congratulations! Your application has been accepted. You'll receive onboarding instructions shortly."
              : status === "rejected"
              ? `Your application has been declined. ${reason ? `Reason: ${reason}` : ""}`.trim()
              : `Your application status is now: ${status}.`,
          category: "application",
          priority: status === "accepted" ? "high" : "medium",
          actionUrl: "/student/applications",
          metadata: { type: status === "accepted" ? "application_accepted" : status === "rejected" ? "application_rejected" : "application_status_update", application_id: a.id, new_status: status },
        })
      )
    );

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `update_application_status_${status}`,
      entity_type: "application",
      new_values: { ids: ownedApps.map((a) => a.id), status, reason },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Updated ${ownedApps.length} application(s) to "${status}"`,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
