/**
 * Server-side notification helper.
 *
 * Centralises the logic for inserting in-app notifications into the
 * `notifications` table AND firing web push notifications to subscribed
 * devices. Used by API routes to fire notifications on key workflow events:
 *
 *   - Application submitted / accepted / rejected
 *   - Task assigned / submitted / evaluated
 *   - Weekly log submitted / reviewed
 *   - Evaluation submitted (site / faculty)
 *   - Student enrolled / assigned supervisor
 *
 * Each helper accepts a Supabase server client (so it inherits the
 * caller's RLS context) and inserts one row per recipient. The push
 * notification is sent via the service-role client (so we can read
 * push_subscriptions rows for the recipient — the SENDER is not the
 * RECIPIENT, so the caller's RLS context cannot read them).
 *
 * Failures are logged but never throw — notifications are best-effort
 * and should not break the parent workflow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push-notifications";

// notification_category enum (from migration 0001):
//   auth, application, evaluation, deadline, system,
//   announcement, task, attendance, certificate
export type NotificationCategory =
  | "auth"
  | "application"
  | "evaluation"
  | "deadline"
  | "system"
  | "announcement"
  | "task"
  | "attendance"
  | "certificate";

// notification_priority enum: low, medium, high, urgent
export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface SendNotificationInput {
  /** Recipient's profiles.user_id */
  userId: string;
  /** Sender's profiles.user_id (null for system-generated notifications) */
  senderId?: string | null;
  title: string;
  message: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  /** Optional URL the user should be taken to when clicking the notification */
  actionUrl?: string | null;
  /** Arbitrary metadata (sender name, entity IDs, etc.) */
  metadata?: Record<string, any>;
}

/**
 * Fire a web push notification to all active subscriptions for one user.
 *
 * Uses the service-role client to read `push_subscriptions` (the caller's
 * RLS context cannot read another user's subscriptions). If VAPID is not
 * configured, this is a silent no-op (the in-app notification row is
 * still inserted by the caller).
 *
 * Best-effort: logs on error, never throws.
 */
async function firePushNotification(
  userId: string,
  title: string,
  body: string,
  options: {
    category?: NotificationCategory;
    priority?: NotificationPriority;
    actionUrl?: string | null;
    tag?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  try {
    await sendPushToUser(userId, {
      title,
      body,
      icon: "/icon-192.png",
      badge: "/icon-96.png",
      tag: options.tag || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      data: {
        actionUrl: options.actionUrl,
        category: options.category,
        priority: options.priority,
        ...(options.metadata || {}),
      },
      requireInteraction: options.priority === "urgent",
    });
  } catch (err) {
    // Push failure must NEVER break the in-app notification flow.
    // Most common failure: VAPID env vars not set on the Next.js deployment.
    console.error("[notifications] firePushNotification error:", err);
  }
}

/**
 * Insert a single notification row for one recipient AND fire a push
 * notification to all their subscribed devices.
 *
 * Best-effort: logs on error, never throws.
 */
export async function sendNotification(
  supabase: SupabaseClient,
  input: SendNotificationInput
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: input.userId,
      sender_id: input.senderId ?? null,
      title: input.title,
      message: input.message,
      category: input.category ?? "system",
      priority: input.priority ?? "medium",
      is_read: false,
      action_url: input.actionUrl ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.error("[notifications] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[notifications] sendNotification error:", err);
  }

  // Fire push notification in parallel — never blocks the in-app row.
  await firePushNotification(input.userId, input.title, input.message, {
    category: input.category,
    priority: input.priority,
    actionUrl: input.actionUrl,
    metadata: input.metadata,
  });
}

/**
 * Insert the same notification for multiple recipients AND fire a push
 * notification to each recipient's subscribed devices.
 * Uses a single batched insert for efficiency.
 */
