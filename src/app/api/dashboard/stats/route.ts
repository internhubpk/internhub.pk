import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type {
  ApiResponse,
  DashboardStats,
  LicenseInfo,
  UserRole,
} from "@/types";

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics - role-aware
 * Returns different stats based on user role
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile with university info
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, university_id, department_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const stats: DashboardStats = {};
    const universityId = profile.university_id;

    // Role-based statistics
    switch (profile.role as UserRole) {
      case "super_admin":
        // Super Admin sees platform-wide stats with enhanced data
        await Promise.all([
          getSuperAdminStats(supabase, stats),
          getEnhancedStats(supabase, stats, universityId || null, user.id),
        ]);
        break;

      case "university_admin":
        // University Admin sees their university's stats with enhanced data
        if (universityId) {
          await Promise.all([
            getUniversityAdminStats(supabase, stats, universityId),
            getEnhancedStats(supabase, stats, universityId, user.id),
          ]);
        }
        break;

      case "department_coordinator":
        // Department Coordinator sees department-level stats
        if (universityId && profile.department_id) {
          await Promise.all([
            getDepartmentCoordinatorStats(
              supabase,
              stats,
              universityId,
              profile.department_id
            ),
            getEnhancedStats(supabase, stats, universityId, user.id),
          ]);
        }
        break;

      case "faculty_supervisor":
        // Faculty Supervisor sees their supervised students' stats
        if (universityId) {
          await Promise.all([
            getFacultySupervisorStats(supabase, stats, user.id),
            getEnhancedStats(supabase, stats, universityId, user.id),
          ]);
        }
        break;

      case "student":
        // Student sees their own progress stats
        await Promise.all([
          getStudentStats(supabase, stats, user.id),
          getEnhancedStats(supabase, stats, universityId || null, user.id),
        ]);
        break;

      case "company_hr":
        // Company HR sees their company's internship stats
        await Promise.all([
          getCompanyHRStats(supabase, stats, user.id),
          getEnhancedStats(supabase, stats, universityId || null, user.id),
        ]);
        break;

      case "site_supervisor":
        // Site Supervisor sees their assigned interns' stats
        await Promise.all([
          getSiteSupervisorStats(supabase, stats, user.id),
          getEnhancedStats(supabase, stats, universityId || null, user.id),
        ]);
        break;

      case "external_evaluator":
        // External Evaluator sees evaluation-related stats
        await Promise.all([
          getExternalEvaluatorStats(supabase, stats, user.id),
          getEnhancedStats(supabase, stats, universityId || null, user.id),
        ]);
        break;
    }

    return NextResponse.json<ApiResponse<DashboardStats>>({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error in GET /api/dashboard/stats:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============ ENHANCED STATS FUNCTION ============

/**
 * Get enhanced statistics for all roles:
 * - Storage usage percentage
 * - Active license status
 * - Recent audit log count
 * - Unread messages count
 * - Host organizations count
 */
async function getEnhancedStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  universityId: string | null,
  userId: string
): Promise<void> {
  try {
    // Run all enhanced stat queries in parallel
    const [
      storageResult,
      licenseResult,
      auditLogResult,
      messagesResult,
      hostOrgsResult,
    ] = await Promise.allSettled([
      // Storage usage percentage
      getStorageUsagePercentage(supabase, universityId),
      
      // License information
      getLicenseInfo(supabase, universityId),
      
      // Recent audit log count (last 7 days)
      getRecentAuditLogCount(supabase, universityId),
      
      // Unread messages count
      getUnreadMessagesCount(supabase, userId),
      
      // Host organizations count
      getHostOrganizationsCount(supabase, universityId),
    ]);

    // Process storage results
    if (storageResult.status === "fulfilled") {
      stats.storageUsagePercentage = storageResult.value.percentage;
      // Update raw values if not already set
      if (stats.storageUsed === undefined) {
        stats.storageUsed = storageResult.value.usedBytes;
      }
      if (stats.storageLimit === undefined) {
        stats.storageLimit = storageResult.value.allocatedBytes;
      }
    }

    // Process license results
    if (licenseResult.status === "fulfilled") {
      stats.licenseInfo = licenseResult.value;
    }

    // Process audit log results
    if (auditLogResult.status === "fulfilled") {
      stats.recentAuditLogCount = auditLogResult.value;
    }

    // Process messages results
    if (messagesResult.status === "fulfilled") {
      stats.unreadMessagesCount = messagesResult.value;
    }

    // Process host orgs results
    if (hostOrgsResult.status === "fulfilled") {
      stats.hostOrganizationsCount = hostOrgsResult.value;
    }
  } catch (error) {
    console.error("Error fetching enhanced stats:", error);
    // Don't fail the whole request if enhanced stats fail
  }
}

// ============ ENHANCED STAT HELPERS ============

async function getStorageUsagePercentage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universityId: string | null
): Promise<{ percentage: number; usedBytes: number; allocatedBytes: number }> {
  try {
    let query = supabase.from("storage_allocations").select("used_bytes, allocated_bytes");
    
    if (universityId) {
      query = query.eq("university_id", universityId);
    }

    const { data: allocations, error } = await query;

    if (error || !allocations || allocations.length === 0) {
      return { percentage: 0, usedBytes: 0, allocatedBytes: 0 };
    }

    // Sum up all allocations if no specific university
    const totalUsed = allocations.reduce((sum, a) => sum + (a.used_bytes || 0), 0);
    const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocated_bytes || 0), 0);
    
    const percentage = totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0;

    return { percentage, usedBytes: totalUsed, allocatedBytes: totalAllocated };
  } catch (error) {
    return { percentage: 0, usedBytes: 0, allocatedBytes: 0 };
  }
}

