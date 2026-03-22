export type NotificationKind = "order" | "message" | "review" | "system";

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
  ];
};

export const resolveNotificationAction = (notification: NotificationRow): NotificationAction => {
  const entityType = (notification.entity_type || "").toLowerCase();
  const explicitHref = readMetadataString(notification, ["href", "path", "action_path"]);

  if (explicitHref) {
    return {
      ctaLabel: "Open",
      href: explicitHref,
    };
  }

  if (entityType === "conversation") {
    const conversationId =
      notification.entity_id || readMetadataString(notification, ["conversation_id", "conversationId"]);
    return {
      ctaLabel: "Open chat",
      href: withQuery("/dashboard/chat", { open: conversationId }),
    };
  }

  if (entityType === "order") {
    const orderId = notification.entity_id || readMetadataString(notification, ["order_id", "orderId", "task_id"]);
    return {
      ctaLabel: "Open task",
      href: withQuery("/dashboard/tasks", { focus: orderId }),
    };
  }

  if (entityType === "review") {
    return {
      ctaLabel: "View profile",
      href: "/dashboard/profile",
    };
  }

  if (entityType === "help_request") {
    const helpRequestId = notification.entity_id || readMetadataString(notification, ["help_request_id", "helpRequestId"]);
    return {
      ctaLabel: "View matches",
      href: withQuery("/dashboard", {
        focus: helpRequestId,
        source: "notification",
      }),
    };
  }

  if (entityType === "connection_request") {
    const requesterId = readMetadataString(notification, ["requester_id", "requesterId"]);
    return {
      ctaLabel: "Open people",
      href: withQuery("/dashboard/people", { provider: requesterId }),
    };
  }

  if (entityType === "live_talk_request") {
    const conversationId = readMetadataString(notification, ["conversation_id", "conversationId"]);

    return {
      ctaLabel: "Open chat",
      href: withQuery("/dashboard/chat", { open: conversationId }),
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
  return "system";
};
