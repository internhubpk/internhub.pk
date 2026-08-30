"use client";

import { MyIssuesPageContent } from "@/components/shared/my-issues-page-content";

/**
 * Shared "My Issues" page for every role.
 *
 * Served at /dashboard/issues — same pattern as
 * /dashboard/notifications. Linked from the sidebar's "Report an Issue"
 * flow / My Issues entry, works identically regardless of the caller's
 * role since the underlying API + RLS scope everything to the caller's
 * own reports.
 */
export default function SharedMyIssuesPage() {
  return <MyIssuesPageContent />;
}
