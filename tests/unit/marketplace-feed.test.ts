import { describe, expect, it } from "vitest";
import {
  buildMarketplaceDisplayItem,
  dedupeMarketplaceFeedItems,
  matchesMarketplaceFeedFilters,
  type MarketplaceFeedItem,
} from "../../lib/marketplaceFeed";

const baseItem: MarketplaceFeedItem = {
  id: "feed-1",
  source: "post",
  helpRequestId: null,
  providerId: "provider-1",
  type: "service",
  title: "Electrical repair visit",
  description: "Nearby support for switchboard and wiring issues",
  category: "Electrical",
  price: 1600,
  avatarUrl: "",
  creatorName: "Asha Repairs",
  creatorUsername: "asha-repairs",
  locationLabel: "Indiranagar",
  distanceKm: 2.1,
  lat: 12.97,
  lng: 77.64,
  media: [],
  createdAt: "2026-03-24T10:00:00.000Z",
  urgent: false,
  rankScore: 88,
  profileCompletion: 86,
  responseMinutes: 9,
  verificationStatus: "verified",
  publicProfilePath: "/profile/asha-repairs-provider-1",
  status: "open",
  acceptedProviderId: null,
};

describe("marketplace feed helpers", () => {
  it("builds display-safe feed cards", () => {
    const display = buildMarketplaceDisplayItem({
      ...baseItem,
      title: "",
      description: "demo placeholder",
      creatorName: "",
      creatorUsername: "",
    });

    expect(display.displayTitle).toBe("Electrical service");
    expect(display.displayDescription).toBe("Trusted listing from your local marketplace.");
    expect(display.displayCreator).toBe("Local provider");
    expect(display.priceLabel).toBe("INR 1,600");
    expect(display.distanceLabel).toBe("2.1 km away");
  });

  it("prefers the readable creator name over the generated username", () => {
    const display = buildMarketplaceDisplayItem({
      ...baseItem,
      creatorName: "Shriyam Gupta",
      creatorUsername: "shriyamgupta99",
    });

    expect(display.displayCreator).toBe("Shriyam Gupta");
  });

  it("matches query and advanced filters consistently", () => {
    expect(
      matchesMarketplaceFeedFilters(baseItem, {
        query: "electrical wiring",
        category: "all",
        type: "all",
        maxDistanceKm: 0,
        urgentOnly: false,
        mediaOnly: false,
        verifiedOnly: false,
        freshOnly: false,
      })
    ).toBe(true);

    expect(
      matchesMarketplaceFeedFilters(baseItem, {
        query: "",
        category: "product",
        type: "all",
        maxDistanceKm: 0,
        urgentOnly: false,
        mediaOnly: false,
        verifiedOnly: false,
        freshOnly: false,
      })
    ).toBe(false);

    expect(
      matchesMarketplaceFeedFilters(
        {
          ...baseItem,
          media: [{ mimeType: "image/jpeg", url: "https://example.com/image.jpg" }],
          urgent: true,
        },
        {
          query: "",
          category: "all",
          type: "all",
          maxDistanceKm: 5,
          urgentOnly: true,
          mediaOnly: true,
          verifiedOnly: true,
          freshOnly: false,
        }
      )
    ).toBe(true);
  });

  it("collapses mirrored feed rows that represent the same logical post", () => {
    const postItem: MarketplaceFeedItem = {
      ...baseItem,
      id: "post-1",
      source: "post",
      type: "demand",
      title: "Dryclean",
      description: "Need a same-day dryclean service",
      category: "Laundry",
      price: 1200,
      locationLabel: "Koramangala",
      createdAt: "2026-03-24T10:00:00.000Z",
      canonicalKey: "serviq:demand:dryclean-123",
    };

    const helpRequestItem: MarketplaceFeedItem = {
      ...postItem,
      id: "help-1",
      source: "help_request",
      title: "Dryclean pickup",
      description: "Need a dryclean service",
      locationLabel: "Indiranagar",
      createdAt: "2026-03-24T16:00:00.000Z",
    };

    const deduped = dedupeMarketplaceFeedItems([postItem, helpRequestItem]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.source).toBe("help_request");
  });
});
