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

  if (entityType === "conversation") {
    const conversationId = notification.entity_id || (notification.metadata?.conversation_id as string | undefined);
    return {
      ctaLabel: "Open chat",
      href: conversationId ? `/dashboard/chat?open=${conversationId}` : "/dashboard/chat",
    };
  }

  if (entityType === "order") {
    return {
      ctaLabel: "Open task",
      href: "/dashboard/tasks",
    };
  }

  if (entityType === "review") {
    return {
      ctaLabel: "View profile",
      href: "/dashboard/profile",
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
