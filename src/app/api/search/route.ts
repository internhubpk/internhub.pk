import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/lib/authorization";
import { sanitizeInput } from "@/lib/api-security";
import type { UserRole } from "@/types";

/**
 * GET /api/search?q=<query>
 *
 * Database-backed global search for the dashboard ⌘K command.
 *
 * SECURITY:
 *  - `requireAuth()` enforces that the user is signed in.
 *  - The server Supabase client carries the user's JWT, so all queries are
 *    automatically filtered by Row-Level Security (RLS) policies at the
 *    database level — even if a role-based filter below is buggy or missing,
 *    RLS will refuse to return rows the user cannot see.
 *  - On top of RLS, we also apply explicit role-based filters (matching the
 *    existing list endpoints) so the query planner can use indexes instead
 *    of scanning-and-filtering after the fact. Defense in depth.
 *  - The `q` parameter is sanitized to remove control characters and is
 *    passed via Supabase's parameterized client (no string interpolation
 *    into SQL).
 *  - Results are capped at 5 per section, 25 total, to keep payloads small.
 */

const MAX_PER_SECTION = 5;
const MIN_QUERY_LENGTH = 2;

interface SearchHit {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  type: string;
}

interface SearchSection {
  group: string;
  hits: SearchHit[];
}

/**
 * Escape a user-supplied query so it is safe to use inside SQL `ILIKE`.
 * `%` and `_` are LIKE wildcards; backslash is the escape character.
 */
