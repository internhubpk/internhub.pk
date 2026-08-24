/**
 * ============================================================================
 * InternHub Document Generation Service
 * ----------------------------------------------------------------------------
 * Populates the supplied Word `.docx` template (Weekly Internship Activity
 * Report) with real Supabase data, preserving the original template's layout,
 * tables, fonts, spacing, page breaks, headings, borders, alignment, images,
 * headers, footers, and styles.
 *
 * Architecture (per spec section 22):
 *   1. Data Assembly        — see `assembleWeeklyReportData()`
 *   2. Template Processor  — see `populateWeeklyReportTemplate()`
 *   3. Asset Handler        — see `fetchUniversityLogo()`, `fetchSignatureImage()`
 *   4. File Delivery        — see `saveGeneratedReport()`
 *
 * The service is server-only. All Supabase privileged operations run
 * server-side using the service role when needed (e.g. fetching logos
 * from private storage).
 *
 * TEMPLATE STRATEGY
 * ----------------
 * The supplied template does NOT use placeholder tokens like {{student_name}}.
 * Instead, it has literal label text ("Student Name", "Registration No.",
 * "Monday", etc.) followed by empty table cells where the values go.
 *
 * We use JSZip to:
 *   1. Unzip the .docx (it's just a zip archive of XML files)
 *   2. Modify document.xml directly to inject values into the right cells
 *      (after each label, in the same row's adjacent cell)
 *   3. Modify header1.xml to replace the placeholder university name + logo
 *   4. Replace the logo image (word/media/image1.png) bytes with the
 *      student's actual university logo bytes
 *   5. Append the student's signature image as a new drawing in the
 *      signature row
 *   6. Re-zip and return the binary buffer
 *
 * This preserves the original template's formatting because we never
 * recreate the document — we only mutate text content and image bytes.
 * ============================================================================
 */

import JSZip from "jszip";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import path from "path";
import { promises as fs } from "fs";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface WeeklyReportData {
  // University branding
  universityName: string;
  universityLogoBuffer: Buffer | null;
  // Department / faculty branding (header also has "Faculty of Computer Science" —
  // replaced per-student per spec "for every uni logo and name should be different").
  departmentName: string;
  // Program info
  programName: string;
  // Student info
  studentName: string;
  studentRegistrationNumber: string;
  // Host organization (company)
  hostOrganization: string;
  // Week info
  weekNumber: number;
  reportingPeriodStart: string; // ISO date (YYYY-MM-DD)
  reportingPeriodEnd: string;
  // Supervisor info
  supervisorName: string;
  // Weekly activities (Monday-Friday)
  dailyEntries: Array<{
    dayName: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
    date: string; // ISO date
    tasksPerformed: string;
    hoursWorked: number;
    isHoliday: boolean;
    notes?: string;
  }>;
  // Reflections
  learningOutcomes: string;
  challengesFaced: string;
  supportingEvidence: string;
  // Supervisor remarks (filled by supervisor; blank at student's submission)
  supervisorRemarks: string;
  // Signature image buffers
  studentSignatureBuffer: Buffer | null;
  industrySupervisorSignatureBuffer: Buffer | null;
  facultySupervisorSignatureBuffer: Buffer | null;
}

export interface GenerationResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
  metadata: {
    templateUsed: string;
    fieldsPopulated: string[];
    imagesEmbedded: string[];
    durationMs: number;
  };
}

// ----------------------------------------------------------------------------
// Asset Handler
// ----------------------------------------------------------------------------

/**
 * Create a service-role Supabase client for privileged operations
 * (fetching private storage assets, logos from private buckets).
 */
function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for asset fetching.");
  }
  return createServiceRoleClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Fetch the university logo as a Buffer.
 * Returns null if no logo is configured or fetch fails.
 *
 * The logo_url column in `universities` typically stores either:
 *   - A Supabase Storage public URL (when bucket is public)
 *   - A Supabase Storage private path (when bucket is private)
 *   - An external URL
 *
 * We try fetching as URL first; if it's a storage path, we use the
 * service-role client to download from private storage.
 */
export async function fetchUniversityLogo(
  logoUrl: string | null
): Promise<Buffer | null> {
  if (!logoUrl) return null;

  try {
    // Case 1: it's a full URL (http/https)
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const resp = await fetch(logoUrl);
      if (!resp.ok) {
        console.warn("[doc-gen] Failed to fetch university logo:", resp.status);
        return null;
      }
      const ab = await resp.arrayBuffer();
      return Buffer.from(ab);
    }

    // Case 2: it's a Supabase storage path — use service-role client.
    const serviceClient = getServiceRoleClient();
    // The path may be like "logos/university-iiui.png"
    const { data, error } = await serviceClient.storage
      .from("university-assets")
      .download(logoUrl);

    if (error || !data) {
      // Try other common bucket names.
      const altBuckets = ["universities", "logos", "public"];
      for (const bucket of altBuckets) {
        const alt = await serviceClient.storage.from(bucket).download(logoUrl);
        if (alt.data) {
          const ab = await alt.data.arrayBuffer();
          return Buffer.from(ab);
        }
      }
      console.warn("[doc-gen] Could not fetch university logo from storage:", logoUrl);
      return null;
    }

    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  } catch (err) {
    console.error("[doc-gen] fetchUniversityLogo threw:", err);
    return null;
  }
}

/**
 * Fetch a signature image as a Buffer.
 * Signatures are stored in the `signatures` storage bucket, path =
 * `<user_id>.png` (or similar).
 */
export async function fetchSignatureImage(
  signatureUrl: string | null
): Promise<Buffer | null> {
  if (!signatureUrl) return null;
  return fetchUniversityLogo(signatureUrl); // same logic — fetch URL or storage path
}

// ----------------------------------------------------------------------------
// Data Assembly
// ----------------------------------------------------------------------------

/**
 * Assemble all the data needed to populate the weekly report template.
 * Fetches: student, university, department, program, internship, company,
 *          supervisors, weekly log + daily entries, evaluation context.
 *
 * The caller MUST verify authorization BEFORE calling this function —
 * it does NOT perform auth checks itself.
 *
 * @param weeklyLogId The weekly_logs.id
 * @returns The assembled data, or throws on missing required fields.
 */
