/**
 * Notification dispatcher — inserts a row into the `notifications` table
 * AND fires a push notification to the user's subscribed devices.
 *
 * This is the single entry point for all workflow-triggered notifications.
 * Workflow event handlers (task assigned, weekly log submitted, evaluation
 * completed, etc.) should call notifyUser() — they do NOT need to:
 *   - check whether the user has push subscriptions
 *   - check whether VAPID is configured
 *   - fetch the user's notification preferences
 * Those concerns are encapsulated here.
 *
 * SECURITY:
 *   - The notification row is inserted using the *caller's* supabase
 *     client (the user triggering the event), so RLS applies.
 *   - The push send uses the service role client (server-only) to fetch
 *     subscriptions — this is intentional because the SENDER is not the
 *     RECIPIENT.
 *   - This module is server-only. Never import into client code.
 */

import { createClient } from "@/utils/supabase/server";
import { sendPushToUser, type PushPayload } from "@/lib/push-notifications";
import type { NotificationCategory, NotificationPriority } from "@/types";

// Extending the NotificationCategory type to include 'task' which is used
// by some workflow notifications. The DB schema (migration 0001) already
// supports 'task' as a valid category, but the TS type definition in
// src/types/index.ts does not include it. We use a widened type here
// to avoid breaking the existing code.
type NotificationCategoryWide = NotificationCategory | "task";

export interface NotifyInput {
  user_id: string;
  title: string;
  message: string;
  category: NotificationCategoryWide;
  priority?: NotificationPriority;
  action_url?: string | null;
  metadata?: Record<string, unknown>;
  // Optional: the push payload to send. Defaults to a simple payload
  // derived from title/message/action_url.
  push?: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    requireInteraction?: boolean;
  };
}

export interface NotifyResult {
  notificationId: string | null;
  pushSent: number;
  pushFailed: number;
  error?: string;
}

/**
 * Send a notification to a user.
 *
 * Inserts a row into `notifications` (RLS-enforced via the caller's supabase
 * client), then sends a web push notification to all active push
 * subscriptions for the user (server-side, service-role).
 *
 * If the user has no push subscriptions, only the in-app notification is
 * created (visible via the notifications popover).
 *
 * If VAPID is not configured, the push send is silently skipped — the
 * in-app notification is still created.
 */