function escapeIlike(q: string): string {
  return q.replace(/[%_\\]/g, (c) => `\\${c}`);
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuth();
    const role = (authContext.profile?.role as UserRole | undefined) ?? null;
    const universityId = authContext.profile?.university_id ?? null;
    const departmentId = authContext.profile?.department_id ?? null;
    const userId = authContext.user?.id ?? null;

    if (!role) {
      return NextResponse.json({ success: false, error: "No role on profile" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q") ?? "";
    const q = sanitizeInput(rawQuery).trim();

    if (q.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ success: true, data: { sections: [] } });
    }

    const ilike = `%${escapeIlike(q)}%`;
    const supabase = await createClient();

    // Run role-appropriate queries in parallel. Each query is also enforced
    // by RLS at the database level.
    const tasks: Promise<SearchSection | null>[] = [];

    // ---- STUDENTS (admin / coordinator / faculty supervisor) ----
    if (
      role === "super_admin" ||
      role === "university_admin" ||
      role === "department_coordinator" ||
      role === "faculty_supervisor"
    ) {
      tasks.push(
        (async (): Promise<SearchSection | null> => {
          let query = supabase
            .from("students")
            .select(
              `user_id, student_id_number,
               profiles:user_id ( first_name, last_name, email )`
            )
            .ilike("student_id_number", ilike)
            .limit(MAX_PER_SECTION);

          if (role === "super_admin") {
            // RLS still applies; no extra filter needed for correctness
          } else if (role === "university_admin" && universityId) {
            query = query.eq("university_id", universityId);
          } else if (role === "department_coordinator" && departmentId) {
            query = query.eq("department_id", departmentId);
          } else if (role === "faculty_supervisor" && universityId) {
            query = query.eq("university_id", universityId);
          } else {
            return null;
          }

          // Also match on the student's name/email via the profile join.
          // Supabase doesn't support ORing across foreign-key joins directly,
          // so we run a second small query for name matches and merge.
          const [byId, byName] = await Promise.all([
            query,
            supabase
              .from("profiles")
              .select("user_id, first_name, last_name, email")
              .or(
                `first_name.ilike.${ilike},last_name.ilike.${ilike},email.ilike.${ilike}`
              )
              .limit(MAX_PER_SECTION),
          ]);

          if (byId.error) console.debug("[search] students by id error:", byId.error.message);
          if (byName.error) console.debug("[search] profiles error:", byName.error.message);

          // For name matches, filter to only profiles that have a student record
          // (RLS on `students` will further scope to the user's tenant).
          const nameHits: SearchHit[] = [];
          if (byName.data && byName.data.length > 0) {
            const userIds = byName.data.map((p: any) => p.user_id);
            const { data: studentRows, error: studErr } = await supabase
              .from("students")
              .select("user_id, student_id_number")
              .in("user_id", userIds)
              .limit(MAX_PER_SECTION);
            if (!studErr && studentRows) {
              const studMap = new Map<string, any>();
              for (const s of studentRows as any[]) studMap.set(s.user_id, s);
              for (const p of byName.data as any[]) {
                if (studMap.has(p.user_id)) {
                  nameHits.push({
                    id: p.user_id,
                    label: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email,
                    subtitle: p.email,
                    href: studentDetailHref(role, p.user_id),
                    type: "student",
                  });
                }
              }
            }
          }

          const idHits: SearchHit[] = (byId.data ?? []).map((s: any) => {
            const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
            const name = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : null;
            return {
              id: s.user_id,
              label: name || s.student_id_number || s.user_id,
              subtitle: s.student_id_number ? `ID: ${s.student_id_number}` : undefined,
              href: studentDetailHref(role, s.user_id),
              type: "student",
            };
          });

          // Merge + dedupe by id, cap at MAX_PER_SECTION
          const seen = new Set<string>();
          const hits: SearchHit[] = [];
          for (const h of [...idHits, ...nameHits]) {
            if (seen.has(h.id)) continue;
            seen.add(h.id);
            hits.push(h);
            if (hits.length >= MAX_PER_SECTION) break;
          }

          return hits.length ? { group: "Students", hits } : null;
        })()
      );
    }

    // ---- INTERNSHIPS (everyone except external_evaluator) ----
    if (role !== "external_evaluator") {
      tasks.push(
        (async (): Promise<SearchSection | null> => {
          let query = supabase
            .from("internships")
            .select("id, title, status, company:companies ( name )")
            .ilike("title", ilike)
            .limit(MAX_PER_SECTION);

          if (role === "super_admin") {
            // all
          } else if (role === "university_admin" && universityId) {
            query = query.eq("university_id", universityId);
          } else if (role === "department_coordinator" && departmentId) {
            query = query.eq("department_id", departmentId);
          } else if (role === "faculty_supervisor" && universityId) {
            query = query.eq("university_id", universityId);
          } else if (role === "company_hr") {
            // RLS on company_hr_membership / companies will scope to their company
            query = query.eq("created_by", userId ?? "");
          } else {
            // students, site_supervisor — only visible internships.
            // The `internship_status` enum has no `published` value
            // (it has draft/open/active/completed/cancelled/expired),
            // so we filter for `open` and `active`.
            query = query.in("status", ["open", "active"]);
          }

          const { data, error } = await query;
          if (error) {
            console.debug("[search] internships error:", error.message);
            return null;
          }
          const hits: SearchHit[] = (data ?? []).map((i: any) => ({
            id: i.id,
            label: i.title,
            subtitle: i.company?.name,
            href: internshipDetailHref(role, i.id),
            type: "internship",
          }));
          return hits.length ? { group: "Internships", hits } : null;
        })()
      );
    }

    // ---- COMPANIES (admin roles + company_hr + students) ----
    if (
      role === "super_admin" ||
      role === "university_admin" ||
      role === "department_coordinator" ||
      role === "company_hr" ||
      role === "student"
    ) {
      tasks.push(
        (async (): Promise<SearchSection | null> => {
          let query = supabase
            .from("companies")
            .select("id, name, slug, industry")
            .ilike("name", ilike)
            .limit(MAX_PER_SECTION);

          if (role === "university_admin" && universityId) {
            query = query.eq("university_id", universityId);
          } else if (role === "department_coordinator" && universityId) {
            query = query.eq("university_id", universityId);
          }
          // super_admin, company_hr, student → RLS handles scoping

          const { data, error } = await query;
          if (error) {
            console.debug("[search] companies error:", error.message);
            return null;
          }
          const hits: SearchHit[] = (data ?? []).map((c: any) => ({
            id: c.id,
            label: c.name,
            subtitle: c.industry,
            href: companyDetailHref(role, c.slug, c.id),
            type: "company",
          }));
          return hits.length ? { group: "Companies", hits } : null;
        })()
      );
    }

    // ---- PROGRAMS (admin / coordinator) ----
    if (
      role === "super_admin" ||
      role === "university_admin" ||
      role === "department_coordinator"
    ) {
      tasks.push(
        (async (): Promise<SearchSection | null> => {
          let query = supabase
            .from("programs")
            .select("id, name, code")
            .or(`name.ilike.${ilike},code.ilike.${ilike}`)
            .limit(MAX_PER_SECTION);

          if (role === "university_admin" && universityId) {
            query = query.eq("university_id", universityId);
          } else if (role === "department_coordinator" && departmentId) {
            query = query.eq("department_id", departmentId);
          }

          const { data, error } = await query;
          if (error) {
            console.debug("[search] programs error:", error.message);
            return null;
          }
          const hits: SearchHit[] = (data ?? []).map((p: any) => ({
            id: p.id,
            label: p.name,
            subtitle: p.code ? `Code: ${p.code}` : undefined,
            href: programListHref(role),
            type: "program",
          }));
          return hits.length ? { group: "Programs", hits } : null;
        })()
      );
    }

    // ---- DEPARTMENTS (admin / coordinator) ----
    if (
      role === "super_admin" ||
      role === "university_admin" ||
      role === "department_coordinator"
    ) {
      tasks.push(
        (async (): Promise<SearchSection | null> => {
          let query = supabase
            .from("departments")
            .select("id, name, code")
            .or(`name.ilike.${ilike},code.ilike.${ilike}`)
            .limit(MAX_PER_SECTION);

          if (role === "university_admin" && universityId) {
            query = query.eq("university_id", universityId);
          } else if (role === "department_coordinator" && departmentId) {
            query = query.eq("id", departmentId);
          }

          const { data, error } = await query;
          if (error) {
            console.debug("[search] departments error:", error.message);
            return null;
          }
          const hits: SearchHit[] = (data ?? []).map((d: any) => ({
            id: d.id,
            label: d.name,
            subtitle: d.code ? `Code: ${d.code}` : undefined,
            href: departmentListHref(role),
            type: "department",
          }));
          return hits.length ? { group: "Departments", hits } : null;
        })()
      );
    }

    // ---- APPLICATIONS (student / company_hr) ----
    if (role === "student" || role === "company_hr") {
      tasks.push(
        (async (): Promise<SearchSection | null> => {
          let query = supabase
            .from("internship_applications")
            .select(
              `id, status, internship:internships ( id, title )`
            )
            .ilike("internships.title", ilike)
            .limit(MAX_PER_SECTION);

          if (role === "student") {
            query = query.eq("student_user_id", userId ?? "");
          } else if (role === "company_hr") {
            // RLS will scope to user's company; explicit filter not possible
            // without a join to company_hr_membership, so rely on RLS here.
          }

          const { data, error } = await query;
          if (error) {
            console.debug("[search] applications error:", error.message);
            return null;
          }
          const hits: SearchHit[] = (data ?? []).map((a: any) => ({
            id: a.id,
            label: a.internship?.title ?? "Application",
            subtitle: `Status: ${a.status}`,
            href: role === "student" ? "/student/applications" : "/company-hr/applications",
            type: "application",
          }));
          return hits.length ? { group: "Applications", hits } : null;
        })()
      );
    }

    const settled = await Promise.all(tasks);
    const sections = settled.filter((s): s is SearchSection => s !== null);

    return NextResponse.json({ success: true, data: { sections } });
  } catch (err: any) {
    if (err?.message === "Authentication required") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("[search] error:", err);
    return NextResponse.json(
      { success: false, error: "Search failed" },
      { status: 500 }
    );
  }
}

