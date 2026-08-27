import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import {
  getServerAuthContext,
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import type { ApiResponse, UserRole } from "@/types";

// ============ INTERFACES ============

interface StorageStats {
  used_bytes: number;
  allocated_bytes: number;
  file_count: number;
  usage_percentage: number;
  used_mb: number;
  allocated_mb: number;
  used_gb: number;
  allocated_gb: number;
}

interface UniversityStorageStats extends StorageStats {
  university_id: string;
  university_name: string | null;
  student_count: number;
}

interface PlatformStorageStats {
  total_used_bytes: number;
  total_allocated_bytes: number;
  total_file_count: number;
  universities: UniversityStorageStats[];
}

// Roles that can view storage stats
const VIEW_ROLES: UserRole[] = ["super_admin", "university_admin"];

/** Pseudo-id for the "Other (company & unattributed)" row — documents that
 *  belong to no university. The UI excludes it from the university COUNT. */
const UNATTRIBUTED_ID = "__unattributed__";

/**
 * GET /api/storage/stats
 * Get storage usage statistics
 * - Super Admin can see platform-wide and per-university stats
 * - University Admin can only see their own university's stats
 *
 * Uses the service-role client to bypass RLS and aggregate real document
 * file sizes from the `documents` table.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authContext = await getServerAuthContext();

    if (!authContext.isAuthenticated || !authContext.user) {
      return authenticationError();
    }

    // Check role permissions
    if (!VIEW_ROLES.includes(authContext.profile?.role as UserRole)) {
      return authorizationError("Insufficient permissions to view storage statistics");
    }

    const userRole = authContext.profile?.role as UserRole;

    if (userRole === "super_admin") {
      return await getPlatformStorageStats();
    } else {
      const universityId = authContext.profile?.university_id;

      if (!universityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "No university assigned to your account" },
          { status: 400 }
        );
      }

      return await getUniversityStorageStats(universityId);
    }
  } catch (error) {
    console.error("Error in GET /api/storage/stats:", error);

    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }

    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Helper: convert bytes to human-readable units.
 */
function bytesToMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

function bytesToGb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}

/**
 * NOTE on the size column (bug fix 2026-08-27 — "storage statistics show 0
 * files / 0 MB / No documents uploaded yet"): the `documents` table's byte
 * column is named **size**, NOT file_size. The previous queries selected
 * `file_size`, which PostgREST rejects (column does not exist) — and because
 * the fetch errors were silently ignored, the page rendered zeros. All
 * queries now select `size` and surface fetch errors instead of swallowing
 * them.
 */

/**
 * Build a UniversityStorageStats object.
 */
function buildUniStats(
  universityId: string,
  universityName: string | null,
  usedBytes: number,
  fileCount: number,
  studentCount: number,
  allocatedBytes = 0
): UniversityStorageStats {
  const percentage = allocatedBytes > 0 ? Math.round((usedBytes / allocatedBytes) * 100) : 0;
  return {
    university_id: universityId,
    university_name: universityName,
    used_bytes: usedBytes,
    allocated_bytes: allocatedBytes,
    file_count: fileCount,
    usage_percentage: percentage,
    used_mb: bytesToMb(usedBytes),
    allocated_mb: bytesToMb(allocatedBytes),
    used_gb: bytesToGb(usedBytes),
    allocated_gb: bytesToGb(allocatedBytes),
    student_count: studentCount,
  };
}

/**
 * Get platform-wide storage statistics (Super Admin only).
 *
 * Strategy:
 * 1. Fetch ALL active universities.
 * 2. Fetch ALL documents (id, size, entity_id, entity_type).
 * 3. Fetch students (user_id, university_id) to map documents → universities.
 * 4. Aggregate per-university: file count, sum(size), student count.
 * 5. Compute platform totals.
 */
