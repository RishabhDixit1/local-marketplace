import { NextResponse } from "next/server";
import type { CreateLiveTalkRequest, LiveTalkRequestRecord, LiveTalkStatus } from "@/lib/api/chat";
import { areUsersConnected, getConversationContext, mapLiveTalkRequestRow } from "@/lib/server/chatGuards";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type CreateLiveTalkPayload = {
  conversationId?: string;
};

type UpdateLiveTalkPayload = {
  requestId?: string;
  status?: LiveTalkStatus;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      } satisfies CreateLiveTalkRequest,
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
      } satisfies CreateLiveTalkRequest,
      { status: 500 }
    );
  }

  let body: CreateLiveTalkPayload = {};
  try {
    body = (await request.json()) as CreateLiveTalkPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid JSON payload.",
      } satisfies CreateLiveTalkRequest,
      { status: 400 }
    );
  }

  const conversationId = body.conversationId?.trim() || "";
  if (!conversationId) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "conversationId is required.",
      } satisfies CreateLiveTalkRequest,
      { status: 400 }
    );
  }

  try {
    const dbForChecks = admin || userClient;
    const conversation = await getConversationContext(dbForChecks, conversationId, authResult.auth.userId);

    if (conversation.kind !== "direct" || !conversation.otherUserId) {
      return NextResponse.json(
        {
          ok: false,
          code: "FORBIDDEN",
          message: "Live Talk is available for connected one-to-one chats only.",
        } satisfies CreateLiveTalkRequest,
        { status: 403 }
      );
    }

    const connected = await areUsersConnected(dbForChecks, authResult.auth.userId, conversation.otherUserId);
    if (!connected) {
      return NextResponse.json(
        {
          ok: false,
          code: "FORBIDDEN",
          message: "Connect with this member first to start Live Talk.",
        } satisfies CreateLiveTalkRequest,
        { status: 403 }
      );
    }

    const existingPendingResult = await userClient
      .from("live_talk_requests")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPendingResult.error) {
      throw new Error(existingPendingResult.error.message);
    }

    const existingPending = mapLiveTalkRequestRow((existingPendingResult.data as Record<string, unknown> | null) || null);
    if (existingPending) {
      return NextResponse.json(
        {
          ok: true,
          request: existingPending,
        } satisfies CreateLiveTalkRequest,
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const insertResult = await userClient
      .from("live_talk_requests")
      .insert({
        conversation_id: conversationId,
        caller_id: authResult.auth.userId,
        recipient_id: conversation.otherUserId,
        status: "pending",
        mode: "audio_video",
        metadata: {
          placeholder: true,
          source: "chat_ui",
        },
      })
      .select("*")
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new Error(insertResult.error?.message || "Unable to start Live Talk.");
    }

    return NextResponse.json(
      {
        ok: true,
        request: mapLiveTalkRequestRow(insertResult.data as Record<string, unknown>) as LiveTalkRequestRecord,
      } satisfies CreateLiveTalkRequest,
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
        message: error instanceof Error ? error.message : "Unable to start Live Talk.",
      } satisfies CreateLiveTalkRequest,
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      } satisfies CreateLiveTalkRequest,
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
      } satisfies CreateLiveTalkRequest,
      { status: 500 }
    );
  }

  let body: UpdateLiveTalkPayload = {};
  try {
    body = (await request.json()) as UpdateLiveTalkPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid JSON payload.",
      } satisfies CreateLiveTalkRequest,
      { status: 400 }
    );
  }

  const requestId = body.requestId?.trim() || "";
  const nextStatus = body.status || "pending";
  if (!requestId || !["accepted", "declined", "ended", "cancelled"].includes(nextStatus)) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "requestId and a supported status are required.",
      } satisfies CreateLiveTalkRequest,
      { status: 400 }
    );
  }

  const existingResult = await userClient.from("live_talk_requests").select("*").eq("id", requestId).maybeSingle();
  if (existingResult.error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: existingResult.error.message,
      } satisfies CreateLiveTalkRequest,
      { status: 500 }
    );
  }

  const existing = mapLiveTalkRequestRow((existingResult.data as Record<string, unknown> | null) || null);
  if (!existing) {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_FOUND",
        message: "Live Talk request not found.",
      } satisfies CreateLiveTalkRequest,
      { status: 404 }
    );
  }

  if (["accepted", "declined"].includes(nextStatus) && existing.recipient_id !== authResult.auth.userId) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only the recipient can accept or decline a Live Talk request.",
      } satisfies CreateLiveTalkRequest,
      { status: 403 }
    );
  }

  if (["ended", "cancelled"].includes(nextStatus) && ![existing.caller_id, existing.recipient_id].includes(authResult.auth.userId)) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only participants can end this Live Talk request.",
      } satisfies CreateLiveTalkRequest,
      { status: 403 }
    );
  }

  const updateResult = await userClient
    .from("live_talk_requests")
    .update({
      status: nextStatus,
      responded_at: new Date().toISOString(),
      metadata: {
        ...(existing.metadata || {}),
        updated_by: authResult.auth.userId,
      },
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: updateResult.error?.message || "Unable to update Live Talk request.",
      } satisfies CreateLiveTalkRequest,
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      request: mapLiveTalkRequestRow(updateResult.data as Record<string, unknown>) as LiveTalkRequestRecord,
    } satisfies CreateLiveTalkRequest,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
