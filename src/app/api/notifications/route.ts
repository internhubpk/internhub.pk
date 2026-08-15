import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: List notifications related to the current user (sent by OR addressed to them).
//
// Schema note (migration 0001 + 0055): the `notifications` table is the
// single source of truth — every recipient gets their own row keyed by
// `user_id`, with `sender_id` pointing back to the sender's profile.
// `notifications_sent` and `notification_recipients` are *views* over this
// table (no FK relationship), so they cannot be joined as nested PostgREST
// resources. The previous implementation tried to do exactly that and
// PostgREST returned HTTP 400 on every request. Query `notifications`
// directly instead.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sender's profile.
    // NOTE: `profiles` uses `user_id` (uuid PK mirroring auth.users.id) —
    // there is no `id` column. Selecting `id` would make PostgREST return
    // HTTP 400. Use `user_id` instead.
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const priority = searchParams.get("priority");
    const category = searchParams.get("category"); // system, announcement, task, ...
    const search = searchParams.get("search");

    // Query `notifications` directly. A row relates to the caller if they
    // are the recipient (`user_id`) OR the sender (`sender_id`). System
    // broadcasts (sender_id IS NULL) are visible only to their recipients,
    // which is already captured by `user_id.eq.<uid>`.
    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .or(`user_id.eq.${user.id},sender_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
    }

    const { data: notifications, count, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: notifications || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Notifications GET API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Send a notification to one or more recipients.
//
// Schema note: there is NO `notifications_sent` or `notification_recipients`
// *table* — they are views over `notifications`. The previous implementation
// tried to `insert` into both views using columns that don't exist
// (`target_type`, `target_id`, `recipient_count`, `notification_id`,
// `is_read`, `delivered_at`), which PostgREST rejects. The correct write
// path is a direct batched `insert` into the `notifications` table: one row
// per recipient, with `sender_id` set to the caller.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sender's profile (user_id, not id — profiles has no `id` column)
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role, full_name, university_id, department_id, company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only staff/faculty roles can send notifications. Students cannot.
    const allowedRoles = [
      "faculty_supervisor",
      "department_coordinator",
      "university_admin",
      "super_admin",
      "company_hr",
      "site_supervisor",
    ];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to send notifications" },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const {
      title,
      message,
      category = "announcement",
      priority = "medium",
      recipient_user_ids, // explicit list of user_ids
      target_role, // e.g. 'student' — broadcast to every user with this role (tenant-scoped)
      target_department_id, // broadcast to every user in this department
      target_university_id, // broadcast to every user in this university (super_admin only)
      action_url,
      metadata = {},
    } = body;

    // Validate required fields
    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      );
    }

    const validCategories = [
      "auth",
      "application",
      "evaluation",
      "deadline",
      "system",
      "announcement",
      "task",
      "attendance",
      "certificate",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // notification_priority enum is ('low','medium','high','urgent') — there
    // is no 'normal' value despite the task description; use 'medium'.
    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }

    // Determine recipients based on the supplied targeting parameter.
    let recipientUserIds: string[] = [];

    if (Array.isArray(recipient_user_ids) && recipient_user_ids.length > 0) {
      // Explicit recipient list — caller already knows who to notify.
      recipientUserIds = recipient_user_ids.filter(Boolean);
    } else if (target_role) {
      // Broadcast to every user with the given role, scoped to the caller's
      // tenant for non-super_admins.
      let roleQuery = supabase
        .from("profiles")
        .select("user_id")
        .eq("role", target_role);

      // Tenant isolation: university-scoped roles can only target users in
      // their own university; company-scoped roles can only target users in
      // their own company. super_admin and faculty_supervisor are not
      // tenant-scoped here (faculty supervisors typically target students
      // in their own programs via `recipient_user_ids`).
      if (profile.role === "university_admin" || profile.role === "department_coordinator") {
        if (!profile.university_id) {
          return NextResponse.json(
            { error: "Your profile is not associated with a university" },
            { status: 403 }
          );
        }
        roleQuery = roleQuery.eq("university_id", profile.university_id);
      } else if (profile.role === "company_hr" || profile.role === "site_supervisor") {
        if (!profile.company_id) {
          return NextResponse.json(
            { error: "Your profile is not associated with a company" },
            { status: 403 }
          );
        }
        roleQuery = roleQuery.eq("company_id", profile.company_id);
      }

      const { data: targets, error: targetErr } = await roleQuery;
      if (targetErr) {
        console.error("Error fetching recipients by role:", targetErr);
        return NextResponse.json({ error: "Failed to resolve recipients" }, { status: 500 });
      }
      recipientUserIds = (targets || []).map((r: { user_id: string }) => r.user_id);
    } else if (target_department_id) {
      // Department-targeted broadcast. Company users are not allowed to
      // target by department. University roles must target a department
      // inside their own university.
      if (profile.role === "company_hr" || profile.role === "site_supervisor") {
        return NextResponse.json(
          { error: "Forbidden: company users cannot target by department" },
          { status: 403 }
        );
      }

      if (profile.role === "university_admin" || profile.role === "department_coordinator") {
        if (!profile.university_id) {
          return NextResponse.json(
            { error: "Your profile is not associated with a university" },
            { status: 403 }
          );
        }
        // Verify the department belongs to the caller's university.
        const { data: dept } = await supabase
          .from("departments")
          .select("id")
          .eq("id", target_department_id)
          .eq("university_id", profile.university_id)
          .maybeSingle();
        if (!dept) {
          return NextResponse.json(
            { error: "Department not found in your university" },
            { status: 403 }
          );
        }
      }

      const { data: members, error: mErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("department_id", target_department_id);
      if (mErr) {
        console.error("Error fetching department members:", mErr);
        return NextResponse.json({ error: "Failed to resolve recipients" }, { status: 500 });
      }
      recipientUserIds = (members || []).map((m: { user_id: string }) => m.user_id);
    } else if (target_university_id) {
      // Whole-university broadcast. Restrict to super_admin to avoid
      // cross-tenant leakage.
      if (profile.role !== "super_admin") {
        return NextResponse.json(
          { error: "Forbidden: only super admins can broadcast to an entire university" },
          { status: 403 }
        );
      }

      const { data: members, error: mErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("university_id", target_university_id);
      if (mErr) {
        console.error("Error fetching university members:", mErr);
        return NextResponse.json({ error: "Failed to resolve recipients" }, { status: 500 });
      }
      recipientUserIds = (members || []).map((m: { user_id: string }) => m.user_id);
    } else {
      return NextResponse.json(
        {
          error:
            "Specify at least one of: recipient_user_ids, target_role, target_department_id, or target_university_id",
        },
        { status: 400 }
      );
    }

    // Don't notify yourself.
    recipientUserIds = recipientUserIds.filter((id) => id !== user.id);

    if (recipientUserIds.length === 0) {
      return NextResponse.json(
        { error: "No recipients found for the specified target" },
        { status: 400 }
      );
    }

    // Build one `notifications` row per recipient and batch-insert directly
    // into the table. The `notifications_sent` / `notification_recipients`
    // views are read-only projections and must NOT be written to.
    const payloadMetadata = {
      ...metadata,
      sender_name: profile.full_name || null,
      sender_role: profile.role,
    };

    const notificationRecords = recipientUserIds.map((userId) => ({
      user_id: userId,
      sender_id: user.id,
      title,
      message,
      category,
      priority,
      is_read: false,
      action_url: action_url || null,
      metadata: payloadMetadata,
    }));

    // Insert in batches to avoid PostgREST payload limits.
    const batchSize = 100;
    let insertedCount = 0;
    for (let i = 0; i < notificationRecords.length; i += batchSize) {
      const batch = notificationRecords.slice(i, i + batchSize);
      const { error: insertErr } = await supabase
        .from("notifications")
        .insert(batch);
      if (insertErr) {
        console.error("Error inserting notification batch:", insertErr);
        return NextResponse.json(
          { error: "Failed to send notifications", details: insertErr.message },
          { status: 500 }
        );
      }
      insertedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      data: { sent_count: insertedCount },
      message: `Notification sent to ${insertedCount} recipient(s)`,
    });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
