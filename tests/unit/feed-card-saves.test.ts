import { describe, expect, it } from "vitest";
import { createPendingFeedCardSave, mergeFeedCardSaves, type FeedCardSaveRecord } from "../../lib/feedCardSaves";

const buildServerRow = (overrides: Partial<FeedCardSaveRecord> = {}): FeedCardSaveRecord => ({
  id: "server-save-1",
  card_id: "welcome-help-1",
  focus_id: "help-1",
  card_type: "demand",
  title: "Need a same-day courier",
  subtitle: "A connected neighbor needs a courier today",
  action_path: "/dashboard",
  metadata: { priceLabel: "Budget INR 800" },
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  sync_state: "synced",
  ...overrides,
});

describe("feed card save helpers", () => {
  it("preserves the original pending created time when re-staging a card", () => {
    const initial = createPendingFeedCardSave({
      card_id: "welcome-help-1",
      focus_id: "help-1",
      card_type: "demand",
      title: "Need a same-day courier",
      subtitle: "A connected neighbor needs a courier today",
      action_path: "/dashboard",
      metadata: null,
    });

    const restaged = createPendingFeedCardSave(
      {
        card_id: "welcome-help-1",
        focus_id: "help-1",
        card_type: "demand",
        title: "Need a same-day courier",
        subtitle: "A connected neighbor needs a courier today",
        action_path: "/dashboard",
        metadata: null,
      },
      {
        ...initial,
        created_at: "2026-03-20T09:55:00.000Z",
      }
    );

    expect(restaged.created_at).toBe("2026-03-20T09:55:00.000Z");
    expect(restaged.sync_state).toBe("pending");
  });

  it("merges pending local saves into the saved feed while preferring server rows", () => {
    const serverRow = buildServerRow();
    const pendingOnlyRow = createPendingFeedCardSave({
      card_id: "welcome-service-2",
      focus_id: "service-2",
      card_type: "service",
      title: "Laptop repair in 2 hours",
      subtitle: "A connected provider is available nearby",
      action_path: "/dashboard",
      metadata: { priceLabel: "From INR 699" },
    }, {
      id: "local-save:welcome-service-2",
      card_id: "welcome-service-2",
      focus_id: "service-2",
      card_type: "service",
      title: "Laptop repair in 2 hours",
      subtitle: "A connected provider is available nearby",
      action_path: "/dashboard",
      metadata: { priceLabel: "From INR 699" },
      created_at: "2026-03-20T10:05:00.000Z",
      updated_at: "2026-03-20T10:05:00.000Z",
      sync_state: "pending",
    });
    const duplicatePendingRow = createPendingFeedCardSave({
      card_id: serverRow.card_id,
      focus_id: serverRow.focus_id,
      card_type: serverRow.card_type,
      title: serverRow.title,
      subtitle: serverRow.subtitle,
      action_path: serverRow.action_path,
      metadata: serverRow.metadata,
    });

    const merged = mergeFeedCardSaves([serverRow], [pendingOnlyRow, duplicatePendingRow]);

    expect(merged).toHaveLength(2);
    expect(merged[0]?.card_id).toBe(pendingOnlyRow.card_id);
    expect(merged[0]?.sync_state).toBe("pending");
    expect(merged[1]?.card_id).toBe(serverRow.card_id);
    expect(merged[1]?.id).toBe(serverRow.id);
    expect(merged[1]?.sync_state).toBe("synced");
  });
});
