import { describe, expect, it } from "vitest";
import {
  calculateProviderListingsStats,
  formatServicePriceLabel,
  formatServicePricingTypeLabel,
  normalizeProductDraft,
  normalizeServicePricingType,
  normalizeServiceDraft,
  validateProductDraft,
  validateServiceDraft,
} from "../../lib/provider/listings";
import {
  isCreateProviderListingRequest,
  isDeleteProviderListingRequest,
  isUpdateProviderListingRequest,
} from "../../lib/server/providerListings";

describe("provider listings domain helpers", () => {
  it("normalizes and validates service drafts", () => {
    const draft = normalizeServiceDraft({
      title: "  Home AC Repair  ",
      description: "Quick diagnostics and same-day repair.",
      category: "Repairs",
      price: 899,
      availability: "busy",
      pricingType: "hourly",
    });

    expect(draft.title).toBe("Home AC Repair");
    expect(draft.availability).toBe("busy");
    expect(validateServiceDraft(draft)).toEqual({});
  });

  it("supports starting, hourly, and quote pricing labels", () => {
    expect(normalizeServicePricingType("negotiable")).toBe("quote");
    expect(formatServicePricingTypeLabel("starting_at")).toBe("Starting price");
    expect(formatServicePriceLabel(650, "hourly")).toBe("INR 650/hr");
    expect(formatServicePriceLabel(0, "quote")).toBe("Quote on request");
  });

  it("rejects invalid product drafts", () => {
    const draft = normalizeProductDraft({
      title: "A",
      price: -5,
      stock: -2,
      deliveryMethod: "invalid" as never,
      imageUrl: "notaurl",
    });

    const errors = validateProductDraft(draft);
    expect(errors.title).toMatch(/at least 2 characters/i);
    expect(errors.price).toMatch(/non-negative/i);
    expect(errors.stock).toMatch(/non-negative/i);
    expect(errors.imageUrl).toMatch(/valid public .*listing-images.*url\/path/i);
  });

  it("computes listing stats from normalized rows", () => {
    const stats = calculateProviderListingsStats(
      [
        {
          id: "service-1",
          providerId: "provider-1",
          title: "Service one",
          description: "",
          category: "Service",
          price: 100,
          availability: "available",
          pricingType: "fixed",
          createdAt: null,
          updatedAt: null,
          metadata: {},
        },
        {
          id: "service-2",
          providerId: "provider-1",
          title: "Service two",
          description: "",
          category: "Service",
          price: 200,
          availability: "offline",
          pricingType: "fixed",
          createdAt: null,
          updatedAt: null,
          metadata: {},
        },
      ],
      [
        {
          id: "product-1",
          providerId: "provider-1",
          title: "Product one",
          description: "",
          category: "Product",
          price: 500,
          stock: 0,
          deliveryMethod: "pickup",
          imageUrl: "",
          createdAt: null,
          updatedAt: null,
          metadata: {},
        },
        {
          id: "product-2",
          providerId: "provider-1",
          title: "Product two",
          description: "",
          category: "Product",
          price: 650,
          stock: 3,
          deliveryMethod: "pickup",
          imageUrl: "",
          createdAt: null,
          updatedAt: null,
          metadata: {},
        },
      ]
    );

    expect(stats).toEqual({
      totalServices: 2,
      activeServices: 1,
      totalProducts: 2,
      activeProducts: 1,
    });
  });
});

describe("provider listings request guards", () => {
  it("accepts valid create payloads", () => {
    expect(
      isCreateProviderListingRequest({
        listingType: "service",
        values: { title: "Service title" },
      })
    ).toBe(true);
  });

  it("accepts valid update payloads", () => {
    expect(
      isUpdateProviderListingRequest({
        listingType: "product",
        listingId: "listing-1",
        values: { title: "Product title" },
      })
    ).toBe(true);
  });

  it("accepts valid delete payloads", () => {
    expect(
      isDeleteProviderListingRequest({
        listingType: "service",
        listingId: "listing-1",
      })
    ).toBe(true);
  });
});
