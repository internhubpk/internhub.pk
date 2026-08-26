/**
 * Document-generation substitution test — verifies that
 * `populateWeeklyReportTemplate()` actually substitutes the university
 * name + department name in the header, and fills all the body labels,
 * using a synthetic WeeklyReportData object.
 *
 * Run with: npx tsx src/lib/__tests__/document-generation.test.ts
 */
import path from "path";
import fs from "fs";
import JSZip from "jszip";
import { populateWeeklyReportTemplate } from "../document-generation/document-service";
import type { WeeklyReportData } from "../document-generation/document-service";

const PASS = "\u2713 PASS";
const FAIL = "\u2717 FAIL";
let totalPass = 0;
let totalFail = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    totalPass++;
  } else {
    console.log(`  ${FAIL}  ${label}${detail ? ` — ${detail}` : ""}`);
    totalFail++;
  }
}

function extractCellPlainText(cellXml: string): string {
  const parts: string[] = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = tRegex.exec(cellXml)) !== null) {
    parts.push(m[1]);
  }
  return parts.join("");
}

async function main() {
  console.log("============================================================");
  console.log("Document-generation substitution test");
  console.log("============================================================");

  // Build a synthetic data object with obviously distinguishable values.
  const data: WeeklyReportData = {
    universityName: "Test University of InternHub",
    universityLogoBuffer: null, // skip logo swap for this test (keep IIUI logo bytes)
    departmentName: "Test Department of Engineering",
    programName: "Test Program X",
    studentName: "Test Student Name",
    studentRegistrationNumber: "TEST-REG-001",
    hostOrganization: "Test Host Organization Inc.",
    weekNumber: 99,
    reportingPeriodStart: "2026-08-24",
    reportingPeriodEnd: "2026-08-30",
    supervisorName: "Test Supervisor Name",
    dailyEntries: [
      { dayName: "Monday" as const, date: "2026-08-24", tasksPerformed: "Monday task A", hoursWorked: 8, isHoliday: false },
      { dayName: "Tuesday" as const, date: "2026-08-25", tasksPerformed: "Tuesday task B", hoursWorked: 7, isHoliday: false },
      { dayName: "Wednesday" as const, date: "2026-08-26", tasksPerformed: "Wednesday task C", hoursWorked: 9, isHoliday: false },
      { dayName: "Thursday" as const, date: "2026-08-27", tasksPerformed: "Thursday task D", hoursWorked: 6, isHoliday: false },
      { dayName: "Friday" as const, date: "2026-08-28", tasksPerformed: "Friday task E", hoursWorked: 5, isHoliday: false },
    ],
    learningOutcomes: "Test learning outcomes content.",
    challengesFaced: "Test challenges content.",
    supportingEvidence: "1. evidence-A\n2. evidence-B",
    evidenceAttachments: [],
    supervisorRemarks: "Test supervisor remarks.",
    studentSignatureBuffer: null,
    industrySupervisorSignatureBuffer: null,
    facultySupervisorSignatureBuffer: null,
  };

  const result = await populateWeeklyReportTemplate(data);
  if (!result.success || !result.buffer) {
    console.log(`  ${FAIL}  populateWeeklyReportTemplate failed:`, result.error);
    process.exit(1);
  }
  assert(result.success, "populateWeeklyReportTemplate succeeded");
  assert(!!result.buffer, "Result has a buffer");
  assert(
    result.metadata.fieldsPopulated.includes("university_name (header)"),
    "university_name (header) reported as populated"
  );
  assert(
    result.metadata.fieldsPopulated.includes("department_name (header)"),
    "department_name (header) reported as populated"
  );

  // Re-open the generated docx and verify the substitutions actually happened.
  const zip = await JSZip.loadAsync(result.buffer!);
  const headerXml = await zip.file("word/header1.xml")!.async("string");
  const headerPlain = headerXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert(
    headerPlain.includes("Test University of InternHub"),
    "Header now contains the substituted university name"
  );
  assert(
    !headerPlain.includes("Ibadat International University Islamabad"),
    "Header no longer contains the placeholder IIUI name"
  );
  assert(
    headerPlain.includes("Test Department of Engineering"),
    "Header now contains the substituted department name"
  );
  assert(
    !headerPlain.includes("Faculty of Computer Science"),
    "Header no longer contains the placeholder 'Faculty of Computer Science'"
  );

  // Verify body substitutions.
  const documentXml = await zip.file("word/document.xml")!.async("string");
  const bodyPlain = documentXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const expectedInBody = [
    "Test Student Name",
    "TEST-REG-001",
    "Test Host Organization Inc.",
    "99",
    "Test Supervisor Name",
    "Monday task A",
    "Tuesday task B",
    "Wednesday task C",
    "Thursday task D",
    "Friday task E",
    "Test learning outcomes content.",
    "Test challenges content.",
    "1. evidence-A",
    "Test supervisor remarks.",
    "Test Program X",
  ];
  for (const expected of expectedInBody) {
    assert(
      bodyPlain.includes(expected),
      `Body contains '${expected}'`
    );
  }

  // Verify the IIUI placeholder was actually replaced (no leftover).
  assert(
    !bodyPlain.includes("Ibadat International University Islamabad"),
    "Body no longer contains the IIUI placeholder name"
  );

  console.log("\n------------------------------------------------------------");
  console.log(`  ${totalPass} passed, ${totalFail} failed`);
  console.log("------------------------------------------------------------");
  if (totalFail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test harness crashed:", e);
  process.exit(1);
});
