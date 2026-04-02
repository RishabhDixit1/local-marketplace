import { describe, expect, it } from "vitest";
import { resolveCoordinatesWithAccuracy } from "../../lib/geo";

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
