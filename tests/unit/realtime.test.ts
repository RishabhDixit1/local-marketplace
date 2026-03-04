import { describe, expect, it } from "vitest";
import {
  extractPresenceUserIds,
  getConversationRealtimeChannel,
  GLOBAL_PRESENCE_CHANNEL,
} from "../../lib/realtime";

describe("realtime helpers", () => {
  it("builds conversation channel names", () => {
    expect(getConversationRealtimeChannel("conv-123")).toBe("conversation-live-conv-123");
    expect(GLOBAL_PRESENCE_CHANNEL).toBe("marketplace-global-presence");
  });

  it("extracts user ids from presence keys and meta payloads", () => {
    const state = {
      "user-key-1": [{ user_id: "user-1" }],
      "": [{ presence_ref: "fallback-ref-user" }],
      "user-key-2": [{ user_id: "user-2" }, { presence_ref: "presence-user-2" }],
      "user-key-3": [{ random: "ignored" }],
    };

    const userIds = extractPresenceUserIds(state);

    expect(Array.from(userIds).sort()).toEqual([
      "fallback-ref-user",
      "presence-user-2",
      "user-1",
      "user-2",
      "user-key-1",
      "user-key-2",
      "user-key-3",
    ]);
  });

  it("handles non-array and empty presence rows safely", () => {
    const userIds = extractPresenceUserIds({
      "user-key": null as unknown as { user_id?: string }[],
      "": [],
    });

    expect(Array.from(userIds)).toEqual(["user-key"]);
  });
});
