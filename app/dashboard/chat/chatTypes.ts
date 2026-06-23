import type { LiveTalkRequestRecord } from "@/lib/api/chat";
import { parseChatFeedContext, parseChatQuoteContext } from "@/lib/chatNavigation";

export type Conversation = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageAt: string | null;
  otherUserId: string | null;
  unreadCount: number;
  lastSenderId: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  content: string;
  sender_id: string;
  created_at: string;
  status?: "sending" | "failed";
};

export type ParticipantRow = {
  conversation_id: string;
  user_id: string;
  last_read_at?: string | null;
};

export type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export type InboxFilter = "all" | "unread";
export type ChannelHealth = "connecting" | "connected" | "reconnecting" | "error" | "offline";

export type GroupedMessages = {
  key: string;
  label: string;
  items: Message[];
};

export type FeedMessageContext = {
  source: string;
  cardId: string;
  focusId: string;
  itemType: "demand" | "service" | "product";
  title: string;
  audience: string;
  returnPath?: string | null;
};

export type RequestedQuoteContext = {
  orderId: string | null;
  helpRequestId: string | null;
  conversationId: string | null;
};

export const fallbackAvatar = "https://i.pravatar.cc/150";
export const CONVERSATION_MESSAGE_SCAN_MIN = 200;
export const CONVERSATION_MESSAGE_SCAN_MAX = 1000;
export const CONVERSATION_MESSAGE_SCAN_PER_CHAT = 40;
export const MESSAGE_HISTORY_LIMIT = 300;
export const FEED_CONTEXT_QUERY_KEYS = [
  "source",
  "context_card",
  "context_focus",
  "context_type",
  "context_title",
  "context_audience",
  "context_return",
] as const;
export const QUOTE_CONTEXT_QUERY_KEYS = ["quote", "order", "helpRequest"] as const;
export const DRAFT_CONTEXT_QUERY_KEYS = ["draft_kind", "draft_title"] as const;
export const CHAT_EMOTICONS = [
  { label: "Smile", value: "😊" },
  { label: "Big smile", value: "😁" },
  { label: "Laugh", value: "😂" },
  { label: "Rolling laughter", value: "🤣" },
  { label: "Wink", value: "😉" },
  { label: "Warm smile", value: "☺️" },
  { label: "Blush", value: "😊" },
  { label: "Happy tears", value: "🥹" },
  { label: "Love", value: "😍" },
  { label: "Heart eyes", value: "🥰" },
  { label: "Kiss", value: "😘" },
  { label: "Cool", value: "😎" },
  { label: "Thinking", value: "🤔" },
  { label: "Mind blown", value: "🤯" },
  { label: "Shocked", value: "😮" },
  { label: "Oops", value: "😅" },
  { label: "Sad", value: "😔" },
  { label: "Crying", value: "😢" },
  { label: "Relieved", value: "😌" },
  { label: "Sleepy", value: "😴" },
  { label: "Party", value: "🎉" },
  { label: "Celebrate", value: "🎉" },
  { label: "Celebrate more", value: "🥳" },
  { label: "Sparkles", value: "✨" },
  { label: "Fire", value: "🔥" },
  { label: "Star", value: "🌟" },
  { label: "Hundred", value: "💯" },
  { label: "Thumbs up", value: "👍" },
  { label: "Thumbs down", value: "👎" },
  { label: "Clap", value: "👏" },
  { label: "Raised hands", value: "🙌" },
  { label: "Thanks", value: "🙏" },
  { label: "Handshake", value: "🤝" },
  { label: "Wave", value: "👋" },
  { label: "Flex", value: "💪" },
  { label: "Heart", value: "❤️" },
  { label: "Pink heart", value: "🩷" },
  { label: "Blue heart", value: "💙" },
  { label: "Sparkle heart", value: "💖" },
  { label: "Broken heart", value: "💔" },
  { label: "Check mark", value: "✅" },
  { label: "Idea", value: "💡" },
  { label: "Rocket", value: "🚀" },
  { label: "Trophy", value: "🏆" },
  { label: "Coffee", value: "☕" },
  { label: "Camera", value: "📸" },
  { label: "Music", value: "🎵" },
  { label: "Gift", value: "🎁" },
  { label: "Smiley emoticon", value: ":)" },
  { label: "Grin emoticon", value: ":D" },
  { label: "Wink emoticon", value: ";)" },
  { label: "Love emoticon", value: "<3" },
  { label: "Unsure emoticon", value: ":/" },
  { label: "Sad emoticon", value: ":(" },
] as const;

export const decodeEmojiMojibake = (value: string) => {
  try {
    return new TextDecoder("utf-8").decode(Uint8Array.from(value, (char) => char.charCodeAt(0)));
  } catch {
    return value;
  }
};

export const CHAT_EMOJI_OPTIONS = CHAT_EMOTICONS.map((option) => ({
  ...option,
  value: option.value.startsWith(":") || option.value === "<3" ? option.value : decodeEmojiMojibake(option.value),
}));