export async function notifyUser(input: NotifyInput): Promise<NotifyResult> {
  try {
    const supabase = await createClient();

    // 1. Insert the notification row. RLS on `notifications` allows the
    //    sender to insert a row addressed to ANY user_id (this is the
    //    one direction RLS allows — outbound notifications TO others).
    const { data: notif, error: notifErr } = await supabase
      .from("notifications")
      .insert({
        user_id: input.user_id,
        title: input.title,
        message: input.message,
        category: input.category,
        priority: input.priority || "medium",
        is_read: false,
        action_url: input.action_url || null,
        metadata: input.metadata || {},
      })
      .select("id")
      .single();

    if (notifErr || !notif) {
      console.error("[notify] Failed to insert notification:", notifErr);
      return { notificationId: null, pushSent: 0, pushFailed: 0, error: notifErr?.message };
    }

    // 2. Send the push notification (server-side, service role).
    const pushPayload: PushPayload = {
      title: input.push?.title || input.title,
      body: input.push?.body || input.message,
      icon: input.push?.icon || "/icon-192.png",
      badge: input.push?.badge || "/icon-96.png",
      tag: input.push?.tag || `notif-${notif.id}`,
      data: {
        notificationId: notif.id,
        actionUrl: input.action_url,
        category: input.category,
        ...(input.push?.data || {}),
      },
      requireInteraction: input.priority === "urgent" || input.push?.requireInteraction,
    };

    const pushResult = await sendPushToUser(input.user_id, pushPayload);

    return {
      notificationId: notif.id,
      pushSent: pushResult.sent,
      pushFailed: pushResult.failed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[notify] Threw:", err);
    return { notificationId: null, pushSent: 0, pushFailed: 0, error: msg };
  }
}

/**
 * Notify multiple users in parallel.
 */
export async function notifyUsers(
  inputs: NotifyInput[]
): Promise<NotifyResult[]> {
  return Promise.all(inputs.map((i) => notifyUser(i)));
}

// ----------------------------------------------------------------------------
// Workflow event triggers — convenience wrappers for common notifications
// ----------------------------------------------------------------------------

export async function notifyTaskAssigned(
  studentId: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  await notifyUser({
    user_id: studentId,
    title: "New task assigned",
    message: `You have been assigned: "${taskTitle}"`,
    category: "task",
    priority: "high",
    action_url: `/student/tasks?id=${taskId}`,
    metadata: { taskId, type: "task_assigned" },
    push: { tag: `task-${taskId}` },
  });
}

export async function notifyTaskReviewed(
  studentId: string,
  taskTitle: string,
  taskId: string,
  status: "approved" | "rejected"
): Promise<void> {
  await notifyUser({
    user_id: studentId,
    title: `Task ${status}`,
    message: `Your submission for "${taskTitle}" has been ${status}.`,
    category: "task",
    priority: "medium",
    action_url: `/student/tasks?id=${taskId}`,
    metadata: { taskId, status, type: "task_reviewed" },
    push: { tag: `task-${taskId}-reviewed` },
  });
}

export async function notifyWeeklyLogSubmitted(
  supervisorId: string,
  studentName: string,
  weekNumber: number,
  weeklyLogId: string
): Promise<void> {
  await notifyUser({
    user_id: supervisorId,
    title: "Weekly log submitted",
    message: `${studentName} submitted weekly log #${weekNumber} for review.`,
    category: "evaluation",
    priority: "medium",
    action_url: `/site-supervisor/weekly-logs?id=${weeklyLogId}`,
    metadata: { weeklyLogId, weekNumber, type: "weekly_log_submitted" },
    push: { tag: `weekly-log-${weeklyLogId}` },
  });
}

export async function notifyWeeklyLogReviewed(
  studentId: string,
  weekNumber: number,
  weeklyLogId: string,
  status: "approved" | "rejected" | "revision_required"
): Promise<void> {
  await notifyUser({
    user_id: studentId,
    title: `Weekly log ${status.replace("_", " ")}`,
    message: `Your weekly log #${weekNumber} has been ${status.replace("_", " ")}.`,
    category: "evaluation",
    priority: status === "rejected" ? "high" : "medium",
    action_url: `/student/weekly-logs?id=${weeklyLogId}`,
    metadata: { weeklyLogId, weekNumber, status, type: "weekly_log_reviewed" },
    push: { tag: `weekly-log-${weeklyLogId}-reviewed` },
  });
}

export async function notifyEvaluationCompleted(
  studentId: string,
  evaluationType: string,
  evaluatorName: string,
  evaluationId: string
): Promise<void> {
  await notifyUser({
    user_id: studentId,
    title: "Evaluation completed",
    message: `${evaluatorName} has completed your ${evaluationType} evaluation.`,
    category: "evaluation",
    priority: "medium",
    action_url: `/student/evaluations?id=${evaluationId}`,
    metadata: { evaluationId, evaluationType, type: "evaluation_completed" },
    push: { tag: `eval-${evaluationId}` },
  });
}

export async function notifyEvaluationCycleStart(
  studentId: string,
  cycleType: "three_week" | "final",
  weekNumber: number
): Promise<void> {
  await notifyUser({
    user_id: studentId,
    title: cycleType === "final" ? "Final evaluation started" : "Three-week evaluation started",
    message:
      cycleType === "final"
        ? "Your final evaluation cycle has begun. Please ensure all reports and evaluations are submitted."
        : `Week ${weekNumber}: your three-week evaluation cycle has started. Site supervisor evaluation and weekly reports are due.`,
    category: "evaluation",
    priority: cycleType === "final" ? "urgent" : "high",
    action_url: "/student/evaluations",
    metadata: { cycleType, weekNumber, type: "evaluation_cycle_start" },
    push: { tag: `eval-cycle-${cycleType}-${weekNumber}`, requireInteraction: cycleType === "final" },
  });
}

export async function notifyFinalEvaluationCompleted(
  studentId: string,
  finalScore: number,
  letterGrade: string
): Promise<void> {
  await notifyUser({
    user_id: studentId,
    title: "Final evaluation completed",
    message: `Your final evaluation is complete. Score: ${finalScore.toFixed(2)} (${letterGrade}). Your final report is now available.`,
    category: "evaluation",
    priority: "urgent",
    action_url: "/student/certificates",
    metadata: { finalScore, letterGrade, type: "final_evaluation_completed" },
    push: { tag: "final-evaluation", requireInteraction: true },
  });
}

export async function notifyReportFinalized(
  studentId: string,
  reportType: string,
  reportId: string
): Promise<void> {
  await notifyUser({
    user_id: studentId,
    title: "Report finalized",
    message: `Your ${reportType} report has been finalized and is available for download.`,
    category: "evaluation",
    priority: "high",
    action_url: `/student/documents?report=${reportId}`,
    metadata: { reportId, reportType, type: "report_finalized" },
    push: { tag: `report-${reportId}` },
  });
}