// ============================================================
// HREF HELPERS — route the user to their role's detail page
// ============================================================
function studentDetailHref(role: UserRole, studentUserId: string): string {
  switch (role) {
    case "super_admin":
      return `/super-admin/users`;
    case "university_admin":
      return `/university-admin/students`;
    case "department_coordinator":
      return `/department-coordinator/students`;
    case "faculty_supervisor":
      return `/faculty-supervisor/students`;
    case "student":
      return `/student`;
    default:
      return `/student`;
  }
}

function internshipDetailHref(role: UserRole, internshipId: string): string {
  // Everyone can view the marketplace detail page; that route is RLS-aware
  // and shows the appropriate actions per role.
  if (role === "student") return `/marketplace/${internshipId}`;
  if (role === "company_hr") return `/company-hr/internships`;
  if (role === "university_admin") return `/university-admin/internships`;
  if (role === "department_coordinator") return `/department-coordinator`;
  if (role === "faculty_supervisor") return `/faculty-supervisor`;
  return `/marketplace/${internshipId}`;
}

function companyDetailHref(role: UserRole, slug: string, id: string): string {
  if (role === "student") return `/companies`;
  if (role === "company_hr") return `/company-hr`;
  if (role === "university_admin") return `/university-admin/companies`;
  if (role === "super_admin") return `/super-admin/companies`;
  return `/companies`;
}

function programListHref(role: UserRole): string {
  if (role === "department_coordinator") return `/department-coordinator/programs`;
  return `/university-admin/programs`;
}

function departmentListHref(role: UserRole): string {
  if (role === "department_coordinator") return `/department-coordinator`;
  return `/university-admin/departments`;
}
