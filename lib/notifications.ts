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
