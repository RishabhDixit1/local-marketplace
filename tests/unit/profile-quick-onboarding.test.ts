import { describe, expect, it } from "vitest";
import { PROFILE_BIO_MIN_LENGTH, type ProfileRecord } from "../../lib/profile/types";
import {
  createProfileSavePayload,
  createQuickOnboardingProfileValues,
  getQuickOnboardingStoredRole,
  isProfileOnboardingComplete,
} from "../../lib/profile/utils";

describe("quick onboarding profile save values", () => {
  it("builds a completion-safe payload for a first-time user", () => {
    const values = createQuickOnboardingProfileValues({
      profile: null,
      email: "riya@example.com",
      fullName: "Riya Local",
      location: "Bengaluru",
      latitude: null,
      longitude: null,
      phone: "9999999999",
      roleChoice: "both",
      includeFallbackBio: true,
    });

    expect(values.role).toBe("provider");
    expect(values.email).toBe("riya@example.com");
    expect(values.bio.length).toBeGreaterThanOrEqual(PROFILE_BIO_MIN_LENGTH);
    expect(
      isProfileOnboardingComplete({
        full_name: values.fullName,
        location: values.location,
        phone: values.phone,
      })
    ).toBe(true);

    const payload = createProfileSavePayload({
      user: { id: "user-1", email: "riya@example.com" },
      values,
      existingProfile: null,
      storedRole: getQuickOnboardingStoredRole("both"),
      metadataPatch: { onboardingRoleChoice: "both" },
    }) as Record<string, unknown>;

    expect(payload.role).toBe("business");
    expect(payload.onboarding_completed).toBe(true);
    expect(payload.bio).toBe(values.bio);
    expect((payload.metadata as Record<string, unknown>).onboardingRoleChoice).toBe("both");
  });

  it("preserves an existing profile bio instead of replacing it", () => {
    const existingProfile = {
      id: "user-1",
      full_name: "Aarav",
      name: "Aarav",
      location: "Mumbai",
      role: "provider",
      bio: "I already wrote a detailed public profile summary for nearby customers.",
      interests: [],
      services: [],
      email: "aarav@example.com",
      phone: null,
      website: null,
      avatar_url: null,
      availability: "available",
      metadata: {},
    } as unknown as ProfileRecord;

    const values = createQuickOnboardingProfileValues({
      profile: existingProfile,
      email: "aarav@example.com",
      fullName: "Aarav",
      location: "Mumbai",
      latitude: null,
      longitude: null,
      phone: "9888888888",
      roleChoice: "provider",
      includeFallbackBio: true,
    });

    expect(values.bio).toBe(existingProfile.bio);
  });

  it("leaves bio empty on the first save attempt when the profile has no bio", () => {
    const values = createQuickOnboardingProfileValues({
      profile: null,
      email: "new@example.com",
      fullName: "New Member",
      location: "Delhi",
      latitude: null,
      longitude: null,
      phone: "9777777777",
      roleChoice: "user",
    });

    expect(values.bio).toBe("");
  });
});
