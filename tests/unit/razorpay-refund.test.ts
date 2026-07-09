import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRazorpayPost = vi.fn();

class MockRazorpay {
  api: { post: typeof mockRazorpayPost };
  constructor() {
    this.api = { post: mockRazorpayPost };
  }
}

vi.mock("razorpay", () => ({
  default: MockRazorpay,
}));

describe("createRefund", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRazorpayPost.mockReset();
    process.env.RAZORPAY_KEY_ID = "rzp_test_refund_test";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    process.env.RAZORPAY_MODE = "test";
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_MODE;
  });

  it("returns null when razorpay is not configured", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    const { createRefund } = await import("@/lib/server/razorpay");
    const result = await createRefund("pay_test_001", 50000);
    expect(result).toBeNull();
  });

  it("returns refund id and status on success", async () => {
    mockRazorpayPost.mockResolvedValue({ id: "rfnd_test_001", status: "processed" });
    const { createRefund } = await import("@/lib/server/razorpay");
    const result = await createRefund("pay_test_001", 50000, { order_id: "order_123", reason: "Test refund" });
    expect(result).toEqual({ id: "rfnd_test_001", status: "processed" });
    expect(mockRazorpayPost).toHaveBeenCalledWith({
      url: "/payments/pay_test_001/refund",
      data: { amount: 50000, notes: { order_id: "order_123", reason: "Test refund" } },
    });
  });

  it("returns null on Razorpay API error and logs it", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRazorpayPost.mockRejectedValue(new Error("Razorpay API error"));
    const { createRefund } = await import("@/lib/server/razorpay");
    const result = await createRefund("pay_test_002", 10000);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[razorpay] Refund failed for payment",
      "pay_test_002",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("handles partial refund amounts correctly", async () => {
    mockRazorpayPost.mockResolvedValue({ id: "rfnd_partial_001", status: "processed" });
    const { createRefund } = await import("@/lib/server/razorpay");
    const result = await createRefund("pay_test_003", 25000);
    expect(result).toBeTruthy();
    expect(mockRazorpayPost).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 25000 }),
      }),
    );
  });
});
