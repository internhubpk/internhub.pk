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
  const { data: weeklyLog, error: wlErr } = await supabase
    .from("weekly_logs")
    .select(
      `
      id, week_number, week_start_date, week_end_date, status,
      student_id, internship_id, supervisor_id,
      tasks_completed, challenges, learnings, next_week_goals, hours_worked,
      supervisor_feedback, submitted_at,
      students:student_id (
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

  // 2. Fetch university + department.
  const { data: university } = await supabase
    .from("universities")
    .select("id, name, slug, logo_url")
    .eq("id", profile.university_id)
    .single();

  if (!university) {
    throw new Error("Student's university not found");
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
  const [universityLogoBuffer, studentSignatureBuffer, industrySupervisorSignatureBuffer, facultySupervisorSignatureBuffer] =
    await Promise.all([
      fetchUniversityLogo(university.logo_url),
      fetchSignatureImage(profile.signature_url || null),
      // Industry supervisor = site supervisor
      weeklyLog.supervisor_id
        ? (async () => {
            const { data: ss } = await supabase
              .from("supervisors")
              .select("user_id, profiles:user_id ( signature_url )")
              .eq("id", weeklyLog.supervisor_id)
              .single();
            return fetchSignatureImage((ss?.profiles as any)?.signature_url || null);
          })()
        : Promise.resolve(null),
      // Faculty supervisor — look up via student_internships
      (async () => {
        const { data: si } = await supabase
          .from("student_internships")
          .select("faculty_supervisor_id")
          .eq("internship_id", weeklyLog.internship_id)
          .eq("student_id", weeklyLog.student_id)
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
  const data: WeeklyReportData = {
    universityName: university.name,
    universityLogoBuffer,
    programName: internship.programs?.name || "—",
    studentName: profile.full_name || "—",
    studentRegistrationNumber: student.student_id_number || "—",
    hostOrganization: internship.companies?.name || "—",
    weekNumber: weeklyLog.week_number,
    reportingPeriodStart: weeklyLog.week_start_date,
    reportingPeriodEnd: weeklyLog.week_end_date,
    supervisorName,
    dailyEntries,
    learningOutcomes: weeklyLog.learnings || "",
    challengesFaced: weeklyLog.challenges || "",
    supportingEvidence: weeklyLog.next_week_goals || "See attached evidence files.",
    supervisorRemarks: weeklyLog.supervisor_feedback || "",
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
 */
function injectValueAfterLabel(
  documentXml: string,
  labelText: string,
  value: string
): { xml: string; replaced: boolean } {
  // Find the label position
  const labelPattern = `<w:t[^>]*>${escapeXml(labelText)}</w:t>`;
  const labelMatch = documentXml.match(labelPattern);
  if (!labelMatch) {
    return { xml: documentXml, replaced: false };
  }
  const labelIdx = documentXml.indexOf(labelMatch[0]);
  if (labelIdx === -1) {
    return { xml: documentXml, replaced: false };
  }

  // Find the next <w:tc> after the label (this is the value cell).
  const afterLabel = documentXml.slice(labelIdx);
  const tcStartMatch = afterLabel.match(/<w:tc[ >]/);
  if (!tcStartMatch) {
    return { xml: documentXml, replaced: false };
  }
  const tcStartOffset = afterLabel.indexOf(tcStartMatch[0]);
  const tcStartIdx = labelIdx + tcStartOffset;

  // Find the first <w:p> inside this <w:tc>
  const tcSegment = documentXml.slice(tcStartIdx);
  const pStartMatch = tcSegment.match(/<w:p[ >]/);
  if (!pStartMatch) {
    return { xml: documentXml, replaced: false };
  }
  const pStartOffset = tcSegment.indexOf(pStartMatch[0]);
  const pStartIdx = tcStartIdx + pStartOffset;

  // Find the closing </w:p> for this paragraph
  const pEndIdx = documentXml.indexOf("</w:p>", pStartIdx);
  if (pEndIdx === -1) {
    return { xml: documentXml, replaced: false };
  }

  // Replace the entire paragraph content with a fresh paragraph containing
  // just our injected value (preserves the paragraph's properties because
  // we re-create the <w:pPr> if it exists).
  // Strategy: insert a new <w:r><w:t>VALUE</w:t></w:r> just before </w:p>.
  // But first, remove any existing <w:r>...</w:r> elements inside this <w:p>
  // (so we don't end up with leftover placeholder text).
  const pContent = documentXml.slice(pStartIdx, pEndIdx + 6); // includes </w:p>

  // Extract <w:pPr>...</w:pPr> if present (paragraph properties — must preserve)
  const pPrMatch = pContent.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";

  // Build the new paragraph: <w:p><w:pPr>?<w:r><w:t>VALUE</w:t></w:r></w:p>
  const newParagraph = `<w:p>${pPr}${buildTextRun(value)}</w:p>`;

  // Replace the old paragraph with the new one.
  const newXml =
    documentXml.slice(0, pStartIdx) + newParagraph + documentXml.slice(pEndIdx + 6);

  return { xml: newXml, replaced: true };
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

  for (const entry of dailyEntries) {
    // Find the row containing the day name (e.g. "Monday")
    const dayLabel = entry.dayName;
    // The pattern in the XML is roughly:
    //   <w:tc><w:p>...<w:t>Monday</w:t>...</w:p></w:tc>
    //   <w:tc><w:p>...<w:t></w:t>...</w:p></w:tc>  ← tasks performed
    //   <w:tc><w:p>...<w:t></w:t>...</w:p></w:tc>  ← hours
    //
    // The day label cell may contain a date too. We'll append the date to
    // the day name in the same cell, and inject tasks/hours into the next two.

    const labelPattern = `<w:t[^>]*>${escapeXml(dayLabel)}</w:t>`;
    const labelMatch = xml.match(labelPattern);
    if (!labelMatch) continue;

    const labelIdx = xml.indexOf(labelMatch[0]);
    if (labelIdx === -1) continue;

    // Update the day label to include the date (e.g. "Monday\nAug 25, 2026")
    // OR mark as holiday: "Monday (Holiday: Independence Day)"
    let dayLabelText: string = dayLabel;
    if (entry.isHoliday) {
      dayLabelText = `${dayLabel} — HOLIDAY`;
    }
    if (entry.date) {
      dayLabelText = `${dayLabelText}\n${formatDate(entry.date)}`;
    }

    // Replace just the day label text (preserving the run structure)
    const newLabelRun = `<w:r><w:t xml:space="preserve">${escapeXml(dayLabelText)}</w:t></w:r>`;
    // Find the <w:r> that contains the label and replace its <w:t>
    const runStart = xml.lastIndexOf("<w:r>", labelIdx);
    const runEnd = xml.indexOf("</w:r>", labelIdx);
    if (runStart !== -1 && runEnd !== -1) {
      xml =
        xml.slice(0, runStart) +
        newLabelRun +
        xml.slice(runEnd + 6); // 6 = "</w:r>".length
    }

    // Recompute labelIdx after the replacement.
    const newLabelMatch = xml.match(`<w:t[^>]*>${escapeXml(dayLabelText).replace(/\n/g, "[^<]*")}</w:t>`);
    // Instead of relying on a complex regex, find the next 2 <w:tc> cells
    // after the day label position and inject tasks + hours.
    const updatedLabelIdx = xml.indexOf(newLabelRun);
    if (updatedLabelIdx === -1) continue;

    // Inject tasks performed into the NEXT <w:tc> after the day label
    const tasksResult = injectValueAfterLabel(xml, dayLabelText.split("\n")[0], entry.tasksPerformed);
    if (tasksResult.replaced) {
      xml = tasksResult.xml;
      replacedCount++;
    }

    // Inject hours into the NEXT-NEXT <w:tc> after tasks
    // This is trickier — injectValueAfterLabel finds the FIRST <w:tc> after the label.
    // We need the SECOND <w:tc> after the day label.
    // Strategy: find the day label position again, find the 2nd <w:tc> after it,
    // and inject hours there.
    const hoursLabelIdx = xml.indexOf(escapeXml(dayLabelText));
    if (hoursLabelIdx !== -1) {
      // Find the 2nd <w:tc> after this position
      const afterLabel2 = xml.slice(hoursLabelIdx);
      let tcCount = 0;
      let tcPos = -1;
      let searchFrom = 0;
      while (tcCount < 2) {
        const m = afterLabel2.slice(searchFrom).match(/<w:tc[ >]/);
        if (!m) break;
        tcPos = searchFrom + afterLabel2.slice(searchFrom).indexOf(m[0]);
        searchFrom = tcPos + 1;
        tcCount++;
      }
      if (tcPos !== -1) {
        // Find the <w:p> inside this 2nd <w:tc>
        const segment = xml.slice(hoursLabelIdx + tcPos);
        const pMatch = segment.match(/<w:p[ >]/);
        if (pMatch) {
          const pIdx = hoursLabelIdx + tcPos + segment.indexOf(pMatch[0]);
          const pEndIdx = xml.indexOf("</w:p>", pIdx);
          if (pEndIdx !== -1) {
            const pContent = xml.slice(pIdx, pEndIdx + 6);
            const pPrMatch = pContent.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
            const pPr = pPrMatch ? pPrMatch[0] : "";
            const hoursText = entry.isHoliday ? "—" : String(entry.hoursWorked || 0);
            const newPara = `<w:p>${pPr}${buildTextRun(hoursText)}</w:p>`;
            xml = xml.slice(0, pIdx) + newPara + xml.slice(pEndIdx + 6);
            replacedCount++;
          }
        }
      }
    }
  }

  return { xml, replacedCount };
}

/**
 * Find a label like "Learning Outcomes" and inject the supplied text into
 * the paragraph that FOLLOWS the label paragraph.
 */
function injectParagraphAfterLabel(
  documentXml: string,
  labelText: string,
  value: string
): { xml: string; replaced: boolean } {
  // Find the paragraph that contains the label
  const labelPattern = `<w:t[^>]*>${escapeXml(labelText)}</w:t>`;
  const labelMatch = documentXml.match(labelPattern);
  if (!labelMatch) {
    return { xml: documentXml, replaced: false };
  }
  const labelIdx = documentXml.indexOf(labelMatch[0]);
  // Find the end of the paragraph containing the label
  const pEndIdx = documentXml.indexOf("</w:p>", labelIdx);
  if (pEndIdx === -1) {
    return { xml: documentXml, replaced: false };
  }
  // Find the NEXT <w:p> after this one
  const nextPStartMatch = documentXml.slice(pEndIdx + 6).match(/<w:p[ >]/);
  if (!nextPStartMatch) {
    // No next paragraph — append a new paragraph right after the label's paragraph
    const newPara = `<w:p>${buildTextRun(value)}</w:p>`;
    return {
      xml: documentXml.slice(0, pEndIdx + 6) + newPara + documentXml.slice(pEndIdx + 6),
      replaced: true,
    };
  }
  const nextPStartIdx = pEndIdx + 6 + documentXml.slice(pEndIdx + 6).indexOf(nextPStartMatch[0]);
  const nextPEndIdx = documentXml.indexOf("</w:p>", nextPStartIdx);
  if (nextPEndIdx === -1) {
    return { xml: documentXml, replaced: false };
  }
  // Replace the next paragraph's content with our value
  const pContent = documentXml.slice(nextPStartIdx, nextPEndIdx + 6);
  const pPrMatch = pContent.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const newPara = `<w:p>${pPr}${buildTextRun(value)}</w:p>`;
  return {
    xml: documentXml.slice(0, nextPStartIdx) + newPara + documentXml.slice(nextPEndIdx + 6),
    replaced: true,
  };
}

/**
 * Append a signature image inline after a "Signature" label.
 * Returns the modified XML + the relationship ID that was added (so the
 * caller can register it in document.xml.rels).
 */
function appendSignatureAfterLabel(
  documentXml: string,
  labelText: string,
  imageBuffer: Buffer | null
): { xml: string; relId?: string; imageAdded: boolean } {
  if (!imageBuffer) {
    return { xml: documentXml, imageAdded: false };
  }

  const labelPattern = `<w:t[^>]*>${escapeXml(labelText)}</w:t>`;
  const labelMatch = documentXml.match(labelPattern);
  if (!labelMatch) {
    return { xml: documentXml, imageAdded: false };
  }
  const labelIdx = documentXml.indexOf(labelMatch[0]);
  // Find the end of the paragraph containing the label
  const pEndIdx = documentXml.indexOf("</w:p>", labelIdx);
  if (pEndIdx === -1) {
    return { xml: documentXml, imageAdded: false };
  }

  const relId = generateRelId();
  // Build a new paragraph containing the inline image.
  // Standard signature image: 150x60 pixels (1.5 inch x 0.6 inch)
  const drawingXml = buildInlineImageXml(relId, 150, 60);
  const newPara = `<w:p><w:r>${drawingXml}</w:r></w:p>`;

  const newXml =
    documentXml.slice(0, pEndIdx + 6) + newPara + documentXml.slice(pEndIdx + 6);

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

  // 4. HEADER: Replace the placeholder university name with the real one.
  // The header currently contains "Ibadat International University Islamabad"
  // (or similar). We replace it with the student's actual university name.
  // Strategy: find all <w:t> elements containing "Ibadat" or "University"
  // and replace the text with the real university name.
  const placeholderPatterns = [
    /Ibadat\s+International\s+University\s+Islamabad/gi,
    /International\s+Islamic\s+University\s+Islamabad/gi,
    /\[UNIVERSITY_NAME\]/g,
    /\{university_name\}/gi,
    /IIUI/g,  // abbreviation form
  ];

  let headerModified = false;
  for (const pattern of placeholderPatterns) {
    if (pattern.test(headerXml)) {
      headerXml = headerXml.replace(pattern, escapeXml(data.universityName));
      headerModified = true;
    }
  }
  // Always set the university name in the header — even if no placeholder
  // was matched, replace the first text run with the university name.
  // Find the first <w:t>...</w:t> in the header and replace its text.
  if (!headerModified) {
    headerXml = headerXml.replace(
      /<w:t[^>]*>([^<]*)<\/w:t>/,
      (match, content) => {
        // Only replace if the content looks like a university name placeholder
        if (content && content.length > 5 && !content.includes("@")) {
          return match.replace(content, escapeXml(data.universityName));
        }
        return match;
      }
    );
  }
  fieldsPopulated.push("university_name (header)");

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
  const reflectionsFields: Array<[string, string]> = [
    ["Learning Outcomes / Skills Gained", data.learningOutcomes],
    ["Challenges Faced and Solutions", data.challengesFaced],
    ["Supporting Evidence", data.supportingEvidence],
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
