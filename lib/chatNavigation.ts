export type ChatFeedSource = "posts_feed" | "welcome_feed" | "saved_feed" | "public_profile";

export type ChatFeedItemType = "demand" | "service" | "product";

export type ChatFeedContext = {
  source: ChatFeedSource;
  cardId: string;
  focusId: string;
  itemType: ChatFeedItemType;
  title: string;
  audience?: string | null;
  returnPath?: string | null;
};

export type ChatQuoteContext = {
  helpRequestId?: string | null;
  orderId?: string | null;
};

export type ChatDraftTemplate = {
  kind: "interest";
  title: string;
};

const CHAT_FEED_SOURCES = new Set<ChatFeedSource>(["posts_feed", "welcome_feed", "saved_feed", "public_profile"]);

const CHAT_FEED_AUDIENCE_LABELS: Record<ChatFeedSource, string> = {
  posts_feed: "Marketplace feed",
  welcome_feed: "Your local network",
  saved_feed: "Saved feed",
  public_profile: "Public profile",
};

const trim = (value?: string | null) => (typeof value === "string" ? value.trim() : "");

const normalizeReturnPath = (value?: string | null) => {
  const normalized = trim(value);
  if (!normalized.startsWith("/")) return null;
  return normalized;
};

export const isChatFeedSource = (value?: string | null): value is ChatFeedSource =>
  CHAT_FEED_SOURCES.has(trim(value) as ChatFeedSource);

export const getChatFeedAudienceLabel = (source: ChatFeedSource, fallback?: string | null) =>
  trim(fallback) || CHAT_FEED_AUDIENCE_LABELS[source];

export const buildInterestDraftMessage = (title: string) => `Hi, I am interested in "${title}". Is it still available?`;

export const parseChatDraftTemplate = (params: URLSearchParams): ChatDraftTemplate | null => {
  const kind = trim(params.get("draft_kind"));
  if (kind !== "interest") return null;

  const title = trim(params.get("draft_title"));
  if (!title) return null;

  return {
    kind: "interest",
    title,
  };
};

export const parseChatFeedContext = (params: URLSearchParams): ChatFeedContext | null => {
  const source = trim(params.get("source"));
  if (!isChatFeedSource(source)) return null;

  const cardId = trim(params.get("context_card"));
  const focusId = trim(params.get("context_focus")) || trim(params.get("focus"));
  const itemType = trim(params.get("context_type")) || trim(params.get("type"));
  const title = trim(params.get("context_title"));

  if (!cardId || !focusId || !title) return null;
  if (itemType !== "demand" && itemType !== "service" && itemType !== "product") return null;

  return {
    source,
    cardId,
    focusId,
    itemType,
    title,
    audience: getChatFeedAudienceLabel(source, params.get("context_audience")),
    returnPath: normalizeReturnPath(params.get("context_return")),
  };
};

export const buildChatConversationPath = (params: {
  conversationId: string;
  feedContext?: ChatFeedContext | null;
  quoteContext?: ChatQuoteContext | null;
  draftTemplate?: ChatDraftTemplate | null;
}) => {
  const searchParams = new URLSearchParams({
    open: params.conversationId,
  });

  if (params.feedContext) {
    searchParams.set("source", params.feedContext.source);
    searchParams.set("context_card", params.feedContext.cardId);
    searchParams.set("context_focus", params.feedContext.focusId);
    searchParams.set("context_type", params.feedContext.itemType);
    searchParams.set("context_title", params.feedContext.title);

    const audience = trim(params.feedContext.audience);
    if (audience) {
      searchParams.set("context_audience", audience);
    }

    const returnPath = normalizeReturnPath(params.feedContext.returnPath);
    if (returnPath) {
      searchParams.set("context_return", returnPath);
    }
  }

  if (params.quoteContext?.helpRequestId || params.quoteContext?.orderId) {
    searchParams.set("quote", "1");

    const helpRequestId = trim(params.quoteContext.helpRequestId);
    const orderId = trim(params.quoteContext.orderId);
    if (helpRequestId) {
      searchParams.set("helpRequest", helpRequestId);
    }
    if (orderId) {
      searchParams.set("order", orderId);
    }
  }

  if (params.draftTemplate?.kind === "interest" && trim(params.draftTemplate.title)) {
    searchParams.set("draft_kind", "interest");
    searchParams.set("draft_title", params.draftTemplate.title);
  }

  return `/dashboard/chat?${searchParams.toString()}`;
};
