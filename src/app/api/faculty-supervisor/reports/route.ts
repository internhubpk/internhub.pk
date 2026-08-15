import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import {
  buildVerificationUrl,
  buildVerificationUrlFromRequest,
} from "@/lib/site-url";

// GET: Generate weekly/final/progress reports for students
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // profiles PK is user_id (not id).
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("report_type"); // 'weekly', 'final', 'progress'
    const studentUserIdParam = searchParams.get("student_id") || searchParams.get("student_user_id");
    const weekNumber = searchParams.get("week_number");

    // Fetch all supervised student_user_ids via student_internships
    // (faculty_supervisor_id references profiles.user_id).
    const { data: assignedInternships } = await supabase
      .from("student_internships")
      .select("student_user_id, internship_id, company_id, start_date, end_date, status")
      .eq("faculty_supervisor_id", user.id);

    const supervisedStudentIds = Array.from(
      new Set((assignedInternships || []).map((a) => a.student_user_id))
    );

    if (reportType === "weekly") {
      // Generate weekly progress report
      if (!studentUserIdParam || !weekNumber) {
        return NextResponse.json(
          { error: "Student user ID and week number are required for weekly reports" },
          { status: 400 }
        );
      }

      // Verify student is supervised by this faculty member.
      if (!supervisedStudentIds.includes(studentUserIdParam)) {
        return NextResponse.json(
          { error: "Student not found or not in your supervised students" },
          { status: 404 }
        );
      }

      // Get weekly log data (weekly_logs has no `student_id`; the FK is
      // student_user_id → profiles).
      const { data: weeklyLog, error: logError } = await supabase
        .from("weekly_logs")
        .select(
          `
          *,
          internship:internships(id, title, location, remote, company:company_id(name))
        `
        )
        .eq("student_user_id", studentUserIdParam)
        .eq("week_number", parseInt(weekNumber))
        .single();

      if (logError || !weeklyLog) {
        return NextResponse.json(
          { error: "Weekly log not found for this student and week" },
          { status: 404 }
        );
      }

      // Get the student's profile (for name).
      const { data: studentProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", studentUserIdParam)
        .single();

      // Get evaluations for this week.
      const weekStart = new Date(weeklyLog.week_start_date);
      const weekEnd = new Date(weeklyLog.week_end_date);

      const { data: evaluations } = await supabase
        .from("evaluations")
        .select("*")
        .eq("student_user_id", studentUserIdParam)
        .eq("evaluator_id", user.id)
        .eq("evaluator_role", "faculty_supervisor")
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      return NextResponse.json({
        success: true,
        data: {
          type: "weekly_report",
          student: {
            id: studentUserIdParam,
            name: studentProfile?.full_name || "Unknown Student",
            email: studentProfile?.email || "",
          },
          week: {
            number: weeklyLog.week_number,
            start: weeklyLog.week_start_date,
            end: weeklyLog.week_end_date,
          },
          internship: weeklyLog.internship,
          content: {
            tasks_completed: weeklyLog.tasks_completed || [],
            challenges: weeklyLog.challenges,
            learnings: weeklyLog.learnings,
            next_week_goals: weeklyLog.next_week_goals,
            hours_worked: weeklyLog.hours_worked,
          },
          evaluation: evaluations?.[0] || null,
          generated_at: new Date().toISOString(),
          generated_by: profile.full_name,
        },
      });
    } else if (reportType === "final") {
      // Generate final evaluation marksheet / certificate data
      if (!studentUserIdParam) {
        return NextResponse.json(
          { error: "Student user ID is required for final reports" },
          { status: 400 }
        );
      }

      if (!supervisedStudentIds.includes(studentUserIdParam)) {
        return NextResponse.json(
          { error: "Student not found or not in your supervised students" },
          { status: 404 }
        );
      }

      // Get student profile + students-table record (program_id, cgpa).
      const [profileRes, studentsRes, assignedRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", studentUserIdParam)
          .single(),
        supabase
          .from("students")
          .select("user_id, cgpa, student_id_number, program_id")
          .eq("user_id", studentUserIdParam)
          .single(),
        supabase
          .from("student_internships")
          .select("internship_id, company_id, start_date, end_date, status")
          .eq("student_user_id", studentUserIdParam)
          .eq("faculty_supervisor_id", user.id)
          .limit(1),
      ]);

      const studentProfile = profileRes.data;
      const studentRecord = studentsRes.data;
      const firstInternship = (assignedRes.data || [])[0];

      let programName = "Unknown Program";
      let companyName = "Unknown Company";
      let internshipTitle = "Internship";
      let internshipStart: string | null = null;
      let internshipEnd: string | null = null;

      if (studentRecord?.program_id) {
        const { data: program } = await supabase
          .from("programs")
          .select("name")
          .eq("id", studentRecord.program_id)
          .single();
        if (program) programName = program.name;
      }

      if (firstInternship?.internship_id) {
        const { data: internship } = await supabase
          .from("internships")
          .select("id, title, start_date, end_date, company:company_id(name)")
          .eq("id", firstInternship.internship_id)
          .single();
        if (internship) {
          internshipTitle = internship.title || "Internship";
          internshipStart = internship.start_date;
          internshipEnd = internship.end_date;
          companyName = (internship as any).company?.name || companyName;
        }
      }

      // Get all weekly logs for this student (via student_user_id).
      const { data: weeklyLogs } = await supabase
        .from("weekly_logs")
        .select("*")
        .eq("student_user_id", studentUserIdParam)
        .order("week_number", { ascending: true });

      // Get all evaluations by this supervisor for this student.
      const { data: allEvaluations } = await supabase
        .from("evaluations")
        .select("*")
        .eq("student_user_id", studentUserIdParam)
        .eq("evaluator_id", user.id)
        .order("created_at", { ascending: true });

      // Attendance summary.
      const { data: attendance } = await supabase
        .from("attendance")
        .select("date, status")
        .eq("student_user_id", studentUserIdParam);

      const attList = attendance || [];
      const present = attList.filter((a) => a.status === "present").length;
      const totalAtt = attList.length;
      const avgAttendance = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;

      // Calculate average evaluation score.
      const avgScore = (allEvaluations || []).length > 0
        ? (allEvaluations || []).reduce((acc, evaluation) => {
            const scoresObj =
              evaluation.scores && typeof evaluation.scores === "object"
                ? evaluation.scores
                : {};
            const vals = Object.values(scoresObj).filter(
              (v): v is number => typeof v === "number"
            );
            const total = vals.reduce((s, v) => s + v, 0);
            const max = vals.length * 10 || 1;
            return acc + (total / max) * 100;
          }, 0) / (allEvaluations || []).length
        : 0;

      // Determine final grade.
      const getGrade = (score: number) => {
        if (score >= 93) return "A";
        if (score >= 87) return "B+";
        if (score >= 80) return "B";
        if (score >= 73) return "C+";
        if (score >= 70) return "C";
        if (score >= 67) return "D+";
        if (score >= 60) return "D";
        return "F";
      };

      return NextResponse.json({
        success: true,
        data: {
          type: "final_report",
          certificate_data: {
            student_name: studentProfile?.full_name || "Unknown Student",
            program_name: programName,
            company_name: companyName,
            internship_title: internshipTitle,
            start_date: internshipStart || firstInternship?.start_date,
            end_date: internshipEnd || firstInternship?.end_date,
            final_grade: getGrade(avgScore),
            supervisor_name: profile.full_name,
            coordinator_name: null,
            issue_date: new Date().toISOString().split("T")[0],
            certificate_id: `CERT-${Date.now()}-${studentUserIdParam.toUpperCase()}`,
          },
          statistics: {
            total_weeks: weeklyLogs?.length || 0,
            total_hours: weeklyLogs?.reduce((sum, log) => sum + (Number(log.hours_worked) || 0), 0) || 0,
            average_attendance: avgAttendance,
            overall_score: Math.round(avgScore),
            letter_grade: getGrade(avgScore),
            weekly_breakdown:
              weeklyLogs?.map((log) => ({
                week_number: log.week_number,
                score: 0, // weekly_logs has no score column
                max_score: 10,
                hours: Number(log.hours_worked) || 0,
                status: log.status,
                remarks: log.supervisor_feedback,
              })) || [],
          },
          generated_at: new Date().toISOString(),
          generated_by: profile.full_name,
        },
      });
    } else if (reportType === "progress") {
      // Generate overall progress report for all supervised students.
      const studentUserIds =
        studentUserIdParam && supervisedStudentIds.includes(studentUserIdParam)
          ? [studentUserIdParam]
          : supervisedStudentIds;

      // Fetch profiles for these students.
      let profileMap: Record<string, { full_name: string; email: string }> = {};
      if (studentUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", studentUserIds);
        (profilesData || []).forEach((p: any) => {
          profileMap[p.user_id] = { full_name: p.full_name, email: p.email };
        });
      }

      // Enrich with progress data for each student.
      const enrichedStudents = await Promise.all(
        studentUserIds.map(async (studentUserId) => {
          // Get task completion stats.
          const { count: totalTasks } = await supabase
            .from("task_assignments")
            .select("*", { count: "exact", head: true })
            .eq("student_user_id", studentUserId)
            .eq("assigned_by", user.id);

          const { count: completedTasks } = await supabase
            .from("task_assignments")
            .select("*", { count: "exact", head: true })
            .eq("student_user_id", studentUserId)
            .eq("assigned_by", user.id)
            .eq("status", "approved");

          // Get latest weekly log.
          const { data: latestLog } = await supabase
            .from("weekly_logs")
            .select("*")
            .eq("student_user_id", studentUserId)
            .order("week_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get evaluation summary (scores JSONB only — no total_score/max_score).
          const { data: evals } = await supabase
            .from("evaluations")
            .select("scores, status")
            .eq("student_user_id", studentUserId)
            .eq("evaluator_id", user.id)
            .in("status", ["submitted", "approved"]);

          let avgEvalScore = 0;
          if (evals && evals.length > 0) {
            const totals = evals.map((e) => {
              const scoresObj = e.scores && typeof e.scores === "object" ? e.scores : {};
              const vals = Object.values(scoresObj).filter(
                (v): v is number => typeof v === "number"
              );
              const total = vals.reduce((s, v) => s + v, 0);
              const max = vals.length * 10 || 1;
              return (total / max) * 100;
            });
            avgEvalScore = totals.reduce((s, v) => s + v, 0) / totals.length;
          }

          return {
            user_id: studentUserId,
            name: profileMap[studentUserId]?.full_name || "Unknown Student",
            email: profileMap[studentUserId]?.email || "",
            progress: {
              task_completion_rate: totalTasks
                ? Math.round(((completedTasks || 0) / totalTasks) * 100)
                : 0,
              total_tasks: totalTasks || 0,
              completed_tasks: completedTasks || 0,
              latest_week_log: latestLog || null,
              average_evaluation_score: Math.round(avgEvalScore),
            },
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          type: "progress_report",
          students: enrichedStudents,
          generated_at: new Date().toISOString(),
          generated_by: profile.full_name,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid report_type. Use: weekly, final, or progress" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Save supervisor remarks / generate certificate / create report template
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // profiles PK is user_id.
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name, university_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, student_user_id, report_data, remark, remarks, coordinator_signature } = body;

    if (action === "save_remarks") {
      // supervisor_remarks has student_user_id (not student_id), remark
      // (singular, not remarks), no updated_at, and NO unique constraint on
      // (student_user_id, supervisor_id) — so we use plain insert, not upsert.
      const remarkText = remark || remarks;
      if (!student_user_id || !remarkText) {
        return NextResponse.json(
          { error: "student_user_id and remark are required" },
          { status: 400 }
        );
      }

      const { error } = await supabase.from("supervisor_remarks").insert({
        student_user_id,
        supervisor_id: user.id,
        remark: remarkText,
      });

      if (error) {
        console.error("Error saving remarks:", error);
        return NextResponse.json({ error: "Failed to save remarks" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Remarks saved successfully",
      });
    } else if (action === "generate_certificate") {
      // certificates has student_user_id (not student_id), title (required),
      // certificate_number, issued_at, issued_by, status, metadata. There is
      // no certificate_type / grade / issue_date / data / coordinator_signature.
      //
      // VERIFICATION CODE / URL GENERATION (added 2026-08-15):
      //   Previously this path created a certificate row WITHOUT
      //   verification_code or verification_url. That meant faculty-supervisor-
      //   issued certificates were unverifiable via /verify/[code] and the
      //   student couldn't add them to LinkedIn (the LinkedIn URL builder on
      //   student/certificates reads cert.verificationUrl and silently
      //   omitted the certUrl param when null). We now generate a unique
      //   verification_code (same IH-XXXX-XXXX format as the company-hr path)
      //   and the verification_url using the canonical site URL helper.
      if (!student_user_id || !report_data) {
        return NextResponse.json(
          { error: "student_user_id and report_data are required" },
          { status: 400 }
        );
      }

      // Resolve the request origin once for the verification URL builder.
      // The helper prefers NEXT_PUBLIC_APP_URL; this fallback is only used
      // when the env var is unset (local dev / fresh preview). NEVER uses
      // VERCEL_URL — that was the source of the rotting-preview-URL bug.
      const requestOrigin = new URL(request.url).origin;

      // Retry loop handles the (very unlikely) case of a verification_code
      // unique-index collision. Mirrors the company-hr certificate route.
      let certificate: any = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const part = () =>
          Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".charAt(b % 32))
            .join("")
            .slice(0, 4);
        const verification_code = `IH-${part()}-${part()}`;
        const verification_url = buildVerificationUrlFromRequest(
          verification_code,
          requestOrigin
        );

        const { data, error } = await supabase
          .from("certificates")
          .insert({
            student_user_id,
            issued_by: user.id,
            title: report_data.title || "Internship Completion Certificate",
            certificate_number:
              report_data.certificate_id || `CERT-${Date.now()}`,
            status: "issued",
            verification_code,
            verification_url,
            metadata: {
              ...(report_data || {}),
              coordinator_signature: coordinator_signature || null,
              issued_via: "faculty_supervisor_report",
            },
          })
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            // unique-constraint collision on verification_code — retry
            lastError = error;
            continue;
          }
          console.error("Error generating certificate:", error);
          return NextResponse.json(
            {
              error:
                "Failed to generate certificate (check RLS — faculty_supervisor may not be in cert_insert)",
            },
            { status: 500 }
          );
        }

        certificate = data;
        break;
      }

      if (!certificate) {
        console.error(
          "[/api/faculty-supervisor/reports] verification_code collision after 5 attempts:",
          lastError
        );
        return NextResponse.json(
          { error: "Failed to generate a unique verification code" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        // Always regenerate the verification URL from the code via
        // the canonical site-URL helper. The DB-stored
        // `verification_url` may be stale (rows issued before this
        // fix contain Vercel deployment URLs that point to a
        // protected deployment and break public verification).
        data: certificate
          ? {
              ...certificate,
              verification_url: certificate.verification_code
                ? buildVerificationUrl(certificate.verification_code)
                : certificate.verification_url,
            }
          : certificate,
        message: "Certificate generated successfully",
      });
    } else if (action === "create_report_template") {
      // report_templates has university_id, name, type, format, parameters,
      // created_by, created_at. No `config` or `scope` columns.
      const { template_name, template_config, template_type, template_format } = body;

      if (!template_name) {
        return NextResponse.json(
          { error: "Template name is required" },
          { status: 400 }
        );
      }

      const { data: template, error } = await supabase
        .from("report_templates")
        .insert({
          name: template_name,
          type: template_type || "custom",
          format: template_format || "csv",
          parameters: template_config || {},
          created_by: user.id,
          university_id: profile.university_id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating template:", error);
        return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: template,
        message: "Report template created successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use: save_remarks, generate_certificate, or create_report_template" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("POST Reports API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
