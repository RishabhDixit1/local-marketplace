export const GLOBAL_PRESENCE_CHANNEL = "marketplace-global-presence";

export const getConversationRealtimeChannel = (conversationId: string) =>
  `conversation-live-${conversationId}`;

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
