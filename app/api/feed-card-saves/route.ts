import { NextResponse } from "next/server";
import type { FeedCardSavePayload, FeedCardType } from "@/lib/feedCardSaves";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type SaveFeedCardSaveAction = {
  action: "save";
  card: Partial<FeedCardSavePayload> | null;
};

type RemoveFeedCardSaveAction = {
  action: "remove";
  cardId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeNullableText = (value: unknown) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const normalizeFeedCardType = (value: unknown): FeedCardType | null => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "demand" || normalized === "service" || normalized === "product") {
    return normalized;
  }
  return null;
};

const normalizeMetadata = (value: unknown) => (isRecord(value) ? value : null);

const toSavePayload = (value: Partial<FeedCardSavePayload> | null): FeedCardSavePayload | null => {
  if (!value) return null;

  const cardId = normalizeText(value.card_id);
  const focusId = normalizeText(value.focus_id);
  const cardType = normalizeFeedCardType(value.card_type);
  const title = normalizeText(value.title);

  if (!cardId || !focusId || !cardType || !title) {
    return null;
  }

  return {
    card_id: cardId,
    focus_id: focusId,
    card_type: cardType,
    title,
    subtitle: normalizeNullableText(value.subtitle),
    action_path: normalizeNullableText(value.action_path),
    metadata: normalizeMetadata(value.metadata),
  };
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const dbClient = createSupabaseUserServerClient(authResult.auth.accessToken) || createSupabaseAdminClient();
  if (!dbClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      },
      { status: 500 }
    );
  }

  let body: SaveFeedCardSaveAction | RemoveFeedCardSaveAction;
  try {
    body = (await request.json()) as SaveFeedCardSaveAction | RemoveFeedCardSaveAction;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  if (body.action === "save") {
    const payload = toSavePayload(body.card);
    if (!payload) {
      return NextResponse.json(
        { ok: false, code: "INVALID_PAYLOAD", message: "card_id, focus_id, card_type, and title are required." },
        { status: 400 }
      );
    }

    const { error } = await dbClient.from("feed_card_saves").upsert(
      {
        user_id: authResult.auth.userId,
        ...payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,card_id" }
    );

    if (error) {
      return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "save", cardId: payload.card_id });
  }

  if (body.action === "remove") {
    const cardId = normalizeText(body.cardId);
    if (!cardId) {
      return NextResponse.json(
        { ok: false, code: "INVALID_PAYLOAD", message: "cardId is required." },
        { status: 400 }
      );
    }

    const { error } = await dbClient
      .from("feed_card_saves")
      .delete()
      .eq("user_id", authResult.auth.userId)
      .eq("card_id", cardId);

    if (error) {
      return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "remove", cardId });
  }

  return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Unsupported save action." }, { status: 400 });
}
