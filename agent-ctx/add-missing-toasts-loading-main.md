# Task: add-missing-toasts-loading

**Agent**: main
**Task**: Add missing success toasts and loading states to critical mutations identified in the toast audit.

## Scope

The toast migration already converted all legacy `useToast()` calls to the visible `sharedToast` (Sonner-based) system. Many critical mutations, however, still had:
- No success toast (user got no feedback when an action succeeded)
- No loading state (double-submit was possible)
- No `disabled` prop on the action button during the request

This task fills those gaps **without** changing the underlying mutation logic — only feedback (toast + loading state + disabled buttons).

## Files changed

### Company HR
- `src/app/(dashboard)/company-hr/internships/page.tsx` — 4 mutations (create, edit, delete, toggle status). Added `isSaving` / `isDeleting` / `isToggling` state, `toast.success` for each, `disabled` props on the buttons, and "Creating.../Saving.../Deleting..." labels.
- `src/app/(dashboard)/company-hr/supervisors/page.tsx` — 4 mutations (create, edit, toggle, delete). Same pattern as internships.
- `src/app/(dashboard)/company-hr/applications/page.tsx` — Added `toast.success` to handleAccept / handleReject / handleMarkForReview / handleBatchAccept / handleBatchReject. Added `disabled={updating}` to the batch buttons (Accept All Selected, Reject All Selected, and the batch-reject AlertDialogAction).
- `src/app/(dashboard)/company-hr/evaluations/page.tsx` — Added `toast.success` for submit-evaluation (submitted vs. draft) and issue-certificate. The existing `submitting` / `issuingCert` loading states already disabled the buttons.
- `src/app/(dashboard)/company-hr/interns/page.tsx` — Added `toast.success("Supervisor assigned")` after the assignment API returns OK.
- `src/app/(dashboard)/company-hr/attendance/page.tsx` — Added `toast.success("Correction saved")`.
- `src/app/(dashboard)/company-hr/documents/page.tsx` — Added `toast.success("Document uploaded")` on upload. Restructured the bulk-generate loop to track per-item failures and emit `toast.warning("Generation completed with errors")` when any items failed (and `toast.success` when all succeeded). Added `toast.success("Document deleted")` on delete.

### Student
- `src/app/(dashboard)/student/internships/page.tsx` — Replaced the generic "Success" toast with `toast.success("Application submitted")` carrying the internship title in the description. Also enriched the error toast with the underlying error message.
- `src/app/(dashboard)/student/applications/page.tsx` — Added `toast.success("Application withdrawn")` with the internship title in the description.
- `src/app/(dashboard)/student/documents/page.tsx` — Added `toast.success("Document uploaded")` and `toast.success("Document deleted")`. Added `isDeleting` state, deferred dialog close until after the operation succeeds, and disabled the Cancel/Delete buttons in the AlertDialog while deleting.
- `src/app/(dashboard)/student/profile/page.tsx` — Added `toast.success("CV uploaded")` and `toast.success("CV deleted")`. Added `cvDeleting` state and `disabled={cvDeleting}` on the AlertDialog buttons.
- `src/app/(dashboard)/student/weekly-logs/page.tsx` — Added `import { toast } from "@/components/shared/toast"` (the file did not import toast at all). Refactored `handleSubmit` to track partial-failure warnings across the 5-step pipeline (signature upload, logo upload, evidence uploads, final patch) and surface `toast.success("Weekly log submitted")` on full success or `toast.warning("Weekly log submitted with warnings")` when any step failed. Added `toast.error("Failed to submit weekly log")` on catch.

### Site Supervisor
- `src/app/(dashboard)/site-supervisor/weekly-logs/page.tsx` — Replaced the generic "Success" review toast with action-specific labels: `"Log approved"`, `"Log rejected"`, `"Log flagged for revision"` (with appropriate descriptions). The sign handler already emitted `"Signed"` / `"Fully Approved"` — left as-is.
- `src/app/(dashboard)/site-supervisor/notifications/page.tsx` — Verified existing implementation: `isSending` state already exists, button already disabled, success toast already present. No code changes needed.

### Faculty Supervisor
- `src/app/(dashboard)/faculty-supervisor/weekly-logs/page.tsx` — Added `toast.success("Log approved/rejected/flagged for revision")` to `handleReview`. Sign handler already emitted `"Signed"` / `"Fully Approved"` — left as-is.
- `src/app/(dashboard)/faculty-supervisor/notifications/page.tsx` — Added `toast.success("Notification sent to N recipients")` with the notification title in the description.
- `src/app/(dashboard)/faculty-supervisor/evaluations/page.tsx` — `handleApproveReport` had no loading state and the Approve button was never disabled. Added `approvingReportId` state, `disabled={approvingReportId === report.id}` on the Approve button, and "Approving..." label. The success toast (`"Weekly report approved"`) already existed.

## Verification
- `npx tsc --noEmit` → EXIT 0
- `npx next build` → EXIT 0 (all 70+ routes compiled successfully)
- `bun run lint` → EXIT 0

## Stage Summary
- Total mutations improved: **31** across 17 files
- Build status: ✅ passing (`npx next build` exit 0)
- Lint status: ✅ passing (`bun run lint` exit 0)
- TypeScript: ✅ passing (`npx tsc --noEmit` exit 0)
