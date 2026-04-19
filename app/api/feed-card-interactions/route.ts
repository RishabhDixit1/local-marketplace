import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import {
  createSupabaseAdminClient,
  createSupabaseUserServerClient,
} from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type FeedCardType = "demand" | "service" | "product";
type FeedCardInteractionChannel = "native" | "clipboard";
type FeedCardFeedbackType = "hide" | "report";

type FeedCardInput = {
  card_id: string;
  focus_id: string;
  card_type: FeedCardType;
  title: string;
  subtitle: string | null;
  action_path: string | null;
  metadata: Record<string, unknown> | null;
};

type FeedCardInteractionAction =
  | { action: "save"; card: FeedCardInput }
  | { action: "remove_save"; cardId: string }
  | {
      action: "share";
      card: FeedCardInput;
      channel: FeedCardInteractionChannel;
    }
  | { action: "hide"; card: FeedCardInput; reason: string | null }
  | { action: "report"; card: FeedCardInput; reason: string };

const trim = (value: string | null | undefined) => value?.trim() ?? "";

const toNullableString = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFeedCardType = (value: unknown): value is FeedCardType =>
  value === "demand" || value === "service" || value === "product";

const isInteractionChannel = (
  value: unknown,
): value is FeedCardInteractionChannel =>
  value === "native" || value === "clipboard";

const parseCard = (value: unknown): FeedCardInput | null => {
  if (!isRecord(value)) return null;

  const cardId = trim(typeof value.card_id === "string" ? value.card_id : "");
  const focusId = trim(
    typeof value.focus_id === "string" ? value.focus_id : "",
  );
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

const parseAction = (value: unknown): FeedCardInteractionAction | null => {
  if (!isRecord(value)) return null;

  if (value.action === "save") {
    const card = parseCard(value.card);
    if (!card) return null;
    return { action: "save", card };
  }

  if (value.action === "remove_save") {
    const cardId = trim(typeof value.cardId === "string" ? value.cardId : "");
    if (!cardId) return null;
    return { action: "remove_save", cardId };
  }

  if (value.action === "share") {
    const card = parseCard(value.card);
    const channel = isInteractionChannel(value.channel)
      ? value.channel
      : "native";
    if (!card) return null;
    return { action: "share", card, channel };
  }

  if (value.action === "hide") {
    const card = parseCard(value.card);
    if (!card) return null;
    return {
      action: "hide",
      card,
      reason: toNullableString(value.reason),
    };
  }

  if (value.action === "report") {
    const card = parseCard(value.card);
    const reason = trim(typeof value.reason === "string" ? value.reason : "");
    if (!card || !reason) return null;
    return { action: "report", card, reason };
  }

  return null;
};

const toErrorResponse = (status: number, message: string) =>
  NextResponse.json(
    {
      ok: false,
      message,
    },
    { status },
  );

const writeFeedback = async (
  dbClient: NonNullable<
    | ReturnType<typeof createSupabaseAdminClient>
    | ReturnType<typeof createSupabaseUserServerClient>
  >,
  userId: string,
  params: {
    card: FeedCardInput;
    feedbackType: FeedCardFeedbackType;
    reason: string | null;
  },
) => {
  return dbClient.from("feed_card_feedback").upsert(
    {
      user_id: userId,
      card_id: params.card.card_id,
      focus_id: params.card.focus_id,
      card_type: params.card.card_type,
      feedback_type: params.feedbackType,
      reason: params.reason,
      metadata: {
        title: params.card.title,
        subtitle: params.card.subtitle,
        action_path: params.card.action_path,
        ...(params.card.metadata || {}),
      },
    },
    {
      onConflict: "user_id,feedback_type,card_id",
    },
  );
};

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
    return toErrorResponse(
      400,
      "Request body does not match the feed card interaction schema.",
    );
  }

  const admin = createSupabaseAdminClient();
  const resolvedClient =
    admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!resolvedClient) {
    return toErrorResponse(
      500,
      "Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  const dbClient = resolvedClient;

  if (action.action === "save") {
    const { error } = await dbClient.from("feed_card_saves").upsert(
      {
        user_id: authResult.auth.userId,
        ...action.card,
      },
      {
        onConflict: "user_id,card_id",
      },
    );

    if (error) {
      return toErrorResponse(500, error.message || "Unable to save feed card.");
    }

    return NextResponse.json({ ok: true });
  }

  if (action.action === "remove_save") {
    const { error } = await dbClient
      .from("feed_card_saves")
      .delete()
      .eq("user_id", authResult.auth.userId)
      .eq("card_id", action.cardId);

    if (error) {
      return toErrorResponse(
        500,
        error.message || "Unable to remove feed card save.",
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action.action === "share") {
    const { error } = await dbClient.from("feed_card_shares").insert({
      user_id: authResult.auth.userId,
      card_id: action.card.card_id,
      focus_id: action.card.focus_id,
      card_type: action.card.card_type,
      title: action.card.title,
      channel: action.channel,
      metadata: {
        subtitle: action.card.subtitle,
        action_path: action.card.action_path,
        ...(action.card.metadata || {}),
      },
    });

    if (error) {
      return toErrorResponse(
        500,
        error.message || "Unable to record feed card share.",
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action.action === "hide") {
    const { error } = await writeFeedback(dbClient, authResult.auth.userId, {
      card: action.card,
      feedbackType: "hide",
      reason: action.reason,
    });

    if (error) {
      return toErrorResponse(500, error.message || "Unable to hide feed card.");
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await writeFeedback(dbClient, authResult.auth.userId, {
    card: action.card,
    feedbackType: "report",
    reason: action.reason,
  });

  if (error) {
    return toErrorResponse(500, error.message || "Unable to report feed card.");
  }

  return NextResponse.json({ ok: true });
}