async function getPlatformStorageStats(): Promise<NextResponse<ApiResponse<PlatformStorageStats>>> {
  const supabase = await createServiceRoleClient();

  // 1. Fetch all active universities
  const { data: universities, error: unisError } = await supabase
    .from("universities")
    .select("id, name")
    .eq("is_active", true);

  if (unisError) {
    console.error("[storage-stats] universities fetch failed:", unisError.message);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Failed to load universities: ${unisError.message}` },
      { status: 500 }
    );
  }

  const uniList = universities || [];

  // 2. Fetch all documents with file sizes (column is `size` — see note above)
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("id, size, entity_id, entity_type, uploaded_by");

  if (docsError) {
    console.error("[storage-stats] documents fetch failed:", docsError.message);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Failed to load documents: ${docsError.message}` },
      { status: 500 }
    );
  }

  const docList = documents || [];

  // 3. Fetch all students with university_id to build entity_id → university_id mapping
  //    entity_id on documents can be a user_id (for student docs). Also try uploaded_by.
  const { data: students } = await supabase
    .from("students")
    .select("user_id, university_id");

  // Build a map: user_id → university_id from students table
  const userToUniversity = new Map<string, string>();
  for (const s of students || []) {
    if (s.user_id && s.university_id) {
      userToUniversity.set(s.user_id, s.university_id);
    }
  }

  // Also map profiles (covers faculty, etc.)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, university_id");

  for (const p of profiles || []) {
    if (p.user_id && p.university_id && !userToUniversity.has(p.user_id)) {
      userToUniversity.set(p.user_id, p.university_id);
    }
  }

  // 4. Aggregate per-university
  const uniStatsMap = new Map<string, { usedBytes: number; fileCount: number; studentCount: number }>();

  // Initialize all universities
  for (const uni of uniList) {
    uniStatsMap.set(uni.id, { usedBytes: 0, fileCount: 0, studentCount: 0 });
  }

  // Count students per university
  for (const s of students || []) {
    if (s.university_id && uniStatsMap.has(s.university_id)) {
      uniStatsMap.get(s.university_id)!.studentCount += 1;
    }
  }

  // Map each document to a university and accumulate. Documents that cannot
  // be attributed to any university (e.g. company-HR uploads) are tracked
  // separately so the platform TOTALS still count every document.
  let unattributedBytes = 0;
  let unattributedCount = 0;
  for (const doc of docList) {
    const fileSize = doc.size || 0;
    let universityId: string | undefined;

    // University-scoped docs (logos etc.): entity_id IS the university id.
    if (doc.entity_type === "university" && doc.entity_id) {
      universityId = doc.entity_id;
    }

    // Try entity_id first (for student docs, entity_id = user_id)
    if (!universityId && doc.entity_id) {
      universityId = userToUniversity.get(doc.entity_id);
    }

    // Fallback to uploaded_by
    if (!universityId && doc.uploaded_by) {
      universityId = userToUniversity.get(doc.uploaded_by);
    }

    if (universityId && uniStatsMap.has(universityId)) {
      const stats = uniStatsMap.get(universityId)!;
      stats.usedBytes += fileSize;
      stats.fileCount += 1;
    } else {
      unattributedBytes += fileSize;
      unattributedCount += 1;
    }
  }

  // 5. Build final stats. Totals count EVERY document in the table.
  let totalUsedBytes = 0;
  let totalFileCount = 0;

  const finalUniversityStats: UniversityStorageStats[] = [];

  for (const uni of uniList) {
    const stats = uniStatsMap.get(uni.id) || { usedBytes: 0, fileCount: 0, studentCount: 0 };
    finalUniversityStats.push(
      buildUniStats(uni.id, uni.name, stats.usedBytes, stats.fileCount, stats.studentCount)
    );
    totalUsedBytes += stats.usedBytes;
    totalFileCount += stats.fileCount;
  }
  totalUsedBytes += unattributedBytes;
  totalFileCount += unattributedCount;

  // Pseudo-row for documents that belong to no university (company uploads
  // etc.) so the per-university table still sums to the platform totals.
  // The UI hides zero-file rows and counts only REAL universities.
  if (unattributedCount > 0) {
    finalUniversityStats.push(
      buildUniStats(UNATTRIBUTED_ID, "Other (company & unattributed)", unattributedBytes, unattributedCount, 0)
    );
  }

  // Sort by used_bytes descending
  finalUniversityStats.sort((a, b) => b.used_bytes - a.used_bytes);

  const platformStats: PlatformStorageStats = {
    total_used_bytes: totalUsedBytes,
    total_allocated_bytes: 0, // No allocation tracking — real storage only
    total_file_count: totalFileCount,
    universities: finalUniversityStats,
  };

  return NextResponse.json<ApiResponse<PlatformStorageStats>>({
    success: true,
    data: platformStats,
  });
}

/**
 * Get single university's storage statistics.
 */
async function getUniversityStorageStats(
  universityId: string
): Promise<NextResponse<ApiResponse<UniversityStorageStats>>> {
  const supabase = await createServiceRoleClient();

  // Get university info
  const { data: university } = await supabase
    .from("universities")
    .select("id, name")
    .eq("id", universityId)
    .single();

  if (!university) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "University not found" },
      { status: 404 }
    );
  }

  // Get students for this university
  const { data: students } = await supabase
    .from("students")
    .select("user_id")
    .eq("university_id", universityId);

  const studentUserIds = new Set((students || []).map((s) => s.user_id));

  // Fetch documents: match by entity_id or uploaded_by being one of the student user IDs
  // We do two separate queries because Supabase JS doesn't support OR across columns easily
  let allDocs: Array<{ id: string; size: number | null }> = [];

  if (studentUserIds.size > 0) {
    const ids = Array.from(studentUserIds);
    // Query 1: entity_id IN studentUserIds
    const { data: docsByEntity } = await supabase
      .from("documents")
      .select("id, size")
      .in("entity_id", ids);

    // Query 2: uploaded_by IN studentUserIds
    const { data: docsByUploader } = await supabase
      .from("documents")
      .select("id, size")
      .in("uploaded_by", ids);

    // Merge and deduplicate by id
    const seen = new Set<string>();
    for (const doc of docsByEntity || []) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        allDocs.push(doc);
      }
    }
    for (const doc of docsByUploader || []) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        allDocs.push(doc);
      }
    }
  }

  // Also fetch documents where entity_type = 'university' and entity_id = universityId
  const { data: uniDocs } = await supabase
    .from("documents")
    .select("id, size")
    .eq("entity_type", "university")
    .eq("entity_id", universityId);

  const seenUni = new Set(allDocs.map((d) => d.id));
  for (const doc of uniDocs || []) {
    if (!seenUni.has(doc.id)) {
      allDocs.push(doc);
    }
  }

  // Aggregate
  let usedBytes = 0;
  for (const doc of allDocs) {
    usedBytes += doc.size || 0;
  }

  const stats: UniversityStorageStats = buildUniStats(
    universityId,
    university.name,
    usedBytes,
    allDocs.length,
    studentUserIds.size
  );

  return NextResponse.json<ApiResponse<UniversityStorageStats>>({
    success: true,
    data: stats,
  });
}
