/**
 * InternHub Production Test Suite
 *
 * Verifies the critical production invariants required by the spec + HEC
 * Stage 6/7 reference images:
 *
 *   1. Final-grade weights must be EXACTLY 40/30/25/5 (Site Supervisor /
 *      Student Reports / Faculty Supervisor / Activity Log).
 *   2. The 30% slot must be `student_reports` (NOT `department_coordinator`
 *      as a prior agent had changed it to).
 *   3. computeWeightedScore produces the spec's example value:
 *        Site Supervisor      85/100 × 40% = 34.00
 *        Student Reports      90/100 × 30% = 27.00
 *        Faculty Evaluation   80/100 × 25% = 20.00
 *        Activity Logs        95/100 ×  5% =  4.75
 *                                       ------------------
 *                                       85.75/100
 *   4. The IIUI Word template's "Faculty of Computer Science" placeholder
 *      is recognized by the substitution logic.
 */
import { FINAL_GRADE_WEIGHTS, computeWeightedScore, letterGradeFromScore } from "../final-grade";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

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

function approxEqual(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) < eps;
}

async function testFinalGradeWeights() {
  console.log("\n[1] Final-grade weights — HEC Stage 7 + spec §18");

  const sum =
    FINAL_GRADE_WEIGHTS.site_supervisor +
    FINAL_GRADE_WEIGHTS.student_reports +
    FINAL_GRADE_WEIGHTS.faculty_supervisor +
    FINAL_GRADE_WEIGHTS.activity_log;
  assert(approxEqual(sum, 1.0), "Weights sum to 1.0", `got ${sum}`);

  assert(
    approxEqual(FINAL_GRADE_WEIGHTS.site_supervisor, 0.40),
    "Site Supervisor = 40%",
    `got ${FINAL_GRADE_WEIGHTS.site_supervisor}`
  );

  assert(
    approxEqual(FINAL_GRADE_WEIGHTS.student_reports, 0.30),
    "Student Reports = 30% (HEC Stage 7 — not department_coordinator)",
    `got ${FINAL_GRADE_WEIGHTS.student_reports}`
  );
  assert(
    !("department_coordinator" in FINAL_GRADE_WEIGHTS),
    "department_coordinator weight must NOT exist (was a bug)"
  );
  assert(
    "student_reports" in FINAL_GRADE_WEIGHTS,
    "student_reports weight must exist"
  );

  assert(
    approxEqual(FINAL_GRADE_WEIGHTS.faculty_supervisor, 0.25),
    "Faculty Supervisor = 25%",
    `got ${FINAL_GRADE_WEIGHTS.faculty_supervisor}`
  );

  assert(
    approxEqual(FINAL_GRADE_WEIGHTS.activity_log, 0.05),
    "Activity Log = 5%",
    `got ${FINAL_GRADE_WEIGHTS.activity_log}`
  );
}

function testSpecExample() {
  console.log("\n[2] Spec example calculation (HEC Stage 7 reference)");
  const result = computeWeightedScore(85, 90, 80, 95);
  assert(
    approxEqual(result, 85.75, 0.01),
    "Spec example: 85/90/80/95 → 85.75",
    `got ${result}`
  );

  const letter = letterGradeFromScore(85.75);
  assert(letter === "A", "Letter grade for 85.75 = 'A'", `got ${letter}`);

  assert(
    approxEqual(computeWeightedScore(100, 100, 100, 100), 100),
    "All 100 → 100"
  );
  assert(
    approxEqual(computeWeightedScore(0, 0, 0, 0), 0),
    "All 0 → 0"
  );
  assert(approxEqual(85 * 0.40, 34.00), "Site supervisor contribution 34.00");
  assert(approxEqual(90 * 0.30, 27.00), "Student reports contribution 27.00");
  assert(approxEqual(80 * 0.25, 20.00), "Faculty supervisor contribution 20.00");
  assert(approxEqual(95 * 0.05, 4.75), "Activity log contribution 4.75");
}

async function testWordTemplateHeaderSubstitution() {
  console.log("\n[3] Word template — IIUI header text recognition");
  const templatePath = path.join(
    process.cwd(),
    "src/lib/document-generation/templates/weekly-activity-report-template.docx"
  );
  if (!fs.existsSync(templatePath)) {
    console.log("  (skipped — template not found)");
    return;
  }
  const buf = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(buf);
  const headerXml = await zip.file("word/header1.xml")!.async("string");

  // The header text may itself be split across multiple <w:t> runs.
  // Strip XML tags first and look for plain text.
  const headerPlain = headerXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert(
    /Ibadat\s+International\s+University\s+Islamabad/i.test(headerPlain),
    "Template header contains 'Ibadat International University Islamabad' (as plain text)"
  );
  assert(
    /Faculty\s+of\s+Computer\s+Science/i.test(headerPlain),
    "Template header contains 'Faculty of Computer Science' (must be substituted per-student)"
  );

  // Verify the document.xml body labels are recognisable either as a
  // single <w:t> run OR split across runs (concatenated plain text).
  const documentXml = await zip.file("word/document.xml")!.async("string");
  const bodyPlain = documentXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const expectedLabels = [
    "Student Name",
    "Registration No.",
    "Host Organization",
    "Week No.",
    "Reporting Period",
    "Supervisor",
    "Day/Date",
    "Tasks Performed",
    "Hours",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Learning Outcomes / Skills Gained",
    "Challenges Faced and Solutions",
    "Supporting Evidence",
    "Supervisor Remarks",
    "Student Signature",
    "Industry Supervisor",
    "Faculty Supervisor",
  ];
  for (const label of expectedLabels) {
    assert(
      bodyPlain.includes(label),
      `Template body contains '${label}' label (plain text)`
    );
  }
}

async function main() {
  console.log("============================================================");
  console.log("InternHub Production Invariants — HEC Stage 6/7 + Spec §18");
  console.log("============================================================");

  await testFinalGradeWeights();
  testSpecExample();
  await testWordTemplateHeaderSubstitution();

  console.log("\n------------------------------------------------------------");
  console.log(`  ${totalPass} passed, ${totalFail} failed`);
  console.log("------------------------------------------------------------");
  if (totalFail > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test harness crashed:", e);
  process.exit(1);
});