export async function assembleWeeklyReportData(
  weeklyLogId: string
): Promise<WeeklyReportData> {
  const supabase = await createClient();

  // 1. Fetch the weekly log with student + internship info.
  //    weekly_logs uses `student_user_id` (NOT `student_id`) — confirmed live
  //    via Supabase Management API. The earlier code used the wrong column
  //    name + wrong FK hint (`students:student_id`), which silently broke
  //    document generation against the live DB. Fixed here.
  //
  //    weekly_logs also carries snapshotted program_name / department_name /
  //    university_logo_url / *_signature_url / *_remarks columns (migrations
  //    0058, 0071) — included so the Word template's "Faculty of Computer
  //    Science" header text can be substituted per-student per spec.
  const { data: weeklyLog, error: wlErr } = await supabase
    .from("weekly_logs")
    .select(
      `
      id, week_number, week_start_date, week_end_date, status,
      student_user_id, internship_id, supervisor_id,
      tasks_completed, challenges, learnings, next_week_goals, hours_worked,
      supervisor_feedback, submitted_at,
      program_name, department_name, university_logo_url,
      learning_outcomes, challenges_solutions,
      supporting_evidence,
      student_signature_url, site_supervisor_signature_url, faculty_supervisor_signature_url,
      site_supervisor_remarks, faculty_supervisor_remarks,
      students:student_user_id (
        user_id, student_id_number, program_id, department_id,
        profiles:user_id ( full_name, email, university_id, program_id, signature_url )
      ),
      internships:internship_id (
        id, title, company_id, program_id,
        companies:company_id ( name, logo_url ),
        programs:program_id ( name, code )
      )
      `
    )
    .eq("id", weeklyLogId)
    .single();

  if (wlErr || !weeklyLog) {
    throw new Error(`Weekly log not found: ${wlErr?.message || "unknown"}`);
  }

  const student = weeklyLog.students as any;
  const internship = weeklyLog.internships as any;
  const profile = student?.profiles as any;
  if (!student || !internship || !profile) {
    throw new Error("Weekly log is missing required student/internship/profile data");
  }

  // 2. Fetch university + department + program (used for header + body population).
  //    The Word template header has BOTH "Ibadat International University Islamabad"
  //    AND "Faculty of Computer Science" hardcoded — both must be substituted per
  //    the user's instruction ("for every uni logo and name should be different").
  const { data: university } = await supabase
    .from("universities")
    .select("id, name, slug, logo_url")
    .eq("id", profile.university_id)
    .single();

  if (!university) {
    throw new Error("Student's university not found");
  }

  // Prefer the weekly_log's snapshotted department_name (migration 0058) when present;
  // otherwise fall back to the live departments row.
  let departmentName: string | null = (weeklyLog as any).department_name || null;
  if (!departmentName && student.department_id) {
    const { data: departmentRow } = await supabase
      .from("departments")
      .select("name, code")
      .eq("id", student.department_id)
      .single();
    if (departmentRow?.name) {
      departmentName = departmentRow.name;
    }
  }

  // 3. Fetch the daily entries (Monday-Friday structured data).
  const { data: dailyEntriesRows } = await supabase
    .from("weekly_log_daily_entries")
    .select("day_of_week, entry_date, tasks_performed, hours_worked, is_holiday, notes")
    .eq("weekly_log_id", weeklyLogId)
    .order("day_of_week", { ascending: true });

  // 4. Build the daily entries array (Mon-Fri). If no structured entries
  //    exist (legacy weekly log), fall back to tasks_completed array.
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
  let dailyEntries: WeeklyReportData["dailyEntries"];

  if (dailyEntriesRows && dailyEntriesRows.length > 0) {
    dailyEntries = dayNames.map((dayName, idx) => {
      const dow = idx + 1; // 1=Mon ... 5=Fri
      const row = dailyEntriesRows.find((r: any) => r.day_of_week === dow);
      if (row) {
        return {
          dayName,
          date: row.entry_date,
          tasksPerformed: row.tasks_performed || "",
          hoursWorked: Number(row.hours_worked) || 0,
          isHoliday: !!row.is_holiday,
          notes: row.notes || undefined,
        };
      }
      // No entry for this day — leave blank (likely a holiday or weekend).
      // Compute the date from week_start_date + dow offset.
      const weekStart = new Date(weeklyLog.week_start_date);
      weekStart.setDate(weekStart.getDate() + idx);
      return {
        dayName,
        date: weekStart.toISOString().slice(0, 10),
        tasksPerformed: "",
        hoursWorked: 0,
        isHoliday: false,
      };
    });
  } else {
    // Legacy: no structured daily entries. Use tasks_completed array if present.
    const tasksCompleted = (weeklyLog.tasks_completed as string[]) || [];
    dailyEntries = dayNames.map((dayName, idx) => {
      const weekStart = new Date(weeklyLog.week_start_date);
      weekStart.setDate(weekStart.getDate() + idx);
      return {
        dayName,
        date: weekStart.toISOString().slice(0, 10),
        tasksPerformed: tasksCompleted[idx] || "",
        hoursWorked: 0,
        isHoliday: false,
      };
    });
  }

  // 5. Resolve the supervisor name (faculty or site supervisor).
  let supervisorName = "—";
  if (weeklyLog.supervisor_id) {
    const { data: sup } = await supabase
      .from("supervisors")
      .select("user_id, profiles:user_id ( full_name )")
      .eq("id", weeklyLog.supervisor_id)
      .single();
    const supProfiles = sup?.profiles as any;
    if (supProfiles?.full_name) {
      supervisorName = supProfiles.full_name as string;
    }
  }

  // 6. Fetch logo + signatures (in parallel).
  //    Prefer the weekly_log's denormalized columns (snapshotted at submit
  //    time — migrations 0058, 0071) when available; fall back to live
  //    relationship queries for legacy rows / missing snapshots.
  const weeklyLogAny = weeklyLog as any;

  const [universityLogoBuffer, studentSignatureBuffer, industrySupervisorSignatureBuffer, facultySupervisorSignatureBuffer] =
    await Promise.all([
      // University logo: prefer weekly_log.university_logo_url, fall back to universities.logo_url
      weeklyLogAny.university_logo_url
        ? fetchUniversityLogo(weeklyLogAny.university_logo_url)
        : fetchUniversityLogo(university.logo_url),
      // Student signature: prefer weekly_log.student_signature_url, fall back to profile.signature_url
      weeklyLogAny.student_signature_url
        ? fetchSignatureImage(weeklyLogAny.student_signature_url)
        : fetchSignatureImage(profile.signature_url || null),
      // Industry supervisor (site supervisor) signature
      weeklyLogAny.site_supervisor_signature_url
        ? fetchSignatureImage(weeklyLogAny.site_supervisor_signature_url)
        : weeklyLog.supervisor_id
          ? (async () => {
              const { data: ss } = await supabase
                .from("supervisors")
                .select("user_id, profiles:user_id ( signature_url )")
                .eq("id", weeklyLog.supervisor_id)
                .single();
              return fetchSignatureImage((ss?.profiles as any)?.signature_url || null);
            })()
          : Promise.resolve(null),
      // Faculty supervisor signature: prefer weekly_log.faculty_supervisor_signature_url,
      // fall back to lookup via student_internships (which also uses student_user_id).
      weeklyLogAny.faculty_supervisor_signature_url
        ? fetchSignatureImage(weeklyLogAny.faculty_supervisor_signature_url)
        : (async () => {
            const { data: si } = await supabase
              .from("student_internships")
              .select("faculty_supervisor_id")
              .eq("internship_id", weeklyLog.internship_id)
              .eq("student_user_id", weeklyLog.student_user_id)
              .single();
            if (!si?.faculty_supervisor_id) return null;
            const { data: fs } = await supabase
              .from("supervisors")
              .select("user_id, profiles:user_id ( signature_url )")
              .eq("id", si.faculty_supervisor_id)
              .single();
            return fetchSignatureImage((fs?.profiles as any)?.signature_url || null);
          })(),
    ]);

  // 7. Build the final data object.
  //    Prefer the weekly_log's denormalized snapshot columns (migrations
  //    0058/0071) when populated; fall back to the legacy `learnings` /
  //    `challenges` / `next_week_goals` / `supervisor_feedback` columns.
  const supportingEvidenceSummary: string = (() => {
    if (weeklyLogAny.supporting_evidence && Array.isArray(weeklyLogAny.supporting_evidence)) {
      const list = weeklyLogAny.supporting_evidence as Array<{ name?: string; url?: string }>;
      if (list.length > 0) {
        return list
          .map((e, i) => `${i + 1}. ${e.name || e.url || "evidence"}`)
          .join("\n");
      }
    }
    return weeklyLog.next_week_goals || "See attached evidence files.";
  })();

  // Supervisor remarks: prefer site_supervisor_remarks (Industry Supervisor),
  // then faculty_supervisor_remarks (Faculty Supervisor), then the legacy
  // `supervisor_feedback` column. For the Word template's "Supervisor Remarks"
  // section, the Industry Supervisor's remarks are most appropriate.
  const supervisorRemarks =
    weeklyLogAny.site_supervisor_remarks ||
    weeklyLogAny.faculty_supervisor_remarks ||
    weeklyLog.supervisor_feedback ||
    "";

  const data: WeeklyReportData = {
    universityName: university.name,
    universityLogoBuffer,
    departmentName: departmentName || "Faculty of Computer Science",
    programName: internship.programs?.name || weeklyLogAny.program_name || "—",
    studentName: profile.full_name || "—",
    studentRegistrationNumber:
      weeklyLogAny.student_registration_no ||
      student.student_id_number ||
      "—",
    hostOrganization: internship.companies?.name || "—",
    weekNumber: weeklyLog.week_number,
    reportingPeriodStart: weeklyLog.week_start_date,
    reportingPeriodEnd: weeklyLog.week_end_date,
    supervisorName,
    dailyEntries,
    // Learning Outcomes / Skills Gained
    learningOutcomes: weeklyLogAny.learning_outcomes || weeklyLog.learnings || "",
    // Challenges Faced and Solutions
    challengesFaced: weeklyLogAny.challenges_solutions || weeklyLog.challenges || "",
    // Supporting Evidence (Mandatory)
    supportingEvidence: supportingEvidenceSummary,
    // Supervisor Remarks
    supervisorRemarks,
    studentSignatureBuffer,
    industrySupervisorSignatureBuffer,
    facultySupervisorSignatureBuffer,
  };

  return data;
}

