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
    studentName: "Muhammad Sami",
    studentRegistrationNumber: "IIUI-21-1234",
    hostOrganization: "Gohar Publishers",
    weekNumber: 2,
    reportingPeriodStart: "2026-08-17",
    reportingPeriodEnd: "2026-08-21",
    supervisorName: "Dr. Ahmad",
    dailyEntries: [
      { dayName: "Monday", date: "2026-08-17", tasksPerformed: "Onboarding and setup", hoursWorked: 8, isHoliday: false },
      { dayName: "Tuesday", date: "2026-08-18", tasksPerformed: "Data cleaning", hoursWorked: 7, isHoliday: false },
      { dayName: "Wednesday", date: "2026-08-19", tasksPerformed: "Report drafting", hoursWorked: 8, isHoliday: false },
      { dayName: "Thursday", date: "2026-08-20", tasksPerformed: "QA", hoursWorked: 6, isHoliday: false },
      { dayName: "Friday", date: "2026-08-21", tasksPerformed: "Weekly review", hoursWorked: 5, isHoliday: false },
    ],
    learningOutcomes: "Learned the internal publishing workflow.",
    challengesFaced: "Tooling setup took longer than expected.",
    supportingEvidence: "1. Settings.pdf (PDF file — attached in the Attachments section)",
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

  // 1. Logo anchor geometry
  const logoIdx = header.indexOf('name="Image 1"');
  const logoAnchorStart = header.lastIndexOf("<wp:anchor", logoIdx);
  const logoAnchor = header.slice(logoAnchorStart, header.indexOf("</wp:anchor>", logoIdx));
  const posH = logoAnchor.match(/<wp:positionH[^>]*>[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
  const extent = logoAnchor.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
  console.log("\n=== LOGO ANCHOR ===");
  console.log("positionH offset:", posH?.[1], "(centered would be", (7772400 - Number(extent?.[1] || 0)) / 2, ")");
  console.log("extent:", extent?.[1], "x", extent?.[2]);

  // 2. University-name textbox geometry
  const tbIdx = header.indexOf('name="Textbox 2"');
  const tbStart = header.lastIndexOf("<wp:anchor", tbIdx);
  const tbSpan = header.slice(tbStart, header.indexOf("</mc:AlternateContent>", tbIdx));
  const tbPos = tbSpan.match(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
  const tbExt = tbSpan.match(/<wp:extent cx="(\d+)"/);
  console.log("\n=== NAME TEXTBOX ===");
  console.log("positionH offset:", tbPos?.[1], "(centered would be", (7772400 - Number(tbExt?.[1] || 0)) / 2, ")");
  console.log("extent cx:", tbExt?.[1]);
  const vmlStyle = tbSpan.match(/style="([^"]*)"/);
  console.log("VML style:", vmlStyle?.[1]?.slice(0, 160));

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
