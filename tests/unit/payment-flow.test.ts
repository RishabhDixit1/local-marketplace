import { describe, expect, it } from "vitest";
import {
  formatPaymentRailLabel,
  formatPaymentRailList,
  getCheckoutPaymentJourney,
  getOrderPaymentSummary,
} from "@/lib/paymentFlow";

describe("paymentFlow", () => {
  it("normalizes raw payment rails into human-friendly labels", () => {
    expect(formatPaymentRailLabel("upi")).toBe("UPI");
    expect(formatPaymentRailLabel("cash_on_delivery")).toBe("Cash on Delivery");
    expect(formatPaymentRailLabel("netbanking")).toBe("NetBanking");
    expect(formatPaymentRailList(["upi", "UPI", "cash", "razorpay"])).toEqual([
      "UPI",
      "Cash on Delivery",
      "Razorpay",
    ]);
  });

  it("describes pay-on-delivery flow based on fulfillment handoff", () => {
    const journey = getCheckoutPaymentJourney("cod", "courier");

    expect(journey.heading).toContain("pay at the final handoff");
    expect(journey.detail).toContain("when the courier reaches you");
    expect(journey.steps[1]).toContain("courier handoff");
  });

  it("returns a paid-online summary for verified Razorpay orders", () => {
    const summary = getOrderPaymentSummary({
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      fulfillmentMethod: "provider",
    });

    expect(summary.statusLabel).toBe("Paid");
    expect(summary.heading).toBe("Online payment confirmed.");
    expect(summary.rails).toContain("UPI");
  });

  it("returns a handoff summary for cod orders that are still pending", () => {
    const summary = getOrderPaymentSummary({
      paymentMethod: "cod",
      paymentStatus: "pending",
      fulfillmentMethod: "self",
    });

    expect(summary.statusLabel).toBe("Pay at handoff");
    expect(summary.heading).toContain("when you meet the provider");
    expect(summary.support).toContain("meetup");
  });
});
