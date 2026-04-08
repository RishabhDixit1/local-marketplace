import { describe, expect, it } from "vitest";
import { buildMarketplaceComposerMetadata, readMarketplaceComposerMetadata } from "../../lib/marketplaceMetadata";
import type { PublishPayloadBase } from "../../lib/api/publish";

const basePayload: PublishPayloadBase = {
  title: "Need same-day laundry pickup",
  details: "Collect three bags and return by evening.",
  category: "Cleaning",
  budget: 800,
  locationLabel: "Indiranagar",
  radiusKm: 8,
  mode: "urgent",
  neededWithin: "Within 24 hours",
  scheduleDate: "",
  scheduleTime: "",
  flexibleTiming: true,
  media: [],
};

describe("marketplace composer metadata", () => {
  it("keeps text-only need posts canonical without media attachments", () => {
    const metadata = buildMarketplaceComposerMetadata(basePayload, "need");

    expect(metadata).toMatchObject({
      source: "serviq_compose",
      postType: "need",
      title: "Need same-day laundry pickup",
      attachmentCount: 0,
      media: [],
    });
    expect(metadata.publishGroupKey).toContain("serviq:need:");
  });

  it("preserves uploaded image media for need posts", () => {
    const metadata = buildMarketplaceComposerMetadata(
      {
        ...basePayload,
        media: [
          {
            name: "front.jpg",
            url: "https://cdn.example.com/front.jpg",
            type: "image/jpeg",
          },
          {
            name: "detail.png",
            url: "https://cdn.example.com/detail.png",
            type: "image/png",
          },
        ],
      },
      "need"
    );

    expect(metadata.attachmentCount).toBe(2);
    expect(metadata.media).toEqual([
      {
        name: "front.jpg",
        url: "https://cdn.example.com/front.jpg",
        type: "image/jpeg",
      },
      {
        name: "detail.png",
        url: "https://cdn.example.com/detail.png",
        type: "image/png",
      },
    ]);
  });

  it("round-trips service posts with media through the canonical metadata schema", () => {
    const metadata = buildMarketplaceComposerMetadata(
      {
        ...basePayload,
        title: "AC deep-clean service",
        details: "Indoor and outdoor unit cleaning with filter wash.",
        category: "AC Repair",
        media: [
          {
            name: "service-shot.webp",
            url: "https://cdn.example.com/service-shot.webp",
            type: "image/webp",
          },
        ],
      },
      "service"
    );

    expect(readMarketplaceComposerMetadata(metadata)).toEqual(metadata);
  });

  it("keeps product posts valid when they publish without media", () => {
    const metadata = buildMarketplaceComposerMetadata(
      {
        ...basePayload,
        title: "Study chair in good condition",
        details: "Solid wood chair with light wear.",
        category: "Other",
        budget: 2200,
      },
      "product"
    );

    expect(readMarketplaceComposerMetadata(metadata)).toMatchObject({
      postType: "product",
      title: "Study chair in good condition",
      attachmentCount: 0,
      media: [],
      budget: 2200,
    });
  });
});