async function getLicenseInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universityId: string | null
): Promise<LicenseInfo | null> {
  try {
    if (!universityId) {
      return null;
    }

    const { data: license, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("university_id", universityId)
      .in("status", ["active", "trial"])
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !license) {
      // Check for any license record even if expired/cancelled
      const { data: anyLicense } = await supabase
        .from("licenses")
        .select("status, plan, expires_at")
        .eq("university_id", universityId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyLicense) {
        let daysRemaining: number | null = null;
        
        if (anyLicense.expires_at) {
          const expiryDate = new Date(anyLicense.expires_at);
          daysRemaining = Math.ceil(
            (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          if (daysRemaining < 0) daysRemaining = null;
        }

        return {
          status: anyLicense.status as LicenseInfo["status"],
          plan: anyLicense.plan,
          daysRemaining,
          expiresAt: anyLicense.expires_at,
        };
      }

      return null;
    }

    let daysRemaining: number | null = null;
    
    if (license.expires_at) {
      const expiryDate = new Date(license.expires_at);
      daysRemaining = Math.ceil(
        (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      status: license.status as LicenseInfo["status"],
      plan: license.plan,
      daysRemaining,
      expiresAt: license.expires_at,
    };
  } catch (error) {
    console.error("Error getting license info:", error);
    return null;
  }
}

async function getRecentAuditLogCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universityId: string | null
): Promise<number> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString());

    if (universityId) {
      query = query.eq("university_id", universityId);
    }

    const { count, error } = await query;

    if (error) return 0;
    return count || 0;
  } catch (error) {
    return 0;
  }
}

async function getUnreadMessagesCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);

    if (error) return 0;
    return count || 0;
  } catch (error) {
    return 0;
  }
}

async function getHostOrganizationsCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universityId: string | null
): Promise<number> {
  try {
    let query = supabase
      .from("host_organizations")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (universityId) {
      query = query.eq("university_id", universityId);
    }

    const { count, error } = await query;

    if (error) return 0;
    return count || 0;
  } catch (error) {
    return 0;
  }
}

// ============ ROLE-SPECIFIC STATS FUNCTIONS ============