export async function sendNotificationToMany(
  supabase: SupabaseClient,
  userIds: string[],
  input: Omit<SendNotificationInput, "userId">
): Promise<void> {
  if (!userIds.length) return;
  try {
    const rows = userIds.map((uid) => ({
      user_id: uid,
      sender_id: input.senderId ?? null,
      title: input.title,
      message: input.message,
      category: input.category ?? "system",
      priority: input.priority ?? "medium",
      is_read: false,
      action_url: input.actionUrl ?? null,
      metadata: input.metadata ?? {},
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) {
      console.error("[notifications] batch insert failed:", error.message);
    }
  } catch (err) {
    console.error("[notifications] sendNotificationToMany error:", err);
  }

  // Fire push to each recipient in parallel. This is bounded by the
  // number of recipients (typically small — 1-5 supervisors).
  await Promise.all(
    userIds.map((uid) =>
      firePushNotification(uid, input.title, input.message, {
        category: input.category,
        priority: input.priority,
        actionUrl: input.actionUrl,
        metadata: input.metadata,
      })
    )
  );
}

// ============================================================
// CONVENIENCE HELPERS — domain-specific notification builders
// ============================================================

/** Notify a student that their application was submitted. */
export async function notifyApplicationSubmitted(
  supabase: SupabaseClient,
  studentUserId: string,
  internshipTitle: string,
  companyName: string
) {
  await sendNotification(supabase, {
    userId: studentUserId,
    category: "application",
    priority: "medium",
    title: "Application Submitted",
    message: `Your application for "${internshipTitle}" at ${companyName} has been submitted successfully.`,
    actionUrl: "/student/applications",
    metadata: { type: "application_submitted" },
  });
}

/** Notify a student that their application was accepted. */
export async function notifyApplicationAccepted(
  supabase: SupabaseClient,
  studentUserId: string,
  internshipTitle: string,
  companyName: string
) {
  await sendNotification(supabase, {
    userId: studentUserId,
    category: "application",
    priority: "high",
    title: "Application Accepted!",
    message: `Congratulations! Your application for "${internshipTitle}" at ${companyName} has been accepted.`,
    actionUrl: "/student/applications",
    metadata: { type: "application_accepted" },
  });
}

/** Notify a student that their application was rejected. */
export async function notifyApplicationRejected(
  supabase: SupabaseClient,
  studentUserId: string,
  internshipTitle: string,
  companyName: string
) {
  await sendNotification(supabase, {
    userId: studentUserId,
    category: "application",
    priority: "medium",
    title: "Application Update",
    message: `Your application for "${internshipTitle}" at ${companyName} was not selected at this time.`,
    actionUrl: "/student/applications",
    metadata: { type: "application_rejected" },
  });
}

/** Notify a student that a new task was assigned to them. */
export async function notifyTaskAssigned(
  supabase: SupabaseClient,
  studentUserId: string,
  taskTitle: string,
  dueDate: string | null,
  senderId?: string | null,
  senderName?: string
) {
  const due = dueDate
    ? ` Due ${new Date(dueDate).toLocaleDateString()}.`
    : "";
  await sendNotification(supabase, {
    userId: studentUserId,
    senderId: senderId ?? null,
    category: "task",
    priority: "high",
    title: "New Task Assigned",
    message: `A new task "${taskTitle}" has been assigned to you.${due}`,
    actionUrl: "/student/tasks",
    metadata: { type: "task_assigned", sender_name: senderName ?? "Supervisor" },
  });
}

/** Notify supervisors that a student submitted a task. */
export async function notifyTaskSubmitted(
  supabase: SupabaseClient,
  supervisorUserIds: string[],
  studentName: string,
  taskTitle: string,
  senderId?: string | null
) {
  if (!supervisorUserIds.length) return;
  await sendNotificationToMany(supabase, supervisorUserIds, {
    senderId: senderId ?? null,
    category: "task",
    priority: "medium",
    title: "Task Submission Received",
    message: `${studentName} submitted the task "${taskTitle}" for your review.`,
    actionUrl: "/faculty-supervisor/tasks",
    metadata: { type: "task_submitted" },
  });
}

/** Notify a student that their task was evaluated. */
export async function notifyTaskEvaluated(
  supabase: SupabaseClient,
  studentUserId: string,
  taskTitle: string,
  status: "approved" | "rejected" | "submitted",
  evaluatorName: string
) {
  const isApproved = status === "approved";
  await sendNotification(supabase, {
    userId: studentUserId,
    category: "evaluation",
    priority: isApproved ? "medium" : "high",
    title: isApproved ? "Task Approved" : "Task Needs Revision",
    message:
      status === "approved"
        ? `Your submission for "${taskTitle}" was approved by ${evaluatorName}.`
        : `Your submission for "${taskTitle}" was reviewed by ${evaluatorName} and needs revision.`,
    actionUrl: "/student/tasks",
    metadata: { type: "task_evaluated", status },
  });
}

/** Notify supervisors that a student submitted a weekly log. */
export async function notifyWeeklyLogSubmitted(
  supabase: SupabaseClient,
  supervisorUserIds: string[],
  studentName: string,
  weekStart: string,
  senderId?: string | null
) {
  if (!supervisorUserIds.length) return;
  const weekLabel = new Date(weekStart).toLocaleDateString();
  await sendNotificationToMany(supabase, supervisorUserIds, {
    senderId: senderId ?? null,
    category: "task",
    priority: "medium",
    title: "Weekly Log Submitted",
    message: `${studentName} submitted a weekly log for the week of ${weekLabel}.`,
    actionUrl: "/faculty-supervisor/weekly-logs",
    metadata: { type: "weekly_log_submitted" },
  });
}

/** Notify a student that an evaluation was submitted for them. */
export async function notifyEvaluationSubmitted(
  supabase: SupabaseClient,
  studentUserId: string,
  evaluationType: string,
  evaluatorName: string,
  evaluatorRole: "faculty_supervisor" | "site_supervisor" | "external_evaluator"
) {
  const roleLabel =
    evaluatorRole === "faculty_supervisor"
      ? "Faculty Supervisor"
      : evaluatorRole === "site_supervisor"
      ? "Site Supervisor"
      : "External Evaluator";
  await sendNotification(supabase, {
    userId: studentUserId,
    category: "evaluation",
    priority: "high",
    title: `${evaluationType} Evaluation Submitted`,
    message: `Your ${evaluationType} evaluation has been submitted by ${evaluatorName} (${roleLabel}).`,
    actionUrl: "/student/evaluations",
    metadata: { type: "evaluation_submitted", evaluator_role: evaluatorRole },
  });
}

/** Notify a student they were assigned to a supervisor / internship. */
export async function notifyStudentAssigned(
  supabase: SupabaseClient,
  studentUserId: string,
  supervisorName: string,
  internshipTitle: string,
  senderId?: string | null
) {
  await sendNotification(supabase, {
    userId: studentUserId,
    senderId: senderId ?? null,
    category: "system",
    priority: "medium",
    title: "Supervisor Assigned",
    message: `You have been assigned to ${supervisorName} for "${internshipTitle}".`,
    actionUrl: "/student/internships",
    metadata: { type: "student_assigned" },
  });
}
