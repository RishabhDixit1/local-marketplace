import { describe, expect, it } from "vitest";
import { parseIntent, buildResponse, type ParsedIntent } from "../../lib/ai/intentParser";

function intent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    action: "find_service",
    category: null,
    subcategory: null,
    urgency: null,
    location: null,
    budget: { min: null, max: null },
    keywords: [],
    originalQuery: "",
    response: "",
    intentType: null,
    confidence: 0,
    ...overrides,
  };
}

describe("extractLocation via parseIntent", () => {
  it("returns null for 'near me' phrasing", () => {
    const result = parseIntent("find a plumber near me");
    expect(result.location).toBeNull();
  });

  it("returns null for 'nearby' phrasing", () => {
    const result = parseIntent("Carpenter nearby");
    expect(result.location).toBeNull();
  });

  it("extracts a real place name", () => {
    const result = parseIntent("plumber in Crossing Republik");
    expect(result.location).toBeTruthy();
    expect(result.location!.toLowerCase()).toContain("crossing");
  });

  it("returns null when no location is mentioned", () => {
    const result = parseIntent("find a plumber");
    expect(result.location).toBeNull();
  });

  it("extracts 'Noida' from a natural query", () => {
    const result = parseIntent("AC repair in Noida");
    expect(result.location).toBe("Noida");
  });

  it("does not extract 'me' as a location", () => {
    const result = parseIntent("electrician for me");
    expect(result.location).toBeNull();
  });

  it("does not extract 'by' as a location", () => {
    const result = parseIntent("Carpenter nearby");
    expect(result.location).toBeNull();
  });
});

describe("buildResponse with actual counts", () => {
  it("shows 'no providers found' with zero count", () => {
    const response = buildResponse(intent({ action: "find_service", category: "plumber" }), 0);
    expect(response).toContain("No");
    expect(response).toContain("Plumber");
    expect(response).toContain("post a requirement");
  });

  it("shows correct count when providers found", () => {
    const response = buildResponse(intent({ action: "find_service", category: "plumber" }), 3);
    expect(response).toContain("3");
    expect(response).toContain("Plumber");
    expect(response).toContain("providers");
  });

  it("shows 'Searching' when no count provided", () => {
    const response = buildResponse(intent({ action: "find_service", category: "plumber" }));
    expect(response).toContain("Searching");
  });

  it("shows singular 'provider' for count of 1", () => {
    const response = buildResponse(intent({ action: "find_service", category: "plumber" }), 1);
    expect(response).toContain("1");
    expect(response).toContain("provider");
    expect(response).not.toContain("providers");
  });

  it("includes location when present", () => {
    const response = buildResponse(
      intent({ action: "find_service", category: "plumber", location: "Noida" }),
      2,
    );
    expect(response).toContain("Noida");
  });

  it("includes budget when present", () => {
    const response = buildResponse(
      intent({ action: "find_service", category: "plumber", budget: { min: null, max: 500 } }),
      2,
    );
    expect(response).toContain("500");
  });
});

describe("parseIntent category extraction", () => {
  it("extracts 'plumber' category", () => {
    const result = parseIntent("find a plumber near me");
    expect(result.category).toBe("plumber");
  });

  it("extracts 'carpenter' category", () => {
    const result = parseIntent("Carpenter nearby");
    expect(result.category).toBe("carpenter");
  });

  it("extracts 'electrician' category", () => {
    const result = parseIntent("need an electrician");
    expect(result.category).toBe("electrician");
  });
});