async function getSuperAdminStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats
): Promise<void> {
  const [
    { count: totalStudents },
    { count: totalUniversities },
    { count: totalCompanies },
    { count: totalSupervisors },
    { count: activeInternships },
    { count: pendingApplications },
    { count: completedInternships },
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase.from("universities").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("supervisors").select("*", { count: "exact", head: true }),
    supabase
      .from("student_internships")
      .select("*", { count: "exact", head: true })
      .in("status", ["active"]),
    supabase
      .from("internship_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("student_internships")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  stats.totalStudents = totalStudents || 0;
  stats.totalCompanies = totalCompanies || 0;
  stats.totalSupervisors = totalSupervisors || 0;
  stats.activeInternships = activeInternships || 0;
  stats.pendingApplications = pendingApplications || 0;
  stats.completedInternships = completedInternships || 0;
}

async function getUniversityAdminStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  universityId: string
): Promise<void> {
  const [
    { count: totalStudents },
    { count: activeInternships },
    { count: pendingApplications },
    { count: completedInternships },
    { count: totalCompanies },
    { count: totalSupervisors },
    storageData,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("university_id", universityId)
      .eq("status", "active"),
    supabase
      .from("student_internships")
      .select("*", { count: "exact", head: true })
      .in("status", ["active"])
      .in(
        "internship_id",
        (
          await supabase
            .from("internships")
            .select("id")
            .eq("university_id", universityId)
        ).data?.map((i) => i.id) || []
      ),
    supabase
      .from("internship_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .in(
        "internship_id",
        (
          await supabase
            .from("internships")
            .select("id")
            .eq("university_id", universityId)
        ).data?.map((i) => i.id) || []
      ),
    supabase
      .from("student_internships")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .in(
        "internship_id",
        (
          await supabase
            .from("internships")
            .select("id")
            .eq("university_id", universityId)
        ).data?.map((i) => i.id) || []
      ),
    supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("university_id", universityId)
      .eq("is_active", true),
    supabase
      .from("supervisors")
      .select("*", { count: "exact", head: true })
      .eq("university_id", universityId)
      .eq("is_active", true),
    supabase
      .from("storage_allocations")
      .select("used_bytes, allocated_bytes")
      .eq("university_id", universityId)
      .single(),
  ]);

  stats.totalStudents = totalStudents || 0;
  stats.activeInternships = activeInternships || 0;
  stats.pendingApplications = pendingApplications || 0;
  stats.completedInternships = completedInternships || 0;
  stats.totalCompanies = totalCompanies || 0;
  stats.totalSupervisors = totalSupervisors || 0;
  stats.storageUsed = storageData?.used_bytes || 0;
  stats.storageLimit = storageData?.allocated_bytes || 0;
}

async function getDepartmentCoordinatorStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  universityId: string,
  departmentId: string
): Promise<void> {
  const [
    { count: totalStudents },
    { count: activeInternships },
    { count: pendingApplications },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("department_id", departmentId)
      .eq("status", "active"),
    // Active internships for students in this department
    (async () => {
      const { data: deptStudents } = await supabase
        .from("students")
        .select("id")
        .eq("department_id", departmentId);

      if (deptStudents && deptStudents.length > 0) {
        const studentIds = deptStudents.map((s) => s.id);
        const { count } = await supabase
          .from("student_internships")
          .select("*", { count: "exact", head: true })
          .in("student_id", studentIds)
          .in("status", ["active"]);
        return count;
      }
      return 0;
    })(),
    (async () => {
      const { data: deptStudents } = await supabase
        .from("students")
        .select("id")
        .eq("department_id", departmentId);

      if (deptStudents && deptStudents.length > 0) {
        const studentIds = deptStudents.map((s) => s.id);
        const { count } = await supabase
          .from("internship_applications")
          .select("*", { count: "exact", head: true })
          .in("student_id", studentIds)
          .eq("status", "pending");
        return count;
      }
      return 0;
    })(),
  ]);

  stats.totalStudents = totalStudents || 0;
  stats.activeInternships = (activeInternships as number) || 0;
  stats.pendingApplications = (pendingApplications as number) || 0;
}

