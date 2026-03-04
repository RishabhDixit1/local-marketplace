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
    expect(rows).toHaveLength(3);
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
      href: "/dashboard/chat?open=conv-1",
    });
  });

  it("resolves conversation actions using metadata fallback", () => {
    const action = resolveNotificationAction(
      baseNotification({
        entity_type: "conversation",
        metadata: { conversation_id: "conv-2" },
      })
    );

    expect(action.href).toBe("/dashboard/chat?open=conv-2");
  });

  it("resolves order, review, and help request actions", () => {
    expect(resolveNotificationAction(baseNotification({ entity_type: "order" }))).toEqual({
      ctaLabel: "Open task",
      href: "/dashboard/tasks",
    });

    expect(resolveNotificationAction(baseNotification({ entity_type: "review" }))).toEqual({
      ctaLabel: "View profile",
      href: "/dashboard/profile",
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
      href: "/dashboard?help_request=help-1",
    });
  });

  it("falls back to welcome feed for unknown entities", () => {
    expect(resolveNotificationAction(baseNotification({ entity_type: "unknown" }))).toEqual({
      ctaLabel: "View",
      href: "/dashboard/welcome",
    });
  });

  it("normalizes notification kind", () => {
    expect(getNotificationKind("order")).toBe("order");
    expect(getNotificationKind("message")).toBe("message");
    expect(getNotificationKind("review")).toBe("review");
    expect(getNotificationKind("anything-else")).toBe("system");
    expect(getNotificationKind(null)).toBe("system");
  });
});
