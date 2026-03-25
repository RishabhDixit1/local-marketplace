import { NextResponse } from "next/server";
import type { DirectConversationResponse } from "@/lib/api/chat";
import { getOrCreateDirectConversationIdForUsers } from "@/lib/server/directConversations";
import { createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type DirectConversationRequest = {
  recipientId?: string;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      } satisfies DirectConversationResponse,
      { status: authResult.status }
    );
  }

  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!userClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      } satisfies DirectConversationResponse,
      { status: 500 }
    );
  }

  let body: DirectConversationRequest = {};
  try {
    body = (await request.json()) as DirectConversationRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid JSON payload.",
      } satisfies DirectConversationResponse,
      { status: 400 }
    );
  }

  const recipientId = body.recipientId?.trim() || "";
  if (!recipientId) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "recipientId is required.",
      } satisfies DirectConversationResponse,
      { status: 400 }
    );
  }

  if (recipientId === authResult.auth.userId) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "You cannot start a direct chat with yourself.",
      } satisfies DirectConversationResponse,
      { status: 400 }
    );
  }

  try {
    const conversationId = await getOrCreateDirectConversationIdForUsers(
      userClient,
      authResult.auth.userId,
      recipientId
    );

    return NextResponse.json(
      {
        ok: true,
        conversationId,
        recipientId,
      } satisfies DirectConversationResponse,
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
        message: error instanceof Error ? error.message : "Unable to open a direct conversation.",
      } satisfies DirectConversationResponse,
      { status: 500 }
    );
  }
}
