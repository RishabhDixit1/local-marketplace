import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestAuthMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/server/requestAuth", () => ({
  requireRequestAuth: requireRequestAuthMock,
}));

vi.mock("@/lib/server/supabaseClients", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

const authContext = {
  ok: true as const,
  auth: {
    userId: "consumer-1",
    email: "consumer@example.com",
    accessToken: "token-1",
  },
};

const originalRazorpaySecret = process.env.RAZORPAY_KEY_SECRET;

const buildSignature = (orderId: string, paymentId: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

const makeSelectChain = <T,>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn(async () => result),
  };

  return chain;
};

const makeUpdateChain = (result: { error: { message: string } | null } = { error: null }) => {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(),
  };

  chain.eq.mockImplementationOnce(() => chain);
  chain.eq.mockImplementationOnce(async () => result);

  return chain;
};

describe("POST /api/payment/verify", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalRazorpaySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = originalRazorpaySecret;
    }
  });

  it("returns idempotent success when the same payment was already verified", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: [
        {
          id: "order-1",
          consumer_id: "consumer-1",
          status: "accepted",
          metadata: {
            payment_method: "razorpay",
            payment_status: "paid",
            razorpay_order_id: "rzp_order_1",
            razorpay_payment_id: "rzp_payment_1",
            paid_at: "2026-04-01T10:00:00.000Z",
          },
        },
      ],
      error: null,
    });

    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(selectChain),
    });

    const { POST } = await import("../../app/api/payment/verify/route");
    const response = await POST(
      new Request("http://localhost:3000/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpayOrderId: "rzp_order_1",
          razorpayPaymentId: "rzp_payment_1",
          razorpaySignature: buildSignature("rzp_order_1", "rzp_payment_1", "test-secret"),
          serviQOrderIds: ["order-1", "order-1"],
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "Payment already verified.",
      updatedOrders: 0,
      alreadyVerifiedOrders: 1,
      idempotent: true,
    });
  });

  it("merges existing order metadata and promotes quoted orders when payment is verified", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: [
        {
          id: "order-1",
          consumer_id: "consumer-1",
          status: "quoted",
          metadata: {
            source: "cart",
            title: "Deep Cleaning",
            address: "221B Baker Street, Bengaluru",
            notes: "Call on arrival",
            payment_method: "razorpay",
            payment_status: "processing",
            paid_at: "2026-04-01T08:30:00.000Z",
          },
        },
      ],
      error: null,
    });
    const updateChain = makeUpdateChain();

    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain),
    });

    const { POST } = await import("../../app/api/payment/verify/route");
    const response = await POST(
      new Request("http://localhost:3000/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpayOrderId: "rzp_order_2",
          razorpayPaymentId: "rzp_payment_2",
          razorpaySignature: buildSignature("rzp_order_2", "rzp_payment_2", "test-secret"),
          serviQOrderIds: ["order-1"],
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      message: "Payment verified.",
      updatedOrders: 1,
      alreadyVerifiedOrders: 0,
      idempotent: false,
    });

    expect(updateChain.update).toHaveBeenCalledWith({
      status: "accepted",
      metadata: expect.objectContaining({
        source: "cart",
        title: "Deep Cleaning",
        address: "221B Baker Street, Bengaluru",
        notes: "Call on arrival",
        payment_method: "razorpay",
        payment_status: "paid",
        razorpay_order_id: "rzp_order_2",
        razorpay_payment_id: "rzp_payment_2",
        paid_at: "2026-04-01T08:30:00.000Z",
      }),
    });
  });

  it("rejects payment verification when orders already point to another payment reference", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: [
        {
          id: "order-1",
          consumer_id: "consumer-1",
          status: "accepted",
          metadata: {
            payment_method: "razorpay",
            payment_status: "processing",
            razorpay_order_id: "rzp_order_other",
            razorpay_payment_id: "rzp_payment_other",
          },
        },
      ],
      error: null,
    });

    const fromMock = vi.fn().mockReturnValueOnce(selectChain);
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const { POST } = await import("../../app/api/payment/verify/route");
    const response = await POST(
      new Request("http://localhost:3000/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpayOrderId: "rzp_order_3",
          razorpayPaymentId: "rzp_payment_3",
          razorpaySignature: buildSignature("rzp_order_3", "rzp_payment_3", "test-secret"),
          serviQOrderIds: ["order-1"],
        }),
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "PAYMENT_CONFLICT",
      message: "These orders are already linked to a different payment reference.",
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
