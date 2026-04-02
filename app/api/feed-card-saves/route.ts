import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type FeedCardType = "demand" | "service" | "product";

type FeedCardSaveInput = {
  card_id: string;
  focus_id: string;
  card_type: FeedCardType;
  title: string;
  subtitle: string | null;
  action_path: string | null;
  metadata: Record<string, unknown> | null;
};

type SaveFeedCardSavesAction =
  | {
      action: "save";
      card: FeedCardSaveInput;
    }
  | {
      action: "remove";
      cardId: string;
    };

const trim = (value: string | null | undefined) => value?.trim() ?? "";

const toNullableString = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFeedCardType = (value: unknown): value is FeedCardType =>
  value === "demand" || value === "service" || value === "product";

const parseFeedCardSaveInput = (value: unknown): FeedCardSaveInput | null => {
  if (!isRecord(value)) return null;

  const cardId = trim(typeof value.card_id === "string" ? value.card_id : "");
  const focusId = trim(typeof value.focus_id === "string" ? value.focus_id : "");
  const title = trim(typeof value.title === "string" ? value.title : "");

  if (!cardId || !focusId || !title || !isFeedCardType(value.card_type)) {
    return null;
  }

  return {
    card_id: cardId,
    focus_id: focusId,
    card_type: value.card_type,
    title,
    subtitle: toNullableString(value.subtitle),
    action_path: toNullableString(value.action_path),
    metadata: isRecord(value.metadata) ? value.metadata : null,
  };
};

const parseAction = (value: unknown): SaveFeedCardSavesAction | null => {
  if (!isRecord(value)) return null;

  if (value.action === "save") {
    const card = parseFeedCardSaveInput(value.card);
    if (!card) return null;

    return {
      action: "save",
      card,
    };
  }

  if (value.action === "remove") {
    const cardId = trim(typeof value.cardId === "string" ? value.cardId : "");
    if (!cardId) return null;

    return {
      action: "remove",
      cardId,
    };
  }

  return null;
};

const toErrorResponse = (status: number, message: string) =>
  NextResponse.json(
    {
      ok: false,
      message,
    },
    { status }
  );

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return toErrorResponse(authResult.status, authResult.message);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, "Invalid JSON payload.");
  }

  const action = parseAction(body);
  if (!action) {
    return toErrorResponse(400, "Request body does not match the feed card save schema.");
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return toErrorResponse(
      500,
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (action.action === "save") {
    const { error } = await dbClient.from("feed_card_saves").upsert(
      {
        user_id: authResult.auth.userId,
        ...action.card,
      },
      {
        onConflict: "user_id,card_id",
      }
    );

    if (error) {
      return toErrorResponse(500, error.message || "Unable to save feed card.");
    }

    return NextResponse.json({
      ok: true,
    });
  }

  const { error } = await dbClient
    .from("feed_card_saves")
    .delete()
    .eq("user_id", authResult.auth.userId)
    .eq("card_id", action.cardId);

  if (error) {
    return toErrorResponse(500, error.message || "Unable to remove feed card save.");
  }

  return NextResponse.json({
    ok: true,
  });
}