// ----------------------------------------------------------------------------
// Template Processor
// ----------------------------------------------------------------------------

/**
 * Locate the absolute path to the bundled template file.
 * Falls back gracefully if running in a bundled environment.
 */
async function getTemplatePath(): Promise<string> {
  // Try multiple locations (src layout, dist layout).
  const candidates = [
    path.join(process.cwd(), "src/lib/document-generation/templates/weekly-activity-report-template.docx"),
    path.join(process.cwd(), "public/templates/weekly-activity-report-template.docx"),
    path.join(__dirname, "templates/weekly-activity-report-template.docx"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("Weekly report template not found. Expected at src/lib/document-generation/templates/weekly-activity-report-template.docx");
}

/**
 * Escape text for safe insertion into Word XML.
 * Replaces & < > " ' with their entity equivalents.
 */
function escapeXml(text: string): string {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format a date as a friendly display string (e.g. "Aug 25, 2026").
 */
function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Build a Word XML <w:t> run with the given text.
 * If the text contains newlines, splits into multiple runs separated by <w:br/>.
 */
function buildTextRun(text: string): string {
  const escaped = escapeXml(text);
  if (!escaped.includes("\n")) {
    return `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
  }
  // Split on newlines and insert <w:br/> between.
  const parts = escaped.split("\n");
  const runs = parts
    .map((p, i) => {
      const br = i > 0 ? "<w:r><w:br/></w:r>" : "";
      return `${br}<w:r><w:t xml:space="preserve">${p}</w:t></w:r>`;
    })
    .join("");
  return runs;
}

/**
 * Generate a relationship ID for a new image.
 */
function generateRelId(): string {
  return `rId${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build the XML for an inline image (drawing element).
 *
 * @param relId The relationship ID (must match an entry in document.xml.rels)
 * @param widthPx Image width in pixels (will be converted to EMU)
 * @param heightPx Image height in pixels
 */
function buildInlineImageXml(relId: string, widthPx: number, heightPx: number): string {
  // EMU = English Metric Units. 1 inch = 914400 EMU. 1 px @ 96 DPI = 9525 EMU.
  const widthEmu = Math.round(widthPx * 9525);
  const heightEmu = Math.round(heightPx * 9525);
  return `<w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
      <wp:effectExtent l="0" t="0" r="0" b="0"/>
      <wp:docPr id="${Math.floor(Math.random() * 100000)}" name="Picture ${relId}"/>
      <wp:cNvGraphicFramePr/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr>
              <pic:cNvPr id="${Math.floor(Math.random() * 100000)}" name="Generated Image"/>
              <pic:cNvPicPr/>
            </pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
              <a:stretch><a:fillRect/></a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm>
                <a:off x="0" y="0"/>
                <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
              </a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>`;
}

/**
 * Detect image format from a Buffer (PNG / JPEG / GIF / BMP).
 * Returns the ContentTypes extension + MIME type.
 */
function detectImageFormat(buf: Buffer): { ext: string; mime: string } {
  if (buf.length < 4) return { ext: "png", mime: "image/png" };
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpeg", mime: "image/jpeg" };
  }
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { ext: "gif", mime: "image/gif" };
  }
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4d) {
    return { ext: "bmp", mime: "image/bmp" };
  }
  return { ext: "png", mime: "image/png" };
}

/**
 * Replace the first occurrence of a label-followed-by-empty-cell pattern
 * with the supplied value. Used to populate the "Student Information" table.
 *
 * The pattern in the XML is roughly:
 *   <w:tc><w:p>...<w:t>Student Name</w:t>...</w:p></w:tc>
 *   <w:tc><w:p>...<w:t></w:t>...</w:p></w:tc>   ← empty cell — INJECT HERE
 *
 * We find the label cell, then find the NEXT <w:tc> after it, and inject
 * the value into its <w:p>.
 *
 * SPLIT-LABEL HANDLING:
 * Word frequently splits a logical label (e.g. "Student Name") across
 * multiple <w:r><w:t>...</w:t></w:r> runs (e.g. "Student" + " Name"). The
 * naive single-regex `<w:t>...Student Name...</w:t>` therefore misses most
 * of the labels in this template. We instead walk every <w:tc>...</w:tc>
 * chunk in the document, extract its plain text (concatenation of all
 * <w:t>...</w:t> contents), and compare against the supplied label.
 */
function injectValueAfterLabel(
  documentXml: string,
  labelText: string,
  value: string
): { xml: string; replaced: boolean } {
  // Walk every <w:tc>...</w:tc> chunk and find the one whose plain text
  // matches the label. The match is case-sensitive + whitespace-collapsed.
  const normalizedLabel = labelText.replace(/\s+/g, " ").trim();
  const tcRegex = /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
  let match: RegExpExecArray | null;
  let labelCellEndIdx = -1;

  while ((match = tcRegex.exec(documentXml)) !== null) {
    const cellXml = match[0];
    const plain = extractCellPlainText(cellXml);
    if (plain.replace(/\s+/g, " ").trim() === normalizedLabel) {
      labelCellEndIdx = match.index + cellXml.length;
      break;
    }
  }

  if (labelCellEndIdx === -1) {
    return { xml: documentXml, replaced: false };
  }

  // Find the NEXT <w:tc>...</w:tc> after the label cell.
  const afterLabel = documentXml.slice(labelCellEndIdx);
  const nextTcMatch = afterLabel.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/);
  if (!nextTcMatch) {
    return { xml: documentXml, replaced: false };
  }
  const nextTcAbsIdx = labelCellEndIdx + afterLabel.indexOf(nextTcMatch[0]);
  const nextTcEnd = nextTcAbsIdx + nextTcMatch[0].length;

  // Find the first <w:p>...</w:p> inside the value cell.
  const pMatch = nextTcMatch[0].match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
  if (!pMatch) {
    // Cell has no paragraph — create a fresh one and inject.
    const newCell = `<w:tc>${buildParagraphWithText(value)}</w:tc>`;
    const newXml =
      documentXml.slice(0, nextTcAbsIdx) +
      newCell +
      documentXml.slice(nextTcEnd);
    return { xml: newXml, replaced: true };
  }
  const pAbsIdx = nextTcAbsIdx + nextTcMatch[0].indexOf(pMatch[0]);
  const pEndIdx = pAbsIdx + pMatch[0].length;

  // Preserve the paragraph's <w:pPr> if present, drop everything else.
  const pPrMatch = pMatch[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const newP = `<w:p>${pPr}${buildTextRun(value)}</w:p>`;

  const newXml =
    documentXml.slice(0, pAbsIdx) + newP + documentXml.slice(pEndIdx);
  return { xml: newXml, replaced: true };
}

/**
 * Concatenate the text content of every <w:t>...</w:t> in the supplied XML
 * fragment. Used to read a Word table cell's plain text even when the cell's
 * label is split across multiple runs.
 */
function extractCellPlainText(cellXml: string): string {
  const parts: string[] = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = tRegex.exec(cellXml)) !== null) {
    parts.push(unescapeXml(m[1]));
  }
  return parts.join("");
}

/**
 * Reverse the escapeXml() transformation (entities → characters).
 * Used when reading text out of <w:t> elements.
 */
function unescapeXml(s: string): string {
  if (!s) return "";
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Build a fresh <w:p> paragraph containing a single text run.
 * Word inserts a blank <w:pPr/> for empty paragraphs; we mimic this.
 */
function buildParagraphWithText(text: string): string {
  return `<w:p>${buildTextRun(text)}</w:p>`;
}

/**
 * Populate the "Weekly Activities" table (Day/Date | Tasks Performed | Hours).
 *
 * For each day (Monday-Friday), find the row whose first cell contains the
 * day name, then inject the date + tasks + hours into the next cells.
 */
function populateWeeklyActivitiesTable(
  documentXml: string,
  dailyEntries: WeeklyReportData["dailyEntries"]
): { xml: string; replacedCount: number } {
  let xml = documentXml;
  let replacedCount = 0;

  // Walk every <w:tr>...</w:tr> in the document. For each day (Mon-Fri),
  // find the row whose FIRST cell's plain text equals the day name, then
  // mutate that row's 3 cells in place: (0) day label + date, (1) tasks,
  // (2) hours. This is far more reliable than the prior approach which
  // modified the day-label run in flight and then failed to locate the
  // adjacent tasks/hours cells.
  for (const entry of dailyEntries) {
    const dayLabel = entry.dayName;

    // Build the new label text for the first cell:
    //   "Monday\nAug 25, 2026" or "Monday — HOLIDAY\nAug 25, 2026"
    let dayLabelText: string = dayLabel;
    if (entry.isHoliday) {
      dayLabelText = `${dayLabel} — HOLIDAY`;
    }
    if (entry.date) {
      dayLabelText = `${dayLabelText}\n${formatDate(entry.date)}`;
    }

    const trRegex = /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g;
    let trMatch: RegExpExecArray | null;
    let targetRowXml: string | null = null;
    let targetRowStartIdx = -1;
    let targetRowEndIdx = -1;

    while ((trMatch = trRegex.exec(xml)) !== null) {
      const rowXml = trMatch[0];
      const firstTc = rowXml.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/);
      if (!firstTc) continue;
      const firstCellPlain = extractCellPlainText(firstTc[0]).replace(/\s+/g, " ").trim();
      if (firstCellPlain === dayLabel) {
        targetRowXml = rowXml;
        targetRowStartIdx = trMatch.index;
        targetRowEndIdx = trMatch.index + rowXml.length;
        break;
      }
    }

    if (targetRowXml === null) continue;

    // Collect ALL <w:tc>...</w:tc> cells in this row in order.
    const cellRegex = /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
    const cells: Array<{ start: number; end: number; xml: string }> = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRegex.exec(targetRowXml)) !== null) {
      cells.push({ start: cm.index, end: cm.index + cm[0].length, xml: cm[0] });
    }
    if (cells.length < 3) continue;

    // Build the new (possibly modified) cell XMLs.
    const newRowParts: string[] = [];

    // Cell 0: day label + date
    {
      const cell0Xml = cells[0].xml;
      const pMatch = cell0Xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
      const pPr = pMatch?.[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
      const newP = `<w:p>${pPr}${buildTextRun(dayLabelText)}</w:p>`;
      let newCell0: string;
      if (pMatch) {
        const pStart = cell0Xml.indexOf(pMatch[0]);
        const pEnd = pStart + pMatch[0].length;
        newCell0 = cell0Xml.slice(0, pStart) + newP + cell0Xml.slice(pEnd);
      } else {
        const tcOpenEnd = cell0Xml.indexOf(">") + 1;
        newCell0 = cell0Xml.slice(0, tcOpenEnd) + newP + cell0Xml.slice(tcOpenEnd);
      }
      newRowParts.push(newCell0);
      replacedCount++;
    }

    // Cell 1: tasks performed
    {
      const cell1Xml = cells[1].xml;
      const pMatch = cell1Xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
      const pPr = pMatch?.[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
      const newP = `<w:p>${pPr}${buildTextRun(entry.tasksPerformed || "")}</w:p>`;
      let newCell1: string;
      if (pMatch) {
        const pStart = cell1Xml.indexOf(pMatch[0]);
        const pEnd = pStart + pMatch[0].length;
        newCell1 = cell1Xml.slice(0, pStart) + newP + cell1Xml.slice(pEnd);
      } else {
        const tcOpenEnd = cell1Xml.indexOf(">") + 1;
        newCell1 = cell1Xml.slice(0, tcOpenEnd) + newP + cell1Xml.slice(tcOpenEnd);
      }
      newRowParts.push(newCell1);
      replacedCount++;
    }

    // Cell 2: hours worked
    {
      const cell2Xml = cells[2].xml;
      const pMatch = cell2Xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
      const pPr = pMatch?.[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
      const hoursText = entry.isHoliday ? "—" : String(entry.hoursWorked || 0);
      const newP = `<w:p>${pPr}${buildTextRun(hoursText)}</w:p>`;
      let newCell2: string;
      if (pMatch) {
        const pStart = cell2Xml.indexOf(pMatch[0]);
        const pEnd = pStart + pMatch[0].length;
        newCell2 = cell2Xml.slice(0, pStart) + newP + cell2Xml.slice(pEnd);
      } else {
        const tcOpenEnd = cell2Xml.indexOf(">") + 1;
        newCell2 = cell2Xml.slice(0, tcOpenEnd) + newP + cell2Xml.slice(tcOpenEnd);
      }
      newRowParts.push(newCell2);
      replacedCount++;
    }

    // Rebuild the row: interleave the (possibly modified) cells with the
    // non-cell text fragments between them.
    let newRow = "";
    let lastEnd = 0;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      newRow += targetRowXml.slice(lastEnd, c.start);
      newRow += i < newRowParts.length ? newRowParts[i] : c.xml;
      lastEnd = c.end;
    }
    newRow += targetRowXml.slice(lastEnd);

    // Splice the new row back into the global xml.
    xml = xml.slice(0, targetRowStartIdx) + newRow + xml.slice(targetRowEndIdx);
  }

  return { xml, replacedCount };
}

/**
 * Find a label like "Learning Outcomes / Skills Gained" and inject the
 * supplied text into the paragraph that FOLLOWS the label paragraph.
 *
 * SPLIT-LABEL HANDLING:
 * Word frequently splits a logical label (e.g. "Learning Outcomes /
 * Skills Gained") across multiple <w:r><w:t>...</w:t></w:r> runs. The
 * naive single-regex `<w:t>...Learning Outcomes...</w:t>` therefore
 * misses the label. We instead walk every <w:p>...</w:p> in the
 * document, extract its plain text, and compare against the supplied
 * label — then target the NEXT paragraph for injection.
 */
function injectParagraphAfterLabel(
  documentXml: string,
  labelText: string,
  value: string
): { xml: string; replaced: boolean } {
  const normalizedLabel = labelText.replace(/\s+/g, " ").trim();
  // Walk every <w:p>...</w:p> chunk; locate the one whose plain text matches.
  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  let labelPStartIdx = -1;
  let labelPEndIdx = -1;

  while ((match = pRegex.exec(documentXml)) !== null) {
    const pXml = match[0];
    // Extract paragraph plain text — concatenate all <w:t>...</w:t> contents.
    const parts: string[] = [];
    let tExec: RegExpExecArray | null;
    const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    while ((tExec = tRe.exec(pXml)) !== null) {
      parts.push(unescapeXml(tExec[1]));
    }
    const plain = parts.join("").replace(/\s+/g, " ").trim();
    if (plain === normalizedLabel) {
      labelPStartIdx = match.index;
      labelPEndIdx = match.index + pXml.length;
      break;
    }
  }

  if (labelPStartIdx === -1) {
    return { xml: documentXml, replaced: false };
  }

  // Find the NEXT <w:p>...</w:p> after the label paragraph.
  const afterLabel = documentXml.slice(labelPEndIdx);
  const nextPMatch = afterLabel.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
  if (!nextPMatch) {
    // No next paragraph — append a new paragraph right after the label's paragraph
    const newPara = `<w:p>${buildTextRun(value)}</w:p>`;
    return {
      xml: documentXml.slice(0, labelPEndIdx) + newPara + documentXml.slice(labelPEndIdx),
      replaced: true,
    };
  }
  const nextPStartIdx = labelPEndIdx + afterLabel.indexOf(nextPMatch[0]);
  const nextPEndIdx = nextPStartIdx + nextPMatch[0].length;

  // Preserve the paragraph's <w:pPr> if present, drop everything else.
  const pPrMatch = nextPMatch[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const newPara = `<w:p>${pPr}${buildTextRun(value)}</w:p>`;
  return {
    xml: documentXml.slice(0, nextPStartIdx) + newPara + documentXml.slice(nextPEndIdx),
    replaced: true,
  };
}

/**
 * Append a signature image inline after a "Signature" label.
 * Returns the modified XML + the relationship ID that was added (so the
 * caller can register it in document.xml.rels).
 *
 * SPLIT-LABEL HANDLING:
 * Word frequently splits a logical label like "Student Signature" across
 * multiple <w:r><w:t>...</w:t></w:r> runs. We walk every <w:tc>...</w:tc>
 * chunk and match its plain text against the label, then insert a new
 * paragraph with the inline drawing immediately after that cell's last
 * paragraph (or just inside the cell, before </w:tc>).
 */
function appendSignatureAfterLabel(
  documentXml: string,
  labelText: string,
  imageBuffer: Buffer | null
): { xml: string; relId?: string; imageAdded: boolean } {
  if (!imageBuffer) {
    return { xml: documentXml, imageAdded: false };
  }

  const normalizedLabel = labelText.replace(/\s+/g, " ").trim();
  const tcRegex = /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
  let match: RegExpExecArray | null;
  let targetCellEndIdx = -1;

  while ((match = tcRegex.exec(documentXml)) !== null) {
    const cellXml = match[0];
    const plain = extractCellPlainText(cellXml);
    if (plain.replace(/\s+/g, " ").trim() === normalizedLabel) {
      targetCellEndIdx = match.index + cellXml.length;
      break;
    }
  }

  if (targetCellEndIdx === -1) {
    return { xml: documentXml, imageAdded: false };
  }

  const relId = generateRelId();
  // Build a new paragraph containing the inline image.
  // Standard signature image: 150x60 pixels (1.5 inch x 0.6 inch)
  const drawingXml = buildInlineImageXml(relId, 150, 60);
  const newPara = `<w:p><w:r>${drawingXml}</w:r></w:p>`;

  // Insert the new paragraph immediately after the cell's last paragraph
  // (i.e. right before the cell's closing </w:tc>).
  // Find the last </w:p> before targetCellEndIdx.
  const cellEndRelativeIdx = documentXml.lastIndexOf("</w:tc>", targetCellEndIdx - 1);
  if (cellEndRelativeIdx === -1) {
    return { xml: documentXml, imageAdded: false };
  }
  // Find the last </w:p> before cellEndRelativeIdx.
  const lastPEndIdx = documentXml.lastIndexOf("</w:p>", cellEndRelativeIdx);
  if (lastPEndIdx === -1) {
    // No <w:p> in cell — insert one right inside <w:tc>
    const tcStartIdx = documentXml.lastIndexOf("<w:tc", cellEndRelativeIdx);
    const tcOpenEnd = documentXml.indexOf(">", tcStartIdx) + 1;
    const newXml =
      documentXml.slice(0, tcOpenEnd) +
      newPara +
      documentXml.slice(tcOpenEnd);
    return { xml: newXml, relId, imageAdded: true };
  }
  // Insert after the last </w:p>
  const insertAt = lastPEndIdx + "</w:p>".length;
  const newXml =
    documentXml.slice(0, insertAt) + newPara + documentXml.slice(insertAt);
  return { xml: newXml, relId, imageAdded: true };
}

// ----------------------------------------------------------------------------
// Main template processor
// ----------------------------------------------------------------------------

/**
 * Populate the weekly report template with the supplied data.
 *
 * @param data The assembled weekly report data.
 * @returns The populated .docx file as a Buffer, or throws on failure.
 */
export async function populateWeeklyReportTemplate(
  data: WeeklyReportData
): Promise<GenerationResult> {
  const startTime = Date.now();
  const fieldsPopulated: string[] = [];
  const imagesEmbedded: string[] = [];

  // 1. Load the template file as a Buffer
  const templatePath = await getTemplatePath();
  const templateBuffer = await fs.readFile(templatePath);

  // 2. Unzip with JSZip
  const zip = await JSZip.loadAsync(templateBuffer);

  // 3. Read document.xml
  let documentXml = await zip.file("word/document.xml")!.async("string");
  let headerXml = await zip.file("word/header1.xml")!.async("string");

  // 4. HEADER: Replace the placeholder university name + faculty/department name
  // with the student's actual values.
  //
  // The supplied IIUI template hardcodes TWO things in the header that must
  // be substituted per-student so each university's report carries that
  // university's own branding:
  //
  //   (a) "Ibadat International University Islamabad" -> data.universityName
  //   (b) "Faculty of Computer Science"              -> data.departmentName
  //
  // Per the user's explicit instruction: "The wordfile is just a template
  // for every uni logo and name should be different." This is enforced both
  // here (text) and at step 5 below (logo image bytes).
  //
  // SPLIT-LABEL HANDLING:
  // The header stores the placeholders inside a textbox (`<wps:txbx>` +
  // `<v:textbox>` legacy fallback). Word splits each logical label across
  // multiple <w:r><w:t>...</w:t></w:r> runs — e.g. "Ibadat" + " " +
  // "International" + " " + "University" + " Islamabad". The naive
  // single-regex approach misses every split label. We instead walk every
  // <w:p>...</w:p> in the header XML, extract its plain text, and replace
  // matching paragraphs wholesale.

  // Set of (matcher, replacement) pairs.
  const headerReplacements: Array<{ match: RegExp; replacement: string; tag: string }> = [
    { match: /^Ibadat\s+International\s+University\s+Islamabad\s*$/i, replacement: data.universityName, tag: "university_name (header)" },
    { match: /^International\s+Islamic\s+University\s+Islamabad\s*$/i, replacement: data.universityName, tag: "university_name (header)" },
    { match: /\[UNIVERSITY_NAME\]/, replacement: data.universityName, tag: "university_name (header)" },
    { match: /\{university_name\}/i, replacement: data.universityName, tag: "university_name (header)" },
  ];
  if (data.departmentName && data.departmentName.trim().length > 0) {
    headerReplacements.push(
      { match: /^Faculty\s+of\s+Computer\s+Science\s*$/i, replacement: data.departmentName, tag: "department_name (header)" },
      { match: /\[DEPARTMENT_NAME\]/, replacement: data.departmentName, tag: "department_name (header)" },
      { match: /\[FACULTY_NAME\]/, replacement: data.departmentName, tag: "department_name (header)" },
      { match: /\{department_name\}/i, replacement: data.departmentName, tag: "department_name (header)" },
      { match: /\{faculty_name\}/i, replacement: data.departmentName, tag: "department_name (header)" }
    );
  }

  let headerXmlWork = headerXml;
  const headerReplacedTags = new Set<string>();

  // Walk every <w:p>...</w:p> in the header. Re-execute the regex after each
  // replacement because indices shift.
  let safetyCounter = 0;
  while (safetyCounter++ < 200) {
    const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let pMatch: RegExpExecArray | null;
    let didReplace = false;

    while ((pMatch = pRegex.exec(headerXmlWork)) !== null) {
      const pXml = pMatch[0];
      const plain = extractCellPlainText(pXml).replace(/\s+/g, " ").trim();
      if (!plain) continue;

      // Try each replacement matcher.
      for (const { match, replacement, tag } of headerReplacements) {
        // Test against the whole plain text (for the strict matchers) OR
        // search for the bracket-placeholder substring.
        const isStrict = match.source.startsWith("^");
        const matched = isStrict ? match.test(plain) : match.test(plain);
        if (!matched) continue;

        // Replace this paragraph's content: keep <w:pPr>, replace all
        // <w:r>...</w:r> with a single new run containing the replacement.
        const pPrMatch = pXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
        const pPr = pPrMatch ? pPrMatch[0] : "";
        const newP = `<w:p>${pPr}${buildTextRun(replacement)}</w:p>`;

        const pStart = pMatch.index;
        const pEnd = pStart + pXml.length;
        headerXmlWork =
          headerXmlWork.slice(0, pStart) + newP + headerXmlWork.slice(pEnd);
        headerReplacedTags.add(tag);
        didReplace = true;
        break; // re-execute the regex from start since indices shifted.
      }
      if (didReplace) break;
    }
    if (!didReplace) break;
  }

  for (const tag of headerReplacedTags) {
    fieldsPopulated.push(tag);
  }

  // Final sweep for any IIUI abbreviation tokens that survived (e.g. "IIUI"
  // appearing standalone as a single run somewhere).
  headerXmlWork = headerXmlWork.replace(/\bIIUI\b/g, escapeXml(data.universityName));

  headerXml = headerXmlWork;

  // 5. Replace the university logo in word/media/image1.png.
  if (data.universityLogoBuffer) {
    zip.file("word/media/image1.png", data.universityLogoBuffer);
    imagesEmbedded.push("university_logo");
  }

  // 6. BODY: Inject student information into the table.
  const studentInfoFields: Array<[string, string]> = [
    ["Student Name", data.studentName],
    ["Registration No.", data.studentRegistrationNumber],
    ["Host Organization", data.hostOrganization],
    ["Week No.", String(data.weekNumber)],
    [
      "Reporting Period",
      `${formatDate(data.reportingPeriodStart)} – ${formatDate(data.reportingPeriodEnd)}`,
    ],
    ["Supervisor", data.supervisorName],
  ];

  for (const [label, value] of studentInfoFields) {
    const result = injectValueAfterLabel(documentXml, label, value);
    if (result.replaced) {
      documentXml = result.xml;
      fieldsPopulated.push(label);
    }
  }

  // 7. Populate the weekly activities table (Mon-Fri).
  const activitiesResult = populateWeeklyActivitiesTable(documentXml, data.dailyEntries);
  documentXml = activitiesResult.xml;
  if (activitiesResult.replacedCount > 0) {
    fieldsPopulated.push(`weekly_activities (${activitiesResult.replacedCount} cells)`);
  }

  // 8. Inject reflection paragraphs.
  //    NOTE: the supplied template's "Supporting Evidence" section is labelled
  //    "Supporting Evidence (Mandatory)" — match the actual label so the
  //    substitution locates the paragraph correctly.
  const reflectionsFields: Array<[string, string]> = [
    ["Learning Outcomes / Skills Gained", data.learningOutcomes],
    ["Challenges Faced and Solutions", data.challengesFaced],
    ["Supporting Evidence (Mandatory)", data.supportingEvidence],
    ["Supervisor Remarks", data.supervisorRemarks],
  ];

  for (const [label, value] of reflectionsFields) {
    const result = injectParagraphAfterLabel(documentXml, label, value || "(not provided)");
    if (result.replaced) {
      documentXml = result.xml;
      fieldsPopulated.push(label);
    }
  }

  // 9. Inject program name (find "Program" label and inject the value).
  // The "Program" label is followed by a list of options (Computer Science,
  // Software Engineering, etc.) which is the original dropdown list. We
  // replace the entire list with just the selected program name.
  const programLabelPattern = /<w:t[^>]*>Program<\/w:t>[\s\S]*?(?=<w:tr|<\/w:tbl|<w:p)/;
  if (programLabelPattern.test(documentXml)) {
    // Find the next <w:tc> after "Program" label and replace its content.
    const result = injectValueAfterLabel(documentXml, "Program", data.programName);
    if (result.replaced) {
      documentXml = result.xml;
      fieldsPopulated.push("program");
    }
  }

  // 10. Inject signature images.
  const newImageRels: Array<{ relId: string; buffer: Buffer; ext: string; mime: string }> = [];

  const sig1Result = appendSignatureAfterLabel(documentXml, "Student Signature", data.studentSignatureBuffer);
  documentXml = sig1Result.xml;
  if (sig1Result.imageAdded && sig1Result.relId) {
    const fmt = detectImageFormat(data.studentSignatureBuffer!);
    newImageRels.push({ relId: sig1Result.relId, buffer: data.studentSignatureBuffer!, ext: fmt.ext, mime: fmt.mime });
    imagesEmbedded.push("student_signature");
  }

  const sig2Result = appendSignatureAfterLabel(documentXml, "Industry Supervisor", data.industrySupervisorSignatureBuffer);
  documentXml = sig2Result.xml;
  if (sig2Result.imageAdded && sig2Result.relId) {
    const fmt = detectImageFormat(data.industrySupervisorSignatureBuffer!);
    newImageRels.push({ relId: sig2Result.relId, buffer: data.industrySupervisorSignatureBuffer!, ext: fmt.ext, mime: fmt.mime });
    imagesEmbedded.push("industry_supervisor_signature");
  }

  const sig3Result = appendSignatureAfterLabel(documentXml, "Faculty Supervisor", data.facultySupervisorSignatureBuffer);
  documentXml = sig3Result.xml;
  if (sig3Result.imageAdded && sig3Result.relId) {
    const fmt = detectImageFormat(data.facultySupervisorSignatureBuffer!);
    newImageRels.push({ relId: sig3Result.relId, buffer: data.facultySupervisorSignatureBuffer!, ext: fmt.ext, mime: fmt.mime });
    imagesEmbedded.push("faculty_supervisor_signature");
  }

  // 11. Register new image relationships in document.xml.rels.
  if (newImageRels.length > 0) {
    let relsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");

    for (const img of newImageRels) {
      // Add the relationship entry
      const relEntry = `<Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.relId}.${img.ext}"/>`;
      // Insert before </Relationships>
      relsXml = relsXml.replace("</Relationships>", `${relEntry}</Relationships>`);

      // Add the image file to the zip
      zip.file(`word/media/${img.relId}.${img.ext}`, img.buffer);
    }

    zip.file("word/_rels/document.xml.rels", relsXml);
  }

  // 12. Update [Content_Types].xml to register new image extensions if needed.
  if (newImageRels.length > 0) {
    let contentTypesXml = await zip.file("[Content_Types].xml")!.async("string");
    const extensions = new Set(newImageRels.map((r) => r.ext));
    for (const ext of extensions) {
      const found = newImageRels.find((r) => r.ext === ext);
      const mime = found?.mime || "image/png";
      const entry = `<Default Extension="${ext}" ContentType="${mime}"/>`;
      if (!contentTypesXml.includes(`Extension="${ext}"`)) {
        contentTypesXml = contentTypesXml.replace("</Types>", `${entry}</Types>`);
      }
    }
    zip.file("[Content_Types].xml", contentTypesXml);
  }

  // 13. Write back the modified XML files.
  zip.file("word/document.xml", documentXml);
  zip.file("word/header1.xml", headerXml);

  // 14. Re-zip and return the buffer.
  const outputBuffer = await zip.generateAsync({
    type: "nodebuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });

  return {
    success: true,
    buffer: outputBuffer,
    metadata: {
      templateUsed: "weekly-activity-report-template.docx",
      fieldsPopulated,
      imagesEmbedded,
      durationMs: Date.now() - startTime,
    },
  };
}

// Helper alias kept for back-compat (no longer used after the bug fix above).
const newImageRelS: Array<{ relId: string; ext: string; mime: string }> = [];

// ----------------------------------------------------------------------------
// File Delivery
// ----------------------------------------------------------------------------

/**
 * Save the generated report to Supabase Storage (private bucket
 * "generated-reports") and insert a row in the `generated_reports` table.
 *
 * The bucket is private — only the user themselves (or authorized roles per
 * RLS) can download via signed URL.
 *
 * @returns The generated_reports row ID.
 */
export async function saveGeneratedReport(params: {
  studentId: string;
  internshipId: string;
  weeklyLogId?: string;
  weekNumber?: number;
  reportType: "weekly" | "weekly_log_template" | "final" | "midterm" | "custom";
  buffer: Buffer;
  filename: string;
  generatedBy: string;
  universityId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ reportId: string; storagePath: string; error?: string }> {
  const supabase = await createClient();

  // 1. Generate a safe storage path: generated-reports/<university_id>/<student_id>/<filename>
  const safeFilename = sanitizeFilename(params.filename);
  const storagePath = [
    params.universityId || "no-university",
    params.studentId,
    `${Date.now()}-${safeFilename}`,
  ].join("/");

  // 2. Upload the buffer to the private "generated-reports" bucket.
  // Note: bucket must exist; create via Supabase Dashboard or CLI.
  const { error: uploadErr } = await supabase.storage
    .from("generated-reports")
    .upload(storagePath, params.buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (uploadErr) {
    console.error("[doc-gen] Storage upload failed:", uploadErr);
    return { reportId: "", storagePath: "", error: uploadErr.message };
  }

  // 3. Insert the metadata row.
  const { data: reportRow, error: dbErr } = await supabase
    .from("generated_reports")
    .insert({
      student_id: params.studentId,
      internship_id: params.internshipId,
      report_type: params.reportType,
      week_number: params.weekNumber || null,
      storage_path: storagePath,
      filename: safeFilename,
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size_bytes: params.buffer.length,
      status: "completed",
      generated_by: params.generatedBy,
      university_id: params.universityId,
      metadata: params.metadata || {},
    })
    .select("id")
    .single();

  if (dbErr || !reportRow) {
    console.error("[doc-gen] DB insert failed:", dbErr);
    return { reportId: "", storagePath, error: dbErr?.message };
  }

  return { reportId: reportRow.id, storagePath };
}

/**
 * Sanitize a filename for safe storage.
 * Removes path traversal sequences, special characters, and trims length.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, "") // no path traversal
    .replace(/[\/\\]/g, "_") // no slashes
    .replace(/[<>:"|?*]/g, "") // no invalid chars
    .replace(/\s+/g, "-") // spaces to dashes
    .slice(0, 100); // cap length
}

/**
 * Generate a signed download URL for a previously-saved report.
 * Used by the secure download API endpoint.
 *
 * @param storagePath The storage_path from generated_reports row
 * @param expiresIn Seconds until the URL expires (default 60 = 1 minute)
 */
export async function createSignedDownloadUrl(
  storagePath: string,
  expiresIn: number = 60
): Promise<{ url: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("generated-reports")
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message || "Failed to create signed URL" };
  }
  return { url: data.signedUrl };
}
