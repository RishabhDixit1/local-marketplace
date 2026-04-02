import { describe, expect, it } from "vitest";
import { isCoordinateOnlyLocationLabel, isUsableLocationLabel, resolveCoordinatesWithAccuracy } from "../../lib/geo";

describe("resolveCoordinatesWithAccuracy", () => {
  it("marks explicit latitude and longitude as precise", () => {
    const result = resolveCoordinatesWithAccuracy({
      row: {
        latitude: 28.6139,
        longitude: 77.209,
      },
      location: "New Delhi",
      seed: "profile-1",
    });

    expect(result).toEqual({
      coordinates: {
        latitude: 28.6139,
        longitude: 77.209,
      },
      accuracy: "precise",
    });
  });

  it("falls back to approximate coordinates when exact coordinates are missing", () => {
    const result = resolveCoordinatesWithAccuracy({
      location: "Mumbai",
      seed: "profile-2",
    });

    expect(result.accuracy).toBe("approximate");
    expect(result.coordinates.latitude).toBeTypeOf("number");
    expect(result.coordinates.longitude).toBeTypeOf("number");
  });
});

describe("location labels", () => {
  it("detects raw coordinate strings", () => {
    expect(isCoordinateOnlyLocationLabel("12.93410, 77.61130")).toBe(true);
    expect(isCoordinateOnlyLocationLabel("Koramangala, Bengaluru")).toBe(false);
  });

  it("requires a readable location label", () => {
    expect(isUsableLocationLabel("Koramangala, Bengaluru")).toBe(true);
    expect(isUsableLocationLabel("12.93410, 77.61130")).toBe(false);
  });
});
