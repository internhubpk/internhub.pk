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
import { buildOleObjectBin } from "./ole-package";
import { PDF_ICON, DOCX_ICON, XLS_ICON, FILE_ICON } from "./ole-icons";

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
  // Supporting-evidence attachments — the ACTUAL files/links, appended at the
  // end of the generated document (centered images for pictures, hyperlinks
  // for links, embedded OLE package objects for PDF/DOCX/other files so the
  // original file is double-clickable inside Word).
  evidenceAttachments: EvidenceAttachment[];
  // Supervisor remarks (filled by supervisor; blank at student's submission)
  supervisorRemarks: string;
  // Signature image buffers
  studentSignatureBuffer: Buffer | null;
  industrySupervisorSignatureBuffer: Buffer | null;
  facultySupervisorSignatureBuffer: Buffer | null;
}

/** One supporting-evidence item as resolved for the Word report. */
export interface EvidenceAttachment {
  kind: "image" | "file" | "link";
  /** Display name (filename for uploads, label for links). */
  name: string;
  /** External URL (links only). */
  url?: string;
  /** Raw bytes (images and files). */
  buffer?: Buffer;
  /** File extension without dot, e.g. "pdf". */
  ext?: string;
  /** MIME type. */
  mime?: string;
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

/**
 * Resolve the supporting_evidence jsonb array of a weekly log into concrete
 * attachments for the Word report:
 *
 *   - link entries  → { kind: "link" }               (rendered as hyperlinks)
 *   - image files   → { kind: "image", buffer }      (embedded, centered)
 *   - other files   → { kind: "file", buffer }       (embedded as OLE package
 *                                                     objects — double-click
 *                                                     opens the original file)
 *
 * Signed storage URLs expire (7-day TTL), so files are downloaded by their
 * STORAGE PATH via the service-role client when available; the signed URL is
 * only used as a fallback. Failures degrade to a link (when a URL is known)
 * or are skipped — never fail the whole report because one evidence file
 * could not be fetched.
 */
async function buildEvidenceAttachments(
  supportingEvidence: unknown
): Promise<EvidenceAttachment[]> {
  if (!Array.isArray(supportingEvidence)) return [];
  const out: EvidenceAttachment[] = [];

  for (const raw of supportingEvidence) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as {
      name?: string;
      url?: string;
      type?: string;
      link?: boolean;
      size?: number;
    };
    const name = (e.name || "").trim() || "evidence";
    const url = (e.url || "").trim();

    // 1. Link evidence (typed into the form) or a non-storage external URL.
    const isStorageUrl = /\/storage\/v1\/object\//.test(url);
    if (e.link === true || e.type === "link" || (url && !isStorageUrl && url.startsWith("http"))) {
      if (url || name) out.push({ kind: "link", name, url: url || undefined });
      continue;
    }

    // 2. File evidence — fetch the bytes.
    if (!url) continue;
    const buffer = await fetchEvidenceBuffer(url, name);
    if (!buffer || buffer.length === 0) {
      // Could not re-fetch (e.g. expired signed URL and no service key) —
      // keep the item visible as a link when we at least have a URL.
      if (isStorageUrl) continue; // dead internal URL — nothing useful to show
      out.push({ kind: "link", name, url });
      continue;
    }

    // 3. Classify: Word-renderable raster images are embedded inline;
    //    everything else becomes an OLE package attachment.
    const fmt = detectImageFormat(buffer);
    const extFromName = (name.split(".").pop() || "").toLowerCase();
    if (fmt && ["png", "jpeg", "gif", "bmp"].includes(fmt.ext)) {
      out.push({ kind: "image", name, buffer, ext: fmt.ext, mime: fmt.mime });
    } else {
      out.push({
        kind: "file",
        name,
        buffer,
        ext: extFromName || fmt?.ext || "bin",
        mime: e.type || undefined,
      });
    }
  }
  return out;
}

/**
 * Download one evidence file's bytes.
 *
 * Handles Supabase storage URLs of the shapes:
 *   https://<ref>.supabase.co/storage/v1/object/sign/documents/<path>?token=…
 *   https://<ref>.supabase.co/storage/v1/object/public/documents/<path>
 *   https://<ref>.supabase.co/storage/v1/object/authenticated/documents/<path>?…
 * and bare storage paths ("documents/<path>" or "<user>/…").
 *
 * Strategy: extract the bucket + path and download with the service-role
 * client (immune to signed-URL expiry); fall back to a plain fetch of the
 * URL (works while the signature is still valid).
 */