async function getFacultySupervisorStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  userId: string
): Promise<void> {
  // Get supervisor record
  const { data: supervisor } = await supabase
    .from("supervisors")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "faculty")
    .single();

  if (!supervisor) {
    return;
  }

  const [
    { count: assignedInterns },
    { count: activeInternships },
    { count: pendingLogs },
    { count: pendingReports },
  ] = await Promise.all([
    supabase
      .from("student_internships")
      .select("*", { count: "exact", head: true })
      .eq("faculty_supervisor_id", supervisor.id)
      .in("status", ["active"]),
    supabase
      .from("student_internships")
      .select("*", { count: "exact", head: true })
      .eq("faculty_supervisor_id", supervisor.id)
      .eq("status", "active"),
    supabase
      .from("weekly_logs")
      .select("*", { count: "exact", head: true })
      .in(
        "student_internship_id",
        (
          await supabase
            .from("student_internships")
            .select("id")
            .eq("faculty_supervisor_id", supervisor.id)
        ).data?.map((si) => si.id) || []
      )
      .eq("status", "submitted"),
    supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .in(
        "student_internship_id",
        (
          await supabase
            .from("student_internships")
            .select("id")
            .eq("faculty_supervisor_id", supervisor.id)
        ).data?.map((si) => si.id) || []
      )
      .eq("status", "submitted"),
  ]);

  stats.totalStudents = assignedInterns || 0;
  stats.activeInternships = activeInternships || 0;
  stats.pendingApplications = (pendingLogs ?? 0) + (pendingReports ?? 0); // Combined pending items
}

async function getStudentStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  userId: string
): Promise<void> {
  // Get student record
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!student) {
    return;
  }

  const [activeInternship, applications] = await Promise.all([
    supabase
      .from("student_internships")
      .select(`
        *,
        internships:internship_id(title, duration_weeks, companies:company_id(name))
      `)
      .eq("student_id", student.id)
      .in("status", ["active"])
      .maybeSingle(),
    supabase
      .from("internship_applications")
      .select("id, status")
      .eq("student_id", student.id),
  ]);

  if (activeInternship) {
    stats.activeInternships = 1;
    
    // Get weekly logs and reports stats for this internship
    const [{ count: submittedLogs }, { count: totalReports }] = await Promise.all([
      supabase
        .from("weekly_logs")
        .select("*", { count: "exact", head: true })
        .eq("student_internship_id", activeInternship.id)
        .in("status", ["approved"]),
      supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("student_internship_id", activeInternship.id)
        .in("status", ["approved"]),
    ]);

    // Calculate progress
    const internship = activeInternship.internships as unknown as {
      duration_weeks: number;
    };
    
    stats.completedInternships = 0; // Not completed yet
  }

  // Count pending applications
  if (applications) {
    const pendingCount = applications.filter(
      (app) => app.status === "pending" || app.status === "under_review"
    ).length;
    stats.pendingApplications = pendingCount;
  }
}

async function getCompanyHRStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  userId: string
): Promise<void> {
  // Get company user record
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", userId)
    .single();

  if (!companyUser) {
    return;
  }

  const [
    { count: activeInternships },
    { count: pendingApplications },
    { count: totalInterns },
    internshipData,
  ] = await Promise.all([
    supabase
      .from("internships")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyUser.company_id)
      .in("status", ["published", "active"]),
    supabase
      .from("internship_applications")
      .select("*", { count: "exact", head: true })
      .in(
        "internship_id",
        (
          await supabase
            .from("internships")
            .select("id")
            .eq("company_id", companyUser.company_id)
        ).data?.map((i) => i.id) || []
      )
      .eq("status", "pending"),
    // Total active interns across all company internships
    (async () => {
      const { data: companyInternships } = await supabase
        .from("internships")
        .select("id")
        .eq("company_id", companyUser.company_id);

      if (companyInternships && companyInternships.length > 0) {
        const internshipIds = companyInternships.map((i) => i.id);
        const { count } = await supabase
          .from("student_internships")
          .select("*", { count: "exact", head: true })
          .in("internship_id", internshipIds)
          .in("status", ["active"]);
        return count;
      }
      return 0;
    })(),
    // Average rating would come from evaluations - simplified here
    Promise.resolve(null),
  ]);

  stats.activeInternships = activeInternships || 0;
  stats.pendingApplications = pendingApplications || 0;
  stats.totalStudents = (totalInterns as number) || 0;
}

