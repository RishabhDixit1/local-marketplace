import { describe, expect, it } from "vitest";
import { calculateVerificationStatus, verificationLabel } from "../../lib/business";

describe("business trust helpers", () => {
  it("marks strongly verified providers as verified", () => {
    expect(
      calculateVerificationStatus({
        role: "business",
        verificationLevel: "kyc",
        profileCompletion: 82,
        listingsCount: 3,
        averageRating: 4.8,
        reviewCount: 7,
        completedJobs: 22,
      })
    ).toBe("verified");
  });

  it("keeps active providers pending until stronger verification exists", () => {
    expect(
      calculateVerificationStatus({
        role: "provider",
        profileCompletion: 88,
        listingsCount: 2,
        averageRating: 4.9,
        reviewCount: 5,
        completedJobs: 16,
      })
    ).toBe("pending");
  });

  it("leaves empty profiles unclaimed", () => {
    expect(
      calculateVerificationStatus({
        role: "seeker",
        profileCompletion: 20,
        listingsCount: 0,
        averageRating: 0,
        reviewCount: 0,
        completedJobs: 0,
      })
    ).toBe("unclaimed");
    expect(verificationLabel("unclaimed")).toBe("Unclaimed profile");
  });
});
