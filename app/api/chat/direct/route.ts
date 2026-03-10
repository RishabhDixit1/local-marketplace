import { NextResponse } from "next/server";
import type { DirectConversationResponse } from "@/lib/api/chat";
import { areUsersConnected } from "@/lib/server/chatGuards";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
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
  const admin = createSupabaseAdminClient();

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
    const dbForChecks = admin || userClient;
    const connected = await areUsersConnected(dbForChecks, authResult.auth.userId, recipientId);

    if (!connected) {
      return NextResponse.json(
        {
          ok: false,
          code: "FORBIDDEN",
          message: "Connect with this member first to start a chat.",
        } satisfies DirectConversationResponse,
        { status: 403 }
      );
    }

    const rpcResult = await userClient.rpc("get_or_create_direct_conversation", {
      target_user_id: recipientId,
    });

    if (rpcResult.error || typeof rpcResult.data !== "string" || !rpcResult.data) {
      throw new Error(rpcResult.error?.message || "Unable to open a direct conversation.");
    }

    return NextResponse.json(
      {
        ok: true,
        conversationId: rpcResult.data,
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