async function fetchEvidenceBuffer(url: string, name: string): Promise<Buffer | null> {
  try {
    let bucket: string | null = null;
    let objectPath: string | null = null;

    const m = url.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/([^?#]+)/);
    if (m) {
      bucket = m[1];
      objectPath = decodeURIComponent(m[2]);
    } else if (!/^https?:\/\//i.test(url)) {
      // Bare path — try the documents bucket first, then treat the first
      // segment as a possible bucket name.
      bucket = "documents";
      objectPath = url;
    }

    if (bucket && objectPath) {
      const url2 = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url2 && serviceKey) {
        const client = createServiceRoleClient(url2, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client.storage
          .from(bucket)
          .download(objectPath);
        if (!error && data) {
          return Buffer.from(await data.arrayBuffer());
        }
        console.warn(
          `[doc-gen] evidence service-role download failed (${name}):`,
          error?.message
        );
      }
    }

    // Fallback: fetch the URL directly (signed URL still valid).
    const resp = await fetch(url);
    if (resp.ok) {
      const ab = await resp.arrayBuffer();
      if (ab.byteLength > 0) return Buffer.from(ab);
    }
    console.warn(`[doc-gen] evidence fetch failed (${name}): HTTP ${resp.status}`);
    return null;
  } catch (err) {
    console.warn(`[doc-gen] evidence fetch threw (${name}):`, err);
    return null;
  }
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

  // 1. Fetch the weekly log with all its scalar columns (NO embedded joins —
  //    see note below).
  //    weekly_logs uses `student_user_id` (NOT `student_id`) — confirmed live
  //    via Supabase Management API.
  //
  //    weekly_logs also carries snapshotted program_name / department_name /
  //    university_logo_url / *_signature_url / *_remarks columns (migrations
  //    0058, 0071) — included so the Word template's "Faculty of Computer
  //    Science" header text can be substituted per-student per spec.
  //
  //    IMPORTANT: the previous shape embedded
  //      `students:student_user_id ( profiles:user_id (...) )`
  //    which PostgREST CANNOT resolve on the live schema — `students` has two
  //    FKs to `profiles` (user_id + faculty_supervisor_id), so the
  //    `profiles:user_id` embed is ambiguous and the whole request failed
  //    with "Could not embed because more than one relationship was found".
  //    Student / profile / internship rows are now fetched with separate,
  //    unambiguous queries.
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
      site_supervisor_remarks, faculty_supervisor_remarks
      `
    )
    .eq("id", weeklyLogId)
    .single();

  if (wlErr || !weeklyLog) {
    throw new Error(`Weekly log not found: ${wlErr?.message || "unknown"}`);
  }

  // 1a. Student row (registration number, program / department ids).
  const { data: studentData } = await supabase
    .from("students")
    .select("user_id, student_id_number, program_id, department_id")
    .eq("user_id", weeklyLog.student_user_id)
    .maybeSingle();
  const student = studentData as any;

  // 1b. Profile row (name, email, university). NOTE: `profiles` has no
  //     `signature_url` column on the live DB — the student's signature is
  //     read from weekly_logs.student_signature_url instead.
  const { data: profileData } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, university_id, program_id")
    .eq("user_id", weeklyLog.student_user_id)
    .maybeSingle();
  const profile = profileData as any;

  // 1c. Internship row (title, company, program) — the company/program
  //     embeds on `internships` resolve fine (single FK each).
  let internship: any = null;
  if (weeklyLog.internship_id) {
    const { data: internshipData } = await supabase
      .from("internships")
      .select(
        `
        id, title, company_id, program_id,
        companies:company_id ( name, logo_url ),
        programs:program_id ( name, code )
        `
      )
      .eq("id", weeklyLog.internship_id)
      .maybeSingle();
    internship = internshipData as any;
  }

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

  // Program name resolution (bug fix 2026-08-26: report showed "—" when the
  // internship had no program and the weekly-log snapshot was empty).
  //
  // Priority — the "Program" field on a university weekly report is the
  // STUDENT'S enrolled degree program, not the internship's category:
  //   1. weekly_logs.program_name  — snapshotted at submit time
  //   2. the student's program     — students.program_id (canonical) or
  //                                 profiles.program_id (fallback) resolved
  //                                 via the programs table
  //   3. the internship's program  — internships.program_id (last resort;
  //                                 usually equals the student's program)
  //   4. "—"
  const studentProgramId: string | null =
    student.program_id || profile.program_id || null;
  let studentProgramName: string | null = null;
  if (studentProgramId) {
    const { data: programRow } = await supabase
      .from("programs")
      .select("name, code")
      .eq("id", studentProgramId)
      .maybeSingle();
    if (programRow?.name) {
      studentProgramName = programRow.name;
    }
  }
  const programName: string | null =
    (weeklyLog as any).program_name ||
    studentProgramName ||
    internship?.programs?.name ||
    null;

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
      // Student signature: weekly_log.student_signature_url (uploaded via the
      // weekly-log form). The old fallback referenced `profile.signature_url`,
      // a column that does not exist on the live `profiles` table.
      fetchSignatureImage(weeklyLogAny.student_signature_url || null),
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
  // 7. Resolve supporting-evidence attachments (the actual files/links —
  //    embedded at the END of the generated document).
  const evidenceAttachments = await buildEvidenceAttachments(
    (weeklyLogAny as any).supporting_evidence
  );

  // 7a. Body-section summary text ("Supporting Evidence (Mandatory)").
  //     Each item states where it can be found in the document:
  //     images are embedded below, files are attached below, links are live.
  const supportingEvidenceSummary: string = (() => {
    if (evidenceAttachments.length > 0) {
      return evidenceAttachments
        .map((e, i) => {
          if (e.kind === "link") return `${i + 1}. Link: ${e.url || e.name}`;
          const ext = (e.ext || "").toUpperCase();
          if (e.kind === "image") return `${i + 1}. ${e.name} (image — embedded in the Attachments section)`;
          return `${i + 1}. ${e.name}${ext ? ` (${ext} file — attached in the Attachments section)` : " (attached in the Attachments section)"}`;
        })
        .join("\n");
    }
    if (
      weeklyLogAny.supporting_evidence &&
      Array.isArray(weeklyLogAny.supporting_evidence)
    ) {
      const list = weeklyLogAny.supporting_evidence as Array<{
        name?: string;
        url?: string;
      }>;
      if (list.length > 0) {
        return list
          .map((e, i) => `${i + 1}. ${e.name || e.url || "evidence"}`)
          .join("\n");
      }
    }
    return "No supporting evidence was attached for this week.";
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
    departmentName: departmentName || "—",
    programName: programName || "—",
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
    // Evidence attachments (rendered at the very end of the document)
    evidenceAttachments,
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
 * Replaces & < > " ' with their entity equivalents and strips characters
 * that are illegal in XML 1.0 (control chars other than tab/newline/CR —
 * these commonly arrive via copy-paste from Word/PDFs and make Word refuse
 * to open the file with a "corrupted" dialog).
 */
function escapeXml(text: string): string {
  if (text == null) return "";
  // eslint-disable-next-line no-control-regex
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Escape a value for use inside an XML attribute (relationship targets,
 * hyperlink URLs). Also strips control characters and — for URLs — leaves
 * &amp; properly escaped so rels stay well-formed.
 */
function escapeXmlAttr(text: string): string {
  return escapeXml(text);
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
 * An optional <w:rPr> (run properties — font size / bold / spacing) is
 * carried onto every run so injected text keeps the template's exact
 * formatting ("the exact docx pattern").
 */
function buildTextRun(text: string, rPr?: string): string {
  const escaped = escapeXml(text);
  const rPrXml = rPr ? `<w:rPr>${rPr}</w:rPr>` : "";
  if (!escaped.includes("\n")) {
    return `<w:r>${rPrXml}<w:t xml:space="preserve">${escaped}</w:t></w:r>`;
  }
  // Split on newlines and insert <w:br/> between.
  const parts = escaped.split("\n");
  const runs = parts
    .map((p, i) => {
      const br = i > 0 ? "<w:r><w:br/></w:r>" : "";
      return `${br}<w:r>${rPrXml}<w:t xml:space="preserve">${p}</w:t></w:r>`;
    })
    .join("");
  return runs;
}

/**
 * LEAF-paragraph regex — matches a <w:p>...</w:p> that contains NO nested
 * <w:p> opening tag.
 *
 * WHY THIS EXISTS (bug fix 2026-08-26 — "corrupted docx that won't open"):
 * The template header stores the university/department names inside a
 * TEXTBOX (<wps:txbx><w:txbxContent>), i.e. paragraphs NESTED inside the
 * outer paragraph that carries the drawing. The previous naive regex
 * `/<w:p\b[^>]*>[\s\S]*?<\/w:p>/` started at the OUTER paragraph's opening
 * tag but stopped at the FIRST `</w:p>` — which belonged to the textbox's
 * inner paragraph. Replacing that span beheaded the <w:drawing> element and
 * left its closing tags orphaned → mismatched XML → Word declared the whole
 * file corrupted. The leaf regex can never span a textbox boundary.
 *
 * (The `(?!<w:p\b)` lookahead correctly ignores `<w:pPr>` — no word
 * boundary between "p" and "P".)
 */
const LEAF_P_REGEX = /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g;

/**
 * Extract the run properties (<w:rPr>) that should be applied to injected
 * text so it renders with the SAME formatting as the template text it
 * replaces:
 *   1. the first <w:r>'s <w:rPr> inside the paragraph (most faithful), or
 *   2. the paragraph-mark <w:rPr> inside <w:pPr> (for empty paragraphs —
 *      Word stores the intended formatting of the next typed run there), or
 *   3. "" (fall back to style defaults).
 */
function extractRPrForInjection(fragmentXml: string): string {
  // First <w:r>...<w:rPr>...</w:rPr>...<w:rPr is inside a run, not inside pPr.
  const runMatch = fragmentXml.match(/<w:r\b[^>]*>\s*<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (runMatch) return runMatch[1];
  const pPrRPr = fragmentXml.match(/<w:pPr>[\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>[\s\S]*?<\/w:pPr>/);
  if (pPrRPr) return pPrRPr[1];
  return "";
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
 * Returns the ContentTypes extension + MIME type, or null when the magic
 * bytes are not a Word-embeddable raster format (e.g. SVG or WebP text).
 *
 * NOTE: returning null (instead of the old "png" fallback) prevents
 * non-PNG bytes from being written into a .png media part — which made
 * Word refuse to open the generated document.
 */
function detectImageFormat(buf: Buffer): { ext: string; mime: string } | null {
  if (!buf || buf.length < 4) return null;
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
  return null;
}

/**
 * Read the pixel dimensions of a PNG / JPEG / GIF / BMP buffer.
 * Returns null for anything else (or a malformed header).
 */
export function readImageDimensions(
  buf: Buffer | null
): { width: number; height: number } | null {
  if (!buf || buf.length < 26) return null;
  try {
    // PNG — IHDR: width @16, height @20 (big-endian).
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    // GIF — logical screen size @6 (little-endian).
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      const width = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    // BMP — width @18, height @22 (little-endian; height may be negative for
    // top-down bitmaps).
    if (buf[0] === 0x42 && buf[1] === 0x4d) {
      const width = buf.readInt32LE(18);
      const height = Math.abs(buf.readInt32LE(22));
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    // JPEG — walk the segment stream to the first SOF marker.
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) {
          off++;
          continue;
        }
        const marker = buf[off + 1];
        // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC).
        if (
          marker >= 0xc0 && marker <= 0xcf &&
          marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
        ) {
          const height = buf.readUInt16BE(off + 5);
          const width = buf.readUInt16BE(off + 7);
          if (width > 0 && height > 0) return { width, height };
          return null;
        }
        // Skip this segment (length includes the 2 length bytes).
        const segLen = buf.readUInt16BE(off + 2);
        if (segLen < 2) return null;
        off += 2 + segLen;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Re-anchor the header's LOGO drawing (the wp:anchor whose docPr is
 * "Image 1") so it renders at the given size, horizontally centered on the
 * page. Updates positionH/posOffset, wp:extent and the inner a:ext.
 *
 * The anchor is located structurally (via its <wp:docPr name="Image 1"/>
 * marker) so this does not depend on the template's hardcoded EMU offsets;
 * if the marker cannot be found the header is returned unchanged.
 */
function retargetLogoAnchor(
  headerXml: string,
  newW: number,
  newH: number,
  newOffX: number
): string {
  const docPrIdx = headerXml.indexOf('name="Image 1"');
  if (docPrIdx === -1) return headerXml;
  const anchorStart = headerXml.lastIndexOf("<wp:anchor", docPrIdx);
  const anchorEnd = headerXml.indexOf("</wp:anchor>", docPrIdx);
  if (anchorStart === -1 || anchorEnd === -1) return headerXml;

  let anchor = headerXml.slice(anchorStart, anchorEnd);
  // First posOffset inside the anchor = positionH (relativeFrom="page").
  anchor = anchor.replace(
    /<wp:posOffset>-?\d+<\/wp:posOffset>/,
    `<wp:posOffset>${newOffX}</wp:posOffset>`
  );
  anchor = anchor.replace(
    /<wp:extent cx="\d+" cy="\d+"\/>/,
    `<wp:extent cx="${newW}" cy="${newH}"/>`
  );
  anchor = anchor.replace(
    /<a:ext cx="\d+" cy="\d+"\/>/,
    `<a:ext cx="${newW}" cy="${newH}"/>`
  );
  return headerXml.slice(0, anchorStart) + anchor + headerXml.slice(anchorEnd);
}

/**
 * Re-anchor the header's university-name TEXTBOX (the wp:anchor whose docPr
 * is "Textbox 2") with the given width, horizontally centered on the page.
 *
 * Updates BOTH representations Word ships for the textbox:
 *   - the DrawingML anchor (mc:Choice): positionH/posOffset, wp:extent, a:ext
 *   - the legacy VML fallback (mc:Fallback v:shape style): margin-left/width
 *
 * Returns the XML unchanged when the textbox marker cannot be found.
 */
function retargetHeaderTextbox(
  headerXml: string,
  boxW: number,
  pageW: number
): string {
  const docPrIdx = headerXml.indexOf('name="Textbox 2"');
  if (docPrIdx === -1) return headerXml;
  const anchorStart = headerXml.lastIndexOf("<wp:anchor", docPrIdx);
  // The textbox's anchor is wrapped in <mc:AlternateContent> whose
  // <mc:Fallback> carries a VML v:shape COPY that sits AFTER </wp:anchor> —
  // the span must cover BOTH so the fallback geometry is updated too.
  const anchorEnd = headerXml.indexOf("</mc:AlternateContent>", docPrIdx);
  if (anchorStart === -1 || anchorEnd === -1) return headerXml;
  const spanEnd = anchorEnd + "</mc:AlternateContent>".length;

  const offX = Math.round(pageW / 2 - boxW / 2); // exact horizontal center
  let span = headerXml.slice(anchorStart, spanEnd);

  // --- DrawingML anchor (mc:Choice) ---
  span = span.replace(
    /<wp:posOffset>-?\d+<\/wp:posOffset>/,
    `<wp:posOffset>${offX}</wp:posOffset>`
  );
  span = span.replace(
    /<wp:extent cx="\d+" cy="\d+"\/>/,
    (m) => m.replace(/cx="\d+"/, `cx="${boxW}"`)
  );
  span = span.replace(
    /<a:ext cx="\d+" cy="\d+"\/>/,
    (m) => m.replace(/cx="\d+"/, `cx="${boxW}"`)
  );

  // --- VML fallback (v:shape style uses pt units; 1pt = 12700 EMU) ---
  const widthPt = (boxW / 12700).toFixed(2);
  const marginLeftPt = (offX / 12700).toFixed(2);
  span = span.replace(/margin-left:[\d.]+pt;/, `margin-left:${marginLeftPt}pt;`);
  span = span.replace(/width:[\d.]+pt;/, `width:${widthPt}pt;`);

  return headerXml.slice(0, anchorStart) + span + headerXml.slice(spanEnd);
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
  value: string,
  /**
   * When true, replace EVERY paragraph in the value cell (not just the
   * first). Needed for the Program cell: the template ships a list of
   * degree-program options as separate paragraphs ("Computer Science",
   * "Software Engineering", ...) and replacing only the first paragraph
   * left the remaining options visible next to the injected value.
   */
  replaceWholeCell = false
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

  if (replaceWholeCell) {
    // Rebuild the entire value cell with a single paragraph holding the
    // value. The cell's <w:tcPr> (borders / shading / width) and the first
    // paragraph's <w:pPr> (alignment) are preserved, and the injected run
    // inherits the template's run formatting (font size etc.) so the cell
    // looks exactly like the template intended.
    const tcPrMatch = nextTcMatch[0].match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
    const tcPr = tcPrMatch ? tcPrMatch[0] : "";
    const firstP = nextTcMatch[0].match(new RegExp(LEAF_P_REGEX.source));
    const pPrMatch = firstP?.[0]?.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : "";
    const rPr = extractRPrForInjection(firstP?.[0] || nextTcMatch[0]);
    const newCell = `<w:tc>${tcPr}<w:p>${pPr}${buildTextRun(value, rPr)}</w:p></w:tc>`;
    const newXml =
      documentXml.slice(0, nextTcAbsIdx) +
      newCell +
      documentXml.slice(nextTcEnd);
    return { xml: newXml, replaced: true };
  }

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

  // Preserve the paragraph's <w:pPr> if present, drop everything else, and
  // carry the paragraph-mark run formatting onto the injected run.
  const pPrMatch = pMatch[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const rPr = extractRPrForInjection(pMatch[0]);
  const newP = `<w:p>${pPr}${buildTextRun(value, rPr)}</w:p>`;

  const newXml =
    documentXml.slice(0, pAbsIdx) + newP + documentXml.slice(pEndIdx);
  return { xml: newXml, replaced: true };
}

/**
 * Remove the template's extra program-option rows from the FIRST table of
 * the document. The template emulates a program dropdown with a "Program"
 * label row followed by FOUR option rows; the injection writes the real
 * program into the first option row, and this helper deletes the rest so
 * the rendered document shows exactly one program value.
 *
 * Safety: if the first table doesn't match the expected shape (label row
 * "Program" followed by at least one row), or any row contains a nested
 * table, the XML is returned unchanged.
 */
function removeProgramOptionRows(documentXml: string): string {
  const tblMatch = documentXml.match(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/);
  if (!tblMatch) return documentXml;

  const tblXml = tblMatch[0];
  // Bail out on nested tables — the row regex below would mis-split them.
  const rowRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  const rows: string[] = [];
  let rm: RegExpExecArray | null;
  while ((rm = rowRegex.exec(tblXml)) !== null) rows.push(rm[0]);
  if (rows.some((r) => r.includes("<w:tbl"))) return documentXml;

  const rowPlainText = (rowXml: string) =>
    Array.from(rowXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g))
      .map((m) => m[1])
      .join("")
      .replace(/\s+/g, " ")
      .trim();

  const labelIdx = rows.findIndex((r) => rowPlainText(r) === "Program");
  if (labelIdx === -1 || labelIdx + 1 >= rows.length) return documentXml;

  // Keep the label row and the (already-injected) value row; drop the rest.
  // The table's structural prefix (<w:tblPr>, <w:tblGrid>) lives between the
  // <w:tbl> open tag and the first <w:tr> — preserve it verbatim.
  const kept = rows.slice(0, labelIdx + 2);
  const firstRowIdx = tblXml.indexOf(rows[0]);
  const tblPrefix = tblXml.slice(0, firstRowIdx);
  const rebuilt = tblPrefix + kept.join("") + "</w:tbl>";
  // Function replacement — avoids interpreting $ patterns in the XML.
  return documentXml.replace(tblXml, () => rebuilt);
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

  // Walk every LEAF <w:tr>...</w:tr> in the document. For each day (Mon-Fri),
  // find the row whose FIRST cell's plain text equals the day name, then
  // mutate that row's 3 cells in place: (0) day label + date, (1) tasks,
  // (2) hours. This is far more reliable than the prior approach which
  // modified the day-label run in flight and then failed to locate the
  // adjacent tasks/hours cells.
  //
  // BUG FIX 2026-08-26 ("MondayAug 17, 2026Monday" duplication): the
  // template's day cell contains TWO paragraphs — an empty vertical-spacing
  // paragraph followed by the paragraph holding the "Monday" run. The old
  // code replaced the FIRST paragraph (the spacer) and left the original
  // day-name paragraph in place, duplicating the day name. We now replace
  // the paragraph that actually CONTAINS the day-name text and keep the
  // spacer, matching the template's layout exactly.
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

    // Replaces, inside ONE cell, the paragraph that contains the cell's
    // text-bearing run (for the day cell) or the first paragraph (for the
    // empty tasks/hours cells), preserving pPr + run formatting.
    const replaceCellParagraph = (cellXml: string, text: string, requireExistingText: boolean): string => {
      const leafRe = new RegExp(LEAF_P_REGEX.source, "g");
      let pm: RegExpExecArray | null;
      let targetP: RegExpExecArray | null = null;
      while ((pm = leafRe.exec(cellXml)) !== null) {
        if (extractCellPlainText(pm[0]).trim().length > 0) {
          targetP = pm;
          break;
        }
      }
      if (requireExistingText && !targetP) {
        // Fall back to the first leaf paragraph.
        const anyP = cellXml.match(new RegExp(LEAF_P_REGEX.source));
        targetP = anyP ? { 0: anyP[0], index: anyP.index ?? 0 } as RegExpExecArray : null;
      }
      if (!targetP) {
        const anyP = cellXml.match(new RegExp(LEAF_P_REGEX.source));
        targetP = anyP ? { 0: anyP[0], index: anyP.index ?? 0 } as RegExpExecArray : null;
      }
      if (!targetP) return cellXml;
      const pPr = targetP[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
      const rPr = extractRPrForInjection(targetP[0]);
      const newP = `<w:p>${pPr}${buildTextRun(text, rPr)}</w:p>`;
      const pStart = cellXml.indexOf(targetP[0]);
      const pEnd = pStart + targetP[0].length;
      return cellXml.slice(0, pStart) + newP + cellXml.slice(pEnd);
    };

    // Cell 0: day label + date (replace the paragraph holding "Monday").
    newRowParts.push(replaceCellParagraph(cells[0].xml, dayLabelText, true));
    replacedCount++;

    // Cell 1: tasks performed.
    newRowParts.push(replaceCellParagraph(cells[1].xml, entry.tasksPerformed || "", false));
    replacedCount++;

    // Cell 2: hours worked.
    const hoursText = entry.isHoliday ? "—" : String(entry.hoursWorked || 0);
    newRowParts.push(replaceCellParagraph(cells[2].xml, hoursText, false));
    replacedCount++;

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
  // Walk every LEAF <w:p>...</w:p> chunk; locate the one whose plain text matches.
  // (Leaf = contains no nested paragraph — see LEAF_P_REGEX for why this is
  // critical around textbox content.)
  const pRegex = new RegExp(LEAF_P_REGEX.source, "g");
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

  // Find the NEXT LEAF <w:p>...</w:p> after the label paragraph.
  const afterLabel = documentXml.slice(labelPEndIdx);
  const nextPMatch = afterLabel.match(new RegExp(LEAF_P_REGEX.source));
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

  // Preserve the paragraph's <w:pPr> + run formatting, drop everything else.
  const pPrMatch = nextPMatch[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const rPr = extractRPrForInjection(nextPMatch[0]);
  const newPara = `<w:p>${pPr}${buildTextRun(value, rPr)}</w:p>`;
  return {
    xml: documentXml.slice(0, nextPStartIdx) + newPara + documentXml.slice(nextPEndIdx),
    replaced: true,
  };
}

/**
 * Insert a signature image INSIDE the "box" cell that sits BELOW the given
 * label in the signature table.
 *
 * The template's signature table (last table of the document) is:
 *
 *   Row 0: | Student Signature | Industry Supervisor | Faculty Supervisor |  (labels)
 *   Row 1: |      (box)        |       (box)          |      (box)         |  (empty signature boxes)
 *
 * The user's explicit requirement ("The signatures should be in the below
 * relevant boxes") is that each signature image lands in the EMPTY BOX under
 * its label — NOT inside the label cell itself (the previous behaviour, which
 * left the boxes blank and stretched the label row).
 *
 * How this works:
 *   1. Locate the signature table (the <w:tbl> whose Row 0 contains the label).
 *   2. Determine the label's COLUMN index in Row 0.
 *   3. Replace the corresponding Row-1 cell's empty paragraph with a
 *      horizontally-CENTERED paragraph holding the inline signature drawing,
 *      scaled to fit the box while preserving the image's aspect ratio.
 *
 * Returns the modified XML + the relationship ID that was added (so the
 * caller can register it in document.xml.rels).
 */
function insertSignatureIntoBox(
  documentXml: string,
  labelText: string,
  imageBuffer: Buffer | null
): { xml: string; relId?: string; imageAdded: boolean } {
  if (!imageBuffer) {
    return { xml: documentXml, imageAdded: false };
  }

  const normalizedLabel = labelText.replace(/\s+/g, " ").trim();

  // 1. Walk every table; find the signature table (Row 0 contains the label).
  //    SPLIT-LABEL safe: compare each cell's FULL plain text (Word splits
  //    "Faculty Supervisor" across multiple <w:t> runs, so a raw
  //    .includes("Faculty Supervisor") on the XML would MISS the table).
  const tblRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  let tblMatch: RegExpExecArray | null;
  let sigTbl: string | null = null;
  let sigTblStart = -1;
  let sigTblEnd = -1;

  while ((tblMatch = tblRegex.exec(documentXml)) !== null) {
    const rows = tblMatch[0].match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    if (rows.length < 2) continue;
    const row0Cells = rows[0]!.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
    const labels = row0Cells.map((c) =>
      extractCellPlainText(c).replace(/\s+/g, " ").trim()
    );
    if (labels.includes(normalizedLabel)) {
      sigTbl = tblMatch[0];
      sigTblStart = tblMatch.index;
      sigTblEnd = tblMatch.index + tblMatch[0].length;
      break;
    }
  }

  if (!sigTbl) {
    return { xml: documentXml, imageAdded: false };
  }

  // 2. Locate the label's column in Row 0 and the target box cell in Row 1.
  const rows = sigTbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  if (rows.length < 2) {
    return { xml: documentXml, imageAdded: false };
  }
  const row0Cells = rows[0]!.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
  const colIdx = row0Cells.findIndex((c) =>
    extractCellPlainText(c).replace(/\s+/g, " ").trim() === normalizedLabel
  );
  if (colIdx === -1) {
    return { xml: documentXml, imageAdded: false };
  }
  const row1Cells = rows[1].match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
  if (colIdx >= row1Cells.length) {
    return { xml: documentXml, imageAdded: false };
  }
  const boxCell = row1Cells[colIdx];

  // 3. Scale the signature to fit the box (2881 twips ≈ 2.0" wide × 1457
  //    twips ≈ 1.0" tall) while PRESERVING the image's aspect ratio.
  //    Box-safe target: ≤ 1.8" wide, ≤ 0.8" tall (216×96 px @ 96 DPI).
  const dims = readImageDimensions(imageBuffer);
  let wPx = 150;
  let hPx = 60;
  if (dims && dims.width > 0 && dims.height > 0) {
    const scale = Math.min(216 / dims.width, 96 / dims.height);
    wPx = Math.max(24, Math.round(dims.width * scale));
    hPx = Math.max(16, Math.round(dims.height * scale));
  }

  const relId = generateRelId();
  const drawingXml = buildInlineImageXml(relId, wPx, hPx);
  // Centered paragraph inside the box cell (w:jc=center), replacing the
  // template's empty spacer paragraph so the signature sits dead-center.
  const newPara = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${drawingXml}</w:r></w:p>`;

  const pMatch = boxCell.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
  let newBoxCell: string;
  if (pMatch) {
    newBoxCell = boxCell.replace(pMatch[0], () => newPara);
  } else {
    newBoxCell = boxCell.replace(/<\/w:tc>$/, () => `${newPara}</w:tc>`);
  }

  // 4. Stamp <w:cantSplit/> on both signature rows so the label row and the
  //    box row can never be torn apart across a page boundary. Idempotent:
  //    skips rows that already carry a <w:cantSplit/> (this function runs up
  //    to three times — once per signature).
  const hardenedRow = (rowXml: string) => {
    if (/<w:cantSplit\s*\/>/.test(rowXml)) return rowXml;
    if (/<w:trPr>[\s\S]*?<\/w:trPr>/.test(rowXml)) {
      return rowXml.replace(/<w:trPr>/, () => "<w:trPr><w:cantSplit/>");
    }
    return rowXml.replace(
      /(<w:tr\b[^>]*>)/,
      (m) => `${m}<w:trPr><w:cantSplit/></w:trPr>`
    );
  };

  let newTbl = sigTbl;
  // Swap rows in REVERSE document order so earlier indices stay valid.
  for (let i = rows.length - 1; i >= 0; i--) {
    if (i === 1) {
      const modifiedRow = hardenedRow(rows[1]).replace(boxCell, () => newBoxCell);
      newTbl = newTbl.replace(rows[1], () => modifiedRow);
    } else {
      newTbl = newTbl.replace(rows[i], () => hardenedRow(rows[i]));
    }
  }

  const newXml =
    documentXml.slice(0, sigTblStart) + newTbl + documentXml.slice(sigTblEnd);
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

  // Single pass over every LEAF paragraph (see LEAF_P_REGEX). A replace
  // callback is used instead of the previous restart-after-every-replacement
  // loop: restarting re-tested already-replaced paragraphs from the start,
  // and because the injected university name ("International Islamic
  // University Islamabad") itself matched one of the matchers, the loop
  // burned all 200 safety iterations on the FIRST paragraph and never
  // reached the remaining three (the fallback textbox copy kept the
  // template's hardcoded "Ibadat International University Islamabad").
  //
  // FIT-TO-TEXTBOX scaling + CENTERING (bug fix 2026-08-27 — "the logo and
  // university name should be centered"): the header textbox is anchored to
  // the PAGE, so we (a) WIDEN it (up to ~440pt) when the university name is
  // longer than the template's reference so the font can stay larger, and
  // (b) re-anchor it at the exact horizontal center of the page — for every
  // box width. Text inside the textbox is already paragraph-centered
  // (<w:jc w:val="center"/>), so the name always sits dead-center under the
  // centered logo.
  const TEMPLATE_BOX_W_EMU = 4184015; // 329.45pt — template textbox width
  const MAX_BOX_W_EMU = 5600000; // ~440pt — keeps ≥86pt side margins (Letter)
  const PAGE_W_EMU = 7772400; // Letter (template pgSz 12240 twips)
  const UNI_REF_LEN = 41; // "Ibadat International University Islamabad"
  const uniLen = Math.max(1, (data.universityName || "").trim().length);
  let headerBoxW = TEMPLATE_BOX_W_EMU;
  if (uniLen > UNI_REF_LEN) {
    // Width the box would need for the longer name at the SAME font size
    // (0.9 = the same bold-glyph safety factor used for font scaling).
    const needed = Math.round(
      (TEMPLATE_BOX_W_EMU * uniLen) / (UNI_REF_LEN * 0.9)
    );
    headerBoxW = Math.min(MAX_BOX_W_EMU, Math.max(TEMPLATE_BOX_W_EMU, needed));
  }
  const boxWidthFactor = headerBoxW / TEMPLATE_BOX_W_EMU;

  const scaleHeaderRPr = (rPr: string, referenceLength: number, referenceSz: number, text: string): string => {
    const len = Math.max(1, (text || "").trim().length);
    // Effective per-line capacity grows with the (possibly widened) box.
    const effectiveRef = referenceLength * 0.9 * boxWidthFactor;
    if (len <= effectiveRef) return rPr;
    // 0.90 safety factor: bold proportional-width glyphs (capitals, wide
    // letters) run wider than a strict char-count ratio suggests.
    const scaled = Math.max(16, Math.floor((referenceSz * effectiveRef) / len));
    if (/<w:sz w:val="\d+"\/>/.test(rPr)) {
      return rPr.replace(/<w:sz w:val="\d+"\/>/g, `<w:sz w:val="${scaled}"/>`);
    }
    return `${rPr}<w:sz w:val="${scaled}"/>`;
  };

  {
    const leafRe = new RegExp(LEAF_P_REGEX.source, "g");
    headerXmlWork = headerXmlWork.replace(leafRe, (pXml: string) => {
      const plain = extractCellPlainText(pXml).replace(/\s+/g, " ").trim();
      if (!plain) return pXml;
      for (const { match, replacement, tag } of headerReplacements) {
        if (!match.test(plain)) continue;
        headerReplacedTags.add(tag);
        // Keep <w:pPr>, replace all runs with one run carrying the original
        // run formatting so the header keeps the template's exact look.
        const pPrMatch = pXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
        const pPr = pPrMatch ? pPrMatch[0] : "";
        let rPr = extractRPrForInjection(pXml);
        // Scale down the font so long names stay on one line inside the
        // (possibly widened) header textbox (template references: university
        // name = 41 chars @ sz 36, department = 27 chars @ sz 28).
        const isUni = tag.startsWith("university_name");
        rPr = scaleHeaderRPr(rPr, isUni ? UNI_REF_LEN : 27, isUni ? 36 : 28, replacement || "");
        return `<w:p>${pPr}${buildTextRun(replacement, rPr)}</w:p>`;
      }
      return pXml;
    });
  }

  // Re-anchor the university-name textbox: exact page centering (+ widening
  // for long names). Touches BOTH the DrawingML anchor (mc:Choice path:
  // positionH/posOffset, wp:extent, a:ext) and the legacy VML fallback
  // (v:shape style margin-left/width) so Word AND older renderers agree.
  headerXmlWork = retargetHeaderTextbox(headerXmlWork, headerBoxW, PAGE_W_EMU);
  if (headerBoxW !== TEMPLATE_BOX_W_EMU) {
    fieldsPopulated.push("university_name_textbox_widened");
  }

  for (const tag of headerReplacedTags) {
    fieldsPopulated.push(tag);
  }

  // Final sweep for any IIUI abbreviation tokens that survived (e.g. "IIUI"
  // appearing standalone as a single run somewhere).
  headerXmlWork = headerXmlWork.replace(/\bIIUI\b/g, escapeXml(data.universityName));

  headerXml = headerXmlWork;

  // 5. Replace the university logo in word/media/image1.png.
  //
  // FORMAT SAFETY (bug fix 2026-08-26 — "corrupted docx that won't open"):
  // the template declares image1.png as image/png. Blindly overwriting it
  // with JPEG/WebP/SVG bytes produced a file Word refuses to open. We now
  // (a) detect the real format, (b) only embed Word-safe raster formats
  // (PNG/JPEG/GIF/BMP), (c) for non-PNG formats write a NEW media part and
  // repoint the header relationship + [Content_Types] entry, and (d) skip
  // embedding entirely for anything else (keeping the template logo)
  // rather than shipping a corrupt document.
  const logoFmt = data.universityLogoBuffer
    ? detectImageFormat(data.universityLogoBuffer)
    : null;
  const logoIsEmbeddable =
    !!data.universityLogoBuffer &&
    !!logoFmt &&
    ["png", "jpeg", "gif", "bmp"].includes(logoFmt.ext);
  if (data.universityLogoBuffer && logoIsEmbeddable && logoFmt) {
    if (logoFmt.ext === "png") {
      zip.file("word/media/image1.png", data.universityLogoBuffer);
    } else {
      // Write a new media part and repoint the header relationship.
      const newMedia = `word/media/image1.${logoFmt.ext}`;
      zip.file(newMedia, data.universityLogoBuffer);
      zip.remove("word/media/image1.png");
      const headerRelsFile = zip.file("word/_rels/header1.xml.rels");
      if (headerRelsFile) {
        let headerRelsXml = await headerRelsFile.async("string");
        headerRelsXml = headerRelsXml.replace(
          /Target="media\/image1\.png"/g,
          `Target="media/image1.${logoFmt.ext}"`
        );
        zip.file("word/_rels/header1.xml.rels", headerRelsXml);
      }
      // Register the extension's content type (e.g. jpeg/gif/bmp).
      let ctXml = await zip.file("[Content_Types].xml")!.async("string");
      if (!ctXml.includes(`Extension="${logoFmt.ext}"`)) {
        ctXml = ctXml.replace(
          "</Types>",
          `<Default Extension="${logoFmt.ext}" ContentType="${logoFmt.mime}"/></Types>`
        );
        zip.file("[Content_Types].xml", ctXml);
      }
    }
    imagesEmbedded.push("university_logo");

    // 5a. CENTER THE LOGO + PRESERVE ITS ASPECT RATIO (bug fix 2026-08-27 —
    //     "the logo and university name is not correct, it ruined the
    //     document structure"). The template's logo anchor has a FIXED
    //     extent of 1917192×762000 EMU (a 2.5:1 wide box). A typical
    //     university crest is roughly SQUARE — forcing it into that box
    //     stretched it into a distorted banner and looked "ruined". We now
    //     read the image's real pixel dimensions, scale it to fit the header
    //     band while PRESERVING the aspect ratio, and re-anchor it at the
    //     exact horizontal center of the page.
    const logoDims = readImageDimensions(data.universityLogoBuffer);
    if (logoDims && logoFmt) {
      const PAGE_W_EMU = 7772400; // Letter (template pgSz 12240 twips)
      const LOGO_MAX_H_EMU = 762000; // template logo band height (0.83")
      const LOGO_MAX_W_EMU = 2600000; // never wider than ~2.84"
      const scale = Math.min(
        LOGO_MAX_W_EMU / logoDims.width,
        LOGO_MAX_H_EMU / logoDims.height
      );
      const newW = Math.max(1, Math.round(logoDims.width * scale));
      const newH = Math.max(1, Math.round(logoDims.height * scale));
      const newOffX = Math.round(PAGE_W_EMU / 2 - newW / 2); // exact center
      headerXml = retargetLogoAnchor(headerXml, newW, newH, newOffX);
      fieldsPopulated.push("university_logo_centered");
    }
  } else if (data.universityLogoBuffer) {
    console.warn(
      "[doc-gen] University logo is not a Word-embeddable raster image (PNG/JPEG/GIF/BMP) — keeping the template logo."
    );
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
  // The template emulates a dropdown with FOUR separate table rows after the
  // "Program" label row ("Computer Science" / "Software Engineering" /
  // "Artificial Intelligence" / "Rob & AI"). We (a) write the student's
  // program into the FIRST option row and (b) DELETE the remaining option
  // rows so the generated document shows exactly one program value.
  //
  // BUG FIX 2026-08-26 ("the program should not be hardcoded"): the previous
  // code GATED this injection behind a naive regex that required "Program"
  // to live in a single <w:t> run. When the gate failed, the template's
  // hardcoded option rows ("Computer Science" etc.) shipped unchanged in
  // the generated report. The injection now runs unconditionally (the
  // label-matching itself already handles split runs via cell-plain-text
  // walking), always strips the extra option rows, and falls back to "—"
  // so a hardcoded program can NEVER reach the output.
  {
    const programValue =
      data.programName && String(data.programName).trim().length > 0
        ? data.programName
        : "—";
    const result = injectValueAfterLabel(documentXml, "Program", programValue, true);
    if (result.replaced) {
      documentXml = removeProgramOptionRows(result.xml);
      fieldsPopulated.push("program");
    } else {
      // Even if the label cell moved/renamed, still strip the hardcoded
      // option rows so they can never leak into the generated document.
      documentXml = removeProgramOptionRows(documentXml);
    }
  }

  // 10. Inject signature images.
  //      Format-guarded: a signature buffer that is not a Word-embeddable
  //      raster image (PNG/JPEG/GIF/BMP) is skipped rather than written as
  //      bogus PNG bytes (which corrupted the document).
  const newImageRels: Array<{ relId: string; buffer: Buffer; ext: string; mime: string }> = [];

  const registerSignature = (
    sigResult: { xml: string; relId?: string; imageAdded: boolean },
    buffer: Buffer | null,
    label: string
  ): boolean => {
    if (!sigResult.imageAdded || !sigResult.relId || !buffer) return false;
    const fmt = detectImageFormat(buffer);
    if (!fmt) {
      console.warn(`[doc-gen] ${label} signature is not a raster image — skipping embed.`);
      return false;
    }
    newImageRels.push({ relId: sigResult.relId, buffer, ext: fmt.ext, mime: fmt.mime });
    return true;
  };

  const sig1Result = insertSignatureIntoBox(documentXml, "Student Signature", data.studentSignatureBuffer);
  documentXml = sig1Result.xml;
  if (registerSignature(sig1Result, data.studentSignatureBuffer, "Student")) {
    imagesEmbedded.push("student_signature");
  }

  const sig2Result = insertSignatureIntoBox(documentXml, "Industry Supervisor", data.industrySupervisorSignatureBuffer);
  documentXml = sig2Result.xml;
  if (registerSignature(sig2Result, data.industrySupervisorSignatureBuffer, "Industry supervisor")) {
    imagesEmbedded.push("industry_supervisor_signature");
  }

  const sig3Result = insertSignatureIntoBox(documentXml, "Faculty Supervisor", data.facultySupervisorSignatureBuffer);
  documentXml = sig3Result.xml;
  if (registerSignature(sig3Result, data.facultySupervisorSignatureBuffer, "Faculty supervisor")) {
    imagesEmbedded.push("faculty_supervisor_signature");
  }

  // 10b. SUPPORTING-EVIDENCE ATTACHMENTS — append the ACTUAL evidence at the
  //      end of the document (bug fix 2026-08-27 — the report used to only
  //      list evidence FILENAMES as text: "1. settings.pdf"). Per the
  //      template-owner's requirement:
  //        - image evidence  → embedded inline, CENTERED, with a caption
  //        - link evidence   → live hyperlinks
  //        - PDF/DOCX/…      → embedded as Word OLE package objects (icon +
  //                            filename; double-click opens the ORIGINAL
  //                            file — the same mechanism Word's own
  //                            "Insert > Object > Create from File" uses)
  //      Everything is appended AFTER the signature section, before the
  //      body's final sectPr, starting on a fresh page.
  const extraObjectRels: Array<{
    relId: string;
    type: "oleObject" | "hyperlink" | "image";
    target: string;
    targetMode?: "External";
  }> = [];
  const extraZipFiles: Array<{ path: string; buffer: Buffer }> = [];
  let evidenceImageSeq = 0;
  let evidenceOleSeq = 0;
  let evidenceLinkSeq = 0;

  if (data.evidenceAttachments && data.evidenceAttachments.length > 0) {
    const CONTENT_W_EMU = 5943600; // 6.5" content width (Letter, 1" margins)
    const MAX_IMG_H_EMU = 5500000; // keep one image per page at most

    const sectionXmlParts: string[] = [];

    // Page break + section heading (same Heading1 style the template uses
    // for "Weekly Activities" / "Supporting Evidence (Mandatory)").
    sectionXmlParts.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    sectionXmlParts.push(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="202" w:after="45"/></w:pPr><w:r><w:t>Attachments — Supporting Evidence</w:t></w:r></w:p>`
    );
    sectionXmlParts.push(
      `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">The supporting evidence submitted with this weekly log is attached below. Images are embedded in full; document files are attached as objects which open on double-click; links open in the browser.</w:t></w:r></w:p>`
    );

    let figureNo = 0;
    for (const evRaw of data.evidenceAttachments) {
      // Non-renderable "image" evidence falls back to a file-object attach.
      const ev: EvidenceAttachment =
        evRaw.kind === "image" && evRaw.buffer && !(readImageDimensions(evRaw.buffer) && detectImageFormat(evRaw.buffer))
          ? { ...evRaw, kind: "file", ext: evRaw.ext || "bin" }
          : evRaw;
      if (ev.kind === "image" && ev.buffer) {
        // ---- Embedded, centered image ----
        const dims = readImageDimensions(ev.buffer);
        const fmt = detectImageFormat(ev.buffer);
        if (dims && fmt) {
          evidenceImageSeq += 1;
          const relId = `rIdEvImg${evidenceImageSeq}`;
          // PIXELS → EMU conversion: 1 px @ 96 DPI = 9525 EMU.
          // (bug fix 2026-08-27: dims are PIXELS but were written straight
          // into wp:extent as EMU — a 638px-wide image rendered at 638 EMU
          // = 0.07mm, i.e. invisible.)
          const natWEmu = dims.width * 9525;
          const natHEmu = dims.height * 9525;
          const scale = Math.min(
            CONTENT_W_EMU / natWEmu,
            MAX_IMG_H_EMU / natHEmu,
            1 // never upscale small images beyond natural size
          );
          const wEmu = Math.max(1, Math.round(natWEmu * scale));
          const hEmu = Math.max(1, Math.round(natHEmu * scale));
          figureNo += 1;
          newImageRels.push({ relId, buffer: ev.buffer, ext: fmt.ext, mime: fmt.mime });
          sectionXmlParts.push(
            `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="160"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${9000 + evidenceImageSeq}" name="Evidence Image ${evidenceImageSeq}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${9100 + evidenceImageSeq}" name="Evidence ${evidenceImageSeq}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
          );
          sectionXmlParts.push(
            `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="595959"/></w:rPr><w:t xml:space="preserve">Figure ${figureNo} — ${escapeXml(ev.name)}</w:t></w:r></w:p>`
          );
          imagesEmbedded.push(`evidence_image:${ev.name}`);
          continue;
        }
      }

      if (ev.kind === "link" && (ev.url || ev.name)) {
        // ---- Live hyperlink ----
        evidenceLinkSeq += 1;
        const relId = `rIdEvLnk${evidenceLinkSeq}`;
        const label = ev.name && ev.name !== ev.url ? `${ev.name} — ${ev.url}` : ev.url || ev.name;
        extraObjectRels.push({
          relId,
          type: "hyperlink",
          target: ev.url || ev.name,
          targetMode: "External",
        });
        sectionXmlParts.push(
          `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:ind w:left="360"/></w:pPr><w:hyperlink r:id="${relId}" w:history="1"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escapeXml(label)}</w:t></w:r></w:hyperlink></w:p>`
        );
        continue;
      }

      if (ev.kind === "file" && ev.buffer) {
        // ---- OLE package object (the actual file, double-clickable) ----
        evidenceOleSeq += 1;
        const oleRelId = `rIdEvOle${evidenceOleSeq}`;
        const iconRelId = `rIdEvIcon${evidenceOleSeq}`;
        const ext = (ev.ext || "bin").toLowerCase();
        const icon =
          ext === "pdf" ? PDF_ICON
          : ["doc", "docx", "rtf", "odt"].includes(ext) ? DOCX_ICON
          : ["xls", "xlsx", "csv", "ods"].includes(ext) ? XLS_ICON
          : FILE_ICON;
        const shapeId = `oleEvShape${evidenceOleSeq}`;
        const objectId = `_oleEvObj${evidenceOleSeq}`;
        const binPath = `embeddings/oleObjectEv${evidenceOleSeq}.bin`;
        const iconPath = `media/imageEvIcon${evidenceOleSeq}.png`;

        extraObjectRels.push({
          relId: oleRelId,
          type: "oleObject",
          target: binPath,
        });
        extraObjectRels.push({
          relId: iconRelId,
          type: "image",
          target: iconPath,
        });
        extraZipFiles.push({
          path: `word/${binPath}`,
          buffer: buildOleObjectBin(ev.name, ev.buffer),
        });
        extraZipFiles.push({ path: `word/${iconPath}`, buffer: icon });

        // 32pt icon centered; w:dxaOrig/dyaOrig are twips (32pt = 640 twips).
        sectionXmlParts.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="200"/></w:pPr><w:r><w:object w:dxaOrig="640" w:dyaOrig="640"><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/><v:formulas><v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/><v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/><v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/></v:formulas><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype><v:shape id="${shapeId}" type="#_x0000_t75" style="width:32pt;height:32pt" o:ole=""><v:imagedata r:id="${iconRelId}" o:title=""/></v:shape><o:OLEObject Type="Embed" ProgID="Package" ShapeID="${shapeId}" DrawAspect="Icon" ObjectID="${objectId}" r:id="${oleRelId}"/></w:object></w:r></w:p>`
        );
        sectionXmlParts.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="280"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="595959"/></w:rPr><w:t xml:space="preserve">${escapeXml(ev.name)} — double-click to open${ev.ext ? ` (${ev.ext.toUpperCase()} file, ${(Math.max(1, Math.round((ev.buffer.length || 0) / 1024)) + "").toString()} KB)` : ""}</w:t></w:r></w:p>`
        );
        imagesEmbedded.push(`evidence_file:${ev.name}`);
      }
    }

    // Append the section BEFORE the body's final sectPr (the LAST <w:sectPr
    // in the document — the template also carries an in-paragraph section
    // break mid-document whose sectPr must NOT be targeted).
    const sectPrIdx = documentXml.lastIndexOf("<w:sectPr");
    if (sectPrIdx !== -1) {
      documentXml =
        documentXml.slice(0, sectPrIdx) +
        sectionXmlParts.join("") +
        documentXml.slice(sectPrIdx);
      fieldsPopulated.push(`evidence_attachments (${data.evidenceAttachments.length})`);
    }
  }

  // 11. Register new relationships in document.xml.rels (signature images +
  //     evidence images + OLE objects + hyperlink evidence) and write the
  //     referenced parts (media files, embeddings/*.bin) into the zip.
  if (newImageRels.length > 0 || extraObjectRels.length > 0) {
    let relsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");

    for (const img of newImageRels) {
      // Add the relationship entry
      const relEntry = `<Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.relId}.${img.ext}"/>`;
      // Insert before </Relationships>
      relsXml = relsXml.replace("</Relationships>", `${relEntry}</Relationships>`);

      // Add the image file to the zip
      zip.file(`word/media/${img.relId}.${img.ext}`, img.buffer);
    }

    for (const obj of extraObjectRels) {
      const relEntry =
        `<Relationship Id="${obj.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${obj.type}"` +
        ` Target="${escapeXmlAttr(obj.target)}"${obj.targetMode ? ` TargetMode="${obj.targetMode}"` : ""}/>`;
      relsXml = relsXml.replace("</Relationships>", `${relEntry}</Relationships>`);
    }
    for (const f of extraZipFiles) {
      zip.file(f.path, f.buffer);
    }

    zip.file("word/_rels/document.xml.rels", relsXml);
  }

  // 12. Update [Content_Types].xml to register new extensions if needed
  //     (signature/evidence image formats + the OLE-object .bin parts).
  if (newImageRels.length > 0 || extraZipFiles.length > 0) {
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
    // OLE package parts (word/embeddings/oleObject*.bin).
    if (extraZipFiles.some((f) => f.path.endsWith(".bin")) && !contentTypesXml.includes('Extension="bin"')) {
      contentTypesXml = contentTypesXml.replace(
        "</Types>",
        `<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.oleObject"/></Types>`
      );
    }
    zip.file("[Content_Types].xml", contentTypesXml);
  }

  // 13. Write back the modified XML files.
  zip.file("word/document.xml", documentXml);
  zip.file("word/header1.xml", headerXml);

  // 14. Re-zip.
  const outputBuffer = await zip.generateAsync({
    type: "nodebuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });

  // 15. FINAL SAFETY NET — verify the produced document is structurally
  //     valid BEFORE it is ever stored or delivered. A corrupted .docx
  //     previously reached users ("file is corrupted, won't open") because
  //     generation returned success based only on injection counts. We now
  //     re-open the generated zip and XML-parse every part; any malformed
  //     part aborts generation with a descriptive error instead of shipping
  //     a broken file.
  await validateDocxBuffer(outputBuffer);

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

/**
 * Validate that a generated .docx buffer is a well-formed OOXML package.
 *
 * Checks performed:
 *   1. The buffer unzips as a ZIP archive.
 *   2. Every XML part (document.xml, header1.xml, rels, [Content_Types].xml,
 *      docProps, etc.) parses as well-formed XML.
 *   3. word/document.xml exists.
 *
 * Throws a descriptive Error when validation fails so the calling API can
 * return a 500 with a clear message instead of saving a corrupt file.
 */
async function validateDocxBuffer(buffer: Buffer): Promise<void> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new Error(`Generated document is not a valid ZIP/OOXML package: ${err instanceof Error ? err.message : String(err)}`);
  }

  const files = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  if (!files.includes("word/document.xml")) {
    throw new Error("Generated document is missing word/document.xml");
  }

  // Minimal well-formedness check: tag balance + entity/attribute sanity for
  // every XML part. We use a lightweight scanner (regex-driven) instead of a
  // full DOM parse to stay dependency-free in the Next.js runtime.
  for (const name of files) {
    if (!/\.(xml|rels)$/.test(name) && name !== "[Content_Types].xml") continue;
    const content = await zip.files[name].async("string");
    const problem = checkXmlWellFormed(content);
    if (problem) {
      throw new Error(
        `Generated document part "${name}" is malformed: ${problem}`
      );
    }
  }
}

/**
 * Lightweight XML well-formedness scanner.
 * Returns null when the fragment looks well-formed, or a description of the
 * first problem found. Verifies:
 *   - tags nest correctly (element name stack)
 *   - no stray closing tags
 *   - attributes are quoted
 *   - text contains no raw '<'
 * It is intentionally conservative: a false alarm fails generation loudly
 * (preferred over shipping a corrupt docx).
 */
function checkXmlWellFormed(xml: string): string | null {
  // Strip processing instructions (<?xml ...?>), comments (<!-- -->) and
  // CDATA sections first — they are legal XML but confuse the tag scanner.
  const stripped = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  const tagRe = /<\/?([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  let lastIdx = 0;
  while ((m = tagRe.exec(stripped)) !== null) {
    // Raw "<" in text content between tags is illegal.
    const between = stripped.slice(lastIdx, m.index);
    const lt = between.indexOf("<");
    if (lt !== -1) {
      return `unexpected '<' in text content near offset ${lastIdx + lt}`;
    }
    lastIdx = m.index + m[0].length;

    const isClose = m[0][1] === "/";
    const name = m[1];
    const attrs = m[2] || "";
    if (!isClose) {
      const selfClosed = m[0].endsWith("/>");
      if (!selfClosed) {
        if (!/^(?:[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*')|\s)*$/.test(attrs)) {
          return `malformed attributes on <${name}>`;
        }
        stack.push(name);
      }
    } else {
      const top = stack.pop();
      if (!top || top !== name) {
        return `mismatched closing tag </${name}> (expected </${top || "?"}>)`;
      }
    }
  }
  const tail = stripped.slice(lastIdx);
  const lt = tail.indexOf("<");
  if (lt !== -1) {
    return `unexpected '<' in text content near offset ${lastIdx + lt}`;
  }
  if (stack.length > 0) {
    return `unclosed element <${stack[stack.length - 1]}>`;
  }
  return null;
}

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

  // 1. Generate a safe storage path.
  //
  //    PATH CONVENTION — the FIRST segment MUST be the CALLER's user id
  //    (params.generatedBy). The `generated-reports` bucket's storage RLS
  //    policies require `(storage.foldername(name))[1] = auth.uid()`, so a
  //    path like `<university_id>/<student_id>/<file>` (the old convention)
  //    is rejected with "new row violates row-level security policy" —
  //    university ids are never auth.uid()s. The student id is kept as the
  //    SECOND segment so reports remain grouped per student.
  const safeFilename = sanitizeFilename(params.filename);
  const storagePath = [
    params.generatedBy,
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
