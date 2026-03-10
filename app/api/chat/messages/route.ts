import { NextResponse } from "next/server";
import type { SendChatMessageResponse } from "@/lib/api/chat";
import { areUsersConnected, getConversationContext } from "@/lib/server/chatGuards";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type SendChatMessageRequest = {
  conversationId?: string;
  content?: string;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      } satisfies SendChatMessageResponse,
      { status: authResult.status }
    );
  }

  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const admin = createSupabaseAdminClient();
  if (!userClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      } satisfies SendChatMessageResponse,
      { status: 500 }
    );
  }

  let body: SendChatMessageRequest = {};
  try {
    body = (await request.json()) as SendChatMessageRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid JSON payload.",
      } satisfies SendChatMessageResponse,
      { status: 400 }
    );
  }

  const conversationId = body.conversationId?.trim() || "";
  const content = body.content?.trim() || "";

  if (!conversationId || !content) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "conversationId and content are required.",
      } satisfies SendChatMessageResponse,
      { status: 400 }
    );
  }

  try {
    const dbForChecks = admin || userClient;
    const conversation = await getConversationContext(dbForChecks, conversationId, authResult.auth.userId);

    if (conversation.kind === "direct" && conversation.otherUserId) {
      const connected = await areUsersConnected(dbForChecks, authResult.auth.userId, conversation.otherUserId);
      if (!connected) {
        return NextResponse.json(
          {
            ok: false,
            code: "FORBIDDEN",
            message: "This direct chat is not active anymore. Reconnect before messaging.",
          } satisfies SendChatMessageResponse,
          { status: 403 }
        );
      }
    }

    const insertResult = await userClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: authResult.auth.userId,
        content,
      })
      .select("id,conversation_id,content,sender_id,created_at")
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new Error(insertResult.error?.message || "Unable to send message.");
    }

    return NextResponse.json(
      {
        ok: true,
        message: insertResult.data,
      } satisfies SendChatMessageResponse,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to send message.",
      } satisfies SendChatMessageResponse,
      { status: 500 }
    );
  }
}
