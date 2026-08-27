/**
 * Test harness for the weekly-report docx template population.
 * Runs the REAL populateWeeklyReportTemplate() with mock data + the REAL
 * university logo / student signature downloaded from Supabase storage,
 * then inspects the generated package (header XML offsets, media parts,
 * signature placement, evidence section).
 *
 * Usage: node_modules/.bin/tsx scripts/test-docx-generation.ts
 */
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import {
  populateWeeklyReportTemplate,
  type WeeklyReportData,
} from "../src/lib/document-generation/document-service";
import { buildOleObjectBin } from "../src/lib/document-generation/ole-package";

const ASSETS = "/home/z/my-project/scripts/test-assets";
const OUT = "/home/z/my-project/scripts/test-assets/out";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const logo = fs.readFileSync(path.join(ASSETS, "logo.jpeg"));
  const sig = fs.readFileSync(path.join(ASSETS, "signature.png"));
  // A small fake PDF as file evidence
  const fakePdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF"
  );

  const data: WeeklyReportData = {
    universityName: "Ibadat International University, Islamabad",
    universityLogoBuffer: logo,
    departmentName: "Faculty of Computer Science",
    programName: "Computer Science",
    allPrograms: ["Computer Science", "Software Engineering", "Artificial Intelligence", "BBA"],
    studentName: "Muhammad Sami",
    studentRegistrationNumber: "IIUI-21-1234",
    hostOrganization: "Gohar Publishers",
    weekNumber: 2,
    reportingPeriodStart: "2026-08-17",
    reportingPeriodEnd: "2026-08-21",
    supervisorName: "Dr. Ahmad",
    industrySupervisorName: "Dr. Ahmad",
    facultySupervisorName: "Prof. Bilal",
    dailyEntries: [
      { dayName: "Monday", date: "2026-08-17", tasksPerformed: "Onboarding and setup", hoursWorked: 8, isHoliday: false },
      { dayName: "Tuesday", date: "2026-08-18", tasksPerformed: "Data cleaning", hoursWorked: 7, isHoliday: false },
      { dayName: "Wednesday", date: "2026-08-19", tasksPerformed: "Report drafting", hoursWorked: 8, isHoliday: false },
      { dayName: "Thursday", date: "2026-08-20", tasksPerformed: "QA", hoursWorked: 6, isHoliday: false },
      { dayName: "Friday", date: "2026-08-21", tasksPerformed: "Weekly review", hoursWorked: 5, isHoliday: false },
    ],
    learningOutcomes: "Learned the internal publishing workflow.",
    challengesFaced: "Tooling setup took longer than expected.",
    // Produced by resolveWeeklyReportData since 2026-08-27 — a single tick
    // instead of a numbered file listing (template-owner request).
    supportingEvidence: "✓ Supporting documents attached",
    evidenceAttachments: [
      { kind: "file", name: "Settings.pdf", buffer: fakePdf, ext: "pdf", mime: "application/pdf" },
      { kind: "image", name: "screenshot.png", buffer: sig, ext: "png", mime: "image/png" },
      { kind: "link", name: "GitHub", url: "https://github.com/example/repo" },
    ],
    supervisorRemarks: "Good progress this week.",
    studentSignatureBuffer: sig,
    industrySupervisorSignatureBuffer: sig,
    facultySupervisorSignatureBuffer: sig,
  };

  const result = await populateWeeklyReportTemplate(data);
  if (!result.success || !result.buffer) {
    console.error("GENERATION FAILED:", result.error);
    process.exit(1);
  }
  const outPath = path.join(OUT, "generated.docx");
  fs.writeFileSync(outPath, result.buffer);
  console.log("Generated:", outPath, `(${result.buffer.length} bytes)`);
  console.log("fieldsPopulated:", JSON.stringify(result.metadata.fieldsPopulated, null, 1));
  console.log("imagesEmbedded:", JSON.stringify(result.metadata.imagesEmbedded, null, 1));

  // ---- Inspect the generated package ----
  const zip = await JSZip.loadAsync(result.buffer);
  const header = await zip.file("word/header1.xml")!.async("string");
  const doc = await zip.file("word/document.xml")!.async("string");

  // 1. Header letterhead — must be INLINE + centered (no floating anchors)
  const logoIdx = header.indexOf('name="Image 1"');
  console.log("\n=== HEADER LETTERHEAD ===");
  console.log("Image 1 drawing present:", logoIdx !== -1);
  const headerHasAnchor = header.includes("<wp:anchor");
  const headerHasTextbox = header.includes("txbxContent");
  const headerInlineCount = (header.match(/<wp:inline/g) || []).length;
  console.log("floating wp:anchor remaining:", headerHasAnchor, "| textbox remaining:", headerHasTextbox);
  console.log("wp:inline drawings:", headerInlineCount);
  const centeredParas = (header.match(/<w:jc w:val="center"\/>/g) || []).length;
  console.log("centered paragraphs (<w:jc center>):", centeredParas);
  const logoExt = header.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
  console.log("inline logo extent:", logoExt?.[1], "x", logoExt?.[2],
    `(aspect ${logoExt ? (Number(logoExt[1]) / Number(logoExt[2])).toFixed(2) : "?"}, logo.jpeg is 1063x1063 → expect 762000x762000)`);
  const hdrTexts = [...header.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]);
  console.log("header texts:", JSON.stringify(hdrTexts));
  // spacing between logo and name (anti-"sticked" check)
  const afterLogoSpacing = header.match(/w:after="(\d+)"[^>]*\/><w:jc w:val="center"\/><w:rPr><w:noProof\/>/);
  console.log("spacing after logo paragraph:", afterLogoSpacing?.[1], "twips (expect 60 = 3pt)");

  // 3. Media parts
  console.log("\n=== MEDIA PARTS ===");
  Object.keys(zip.files).filter(f => f.startsWith("word/media")).forEach(f => console.log(" ", f, zip.files[f] ? "" : ""));

  // 4. Signature placement — find the signature table and check which row/cell has drawings
  console.log("\n=== SIGNATURE TABLE ===");
  const tbls = doc.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) || [];
  for (let ti = 0; ti < tbls.length; ti++) {
    const rows = tbls[ti].match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    const firstRowText = (rows[0]?.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).join(" ");
    if (!/Signature|Industry/.test(firstRowText)) continue;
    console.log(`Table ${ti} (${rows.length} rows) — SIGNATURE TABLE`);
    rows.forEach((row, ri) => {
      const cells = row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
      cells.forEach((cell, ci) => {
        const text = (cell.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]*>/g, "")).join("");
        const hasDrawing = cell.includes("<w:drawing>");
        const relIds = [...cell.matchAll(/r:embed="(rId[^"]+)"/g)].map(m => m[1]);
        console.log(`  Row ${ri} Cell ${ci}: text="${text}" drawing=${hasDrawing} rels=${relIds}`);
      });
    });
  }

  // 5. Evidence section
  console.log("\n=== EVIDENCE SECTION ===");
  const evHeadingIdx = doc.indexOf("Attachments — Supporting Evidence");
  console.log("Evidence heading found at:", evHeadingIdx);
  if (evHeadingIdx !== -1) {
    const before = doc.slice(0, evHeadingIdx);
    const sigTblEnd = before.lastIndexOf("</w:tbl>");
    console.log("Signature table ends at:", sigTblEnd, "(evidence is after signatures:", evHeadingIdx > sigTblEnd, ")");
    const between = before.slice(sigTblEnd);
    const hasPageBreak = /<w:br w:type="page"\/>/.test(between);
    console.log("Page break between signatures and evidence:", hasPageBreak);
    console.log("Has OLE objects:", doc.includes("<o:OLEObject"));
    console.log("Has hyperlink evidence:", /r:id="rIdEvLnk\d+"/.test(doc));
  }

  // 5a. Evidence section CLEANUP assertions (2026-08-27 requirements):
  //     - no "yapping" intro paragraph
  //     - no OLE caption ("… — double-click to open (PDF file, X KB)")
  //     - body shows the tick, not a numbered file listing
  //     - link evidence is CENTERED (no left indent)
  console.log("\n=== EVIDENCE CLEANUP ASSERTIONS ===");
  const yappingGone = !doc.includes("The supporting evidence submitted with this weekly log");
  const oleCaptionGone = !doc.includes("double-click to open");
  const tickPresent = doc.includes("✓ Supporting documents attached");
  const oldListingGone = !doc.includes("attached in the Attachments section");
  const linkParaMatch = doc.match(/<w:p><w:pPr>(?:<w:jc w:val="center"\/>|<w:spacing[^>]*\/>)+<\/w:pPr><w:hyperlink r:id="rIdEvLnk\d+"/);
  const linkCentered = !!linkParaMatch && linkParaMatch[0].includes('<w:jc w:val="center"/>');
  const linkIndented = /<w:ind w:left="\d+"\/><w:hyperlink/.test(doc);
  console.log("yapping intro REMOVED:", yappingGone);
  console.log("OLE caption REMOVED:", oleCaptionGone);
  console.log("tick mark in body ✓:", tickPresent);
  console.log("old numbered listing REMOVED:", oldListingGone);
  console.log("hyperlink evidence CENTERED:", linkCentered, "| left-indent remaining:", linkIndented);

  // 5b. Program table CENTERING assertions — the label row ("Program") and
  //     the value row must be horizontally + vertically centered.
  console.log("\n=== PROGRAM TABLE CENTERING ===");
  const progIdx = doc.indexOf("Program");
  if (progIdx !== -1) {
    const tblStart = doc.lastIndexOf("<w:tbl>", progIdx);
    const tblEnd = doc.indexOf("</w:tbl>", progIdx);
    const tbl = doc.slice(tblStart, tblEnd + 8);
    const paras = tbl.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
    const centeredCount = paras.filter(p => p.includes('<w:jc w:val="center"/>')).length;
    const indRemaining = (tbl.match(/<w:ind\b/g) || []).length;
    const cells = tbl.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const vAlignCount = cells.filter(c => c.includes('<w:vAlign w:val="center"/>')).length;
    console.log(`paragraphs: ${paras.length}, centered: ${centeredCount}, leftover <w:ind>: ${indRemaining}`);
    console.log(`cells: ${cells.length}, vertically centered: ${vAlignCount}`);
    console.log("PROGRAM TABLE CENTERED:", paras.length > 0 && centeredCount === paras.length && vAlignCount === cells.length && indRemaining === 0);
  }

  // 5c. Supervisor Remarks assertion — the remarks text must appear in the
  //     body AFTER the "Supervisor Remarks" heading. The heading text is
  //     SPLIT across multiple <w:t> runs in the template, so the check walks
  //     leaf paragraphs and concatenates their runs first.
  console.log("\n=== SUPERVISOR REMARKS ===");
  const leafParas = doc.match(/<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g) || [];
  const paraText = (p: string) =>
    (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]*>/g, "")).join("");
  const supParaIdx = leafParas.findIndex(p => paraText(p).replace(/\s+/g, " ").trim() === "Supervisor Remarks");
  const remarksParaIdx = leafParas.findIndex(p => paraText(p).includes("Good progress this week."));
  console.log("heading present:", supParaIdx !== -1, "| remarks text present:", remarksParaIdx !== -1,
    "| remarks after heading:", supParaIdx !== -1 && remarksParaIdx > supParaIdx);

  // 6. rels integrity: every r:embed in document.xml + header1.xml must exist in rels
  console.log("\n=== RELS INTEGRITY ===");
  const relsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");
  const headerRels = await zip.file("word/_rels/header1.xml.rels")!.async("string");
  const docRelsIds = new Set([...relsXml.matchAll(/Id="([^"]+)"/g)].map(m => m[1]));
  const headerRelsIds = new Set([...headerRels.matchAll(/Id="([^"]+)"/g)].map(m => m[1]));
  let ok = true;
  for (const m of doc.matchAll(/r:(?:embed|id)="([^"]+)"/g)) {
    if (!docRelsIds.has(m[1])) { console.log("  MISSING in document rels:", m[1]); ok = false; }
  }
  for (const m of header.matchAll(/r:(?:embed|id)="([^"]+)"/g)) {
    if (!headerRelsIds.has(m[1])) { console.log("  MISSING in header rels:", m[1]); ok = false; }
  }
  console.log(ok ? "  all r:embed/r:id references resolve" : "  BROKEN references!");

  console.log("\nDONE. Output at", outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
