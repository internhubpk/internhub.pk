/**
 * POST /api/final-grades/compute
 *
 * Computes the final weighted grade (40/30/25/5) for a student/internship.
 * Requires university_admin, program_coordinator, department_coordinator,
 * or super_admin role (scoped to the caller's university / program /
 * department).
 *
 * Body: { student_id, internship_id }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { computeFinalGrade } from "@/lib/final-grade";
import { notifyFinalEvaluationCompleted } from "@/lib/notify";
import type { ApiResponse } from "@/types";

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
      .select("role, university_id, program_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["super_admin", "university_admin", "program_coordinator", "department_coordinator"].includes(profile.role)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: only Super Admin, University Admin, Program Coordinator, or Department Coordinator can compute final grades" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { student_id, internship_id } = body;

    if (!student_id || !internship_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing student_id or internship_id" },
        { status: 400 }
      );
    }

    // Verify the caller has scope access to this student.
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("university_id, program_id, department_id")
      .eq("user_id", student_id)
      .single();

    if (!studentProfile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    if (profile.role === "university_admin" && studentProfile.university_id !== profile.university_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cross-university access denied" },
        { status: 403 }
      );
    }
    if (profile.role === "program_coordinator" && studentProfile.program_id !== profile.program_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cross-program access denied" },
        { status: 403 }
      );
    }
    if (profile.role === "department_coordinator" && studentProfile.department_id !== profile.department_id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cross-department access denied" },
        { status: 403 }
      );
    }

    // Compute the final grade (server-side, real data only).
    const result = await computeFinalGrade(student_id, internship_id);

    // If computed successfully, notify the student.
    if (result.status === "computed" && result.final_score !== null) {
      await notifyFinalEvaluationCompleted(
        student_id,
        result.final_score,
        result.letter_grade || "F"
      );
    }

    return NextResponse.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("[/api/final-grades/compute] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
