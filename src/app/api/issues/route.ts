import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: List the current user's own issue reports ("My Issues").
// RLS (issue_reports_select, migration 0105) already restricts rows to
// reporter_user_id = auth.uid() OR super_admin, so no extra filtering is
// strictly required here — but we filter explicitly anyway so this route
// never accidentally becomes an "all issues" endpoint for a super_admin
// caller. Admins use /api/admin/issues for the full list.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("issue_reports")
      .select("id, name, email, issue, status, admin_note, created_at, updated_at, resolved_at")
      .eq("reporter_user_id", user.id)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/issues error:", error);
      return NextResponse.json({ error: "Failed to load issues" }, { status: 500 });
    }

    return NextResponse.json({ issues: data ?? [] });
  } catch (err) {
    console.error("GET /api/issues unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Submit a new issue report.
// name/email are typically the profile's own values (autofilled client-side)
// but are accepted as submitted text — reporter_user_id is what actually
// ties the row to the account and is what RLS + this handler enforce, so a
// user editing the autofilled name/email cannot impersonate anyone else.
//
// super_admin is blocked from reporting: they are the support staff who
// triage incoming reports (/api/admin/issues) — letting them file reports
// would mix support tickets into the queue they administer. Enforced here
// (DB-verified role) AND at the RLS level (migration 0106 adds
// `NOT internhub.is_super_admin()` to the insert policy).
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // DB-verified role check (never trust JWT metadata alone for policy
    // decisions). Blocked BEFORE parsing the body — a super_admin tampering
    // with the client gets a clean 403 regardless of payload.
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (callerProfile?.role === "super_admin") {
      return NextResponse.json(
        {
          error:
            "Super admins cannot submit issue reports. Use the Issue Reports page to manage reports from all users.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const issue = typeof body.issue === "string" ? body.issue.trim() : "";

    if (!name || !email || !issue) {
      return NextResponse.json(
        { error: "name, email, and issue are all required" },
        { status: 400 }
      );
    }
    if (issue.length > 5000) {
      return NextResponse.json(
        { error: "Issue description is too long (max 5000 characters)" },
        { status: 400 }
      );
    }
    // Minimal sanity check — real validation still happens via the email
    // column's use in RLS-protected reads only, this just blocks garbage input.
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("issue_reports")
      .insert({
        reporter_user_id: user.id,
        name,
        email,
        issue,
        // status intentionally omitted — column default is 'open', and
        // RLS's WITH CHECK also requires status = 'open' on insert, so
        // even a tampered client payload can't set anything else.
      })
      .select("id, name, email, issue, status, created_at")
      .single();

    if (error) {
      console.error("POST /api/issues error:", error);
      return NextResponse.json({ error: "Failed to submit issue" }, { status: 500 });
    }

    return NextResponse.json({ issue: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/issues unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
