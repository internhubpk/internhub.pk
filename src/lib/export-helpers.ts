/**
 * Client-side export helpers — real PDF (jsPDF) + real CSV downloads.
 *
 * Used by:
 *   - Student weekly-logs page (download own weekly log as PDF/CSV)
 *   - Faculty supervisor weekly-logs page (download student weekly log as PDF)
 *   - Site supervisor weekly-logs + evaluations pages
 *
 * No server roundtrip required — the file is generated entirely in the
 * browser and downloaded via a Blob URL. This keeps the download flow
 * resilient to API downtime and reduces server load.
 */

import { jsPDF } from "jspdf";

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function escapeCsv(value: unknown): string {
  const s = (value ?? "").toString();
  // Wrap in quotes; escape embedded quotes by doubling them.
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>
): void {
  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PdfSection {
  title?: string;
  /** Each line is rendered as a paragraph. */
  lines?: Array<string | { label: string; value: string }>;
  /** Optional bulleted list. */
  bullets?: string[];
}

/**
 * Generate a structured PDF document with a title, metadata block, and
 * arbitrary sections. Outputs an A4 single/multi-page PDF.
 *
 * The layout is intentionally simple — heading + body text per section —
 * to avoid the brittleness of html2canvas (which breaks on Tailwind v4
 * `oklch()` colors and on web fonts). For complex layouts, render HTML
 * and use html2canvas — but for data exports, this structured renderer
 * is more reliable.
 */
export function generatePdf(
  opts: {
    title: string;
    subtitle?: string;
    metadata?: Array<{ label: string; value: string }>;
    sections?: PdfSection[];
    footer?: string;
  },
  filename: string
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  const titleLines = doc.splitTextToSize(opts.title, maxWidth);
  titleLines.forEach((line: string) => {
    ensureSpace(28);
    doc.text(line, margin, y);
    y += 24;
  });
  y += 4;

  // Subtitle
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105); // slate-600
    const subLines = doc.splitTextToSize(opts.subtitle, maxWidth);
    subLines.forEach((line: string) => {
      ensureSpace(18);
      doc.text(line, margin, y);
      y += 16;
    });
    y += 6;
  }

  // Metadata block
  if (opts.metadata && opts.metadata.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    for (const item of opts.metadata) {
      ensureSpace(16);
      doc.text(`${item.label}:`, margin, y);
      doc.setFont("helvetica", "normal");
      const valueLines = doc.splitTextToSize(item.value || "—", maxWidth - 120);
      doc.text(valueLines, margin + 120, y);
      y += Math.max(16, valueLines.length * 14);
      doc.setFont("helvetica", "bold");
    }
    y += 8;
  }

  // Sections
  for (const section of opts.sections || []) {
    if (section.title) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(section.title, margin, y);
      y += 18;
    }
    if (section.lines) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      for (const line of section.lines) {
        if (typeof line === "string") {
          const wrapped = doc.splitTextToSize(line, maxWidth);
          wrapped.forEach((l: string) => {
            ensureSpace(14);
            doc.text(l, margin, y);
            y += 14;
          });
        } else {
          doc.setFont("helvetica", "bold");
          ensureSpace(14);
          doc.text(`${line.label}:`, margin, y);
          doc.setFont("helvetica", "normal");
          const valueLines = doc.splitTextToSize(line.value || "—", maxWidth - 130);
          doc.text(valueLines, margin + 130, y);
          y += Math.max(14, valueLines.length * 13);
        }
      }
      y += 6;
    }
    if (section.bullets) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      for (const b of section.bullets) {
        const wrapped = doc.splitTextToSize(`•  ${b}`, maxWidth - 12);
        wrapped.forEach((l: string, i: number) => {
          ensureSpace(14);
          doc.text(l, margin + (i === 0 ? 0 : 12), y);
          y += 14;
        });
      }
      y += 6;
    }
  }

  // Footer
  if (opts.footer) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(opts.footer, margin, pageHeight - 20);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin - 60,
        pageHeight - 20
      );
    }
  }

  doc.save(filename);
}

/**
 * Render a DOM element to a PDF using html2canvas. Use this when the
 * layout is visual (certificates, formatted reports). For pure data,
 * prefer `generatePdf()` — it's more reliable across browsers and
 * doesn't depend on the page's CSS rendering.
 *
 * Note: html2canvas has known issues with Tailwind v4 `oklch()` colors
 * and web fonts. If you see black/empty rectangles, fall back to
 * `generatePdf()`.
 */
export async function elementToPdf(
  element: HTMLElement,
  filename: string,
  opts?: { title?: string }
): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  if (opts?.title) {
    pdf.setProperties({ title: opts.title });
  }

  pdf.save(filename);
}
