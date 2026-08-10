import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  getServerAuthContext,
  requireAuth,
  authorizationError,
  authenticationError,
} from "@/lib/authorization";
import type { ApiResponse } from "@/types";
import { z } from "zod";

// ============ ZOD VALIDATION SCHEMAS ============

const UpdateMessageSchema = z.object({
  is_read: z.boolean().optional(),
  is_deleted_by_sender: z.boolean().optional(),
  is_deleted_by_receiver: z.boolean().optional(),
});

/**
 * GET /api/communications/[id]
 * Get a single message by ID
 * Only accessible to sender or receiver
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const authContext = await getServerAuthContext();

    if (!authContext.isAuthenticated || !authContext.user) {
      return authenticationError();
    }

    const { id } = await params;
    const userId = authContext.user.id;

    // Fetch message
    const { data: message, error } = await supabase
      .from("messages")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !message) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Verify user is sender or receiver
    if (message.sender_id !== userId && message.receiver_id !== userId) {
      return authorizationError("Access denied to this message");
    }

    // Enrich with sender and receiver info
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

    // Auto-mark as read if receiver is viewing and not yet read
    if (message.receiver_id === userId && !message.is_read) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", id);
      
      message.is_read = true;
    }

    return NextResponse.json<ApiResponse<typeof message & { 
      sender: typeof senderData; 
      receiver: typeof receiverData 
    }>>({
      success: true,
      data: {
        ...message,
        sender: senderData,
        receiver: receiverData,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/communications/[id]:", error);
    
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
 * PUT /api/communications/[id]
 * Update a message (mark as read, delete for self)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const authContext = await requireAuth();

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Validation failed",
          message: validation.error.errors[0]?.message,
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;
    const userId = authContext.user!.id;

    // Fetch existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Verify user is sender or receiver
    const isSender = existingMessage.sender_id === userId;
    const isReceiver = existingMessage.receiver_id === userId;

    if (!isSender && !isReceiver) {
      return authorizationError("Access denied to this message");
    }

    // Build update payload based on user role and permissions
    const updates: Record<string, any> = {};

    // Only receiver can mark as read
    if (updateData.is_read !== undefined && isReceiver) {
      updates.is_read = updateData.is_read;
    }

    // Users can delete message for themselves only
    if (updateData.is_deleted_by_sender === true && isSender) {
      updates.is_deleted_by_sender = true;
    }

    if (updateData.is_deleted_by_receiver === true && isReceiver) {
      updates.is_deleted_by_receiver = true;
    }

    // If both parties deleted, we could soft delete or hard delete
    if (
      (existingMessage.is_deleted_by_sender || updates.is_deleted_by_sender) &&
      (existingMessage.is_deleted_by_receiver || updates.is_deleted_by_receiver)
    ) {
      // Both deleted - could hard delete here if desired
      // For now, just mark both as deleted
    }

    // Perform update
    const { data: updatedMessage, error: updateError } = await supabase
      .from("messages")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating message:", updateError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update message" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<typeof updatedMessage>>({
      success: true,
      data: updatedMessage,
      message: "Message updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT /api/communications/[id]:", error);
    
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
 * DELETE /api/communications/[id]
 * Delete a message (soft delete - marks as deleted for current user)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const authContext = await requireAuth();

    const { id } = await params;
    const userId = authContext.user!.id;

    // Fetch existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Verify user is sender or receiver
    const isSender = existingMessage.sender_id === userId;
    const isReceiver = existingMessage.receiver_id === userId;

    if (!isSender && !isReceiver) {
      return authorizationError("Access denied to this message");
    }

    // Soft delete for appropriate party
    const updates: Record<string, any> = {};
    
    if (isSender) {
      updates.is_deleted_by_sender = true;
    }
    
    if (isReceiver) {
      updates.is_deleted_by_receiver = true;
    }

    const { error: updateError } = await supabase
      .from("messages")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("Error deleting message:", updateError);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to delete message" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted: true },
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/communications/[id]:", error);
    
    if (error instanceof Error && error.message.includes("Authentication")) {
      return authenticationError(error.message);
    }
    
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
