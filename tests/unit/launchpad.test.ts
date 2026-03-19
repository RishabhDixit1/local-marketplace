import { describe, expect, it } from "vitest";
import { generateLaunchpadDraftOutput } from "../../lib/launchpad/generate";
import { normalizeLaunchpadAnswers, validateLaunchpadAnswers } from "../../lib/launchpad/validation";

describe("launchpad validation", () => {
  it("normalizes launchpad answers and sanitizes contact fields", () => {
    const normalized = normalizeLaunchpadAnswers({
      businessName: "  Nisha Studio  ",
      businessType: " Boutique bakery ",
      offeringType: "hybrid",
      primaryCategory: " Desserts ",
      location: " Delhi ",
      serviceArea: "South Delhi, Gurgaon",
      serviceRadiusKm: 18.4,
      shortDescription: "  Custom cakes and dessert tables for birthdays, gifting, and weddings.  ",
      coreOfferings: "Custom cakes, Dessert tables",
      catalogText: "",
      pricingNotes: "Starting at INR 2499",
      hours: "Mon-Sat 10am-8pm",
      phone: "99999 99999",
      website: "nishastudio.example",
      brandTone: "premium",
    });

    expect(normalized.businessName).toBe("Nisha Studio");
    expect(normalized.serviceRadiusKm).toBe(18);
    expect(normalized.phone).toBe("+19999999999");
    expect(normalized.website).toBe("https://nishastudio.example");
  });

  it("flags missing required fields", () => {
    const errors = validateLaunchpadAnswers(
      normalizeLaunchpadAnswers({
        businessName: "",
        businessType: "",
        primaryCategory: "",
        location: "",
        serviceArea: "",
        shortDescription: "too short",
        coreOfferings: "",
      })
    );

    expect(errors.businessName).toMatch(/required/i);
    expect(errors.shortDescription).toMatch(/at least 24 characters/i);
    expect(errors.coreOfferings).toMatch(/at least one core offering/i);
  });
});

describe("launchpad generation", () => {
  it("creates service packs, FAQ, and service areas for service businesses", () => {
    const output = generateLaunchpadDraftOutput(
      normalizeLaunchpadAnswers({
        businessName: "Aarav Home Repair",
        businessType: "Home repair studio",
        offeringType: "services",
        primaryCategory: "Repairs",
        location: "Bengaluru",
        serviceArea: "Indiranagar, Koramangala, HSR Layout",
        serviceRadiusKm: 12,
        shortDescription: "Fast, trustworthy repairs for apartments, villas, and small offices.",
        coreOfferings: "AC repair, Electrical diagnostics, Preventive maintenance",
        catalogText: "AC repair - INR 1499\nElectrical diagnostics - INR 899",
        pricingNotes: "Most visits start at INR 799",
        hours: "Mon-Sat, 9am-7pm",
        phone: "+919999999999",
        website: "https://aaravrepair.example",
        brandTone: "fast",
      })
    );

    expect(output.generatedProfile.fullName).toBe("Aarav Home Repair");
    expect(output.generatedServices.length).toBeGreaterThan(1);
    expect(output.generatedProducts).toHaveLength(0);
    expect(output.generatedFaq.length).toBeGreaterThanOrEqual(4);
    expect(output.generatedServiceAreas).toContain("Indiranagar");
  });

  it("creates product packs when launchpad runs in product mode", () => {
    const output = generateLaunchpadDraftOutput(
      normalizeLaunchpadAnswers({
        businessName: "Studio Pantry",
        businessType: "Snack brand",
        offeringType: "products",
        primaryCategory: "Snacks",
        location: "Mumbai",
        serviceArea: "Bandra, Santacruz",
        serviceRadiusKm: 8,
        shortDescription: "Freshly packed snack boxes and gift tins for local delivery.",
        coreOfferings: "Gift tins, Party snack boxes",
        catalogText: "Party snack box - INR 699\nGift tin - INR 1199",
        pricingNotes: "",
        hours: "Daily, 10am-8pm",
        phone: "",
        website: "",
        brandTone: "friendly",
      })
    );

    expect(output.generatedServices).toHaveLength(0);
    expect(output.generatedProducts.length).toBeGreaterThan(0);
    expect(output.generatedProducts[0]?.price).toBe(699);
  });
});