async function getSiteSupervisorStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  userId: string
): Promise<void> {
  // Get supervisor record
  const { data: supervisor } = await supabase
    .from("supervisors")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "site")
    .single();

  if (!supervisor) {
    return;
  }

  const [
    { count: assignedInterns },
    { count: pendingLogs },
    attendanceData,
  ] = await Promise.all([
    supabase
      .from("student_internships")
      .select("*", { count: "exact", head: true })
      .eq("site_supervisor_id", supervisor.id)
      .in("status", ["active"]),
    supabase
      .from("weekly_logs")
      .select("*", { count: "exact", head: true })
      .in(
        "student_internship_id",
        (
          await supabase
            .from("student_internships")
            .select("id")
            .eq("site_supervisor_id", supervisor.id)
        ).data?.map((si) => si.id) || []
      )
      .eq("status", "submitted"),
    // Recent attendance stats
    (async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: sis } = await supabase
        .from("student_internships")
        .select("id")
        .eq("site_supervisor_id", supervisor.id)
        .in("status", ["active"]);

      if (sis && sis.length > 0) {
        const siIds = sis.map((s) => s.id);
        const { count: present, count: absent } = await Promise.all([
          supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .in("student_internship_id", siIds)
            .gte("date", thirtyDaysAgo.toISOString())
            .eq("status", "present"),
          supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .in("student_internship_id", siIds)
            .gte("date", thirtyDaysAgo.toISOString())
            .eq("status", "absent"),
        ]);
        
        return { present: present || 0, absent: absent || 0 };
      }
      return { present: 0, absent: 0 };
    })(),
  ]);

  stats.totalStudents = assignedInterns || 0;
  stats.pendingApplications = pendingLogs || 0; // Using this field for pending logs
  
  // Calculate average attendance rate
  if (attendanceData) {
    const att = attendanceData as { present: number; absent: number };
    const total = att.present + att.absent;
    if (total > 0) {
      stats.averageRating = Math.round((att.present / total) * 100) / 100;
    }
  }
}

async function getExternalEvaluatorStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: DashboardStats,
  userId: string
): Promise<void> {
  // Get external evaluator record
  const { data: evaluator } = await supabase
    .from("external_evaluators")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!evaluator) {
    return;
  }

  const [
    { count: assignedEvaluations },
    { count: completedEvaluations },
    { count: pendingEvaluations },
  ] = await Promise.all([
    supabase
      .from("evaluations")
      .select("*", { count: "exact", head: true })
      .eq("evaluator_id", evaluator.id)
      .eq("evaluator_type", "external"),
    supabase
      .from("evaluations")
      .select("*", { count: "exact", head: true })
      .eq("evaluator_id", evaluator.id)
      .eq("evaluator_type", "external")
      .eq("status", "completed"),
    supabase
      .from("evaluations")
      .select("*", { count: "exact", head: true })
      .eq("evaluator_id", evaluator.id)
      .eq("evaluator_type", "external")
      .in("status", ["pending", "in_progress"]),
  ]);

  stats.totalStudents = assignedEvaluations || 0;
  stats.completedInternships = completedEvaluations || 0;
  stats.pendingApplications = pendingEvaluations || 0; // Using this field for pending evals
}
