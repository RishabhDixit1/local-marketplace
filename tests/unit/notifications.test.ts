import { describe, expect, it } from "vitest";
import {
  getDemoNotifications,
  getNotificationKind,
  resolveNotificationAction,
  type NotificationRow,
} from "../../lib/notifications";

const baseNotification = (overrides: Partial<NotificationRow>): NotificationRow => ({
  id: "n-1",
  user_id: "user-1",
  kind: "system",
  title: "Title",
  message: "Message",
  entity_type: null,
  entity_id: null,
  metadata: null,
  read_at: null,
  cleared_at: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("notifications", () => {
  it("builds demo notifications for the current user", () => {
    const rows = getDemoNotifications("user-123");
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.user_id === "user-123")).toBe(true);
    expect(rows[0].created_at <= rows[1].created_at).toBe(false);
  });

  it("falls back demo user id when none is provided", () => {
    const rows = getDemoNotifications("");
    expect(rows.every((row) => row.user_id === "demo-user")).toBe(true);
  });

  it("resolves conversation actions using entity id", () => {
    const action = resolveNotificationAction(
      baseNotification({
        entity_type: "conversation",
        entity_id: "conv-1",
      })
    );

    expect(action).toEqual({
      ctaLabel: "Open chat",
      href: "/dashboard/chat?open=conv-1&source=notification",
    });
  });

  it("resolves conversation actions using metadata fallback", () => {
    const action = resolveNotificationAction(
      baseNotification({
        entity_type: "conversation",
        metadata: { conversation_id: "conv-2" },
      })
    );

    expect(action.href).toBe("/dashboard/chat?open=conv-2&source=notification");
  });

  it("resolves order, review, and help request actions", () => {
    expect(resolveNotificationAction(baseNotification({ entity_type: "order", entity_id: "order-1" }))).toEqual({
      ctaLabel: "Open task",
      href: "/dashboard/tasks?focus=order-1&source=notification",
    });

    expect(resolveNotificationAction(baseNotification({ entity_type: "review" }))).toEqual({
      ctaLabel: "View profile",
      href: "/dashboard/profile?source=notification",
    });

    expect(
      resolveNotificationAction(
        baseNotification({
          entity_type: "help_request",
          metadata: { help_request_id: "help-1" },
        })
      )
    ).toEqual({
      ctaLabel: "View matches",
      href: "/dashboard/tasks?tab=inbox&focus=help-1&source=notification",
    });
  });

  it("resolves connection request and live talk actions", () => {
    expect(
      resolveNotificationAction(
        baseNotification({
          entity_type: "connection_request",
          metadata: { requester_id: "provider-7" },
        })
      )
    ).toEqual({
      ctaLabel: "View request",
      href: "/dashboard/people?panel=incoming&provider=provider-7&source=notification",
    });

    expect(
      resolveNotificationAction(
        baseNotification({
          entity_type: "live_talk_request",
          metadata: { conversation_id: "conv-live-1" },
        })
      )
    ).toEqual({
      ctaLabel: "Open chat",
      href: "/dashboard/chat?open=conv-live-1&source=notification",
    });
  });

  it("treats message-style entity aliases as chat actions", () => {
    expect(
      resolveNotificationAction(
        baseNotification({
          entity_type: "message",
          metadata: { conversation_id: "conv-msg-1" },
        })
      )
    ).toEqual({
      ctaLabel: "Open chat",
      href: "/dashboard/chat?open=conv-msg-1&source=notification",
    });
  });

  it("falls back to welcome feed for unknown entities", () => {
    expect(resolveNotificationAction(baseNotification({ entity_type: "unknown" }))).toEqual({
      ctaLabel: "View",
      href: "/dashboard/welcome",
    });
  });

  it("prefers explicit metadata hrefs when available", () => {
    expect(
      resolveNotificationAction(
        baseNotification({
          entity_type: "order",
          metadata: { href: "/dashboard/tasks?focus=task-99&source=notification" },
        })
      )
    ).toEqual({
      ctaLabel: "Open",
      href: "/dashboard/tasks?focus=task-99&source=notification",
    });
  });

  it("normalizes notification kind", () => {
    expect(getNotificationKind("order")).toBe("order");
    expect(getNotificationKind("message")).toBe("message");
    expect(getNotificationKind("review")).toBe("review");
    expect(getNotificationKind("connection")).toBe("connection");
    expect(getNotificationKind("anything-else")).toBe("system");
    expect(getNotificationKind(null)).toBe("system");
  });
});
