import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { ApiResponse, PaginatedResponse, University } from "@/types";

/**
 * GET /api/universities
 * 
 * PUBLIC ENDPOINT: Lists universities for public pages (/universities)
 * No authentication required - uses service role for public data
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sort_by") || "name";
    const sortOrder = searchParams.get("sort_order") === "asc";

    // Build query - public access to universities
    let query = supabase
      .from("universities")
      .select("*", { count: "exact" });

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
    }

    // Only show active universities (not test entries)
    query = query.neq("name", "My University");

    // Get total count first
    const { count } = await query;

    // Apply pagination and sorting
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: universities, error } = await query
      .order(sortBy, { ascending: sortOrder })
      .range(start, end);

    if (error) {
      console.error("Error fetching universities:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch universities" },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<University> = {
      data: universities as University[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<University>>>({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Error in GET /api/universities:", error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
