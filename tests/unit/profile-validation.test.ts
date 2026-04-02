import { describe, expect, it } from "vitest";
import { validateProfileValues } from "../../lib/profile/validation";
import type { ProfileFormValues } from "../../lib/profile/types";

const baseValues: ProfileFormValues = {
  fullName: "Aarav Sharma",
  location: "Koramangala, Bengaluru",
  latitude: 12.9341,
  longitude: 77.6113,
  role: "provider",
  bio: "Reliable local services for homes, offices, and urgent visits across nearby neighborhoods.",
  interests: ["AC repair"],
  email: "aarav@example.com",
  phone: "9999999999",
  website: "https://aarav.example",
  avatarUrl: "https://example.com/avatar.jpg",
  backgroundImageUrl: "https://example.com/cover.jpg",
  availability: "available",
};

describe("validateProfileValues", () => {
  it("accepts a readable location label", () => {
    expect(validateProfileValues(baseValues, { mode: "submit" })).toEqual({});
  });

  it("rejects raw GPS coordinates as the location label", () => {
    const errors = validateProfileValues(
      {
        ...baseValues,
        location: "12.93410, 77.61130",
      },
      { mode: "submit" }
    );

    expect(errors.location).toMatch(/readable area or city name/i);
  });
});
