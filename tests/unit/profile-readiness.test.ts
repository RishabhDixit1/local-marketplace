import { describe, expect, it } from "vitest";
import { createMarketplaceReadinessSummary } from "../../lib/profile/readiness";

describe("createMarketplaceReadinessSummary", () => {
  it("guides providers toward publishing a first listing", () => {
    const summary = createMarketplaceReadinessSummary({
      profile: {
        full_name: "Aarav Local",
        location: "Bengaluru",
        role: "provider",
        bio: "Trusted home repair specialist serving nearby neighborhoods with fast turnaround.",
        interests: ["AC repair", "Home maintenance"],
        email: "aarav@example.com",
        phone: "+15551234567",
        avatar_url: "https://example.com/avatar.png",
      },
      providerServicesCount: 0,
      providerProductsCount: 0,
    });

    expect(summary.stage).toBe("momentum");
    expect(summary.headline).toMatch(/bookable storefront/i);
    expect(summary.actions[0]?.href).toBe("/dashboard/provider/add-service");
  });

  it("pushes seekers toward posting a need when matches already exist", () => {
    const summary = createMarketplaceReadinessSummary({
      profile: {
        full_name: "Riya Buyer",
        location: "Mumbai",
        role: "seeker",
        bio: "Looking for reliable weekly meal prep and event dessert support nearby.",
        interests: ["Meal prep", "Desserts"],
        email: "riya@example.com",
        avatar_url: "https://example.com/avatar.png",
      },
      seekerPostsCount: 0,
      matchingProvidersCount: 5,
    });

    expect(summary.stage).toBe("momentum");
    expect(summary.description).toMatch(/5 nearby providers/i);
    expect(summary.actions.some((action) => action.href === "/dashboard?compose=1")).toBe(true);
  });

  it("marks mature provider profiles as market ready", () => {
    const summary = createMarketplaceReadinessSummary({
      profile: {
        full_name: "Nisha Studio",
        location: "Delhi",
        role: "business",
        bio: "Boutique baking studio creating celebration cakes, dessert tables, and custom gift boxes for local events.",
        interests: ["Custom cakes", "Dessert tables", "Gift boxes"],
        email: "hello@nishastudio.example",
        phone: "+919999999999",
        website: "https://nishastudio.example",
        avatar_url: "https://example.com/logo.png",
      },
      providerServicesCount: 2,
      providerProductsCount: 2,
    });

    expect(summary.stage).toBe("market-ready");
    expect(summary.actions[0]?.href).toBe("/dashboard/provider/orders");
  });
});
