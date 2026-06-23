import type { RealtimeChannel } from "@supabase/supabase-js";

export const GLOBAL_PRESENCE_CHANNEL = "marketplace-global-presence";

export const getConversationRealtimeChannel = (conversationId: string) =>
  `conversation-live-${conversationId}`;

export function subscribeWithAutoRetry(
  channel: RealtimeChannel,
  onStatus: (status: string) => void,
  options?: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number }
) {
  const { maxRetries = Infinity, baseDelayMs = 1000, maxDelayMs = 30000 } = options ?? {};
  let retries = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const doSubscribe = () => {
    if (cancelled) return;
    channel.subscribe((status) => {
      onStatus(status);
      if (status === "SUBSCRIBED") {
        retries = 0;
        return;
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        if (retries < maxRetries) {
          retries++;
          const delay = Math.min(baseDelayMs * Math.pow(2, retries - 1), maxDelayMs);
          timer = setTimeout(doSubscribe, delay);
        }
      }
    });
  };

  doSubscribe();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

export type TypingEventPayload = {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  sent_at: string;
};

type PresenceMeta = {
  user_id?: string;
  presence_ref?: string;
  [key: string]: unknown;
};

type PresenceState = Record<string, PresenceMeta[]>;

export const extractPresenceUserIds = (state: PresenceState) => {
  const userIds = new Set<string>();

  for (const [key, value] of Object.entries(state)) {
    if (key) {
      userIds.add(key);
    }

    const metas = Array.isArray(value) ? value : [];
    metas.forEach((meta) => {
      const fromMeta =
        (typeof meta?.user_id === "string" && meta.user_id) ||
        (typeof meta?.presence_ref === "string" && meta.presence_ref) ||
        null;

      if (fromMeta) {
        userIds.add(fromMeta);
      }
    });
  }

  return userIds;
};
