export type NotificationKind = "order" | "message" | "review" | "system" | "connection";

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  cleared_at: string | null;
  created_at: string;
};

export type NotificationAction = {
  ctaLabel: string;
  href: string;
};

const conversationEntityTypes = new Set([
  "conversation",
  "message",
  "chat",
  "conversation_message",
  "direct_message",
]);

const orderEntityTypes = new Set(["order", "task", "order_update", "quote", "quote_draft"]);
const helpRequestEntityTypes = new Set(["help_request", "need", "request"]);
const connectionEntityTypes = new Set(["connection_request", "connection"]);
const liveTalkEntityTypes = new Set(["live_talk_request", "live_talk"]);

const readMetadataString = (notification: NotificationRow, keys: string[]) => {
  for (const key of keys) {
    const value = notification.metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const withQuery = (pathname: string, params: Record<string, string | null | undefined>) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      search.set(key, value.trim());
    }
  });

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
};

const isoMinutesAgo = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

export const getDemoNotifications = (userId: string): NotificationRow[] => {
  const ownerId = userId || "demo-user";

  return [
    {
      id: "demo-notification-order-accepted",
      user_id: ownerId,
      kind: "order",
      title: "Order accepted",
      message: "A provider accepted your latest request and started preparation.",
      entity_type: "order",
      entity_id: null,
      metadata: { source: "demo" },
      read_at: null,
      cleared_at: null,
      created_at: isoMinutesAgo(2),
    },
    {
      id: "demo-notification-message",
      user_id: ownerId,
      kind: "message",
      title: "New message in chat",
      message: "You received a new reply from a provider. Open chat to continue.",
      entity_type: "conversation",
      entity_id: null,
      metadata: { source: "demo" },
      read_at: null,
      cleared_at: null,
      created_at: isoMinutesAgo(7),
    },
    {
      id: "demo-notification-review",
      user_id: ownerId,
      kind: "review",
      title: "New review posted",
      message: "A recent order got reviewed. Check your profile insights.",
      entity_type: "review",
      entity_id: null,
      metadata: { source: "demo" },
      read_at: isoMinutesAgo(20),
      cleared_at: null,
      created_at: isoMinutesAgo(24),
    },
    {
      id: "demo-notification-connection",
      user_id: ownerId,
      kind: "connection",
      title: "New connection request",
      message: "Someone nearby wants to connect. Accept or decline in the People tab.",
      entity_type: "connection_request",
      entity_id: null,
      metadata: { source: "demo" },
      read_at: null,
      cleared_at: null,
      created_at: isoMinutesAgo(15),
    },
  ];
};

export const resolveNotificationAction = (notification: NotificationRow): NotificationAction => {
  const entityType = (notification.entity_type || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const explicitHref = readMetadataString(notification, ["href", "path", "action_path"]);
  const conversationId = notification.entity_id || readMetadataString(notification, ["conversation_id", "conversationId"]);
  const orderId = notification.entity_id || readMetadataString(notification, ["order_id", "orderId", "task_id"]);
  const helpRequestId =
    notification.entity_id ||
    readMetadataString(notification, [
      "help_request_id",
      "helpRequestId",
      "target_help_request_id",
      "targetHelpRequestId",
    ]);
  const requesterId = readMetadataString(notification, ["requester_id", "requesterId"]);

  if (explicitHref) {
    return {
      ctaLabel: "Open",
      href: explicitHref,
    };
  }

  if (conversationEntityTypes.has(entityType) || (notification.kind === "message" && conversationId)) {
    return {
      ctaLabel: "Open chat",
      href: withQuery("/dashboard/chat", { open: conversationId, source: "notification" }),
    };
  }

  if (orderEntityTypes.has(entityType) || notification.kind === "order") {
    return {
      ctaLabel: "Open task",
      href: withQuery("/dashboard/tasks", { focus: orderId, source: "notification" }),
    };
  }

  if (entityType === "review") {
    return {
      ctaLabel: "View profile",
      href: withQuery("/dashboard/profile", { source: "notification" }),
    };
  }

  if (helpRequestEntityTypes.has(entityType)) {
    return {
      ctaLabel: "View matches",
      href: withQuery("/dashboard/tasks", { tab: "inbox", focus: helpRequestId, source: "notification" }),
    };
  }

  if (connectionEntityTypes.has(entityType) || notification.kind === "connection") {
    return {
      ctaLabel: "View request",
      href: withQuery("/dashboard/people", {
        panel: "incoming",
        provider: requesterId || null,
        source: "notification",
      }),
    };
  }

  if (liveTalkEntityTypes.has(entityType)) {
    return {
      ctaLabel: "Open chat",
      href: withQuery("/dashboard/chat", { open: conversationId, source: "notification" }),
    };
  }

  return {
    ctaLabel: "View",
    href: "/dashboard/welcome",
  };
};

export const getNotificationKind = (kind: string | null | undefined): NotificationKind => {
  const normalized = (kind || "").toLowerCase();
  if (normalized === "order") return "order";
  if (normalized === "message") return "message";
  if (normalized === "review") return "review";
  if (normalized === "connection" || normalized === "connection_request") return "connection";
  return "system";
};
