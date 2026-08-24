"use client";

import { NotificationsPageContent } from "@/components/shared/notifications-page-content";

/**
 * Shared notifications page for roles without a dedicated notifications route.
 *
 * Served at /dashboard/notifications and reached via the notifications-popover's
 * "View all" link for: super-admin, university-admin, department-coordinator,
 * program-coordinator, and external-evaluator.
 */
export default function SharedNotificationsPage() {
  return <NotificationsPageContent />;
}
