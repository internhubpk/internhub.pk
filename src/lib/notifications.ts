/**
 * Server-side notification helper.
 *
 * Centralises the logic for inserting in-app notifications into the
 * `notifications` table. Used by API routes to fire notifications on
 * key workflow events:
 *
 *   - Application submitted / accepted / rejected
 *   - Task assigned / submitted / evaluated
 *   - Weekly log submitted / reviewed
 *   - Evaluation submitted (site / faculty)
 *   - Student enrolled / assigned supervisor
 *
 * Each helper accepts a Supabase server client (so it inherits the
 * caller's RLS context) and inserts one row per recipient. Failures are
 * logged but never throw — notifications are best-effort and should not
 * break the parent workflow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Insert a single notification row for one recipient.
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
}

/**
 * Insert the same notification for multiple recipients.
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
