import { describe, expect, it } from "vitest";
import { blendWelcomeFeedCards, buildWelcomeDemoFeedCards, buildWelcomeFeedCards } from "../../lib/welcomeFeed";
import type { CommunityFeedResponse } from "../../lib/api/community";

const buildSnapshot = (overrides: Partial<Extract<CommunityFeedResponse, { ok: true }>> = {}) =>
  ({
    ok: true,
    currentUserId: "viewer-1",
    acceptedConnectionIds: [],
    currentUserProfile: {
      id: "viewer-1",
      name: "Viewer",
      latitude: 12.9716,
      longitude: 77.5946,
      role: "customer",
    },
    services: [],
    products: [],
    posts: [],
    helpRequests: [],
    profiles: [
      {
        id: "viewer-1",
        name: "Viewer",
        latitude: 12.9716,
        longitude: 77.5946,
      },
      {
        id: "peer-1",
        name: "Peer One",
        latitude: 12.972,
        longitude: 77.595,
      },
      {
        id: "peer-2",
        name: "Peer Two",
        latitude: 28.6139,
        longitude: 77.209,
      },
    ],
    reviews: [],
    presence: [],
    ...overrides,
  }) satisfies Extract<CommunityFeedResponse, { ok: true }>;

describe("welcome feed builder", () => {
  it("creates preview cards for welcome stories and feed visualization", () => {
    const demoCards = buildWelcomeDemoFeedCards();

    expect(demoCards.length).toBeGreaterThanOrEqual(6);
    expect(demoCards.every((card) => card.isDemo)).toBe(true);
    expect(new Set(demoCards.map((card) => card.id)).size).toBe(demoCards.length);
  });

  it("blends live cards first and fills the remainder with preview cards", () => {
    const liveCards = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
        posts: [
          {
            id: "post-visible",
            user_id: "peer-1",
            text: "Need a local plumber | Budget: 1200 | Category: Plumbing | Type: demand",
            created_at: "2026-03-12T12:30:00.000Z",
          },
        ],
      })
    ).cards;

    const blendedCards = blendWelcomeFeedCards(liveCards, {
      minimumCardCount: 4,
      demoCards: buildWelcomeDemoFeedCards(),
    });

    expect(blendedCards).toHaveLength(4);
    expect(blendedCards[0]?.focusId).toBe("post-visible");
    expect(blendedCards.slice(1).every((card) => card.isDemo)).toBe(true);
  });

  it("returns an explicit empty state when the viewer has no accepted connections", () => {
    const result = buildWelcomeFeedCards(buildSnapshot());

    expect(result.cards).toEqual([]);
    expect(result.emptyReason).toBe("no_connections");
  });

  it("shows only connected-user content and sorts newest items first", () => {
    const result = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
        posts: [
          {
            id: "post-visible",
            user_id: "peer-1",
            text: "Need a local plumber | Budget: 1200 | Category: Plumbing | Type: demand",
            created_at: "2026-03-12T12:30:00.000Z",
          },
          {
            id: "post-hidden",
            user_id: "peer-2",
            text: "Hidden post | Budget: 900 | Category: Repairs | Type: demand",
            created_at: "2026-03-12T12:45:00.000Z",
          },
        ],
        services: [
          {
            id: "service-visible",
            provider_id: "peer-1",
            title: "AC servicing",
            description: "Cooling support",
            price: 799,
            category: "Repair",
            created_at: "2026-03-12T12:40:00.000Z",
          },
        ],
        helpRequests: [
          {
            id: "help-visible",
            requester_id: "peer-1",
            title: "Need same-day mover",
            details: "Small apartment move",
            budget_max: 2500,
            category: "Moving",
            urgency: "urgent",
            created_at: "2026-03-12T12:50:00.000Z",
          },
        ],
      })
    );

    expect(result.emptyReason).toBeNull();
    expect(result.cards.map((card) => card.focusId)).toEqual([
      "help-visible",
      "service-visible",
      "post-visible",
    ]);
    expect(result.cards.every((card) => card.ownerId === "peer-1")).toBe(true);
  });

  it("returns a connected-but-empty state when peers exist without shareable content", () => {
    const result = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
      })
    );

    expect(result.cards).toEqual([]);
    expect(result.emptyReason).toBe("no_connected_content");
  });
});
