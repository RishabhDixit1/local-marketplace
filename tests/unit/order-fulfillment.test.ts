import { describe, expect, it } from "vitest";
import {
  getFulfillmentMinimumLength,
  getOrderFulfillmentOption,
  recommendOrderFulfillmentMethod,
} from "../../lib/orderFulfillment";

describe("order fulfillment helpers", () => {
  it("recommends self pickup for pickup-only product carts", () => {
    expect(
      recommendOrderFulfillmentMethod([
        { itemType: "product", deliveryMethod: "pickup" },
        { itemType: "product", deliveryMethod: "pickup" },
      ])
    ).toBe("self");
  });

  it("recommends provider fulfillment when services are present", () => {
    expect(
      recommendOrderFulfillmentMethod([
        { itemType: "service" },
        { itemType: "product", deliveryMethod: "both" },
      ])
    ).toBe("provider");
  });

  it("returns a stable fallback option description", () => {
    expect(getOrderFulfillmentOption("unknown")).toMatchObject({
      id: "provider",
      label: "Provider handles delivery",
    });
  });

  it("uses shorter meeting-point validation for self pickup", () => {
    expect(getFulfillmentMinimumLength("self")).toBe(5);
    expect(getFulfillmentMinimumLength("provider")).toBe(10);
  });
});
