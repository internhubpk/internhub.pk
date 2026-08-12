import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: Generate weekly/final reports for students
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get supervisor's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    // Get supervised program IDs
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("program_ids")
      .eq("user_id", user.id)
      .eq("type", "faculty")
      .single();

    const programIds = supervisor?.program_ids || [];

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("report_type"); // 'weekly', 'final', 'progress'
    const studentId = searchParams.get("student_id");
    const weekNumber = searchParams.get("week_number");
    const internshipId = searchParams.get("internship_id");

    if (reportType === "weekly") {
      // Generate weekly progress report
      if (!studentId || !weekNumber) {
        return NextResponse.json(
          { error: "Student ID and week number are required for weekly reports" },
          { status: 400 }
        );
      }

      // Verify student is in supervised programs
      const { data: student } = await supabase
        .from("students")
        .select("id, full_name, email, program_id, user_id")
        .eq("id", studentId)
        .single();

      if (!student || !programIds.includes(student.program_id)) {
        return NextResponse.json(
          { error: "Student not found or not in your supervised programs" },
          { status: 404 }
        );
      }

      // Get weekly log data
      const { data: weeklyLog, error: logError } = await supabase
        .from("weekly_logs")
        .select(`
          *,
          internships (
            id,
            title,
            company_name
          )
        `)
        .eq("student_id", studentId)
        .eq("week_number", parseInt(weekNumber))
        .single();

      if (logError || !weeklyLog) {
        return NextResponse.json(
          { error: "Weekly log not found for this student and week" },
          { status: 404 }
        );
      }

      // Get tasks completed during this week
      const weekStart = new Date(weeklyLog.week_start_date);
      const weekEnd = new Date(weeklyLog.week_end_date);

      const { data: tasksCompleted } = await supabase
        .from("task_assignments")
        .select(`
          tasks (id, title),
          status,
          completed_at
        `)
        .eq("student_id", studentId)
        .in("status", ["completed"])
        .gte("completed_at", weekStart.toISOString())
        .lte("completed_at", weekEnd.toISOString());

      // Get evaluations for this week
      const { data: evaluations } = await supabase
        .from("evaluations")
        .select("*")
        .eq("student_id", studentId)
        .eq("type", "weekly_log")
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      return NextResponse.json({
        success: true,
        data: {
          type: "weekly_report",
          student: {
            id: student.id,
            name: student.full_name,
            email: student.email,
          },
          week: {
            number: weeklyLog.week_number,
            start: weeklyLog.week_start_date,
            end: weeklyLog.week_end_date,
          },
          internship: weeklyLog.internships,
          content: {
            tasks_completed: weeklyLog.tasks_completed || [],
            challenges: weeklyLog.challenges,
            learnings: weeklyLog.learnings,
            next_week_goals: weeklyLog.next_week_goals,
            hours_worked: weeklyLog.hours_worked,
          },
          evaluation: evaluations?.[0] || null,
          tasks_completed_count: tasksCompleted?.length || 0,
          generated_at: new Date().toISOString(),
          generated_by: profile.full_name,
        },
      });

    } else if (reportType === "final") {
      // Generate final evaluation marksheet / certificate data
      if (!studentId) {
        return NextResponse.json(
          { error: "Student ID is required for final reports" },
          { status: 400 }
        );
      }

      // Verify student is in supervised programs
      const { data: student } = await supabase
        .from("students")
        .select(`
          id,
          full_name,
          email,
          program_id,
          user_id,
          programs (id, name),
          internships (
            id,
            title,
            company_name,
            start_date,
            end_date,
            status
          )
        `)
        .eq("id", studentId)
        .single();

      if (!student || !programIds.includes(student.program_id)) {
        return NextResponse.json(
          { error: "Student not found or not in your supervised programs" },
          { status: 404 }
        );
      }

      const internship = student.internships;

      // Get all weekly logs for this internship
      const { data: weeklyLogs } = await supabase
        .from("weekly_logs")
        .select("*")
        .eq("student_id", studentId)
        .eq("internship_id", internship?.id)
        .order("week_number", { ascending: true });

      // Get all evaluations
      const { data: allEvaluations } = await supabase
        .from("evaluations")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true });

      // Calculate statistics
      const totalWeeks = weeklyLogs?.length || 0;
      const totalHours = weeklyLogs?.reduce((sum, log) => sum + (log.hours_worked || 0), 0) || 0;
      const avgScore = allEvaluations?.length > 0 
        ? allEvaluations.reduce((sum, evaluation) => sum + ((evaluation.total_score || 0) / (evaluation.max_score || 1) * 100), 0) / allEvaluations.length
        : 0;

      // Determine final grade
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
            student_name: student.full_name,
            program_name: student.programs?.name || "Unknown Program",
            company_name: internship?.company_name || "Unknown Company",
            internship_title: internship?.title || "Internship",
            start_date: internship?.start_date,
            end_date: internship?.end_date,
            final_grade: getGrade(avgScore),
            supervisor_name: profile.full_name,
            coordinator_name: null, // To be filled by department coordinator
            issue_date: new Date().toISOString().split('T')[0],
            certificate_id: `CERT-${Date.now()}-${studentId.toUpperCase()}`,
          },
          statistics: {
            total_weeks: totalWeeks,
            total_hours: totalHours,
            average_attendance: 97, // Would be calculated from attendance records
            overall_score: Math.round(avgScore),
            letter_grade: getGrade(avgScore),
            weekly_breakdown: weeklyLogs?.map(log => ({
              week_number: log.week_number,
              score: log.score || 0,
              max_score: log.max_score || 20,
              hours: log.hours_worked || 0,
              status: log.status,
              remarks: log.supervisor_feedback,
            })) || [],
          },
          generated_at: new Date().toISOString(),
          generated_by: profile.full_name,
        },
      });

    } else if (reportType === "progress") {
      // Generate overall progress report for all supervised students
      let query = supabase
        .from("students")
        .select(`
          id,
          full_name,
          email,
          program_id,
          avatar_url,
          programs (name),
          internships (
            id,
            title,
            company_name,
            status,
            start_date,
            end_date
          )
        `)
        .in("program_id", programIds.length > 0 ? programIds : ["none"]); // Fallback if no programs

      if (studentId) {
        query = query.eq("id", studentId);
      }

      const { data: students, error: studentsError } = await query;

      if (studentsError) {
        console.error("Error fetching students:", studentsError);
        return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
      }

      // Enrich with progress data for each student
      const enrichedStudents = await Promise.all(
        (students || []).map(async (student) => {
          // Get task completion stats
          const { count: totalTasks } = await supabase
            .from("task_assignments")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id);

          const { count: completedTasks } = await supabase
            .from("task_assignments")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id)
            .eq("status", "completed");

          // Get latest weekly log
          const { data: latestLog } = await supabase
            .from("weekly_logs")
            .select("*")
            .eq("student_id", student.id)
            .order("week_number", { ascending: false })
            .limit(1)
            .single();

          // Get evaluation summary
          const { data: evals } = await supabase
            .from("evaluations")
            .select("total_score, max_score")
            .eq("student_id", student.id)
            .eq("status", "completed");

          const avgEvalScore = evals && evals.length > 0
            ? evals.reduce((sum, e) => sum + ((e.total_score || 0) / (e.max_score || 1)) * 100, 0) / evals.length
            : 0;

          return {
            ...student,
            progress: {
              task_completion_rate: totalTasks ? Math.round(((completedTasks || 0) / totalTasks) * 100) : 0,
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

// POST: Create/save a report template or generate certificate
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get supervisor's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "faculty_supervisor") {
      return NextResponse.json(
        { error: "Forbidden: Faculty supervisor access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      action, // 'save_remarks', 'generate_certificate', 'create_report_template'
      student_id,
      report_data,
      remarks,
      coordinator_signature,
    } = body;

    if (action === "save_remarks") {
      // Save supervisor remarks on a weekly log or final evaluation
      if (!student_id || !remarks) {
        return NextResponse.json(
          { error: "Student ID and remarks are required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("supervisor_remarks")
        .upsert({
          student_id,
          supervisor_id: user.id,
          remarks,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "student_id,supervisor_id"
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
      // Record that a certificate was generated
      if (!student_id || !report_data) {
        return NextResponse.json(
          { error: "Student ID and report data are required" },
          { status: 400 }
        );
      }

      const { data: certificate, error } = await supabase
        .from("certificates")
        .insert({
          student_id,
          issued_by: user.id,
          certificate_type: "internship_completion",
          certificate_id: report_data.certificate_id,
          grade: report_data.final_grade,
          issue_date: report_data.issue_date,
          data: report_data,
          coordinator_signature: coordinator_signature || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error generating certificate:", error);
        return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: certificate,
        message: "Certificate generated successfully",
      });

    } else if (action === "create_report_template") {
      // Create a custom report template
      const { template_name, template_config } = body;

      if (!template_name || !template_config) {
        return NextResponse.json(
          { error: "Template name and config are required" },
          { status: 400 }
        );
      }

      const { data: template, error } = await supabase
        .from("report_templates")
        .insert({
          name: template_name,
          created_by: user.id,
          config: template_config,
          scope: "faculty_supervisor",
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
