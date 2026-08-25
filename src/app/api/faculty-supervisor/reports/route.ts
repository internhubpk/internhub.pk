import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { fetchSupervisedStudentIds } from "@/lib/supervised-students";
import { buildVerificationUrl } from "@/lib/site-url";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Helpers — verification code + server-side PDF generation.
// ---------------------------------------------------------------------------
// 12-char alphanumeric code with ambiguous characters removed (no 0/O/1/I/L).
// Uses crypto.randomBytes for entropy.
const VERIFY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateVerificationCode(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += VERIFY_ALPHABET[bytes[i] % VERIFY_ALPHABET.length];
  }
  return out;
}

// Decode a base64 string into a Uint8Array for Supabase Storage upload.
// Supabase's `upload()` accepts Blob | ArrayBuffer | FormData | string —
// a Uint8Array works because it's a Uint8Array<ArrayBufferLike> view.
function decode(b64: string): Uint8Array {
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

// Minimal server-side PDF generator for internship completion certificates.
// Uses pure string concatenation against the PDF spec — no external deps.
// This produces a single-page A4 PDF with the certificate text.
interface CertificatePdfInput {
  student_name: string;
  program_name: string;
  company_name: string;
  internship_title: string;
  supervisor_name: string;
  coordinator_name: string;
  additional_remarks: string;
  certificate_id: string;
  verification_code: string;
  verification_url: string;
  issue_date: string;
}
function generateCertificatePdf(input: CertificatePdfInput): Buffer {
  // Build a simple single-page PDF with text content. The structure is:
  //   %PDF-1.4
  //   1 0 obj << /Type /Catalog /Pages 2 0 R >>
  //   2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >>
  //   3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]
  //             /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>
  //   4 0 obj << /Length N >> stream BT ... ET endstream
  //   5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
  // We escape parentheses and backslashes in the text content.
  const esc = (s: string) => (s || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const issueDateStr = input.issue_date
    ? new Date(input.issue_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Lines to render on the PDF. The PDF content stream uses BT/ET (Begin/End Text)
  // and Td for positioning. We use a simple top-to-bottom layout.
  const lines: Array<{ text: string; size: number; bold?: boolean; y: number }> = [
    { text: "INTERNSHIP COMPLETION CERTIFICATE", size: 20, bold: true, y: 720 },
    { text: "This is to certify that", size: 12, y: 660 },
    { text: input.student_name, size: 22, bold: true, y: 620 },
    { text: "has successfully completed the internship program", size: 12, y: 580 },
    { text: input.program_name, size: 14, bold: true, y: 545 },
    { text: `Internship Title: ${input.internship_title || "—"}`, size: 11, y: 500 },
    { text: `Host Company: ${input.company_name || "—"}`, size: 11, y: 478 },
    { text: `Faculty Supervisor: ${input.supervisor_name || "—"}`, size: 11, y: 456 },
    ...(input.coordinator_name
      ? [{ text: `Coordinator: ${input.coordinator_name}`, size: 11, y: 434 }]
      : []),
    { text: `Issue Date: ${issueDateStr}`, size: 11, y: 400 },
    ...(input.additional_remarks
      ? [
          { text: "Remarks:", size: 11, bold: true, y: 360 },
          { text: input.additional_remarks.slice(0, 400), size: 10, y: 340 },
        ]
      : []),
    { text: `Certificate ID: ${input.certificate_id}`, size: 10, y: 240 },
    { text: `Verification Code: ${input.verification_code}`, size: 10, y: 222 },
    { text: `Verify online: ${input.verification_url}`, size: 9, y: 204 },
  ];

  // Build the content stream.
  let content = "BT\n";
  for (const line of lines) {
    content += `/F${line.bold ? "2" : "1"} ${line.size} Tf\n`;
    content += `1 0 0 1 60 ${line.y} Tm\n`;
    content += `(${esc(line.text)}) Tj\n`;
  }
  content += "ET\n";

  const contentBytes = Buffer.from(content, "utf-8");

  // Build the PDF objects.
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>"
  );
  objects.push(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  // Assemble the PDF file.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf-8");
}

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

    // Fetch all supervised student_user_ids via BOTH sources:
    //   1. student_internships.faculty_supervisor_id (internship-time)
    //   2. students.faculty_supervisor_id (pre-internship, migration 0041)
    // Without both, supervisors whose assignments live in source #2 see 0
    // students in the reports page.
    const supervisedStudentIds = await fetchSupervisedStudentIds(supabase, user.id);

    // For metadata (company_id, start/end dates), keep the internship rows.
    const { data: assignedInternships } = await supabase
      .from("student_internships")
      .select("student_user_id, internship_id, company_id, start_date, end_date, status")
      .eq("faculty_supervisor_id", user.id);

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
      // certificate_number, issued_at, issued_by, status, metadata, file_url,
      // verification_code, verification_url, linkedin_added_at.
      //
      // Generate a verification code + URL so the student can verify/share
      // the certificate. Previously this route created a certificate row
      // with file_url=NULL, verification_code=NULL, verification_url=NULL,
      // which left the student unable to view/download/verify it.
      if (!student_user_id || !report_data) {
        return NextResponse.json(
          { error: "student_user_id and report_data are required" },
          { status: 400 }
        );
      }

      // Generate a verification code (12-char alphanumeric, no ambiguous chars).
      // Use crypto.randomBytes for entropy — Math.random is not cryptographically
      // secure and would let attackers guess certificate codes.
      const verificationCode = generateVerificationCode();
      const verificationUrl = buildVerificationUrl(verificationCode);

      // Generate a real PDF on the server using the report_data so the
      // student has something to download immediately. The PDF is a simple
      // structured document — the visual certificate template lives on the
      // faculty-supervisor UI for printing.
      const pdfBuffer = generateCertificatePdf({
        student_name: report_data.student_name || "Student",
        program_name: report_data.program_name || "Internship Program",
        company_name: report_data.company_name || "",
        internship_title: report_data.internship_title || "",
        supervisor_name: report_data.supervisor_name || profile.full_name || "",
        coordinator_name: report_data.coordinator_name || "",
        additional_remarks: report_data.additional_remarks || "",
        certificate_id: report_data.certificate_id || `CERT-${Date.now()}`,
        verification_code: verificationCode,
        verification_url: verificationUrl,
        issue_date: report_data.issue_date || new Date().toISOString(),
      });
      const pdfBase64 = pdfBuffer.toString("base64");
      const fileName = `certificate-${verificationCode}.pdf`;
      const filePath = `certificates/${student_user_id}/${fileName}`;
      const fileMimeType = "application/pdf";

      // Upload the PDF to Supabase Storage (public-read bucket 'certificates').
      // If the upload fails for any reason (bucket missing, RLS, etc.) we still
      // insert the certificate row — the supervisor can still print it from
      // the UI, and the verification URL still works.
      let fileUrl: string | null = null;
      try {
        const { error: uploadErr } = await supabase
          .storage
          .from("certificates")
          .upload(filePath, decode(pdfBase64), {
            contentType: fileMimeType,
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadErr) {
          console.warn("[/api/faculty-supervisor/reports] certificate PDF upload failed (non-fatal):", uploadErr);
        } else {
          const { data: pub } = supabase
            .storage
            .from("certificates")
            .getPublicUrl(filePath);
          fileUrl = pub?.publicUrl || null;
        }
      } catch (uploadErr) {
        console.warn("[/api/faculty-supervisor/reports] certificate PDF upload exception (non-fatal):", uploadErr);
      }

      const { data: certificate, error } = await supabase
        .from("certificates")
        .insert({
          student_user_id,
          issued_by: user.id,
          title: report_data.title || "Internship Completion Certificate",
          certificate_number: report_data.certificate_id || `CERT-${Date.now()}`,
          status: "issued",
          file_url: fileUrl,
          verification_code: verificationCode,
          verification_url: verificationUrl,
          metadata: {
            ...(report_data || {}),
            coordinator_signature: coordinator_signature || null,
            generated_by: "faculty_supervisor",
            generated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error) {
        console.error("Error generating certificate:", error);
        return NextResponse.json(
          { error: "Failed to generate certificate (check RLS — faculty_supervisor may not be in cert_insert)" },
          { status: 500 }
        );
      }

      // Notify the student that a certificate has been issued.
      try {
        await supabase.from("notifications").insert({
          user_id: student_user_id,
          sender_id: user.id,
          title: "Certificate issued",
          message: `Your internship completion certificate has been issued. Verification code: ${verificationCode}`,
          category: "certificate",
          priority: "high",
          is_read: false,
          metadata: {
            certificate_id: certificate.id,
            verification_code: verificationCode,
            verification_url: verificationUrl,
            file_url: fileUrl,
          },
        });
      } catch (notifErr) {
        console.warn("[/api/faculty-supervisor/reports] student notification failed (non-fatal):", notifErr);
      }

      return NextResponse.json({
        success: true,
        data: certificate,
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
