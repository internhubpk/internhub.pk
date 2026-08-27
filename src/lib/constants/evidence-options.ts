/**
 * Canonical supporting-evidence checklist options.
 *
 * Shared between:
 *  - the STUDENT weekly-log form (`src/app/(dashboard)/student/weekly-logs`),
 *    which renders them as a multi-select checkbox list, and
 *  - the Word report generator
 *    (`src/lib/document-generation/document-service.ts`), which renders the
 *    SAME list with a ticked box (☑) for the options the student ticked and
 *    an empty box (☐) for the rest.
 *
 * The strings must stay byte-identical to the template's guidance bullets
 * (see removeTemplateEvidenceBullets in document-service.ts) so legacy logs
 * and the blank-form instructions keep matching.
 */
export const EVIDENCE_OPTIONS = [
  "Attendance record or timesheet",
  "Screenshots of completed work",
  "Source code or GitHub commits (if applicable)",
  "Design documents, reports, or presentations",
  "Meeting minutes or task assignments",
  "Photographs of activities (where appropriate)",
  "Any certificate, email, or verification issued by the host organization",
] as const;

export type EvidenceOption = (typeof EVIDENCE_OPTIONS)[number];

/** Checkbox glyphs used in the Word report (U+2611 / U+2610). */
export const BOX_CHECKED = "\u2611"; // ☑
export const BOX_UNCHECKED = "\u2610"; // ☐