export const CHAT_PICKER_VALUE_OVERRIDES = {
  Smile: "😊",
  "Big smile": "😁",
  Laugh: "😂",
  "Rolling laughter": "🤣",
  Wink: "😉",
  "Warm smile": "☺️",
  Blush: "😊",
  "Happy tears": "🥹",
  Love: "😍",
  "Heart eyes": "🥰",
  Kiss: "😘",
  Cool: "😎",
  Thinking: "🤔",
  "Mind blown": "🤯",
  Shocked: "😮",
  Oops: "😅",
  Sad: "😔",
  Crying: "😢",
  Relieved: "😌",
  Sleepy: "😴",
  Party: "🎉",
  Celebrate: "🎉",
  "Celebrate more": "🥳",
  Sparkles: "✨",
  Fire: "🔥",
  Star: "🌟",
  Hundred: "💯",
  "Thumbs up": "👍",
  "Thumbs down": "👎",
  Clap: "👏",
  "Raised hands": "🙌",
  Thanks: "🙏",
  Handshake: "🤝",
  Wave: "👋",
  Flex: "💪",
  Heart: "❤️",
  "Pink heart": "🩷",
  "Blue heart": "💙",
  "Sparkle heart": "💖",
  "Broken heart": "💔",
  "Check mark": "✅",
  Idea: "💡",
  Rocket: "🚀",
  Trophy: "🏆",
  Coffee: "☕",
  Camera: "📸",
  Music: "🎵",
  Gift: "🎁",
} as const;

export const CHAT_PICKER_OPTIONS = CHAT_EMOJI_OPTIONS.map((option) => ({
  ...option,
  value: CHAT_PICKER_VALUE_OVERRIDES[option.label as keyof typeof CHAT_PICKER_VALUE_OVERRIDES] || option.value,
}));

export const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

export const CHANNEL_HEALTH_STYLES: Record<
  ChannelHealth,
  {
    label: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  connected: {
    label: "Connected",
    badgeClassName: "border-emerald-300/70 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  connecting: {
    label: "Connecting",
    badgeClassName: "border-amber-300/80 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  reconnecting: {
    label: "Reconnecting",
    badgeClassName: "border-orange-300/80 bg-orange-50 text-orange-700",
    dotClassName: "bg-orange-500",
  },
  error: {
    label: "Error",
    badgeClassName: "border-rose-300/80 bg-rose-50 text-rose-700",
    dotClassName: "bg-rose-500",
  },
  offline: {
    label: "Idle",
    badgeClassName: "border-slate-300 bg-slate-100 text-slate-600",
    dotClassName: "bg-slate-400",
  },
};

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatTimeAgo = (iso: string | null) => {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const formatDayLabel = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessageDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfMessageDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return parsed.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: parsed.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

export const mapChannelHealth = (status: string): ChannelHealth => {
  if (status === "SUBSCRIBED") return "connected";
  if (status === "TIMED_OUT") return "reconnecting";
  if (status === "CHANNEL_ERROR") return "error";
  if (status === "CLOSED") return "offline";
  return "connecting";
};

export const mapLiveTalkRow = (row: Record<string, unknown> | null | undefined): LiveTalkRequestRecord | null => {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const conversationId = typeof row?.conversation_id === "string" ? row.conversation_id.trim() : "";
  const callerId = typeof row?.caller_id === "string" ? row.caller_id.trim() : "";
  const recipientId = typeof row?.recipient_id === "string" ? row.recipient_id.trim() : "";
  const status = typeof row?.status === "string" ? row.status.trim().toLowerCase() : "pending";
  if (!id || !conversationId || !callerId || !recipientId) return null;
  return {
    id,
    conversation_id: conversationId,
    caller_id: callerId,
    recipient_id: recipientId,
    status:
      status === "accepted" || status === "declined" || status === "ended" || status === "cancelled"
        ? status
        : "pending",
    mode: "audio_video" as const,
    created_at: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    responded_at: typeof row?.responded_at === "string" ? row.responded_at : null,
    metadata:
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
};

export const buildChatRouteHref = (params: URLSearchParams) => {
  const query = params.toString();
  return query ? `/dashboard/chat?${query}` : "/dashboard/chat";
};

export const clearChatRouteContext = (params: URLSearchParams) => {
  [...FEED_CONTEXT_QUERY_KEYS, ...QUOTE_CONTEXT_QUERY_KEYS, ...DRAFT_CONTEXT_QUERY_KEYS].forEach((key) => {
    params.delete(key);
  });
  return params;
};

export const normalizeFeedContext = (searchParams: URLSearchParams): FeedMessageContext | null => {
  const parsed = parseChatFeedContext(searchParams);
  if (!parsed) return null;
  return {
    source: parsed.source,
    cardId: parsed.cardId,
    focusId: parsed.focusId,
    itemType: parsed.itemType,
    title: parsed.title,
    audience: parsed.audience || "Marketplace feed",
    returnPath: parsed.returnPath,
  };
};

export const buildFeedContextKey = (value: FeedMessageContext | null) =>
  value
    ? [
        value.source,
        value.cardId,
        value.focusId,
        value.itemType,
        value.title,
        value.audience,
        value.returnPath || "",
      ].join("::")
    : "";

export const normalizeQuoteTarget = (
  searchParams: URLSearchParams,
  conversationId: string | null,
): RequestedQuoteContext | null => {
  const parsed = parseChatQuoteContext(searchParams);
  if (!parsed) return null;
  return {
    orderId: parsed.orderId || null,
    helpRequestId: parsed.helpRequestId || null,
    conversationId,
  };
};

export const buildQuoteTargetKey = (value: RequestedQuoteContext | null) =>
  value ? [value.orderId || "", value.helpRequestId || "", value.conversationId || ""].join("::") : "";
