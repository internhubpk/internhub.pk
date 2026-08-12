import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  getServerAuthContext,
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import type { ApiResponse, PaginatedResponse, UserRole } from "@/types";
import { z } from "zod";

// ============ ZOD VALIDATION SCHEMAS ============

const SendMessageSchema = z.object({
  receiver_id: z.string().uuid("Invalid receiver ID"),
  subject: z.string()
    .min(1, "Subject is required")
    .max(200, "Subject cannot exceed 200 characters"),
  content: z.string()
    .min(1, "Message content is required")
    .max(10000, "Content cannot exceed 10000 characters"),
});

const MessageFilterSchema = z.object({
  folder: z.enum(["inbox", "sent", "all"]).default("all"),
  is_read: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Roles that can send messages
const MESSAGE_ROLES: UserRole[] = [
  "super_admin",
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
  "company_hr",
  "site_supervisor",
  "external_evaluator",
];

/**
 * GET /api/communications
 * List messages for current user
 * - inbox: received messages
 * - sent: sent messages
 * - all: all messages
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Authenticate user
    const authContext = await getServerAuthContext();

    if (!authContext.isAuthenticated || !authContext.user) {
      return authenticationError();
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    
    const filterResult = MessageFilterSchema.safeParse(
      Object.fromEntries(searchParams)
    );
    
    const paginationResult = PaginationSchema.safeParse(
      Object.fromEntries(searchParams)
    );

    const filters = filterResult.success ? filterResult.data : { folder: "all" as const };
    const page = paginationResult.success ? paginationResult.data.page : 1;
    const pageSize = paginationResult.success ? paginationResult.data.pageSize : 20;

    const userId = authContext.user.id;
    let query;

    // Build query based on folder
    if (filters.folder === "inbox") {
      // Received messages
      query = supabase
        .from("messages")
        .select("*", { count: "exact" })
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false });
    } else if (filters.folder === "sent") {
      // Sent messages
      query = supabase
        .from("messages")
        .select("*", { count: "exact" })
        .eq("sender_id", userId)
        .order("created_at", { ascending: false });
    } else {
      // All messages (sent or received)
      query = supabase
        .from("messages")
        .select("*", { count: "exact" })
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });
    }

    // Apply read/unread filter for inbox
    if (filters.folder === "inbox" && filters.is_read) {
      query = query.eq("is_read", filters.is_read === "true");
    }

    // Apply search filter
    if (filters.search) {
      query = query.or(`subject.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
    }

    // Get total count before pagination
    const { count } = await query;

    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = page * pageSize - 1;

    const { data: messages, error } = await query.range(start, end);

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Enrich messages with sender and receiver info
    const enrichedMessages = await Promise.all(
      (messages || []).map(async (message) => {
        const [senderData, receiverData] = await Promise.all([
          supabase
            .from("profiles")
            .select("first_name, last_name, avatar_url, role")
            .eq("user_id", message.sender_id)
            .single(),
          supabase
            .from("profiles")
            .select("first_name, last_name, avatar_url, role")
            .eq("user_id", message.receiver_id)
            .single(),
        ]);

        return {
          ...message,
          sender: senderData,
          receiver: receiverData,
          // Don't include full content in list view for performance
          content_preview: message.content.substring(0, 150) + (message.content.length > 150 ? "..." : ""),
        };
      })
    );

    const response: PaginatedResponse<typeof enrichedMessages[0]> = {
      data: enrichedMessages,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<typeof enrichedMessages[0]>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in GET /api/communications:", error);
    
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
 * POST /api/communications
 * Send a new message to another user within the same university
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    if (!supabase) {
      return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
    }

    // Authenticate user
    const authContext = await requireAuth();

    // Check if user has permission to send messages
    if (!MESSAGE_ROLES.includes(authContext.profile?.role as UserRole)) {
      return authorizationError("Insufficient permissions to send messages");
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = SendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    const messageData = validation.data;
    const senderId = authContext.user!.id;

    // Prevent sending messages to self
    if (messageData.receiver_id === senderId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cannot send message to yourself" },
        { status: 400 }
      );
    }

    // Verify receiver exists and get their profile
    const { data: receiverProfile, error: receiverError } = await supabase
      .from("profiles")
      .select("id, user_id, university_id, is_active")
      .eq("user_id", messageData.receiver_id)
      .single();

    if (receiverError || !receiverProfile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Receiver not found" },
        { status: 404 }
      );
    }

    // Check if receiver is active
    if (!receiverProfile.is_active) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cannot send message to inactive user" },
        { status: 400 }
      );
    }

    // Verify users are in same university (or sender is super admin)
    const senderUniversityId = authContext.profile?.university_id;
    const receiverUniversityId = receiverProfile.university_id;

    if (authContext.profile?.role !== "super_admin") {
      if (senderUniversityId !== receiverUniversityId) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Can only send messages to users within your university" },
          { status: 403 }
        );
      }
    }

    // Create the message
    const { data: message, error: insertError } = await supabase
      .from("messages")
      .insert({
        sender_id: senderId,
        receiver_id: messageData.receiver_id,
        subject: messageData.subject,
        content: messageData.content,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating message:", insertError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof message>>({
      success: true,
      data: message,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/communications:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
