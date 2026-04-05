import { describe, expect, it } from "vitest";
import { blendWelcomeFeedCards, buildWelcomeDemoFeedCards, buildWelcomeFeedCards } from "../../lib/welcomeFeed";
import type { CommunityFeedResponse } from "../../lib/api/community";
import type { MarketplaceFeedItem } from "../../lib/marketplaceFeed";

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
    feedItems: [],
    feedStats: {
      total: 0,
      urgent: 0,
      demand: 0,
      service: 0,
      product: 0,
    },
    mapCenter: {
      lat: 12.9716,
      lng: 77.5946,
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
    orderStats: [],
    ...overrides,
  }) satisfies Extract<CommunityFeedResponse, { ok: true }>;

const buildFeedItem = (overrides: Partial<MarketplaceFeedItem> = {}): MarketplaceFeedItem => ({
  id: "feed-item-1",
  source: "post",
  helpRequestId: null,
  providerId: "peer-1",
  type: "demand",
  title: "Need a local plumber",
  description: "Urgent plumbing support",
  category: "Plumbing",
  price: 1200,
  avatarUrl: "https://cdn.example.com/avatar.png",
  creatorName: "Peer One",
  creatorUsername: "peer-one",
  locationLabel: "Koramangala",
  distanceKm: 2.1,
  lat: 12.9352,
  lng: 77.6245,
  coordinateAccuracy: "approximate",
  media: [],
  createdAt: "2026-03-12T12:30:00.000Z",
  urgent: true,
  rankScore: 78,
  profileCompletion: 86,
  responseMinutes: 18,
  verificationStatus: "verified",
  publicProfilePath: "/profile/peer-one-peer-1",
  status: "open",
  acceptedProviderId: null,
  ...overrides,
});

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

  it("collapses mirrored need rows into a single welcome card", () => {
    const mirroredMetadata = {
      source: "serviq_compose",
      postType: "need",
      publishGroupKey: "serviq:demand:dryclean-123",
      title: "Need a dryclean service",
      details: "Pickup and wash",
      category: "Laundry",
      budget: 1200,
      locationLabel: "Indiranagar",
      radiusKm: 8,
      mode: "urgent",
      neededWithin: "today",
      scheduleDate: "",
      scheduleTime: "",
      flexibleTiming: true,
      attachmentCount: 0,
      media: [],
    };

    const result = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
        posts: [
        {
          id: "post-mirrored",
          user_id: "peer-1",
          title: "Need a dryclean service",
          text: "Need a dryclean service | Need a pickup and wash | Type: demand | Category: Laundry",
            description: "Need a dryclean service | Need a pickup and wash | Type: demand | Category: Laundry",
            metadata: mirroredMetadata,
            created_at: "2026-03-12T18:30:00.000Z",
          },
        ],
        helpRequests: [
        {
          id: "help-mirrored",
          requester_id: "peer-1",
          title: "Dryclean pickup",
          details: "Pickup and wash",
          category: "Laundry",
          budget_max: 1200,
            metadata: {
              ...mirroredMetadata,
              source: "api_needs_publish",
            },
            created_at: "2026-03-12T12:30:20.000Z",
          },
        ],
      })
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.source).toBe("help_request");
    expect(result.cards[0]?.focusId).toBe("help-mirrored");
    expect(result.cards[0]?.title).toBe("Dryclean pickup");
    expect(result.cards[0]?.summary).toBe("Pickup and wash");
  });

  it("prefers uploaded media from live post metadata before seeded fallback visuals", () => {
    const result = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
        posts: [
          {
            id: "post-with-media",
            user_id: "peer-1",
            text: "Need a photographer | Budget: 3500 | Category: Events | Type: demand",
            metadata: {
              source: "serviq_compose",
              postType: "need",
              title: "Need a photographer",
              details: "Birthday event this Saturday",
              category: "Events",
              budget: 3500,
              locationLabel: "Koramangala",
              radiusKm: 8,
              mode: "urgent",
              neededWithin: "today",
              scheduleDate: "",
              scheduleTime: "",
              flexibleTiming: true,
              attachmentCount: 1,
              media: [
                {
                  name: "birthday.jpg",
                  url: "https://cdn.example.com/uploads/birthday.jpg",
                  type: "image/jpeg",
                },
              ],
            },
            created_at: "2026-03-12T12:30:00.000Z",
          },
        ],
      })
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.image).toBe("https://cdn.example.com/uploads/birthday.jpg");
    expect(result.cards[0]?.media).toEqual([
      {
        mimeType: "image/jpeg",
        url: "https://cdn.example.com/uploads/birthday.jpg",
      },
    ]);
  });

  it("keeps the full uploaded image gallery for connected welcome cards", () => {
    const result = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
        posts: [
          {
            id: "post-with-gallery",
            user_id: "peer-1",
            text: "Ciaz on sale 2018 model | Budget: 350000 | Category: Cars | Type: product",
            metadata: {
              source: "serviq_compose",
              postType: "product",
              title: "Ciaz on sale 2018 model",
              details: "Urgent sale",
              category: "Cars",
              budget: 350000,
              attachmentCount: 4,
              media: [
                { name: "car-1.jpg", url: "https://cdn.example.com/uploads/car-1.jpg", type: "image/jpeg" },
                { name: "car-2.jpg", url: "https://cdn.example.com/uploads/car-2.jpg", type: "image/jpeg" },
                { name: "car-3.jpg", url: "https://cdn.example.com/uploads/car-3.jpg", type: "image/jpeg" },
                { name: "car-4.jpg", url: "https://cdn.example.com/uploads/car-4.jpg", type: "image/jpeg" },
              ],
            },
            created_at: "2026-03-12T12:31:00.000Z",
          },
        ],
      })
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.media.map((entry) => entry.url)).toEqual([
      "https://cdn.example.com/uploads/car-1.jpg",
      "https://cdn.example.com/uploads/car-2.jpg",
      "https://cdn.example.com/uploads/car-3.jpg",
      "https://cdn.example.com/uploads/car-4.jpg",
    ]);
  });

  it("uses a generated live placeholder instead of seeded demo art when no upload exists", () => {
    const result = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
        services: [
          {
            id: "service-no-media",
            provider_id: "peer-1",
            title: "Quick appliance diagnostics",
            description: "Live service without an uploaded cover image",
            price: 999,
            category: "Repair",
            created_at: "2026-03-12T12:40:00.000Z",
          },
        ],
      })
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.image.startsWith("data:image/svg+xml")).toBe(true);
    expect(result.cards[0]?.image.includes("unsplash.com")).toBe(false);
  });

  it("reuses live feed map coordinates for connected welcome cards", () => {
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
        ],
        feedItems: [
          buildFeedItem({
            id: "feed-post-visible",
            linkedPostId: "post-visible",
            canonicalKey: undefined,
            locationLabel: "Koramangala, Bengaluru",
            lat: 12.9341,
            lng: 77.6113,
            coordinateAccuracy: "approximate",
          }),
        ],
      })
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      lat: 12.9341,
      lng: 77.6113,
      coordinateAccuracy: "approximate",
      locationLabel: "Koramangala, Bengaluru",
    });
  });

  it("falls back to owner profile coordinates when a matching feed pin is unavailable", () => {
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
        ],
      })
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      lat: 12.972,
      lng: 77.595,
      coordinateAccuracy: "precise",
    });
  });

  it("ignores persisted seeded image urls on live listings and falls back to the live placeholder", () => {
    const result = buildWelcomeFeedCards(
      buildSnapshot({
        acceptedConnectionIds: ["peer-1"],
        products: [
          {
            id: "product-seeded-image",
            provider_id: "peer-1",
            title: "Neighborhood resale item",
            description: "Legacy demo image should not surface in welcome feed",
            price: 1800,
            category: "Home",
            image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80",
            created_at: "2026-03-12T12:50:00.000Z",
          },
        ],
      })
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.image.startsWith("data:image/svg+xml")).toBe(true);
    expect(result.cards[0]?.image.includes("unsplash.com")).toBe(false);
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
