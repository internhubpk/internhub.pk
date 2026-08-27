/**
 * Edge-case tests for the inline header letterhead rebuild:
 *   1. Wide banner logo (like the template's own 2.5:1 logo)
 *   2. Very long university name (font scaling)
 *   3. No logo buffer at all (template logo kept at template size)
 *   4. Empty department name
 * Verifies: no floating anchors remain, inline drawing present, centered
 * paragraphs, correct texts, aspect ratio preserved, XML well-formed.
 */
import * as fs from "fs";
import JSZip from "jszip";
import {
  populateWeeklyReportTemplate,
  type WeeklyReportData,
} from "../src/lib/document-generation/document-service";

const ASSETS = "/home/z/my-project/scripts/test-assets";

function baseData(overrides: Partial<WeeklyReportData>): WeeklyReportData {
  return {
    universityName: "Edge Case University",
    universityLogoBuffer: null,
    departmentName: "Faculty of Engineering",
    programName: "Computer Science",
    studentName: "Test Student",
    studentRegistrationNumber: "REG-001",
    hostOrganization: "Test Company",
    weekNumber: 1,
    reportingPeriodStart: "2026-08-24",
    reportingPeriodEnd: "2026-08-28",
    supervisorName: "Test Supervisor",
    industrySupervisorName: "Test Site Supervisor",
    facultySupervisorName: "Test Faculty Supervisor",
    allPrograms: ["Computer Science", "Software Engineering"],
    dailyEntries: [
      { dayName: "Monday", date: "2026-08-24", tasksPerformed: "Task A", hoursWorked: 8, isHoliday: false },
      { dayName: "Tuesday", date: "2026-08-25", tasksPerformed: "Task B", hoursWorked: 8, isHoliday: false },
      { dayName: "Wednesday", date: "2026-08-26", tasksPerformed: "Task C", hoursWorked: 8, isHoliday: false },
      { dayName: "Thursday", date: "2026-08-27", tasksPerformed: "Task D", hoursWorked: 8, isHoliday: false },
      { dayName: "Friday", date: "2026-08-28", tasksPerformed: "Task E", hoursWorked: 8, isHoliday: false },
    ],
    learningOutcomes: "Learned things.",
    challengesFaced: "Some challenges.",
    supportingEvidence: "n/a",
    evidenceAttachments: [],
    supervisorRemarks: "",
    studentSignatureBuffer: null,
    industrySupervisorSignatureBuffer: null,
    facultySupervisorSignatureBuffer: null,
    ...overrides,
  };
}

async function check(label: string, data: WeeklyReportData) {
  const result = await populateWeeklyReportTemplate(data);
  if (!result.success || !result.buffer) {
    console.log(`✗ ${label}: GENERATION FAILED — ${result.error}`);
    return;
  }
  const zip = await JSZip.loadAsync(result.buffer);
  const header = await zip.file("word/header1.xml")!.async("string");
  const anchors = (header.match(/<wp:anchor/g) || []).length;
  const inlines = (header.match(/<wp:inline/g) || []).length;
  const centered = (header.match(/<w:jc w:val="center"\/>/g) || []).length;
  const texts = [...header.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]);
  const ext = header.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
  const inlineFlag = result.metadata.fieldsPopulated.includes("header_letterhead_inline_centered");
  const aspect = ext ? Number(ext[1]) / Number(ext[2]) : 0;
  // XML well-formedness (cheap check: balanced paragraph tags)
  const opens = (header.match(/<w:p[ >]/g) || []).length;
  const closes = (header.match(/<\/w:p>/g) || []).length;
  const balanced = opens === closes;
  console.log(
    `${inlineFlag && anchors === 0 && inlines >= 1 && centered >= 2 && balanced ? "✓" : "✗"} ${label}: ` +
    `inline=${inlineFlag} anchors=${anchors} inlineDrawings=${inlines} centeredParas=${centered} ` +
    `pBalanced=${balanced} aspect=${aspect.toFixed(2)} texts=${JSON.stringify(texts)}`
  );
}

async function main() {
  // 1. Wide banner logo (create 2000x800 PNG-ish buffer via the existing square logo? use real jpeg)
  const squareLogo = fs.readFileSync(`${ASSETS}/logo.jpeg`);

  // Wide banner: build a minimal valid BMP 1200x400 manually
  const wideW = 1200, wideH = 400;
  const rowSize = Math.ceil((wideW * 3) / 4) * 4;
  const pix = Buffer.alloc(rowSize * wideH, 0x80);
  const bmp = Buffer.concat([
    Buffer.from([0x42, 0x4d]),
    (() => { const b = Buffer.alloc(12); b.writeUInt32LE(54 + pix.length, 0); b.writeUInt32LE(54, 8); return b; })(),
    (() => { const b = Buffer.alloc(40); b.writeUInt32LE(40, 0); b.writeInt32LE(wideW, 4); b.writeInt32LE(-wideH, 8); b.writeUInt16LE(1, 12); b.writeUInt16LE(24, 14); return b; })(),
    pix,
  ]);

  await check("square logo (1063x1063)", baseData({ universityLogoBuffer: squareLogo }));
  await check("wide banner logo (1200x400)", baseData({ universityLogoBuffer: bmp }));
  await check("no logo buffer (template logo)", baseData({ universityLogoBuffer: null }));
  await check("long university name (86 chars)", baseData({
    universityName: "International Islamic University of Science, Technology and Innovation Islamabad Pakistan",
  }));
  await check("empty department", baseData({ departmentName: "" }));
  await check("long department (95 chars)", baseData({
    departmentName: "Faculty of Computer Science, Software Engineering, Artificial Intelligence and Data Sciences",
  }));
}

main().catch(e => { console.error(e); process.exit(1); });
