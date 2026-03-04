import { describe, expect, it } from "vitest";
import {
  canTransitionOrderStatus,
  getAllowedTransitions,
  getOrderStatusDescription,
  getOrderStatusLabel,
  getTransitionActionLabel,
  isFinalOrderStatus,
  normalizeOrderStatus,
  toTaskWorkflowStatus,
} from "../../lib/orderWorkflow";

describe("orderWorkflow", () => {
  it("normalizes aliases to canonical statuses", () => {
    expect(normalizeOrderStatus("pending")).toBe("new_lead");
    expect(normalizeOrderStatus("quote_sent")).toBe("quoted");
    expect(normalizeOrderStatus("booked")).toBe("accepted");
    expect(normalizeOrderStatus("in-progress")).toBe("in_progress");
    expect(normalizeOrderStatus("done")).toBe("completed");
    expect(normalizeOrderStatus("canceled")).toBe("cancelled");
    expect(normalizeOrderStatus("declined")).toBe("rejected");
  });

  it("falls back unknown status to new_lead", () => {
    expect(normalizeOrderStatus("unknown-status")).toBe("new_lead");
    expect(normalizeOrderStatus(null)).toBe("new_lead");
  });

  it("returns actor-specific transitions", () => {
    expect(getAllowedTransitions("new_lead", "provider")).toEqual(["quoted", "accepted", "rejected"]);
    expect(getAllowedTransitions("new_lead", "consumer")).toEqual(["cancelled"]);
  });

  it("validates transitions using canonical and alias input", () => {
    expect(
      canTransitionOrderStatus({
        from: "new_lead",
        to: "quoted",
        actor: "provider",
      })
    ).toBe(true);

    expect(
      canTransitionOrderStatus({
        from: "quote_sent",
        to: "accepted",
        actor: "consumer",
      })
    ).toBe(true);

    expect(
      canTransitionOrderStatus({
        from: "quoted",
        to: "in_progress",
        actor: "consumer",
      })
    ).toBe(false);
  });

  it("treats no-op transitions as valid", () => {
    expect(
      canTransitionOrderStatus({
        from: "accepted",
        to: "accepted",
        actor: "provider",
      })
    ).toBe(true);
  });

  it("maps final statuses correctly", () => {
    expect(isFinalOrderStatus("completed")).toBe(true);
    expect(isFinalOrderStatus("closed")).toBe(true);
    expect(isFinalOrderStatus("rejected")).toBe(true);
    expect(isFinalOrderStatus("accepted")).toBe(false);
  });

  it("maps order statuses to task workflow buckets", () => {
    expect(toTaskWorkflowStatus("new_lead")).toBe("active");
    expect(toTaskWorkflowStatus("accepted")).toBe("in-progress");
    expect(toTaskWorkflowStatus("in_progress")).toBe("in-progress");
    expect(toTaskWorkflowStatus("completed")).toBe("completed");
    expect(toTaskWorkflowStatus("cancelled")).toBe("cancelled");
  });

  it("returns labels and descriptions", () => {
    expect(getOrderStatusLabel("in_progress")).toBe("In Progress");
    expect(getOrderStatusDescription("quoted")).toBe("Provider sent quote");
  });

  it("returns actor-aware transition action labels", () => {
    expect(getTransitionActionLabel({ actor: "provider", nextStatus: "quoted" })).toBe("Send Quote");
    expect(getTransitionActionLabel({ actor: "provider", nextStatus: "closed" })).toBe("Close Order");
    expect(getTransitionActionLabel({ actor: "consumer", nextStatus: "accepted" })).toBe("Accept Quote");
    expect(getTransitionActionLabel({ actor: "consumer", nextStatus: "cancelled" })).toBe("Cancel Request");
  });
});
